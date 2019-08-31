// Attribution: Adapted from https://github.com/creationix/jsonparse under MIT license
// Copyright (c) 2012 Tim Caswell

// import {assert} from '@loaders.gl/core';

/* global Buffer */
// Tokens: Named constants with unique integer values
// Input stream is first tokenized, then tokens are parsed by state machine
export const TOKEN = {
  LEFT_BRACE: 0x1,
  RIGHT_BRACE: 0x2,
  LEFT_BRACKET: 0x3,
  RIGHT_BRACKET: 0x4,
  COLON: 0x5,
  COMMA: 0x6,
  TRUE: 0x7,
  FALSE: 0x8,
  NULL: 0x9,
  STRING: 0xa,
  NUMBER: 0xb,
  // Tokenizer States
  START: 0x11,
  STOP: 0x12,
  TRUE1: 0x21,
  TRUE2: 0x22,
  TRUE3: 0x23,
  FALSE1: 0x31,
  FALSE2: 0x32,
  FALSE3: 0x33,
  FALSE4: 0x34,
  NULL1: 0x41,
  NULL2: 0x42,
  NULL3: 0x43,
  NUMBER1: 0x51,
  NUMBER3: 0x53,
  STRING1: 0x61,
  STRING2: 0x62,
  STRING3: 0x63,
  STRING4: 0x64,
  STRING5: 0x65,
  STRING6: 0x66
};

// Parser States
const STATE = {
  VALUE: 0x71,
  KEY: 0x72
};
// Parser Modes
const MODE = {
  NONE: 0x80,
  OBJECT: 0x81,
  ARRAY: 0x82
};

// Character constants
const BACK_SLASH = '\\'.charCodeAt(0);
const FORWARD_SLASH = '/'.charCodeAt(0);
const BACKSPACE = '\b'.charCodeAt(0);
const FORM_FEED = '\f'.charCodeAt(0);
const NEWLINE = '\n'.charCodeAt(0);
const CARRIAGE_RETURN = '\r'.charCodeAt(0);
const TAB = '\t'.charCodeAt(0);

// Max string size = 64K
const STRING_BUFFER_SIZE = 64 * 1024;

const DEFAULT_PROPS = {
  maxStringLength: STRING_BUFFER_SIZE,
  onValue: () => {},
  onToken: () => {}, // Mainly for testing
  onError: error => {
    throw error;
  }
};

export default class JSONParser {
  constructor(props) {
    this.props = {...DEFAULT_PROPS, ...props};

    this.stringBuffer = new Uint8Array(this.props.maxStringLength);
    this.stringBufferOffset = 0;

    // Lexer state
    this.tState = TOKEN.START;
    this.unicode = null; // unicode escapes
    this.highSurrogate = null;
    // this.textEncoder = new TextEncoder();

    this.value = undefined;
    this.string = undefined; // string data

    // Parser state
    this.key = undefined;
    this.mode = MODE.NONE;
    this.stack = [];
    this.state = STATE.VALUE;

    this.bytesRemaining = 0; // number of bytes remaining in multi byte utf8 char to read after split boundary
    this.bytesInSequence = 0; // bytes in multi byte utf8 char to read
    this.tempBuffers = {'2': new Buffer(2), '3': new Buffer(3), '4': new Buffer(4)}; // for rebuilding chars split before boundary is reached

    // Stream offset, tracks the current character position in stream for Error reporting
    // TODO - count (unescaped) newlines
    this.offset = -1;
  }

  // Note: This parser works best on binary data
  // Since this parser builds in UTF8 handling, it needs to convert strings to binary before parsing
  write(buffer) {
    if (typeof buffer === 'string') {
      // const textEncoder = new TextEncoder();
      // buffer = textEncoder.encoder(buffer);
    }
    return this._tokenize(buffer);
  }

  // PRIVATE

  _push() {
    this.stack.push({value: this.value, key: this.key, mode: this.mode});
  }

  _pop() {
    const value = this.value;
    const parent = this.stack.pop();
    this.value = parent.value;
    this.key = parent.key;
    this.mode = parent.mode;
    this._emit(value);
    if (this.mode === MODE.NONE) {
      this.state = STATE.VALUE;
    }
  }

  _emit(value) {
    if (this.mode !== MODE.NONE) {
      this.state = TOKEN.COMMA;
    }
    this.props.onValue(value);
  }

  // Slow code to string converter (only used when throwing syntax errors)
  _getTokenName(code) {
    for (const key of Object.keys(TOKEN)) {
      if (TOKEN[key] === code) {
        return key;
      }
    }
    return code && `0x${code.toString(16)}`;
  }

  // Parse error: illegal TOKEN found
  _parserError(token, value) {
    this.tState = TOKEN.STOP;
    const printValue = value ? `(${JSON.stringify(value)})` : '';
    this.props.onError(
      new Error(
        `JSON: Unexpected ${this._getTokenName(token)} ${printValue} in state ${this._getTokenName(
          this.state
        )}`
      )
    );
  }

  // Lexer error: illegal character found
  _lexerError(buffer, i) {
    this.tState = TOKEN.STOP;
    const charName = JSON.stringify(String.fromCharCode(buffer[i]));
    this.props.onError(
      new Error(
        `JSON: Unexpected ${charName} at position ${i} in state ${this._getTokenName(this.tState)}`
      )
    );
  }

  // Build up a string, character by character
  _appendCharToString(char) {
    if (this.stringBufferOffset >= this.stringBuffer.byteLength) {
      // const textDecoder = new TextDecoder();
      // this.string = textDecoder.decode(this.stringBuffer);
      this.stringBufferOffset = 0;
    }

    this.stringBuffer[this.stringBufferOffset++] = char;
  }

  _appendStringToString(string) {
    this._appendBufferToString(new Buffer(string));
  }

  // Build up a string by a buffer range
  _appendBufferToString(buf, start, end) {
    let size = buf.length;
    if (typeof start === 'number') {
      if (typeof end === 'number') {
        if (end < 0) {
          // adding a negative end decreeses the size
          size = buf.length - start + end;
        } else {
          size = end - start;
        }
      } else {
        size = buf.length - start;
      }
    }

    if (size < 0) {
      size = 0;
    }

    if (this.stringBufferOffset + size > this.stringBuffer.byteLength) {
      const bytesToDecode = new Uint8Array(this.stringBuffer, this.stringBufferOffset);
      this.string += this.textDecoder(bytesToDecode, {stream: true});
      this.stringBufferOffset = 0;
    }

    // TODO
    this.stringBuffer.set(this.stringBuffer, this.stringBufferOffset + start, end);
    this.stringBufferOffset += size;
  }

  _getString() {
    const bytesToDecode = new Uint8Array(this.stringBuffer, this.stringBufferOffset);
    // finalizes decoding
    this.string += this.textDecoder.decode(bytesToDecode, {stream: false});
    this.stringBufferOffset = 0;
  }

  // Adds character and tokenizes them
  // Calls _processToken whenever a token is found
  // eslint-disable-next-line complexity, max-statements
  _tokenize(buffer) {
    let n;
    for (let i = 0; i < buffer.length; i++) {
      if (this.tState === TOKEN.START) {
        n = buffer[i];
        this.offset++;
        if (n === 0x7b) {
          this._processToken(TOKEN.LEFT_BRACE, '{'); // {
        } else if (n === 0x7d) {
          this._processToken(TOKEN.RIGHT_BRACE, '}'); // }
        } else if (n === 0x5b) {
          this._processToken(TOKEN.LEFT_BRACKET, '['); // [
        } else if (n === 0x5d) {
          this._processToken(TOKEN.RIGHT_BRACKET, ']'); // ]
        } else if (n === 0x3a) {
          this._processToken(TOKEN.COLON, ':'); // :
        } else if (n === 0x2c) {
          this._processToken(TOKEN.COMMA, ','); // ,
        } else if (n === 0x74) {
          this.tState = TOKEN.TRUE1; // t
        } else if (n === 0x66) {
          this.tState = TOKEN.FALSE1; // f
        } else if (n === 0x6e) {
          this.tState = TOKEN.NULL1; // n
        } else if (n === 0x22) {
          // "
          this.string = '';
          this.stringBufferOffset = 0;
          this.tState = TOKEN.STRING1;
        } else if (n === 0x2d) {
          this.string = '-';
          this.tState = TOKEN.NUMBER1; // -
        } else {
          // eslint-disable-next-line max-depth, no-lonely-if
          if (n >= 0x30 && n < 0x40) {
            // 1-9
            this.string = String.fromCharCode(n);
            this.tState = TOKEN.NUMBER3;
          } else if (n === 0x20 || n === 0x09 || n === 0x0a || n === 0x0d) {
            // whitespace
          } else {
            return this._lexerError(buffer, i);
          }
        }
      } else if (this.tState === TOKEN.STRING1) {
        // After open quote
        n = buffer[i]; // get current byte from buffer
        // check for carry over of a multi byte char split between data chunks
        // & fill temp buffer it with start of this data chunk up to the boundary limit set in the last iteration
        if (this.bytesRemaining > 0) {
          // eslint-disable-next-line
          for (var j = 0; j < this.bytesRemaining; j++) {
            this.tempBuffers[this.bytesInSequence][this.bytesInSequence - this.bytesRemaining + j] =
              buffer[j];
          }

          this._appendBufferToString(this.tempBuffers[this.bytesInSequence]);
          this.bytesInSequence = this.bytesRemaining = 0;
          // eslint-disable-next-line block-scoped-var
          i = i + j - 1;
        } else if (this.bytesRemaining === 0 && n >= 128) {
          // else if no remainder bytes carried over, parse multi byte (>=128) chars one at a time
          if (n <= 193 || n > 244) {
            return this.props.onError(
              new Error(
                `JSON: Invalid UTF-8 character at position ${i} in state ${this._getTokenName(
                  this.tState
                )}`
              )
            );
          }
          if (n >= 194 && n <= 223) this.bytesInSequence = 2;
          if (n >= 224 && n <= 239) this.bytesInSequence = 3;
          if (n >= 240 && n <= 244) this.bytesInSequence = 4;
          if (this.bytesInSequence + i > buffer.length) {
            // if bytes needed to complete char fall outside buffer length, we have a boundary split
            for (let k = 0; k <= buffer.length - 1 - i; k++) {
              this.tempBuffers[this.bytesInSequence][k] = buffer[i + k]; // fill temp buffer of correct size with bytes available in this chunk
            }
            this.bytesRemaining = i + this.bytesInSequence - buffer.length;
            i = buffer.length - 1;
          } else {
            this._appendBufferToString(buffer, i, i + this.bytesInSequence);
            i = i + this.bytesInSequence - 1;
          }
        } else if (n === 0x22) {
          this.tState = TOKEN.START;
          this.string = this._completeString();
          // TODO - convertToString
          // eslint-disable-next-line
          this.string += convertToString(this.stringBuffer, 0, this.stringBufferOffset);
          this.string += this.stringBuffer.toString('utf8', 0, this.stringBufferOffset);
          this.stringBufferOffset = 0;
          this._processToken(TOKEN.STRING, this.string);
          this.offset += Buffer.byteLength(this.string, 'utf8') + 1;
          this.string = undefined;
        } else if (n === 0x5c) {
          this.tState = TOKEN.STRING2;
        } else if (n >= 0x20) {
          this._appendCharToString(n);
        } else {
          return this._lexerError(buffer, i);
        }
      } else if (this.tState === TOKEN.STRING2) {
        // After backslash
        n = buffer[i];
        if (n === 0x22) {
          this._appendCharToString(n);
          this.tState = TOKEN.STRING1;
        } else if (n === 0x5c) {
          this._appendCharToString(BACK_SLASH);
          this.tState = TOKEN.STRING1;
        } else if (n === 0x2f) {
          this._appendCharToString(FORWARD_SLASH);
          this.tState = TOKEN.STRING1;
        } else if (n === 0x62) {
          this._appendCharToString(BACKSPACE);
          this.tState = TOKEN.STRING1;
        } else if (n === 0x66) {
          this._appendCharToString(FORM_FEED);
          this.tState = TOKEN.STRING1;
        } else if (n === 0x6e) {
          this._appendCharToString(NEWLINE);
          this.tState = TOKEN.STRING1;
        } else if (n === 0x72) {
          this._appendCharToString(CARRIAGE_RETURN);
          this.tState = TOKEN.STRING1;
        } else if (n === 0x74) {
          this._appendCharToString(TAB);
          this.tState = TOKEN.STRING1;
        } else if (n === 0x75) {
          this.unicode = '';
          this.tState = TOKEN.STRING3;
        } else {
          return this._lexerError(buffer, i);
        }
      } else if (
        this.tState === TOKEN.STRING3 ||
        this.tState === TOKEN.STRING4 ||
        this.tState === TOKEN.STRING5 ||
        this.tState === TOKEN.STRING6
      ) {
        // unicode hex codes
        n = buffer[i];
        // 0-9 A-F a-f
        if ((n >= 0x30 && n < 0x40) || (n > 0x40 && n <= 0x46) || (n > 0x60 && n <= 0x66)) {
          this.unicode += String.fromCharCode(n);
          if (this.tState++ === TOKEN.STRING6) {
            const intVal = parseInt(this.unicode, 16);
            this.unicode = null;
            if (this.highSurrogate && intVal >= 0xdc00 && intVal < 0xdfff + 1) {
              // <56320,57343> - lowSurrogate
              this._appendStringToString(
                new Buffer(String.fromCharCode(this.highSurrogate, intVal))
              );
              this.highSurrogate = null;
            } else if (!this.highSurrogate && intVal >= 0xd800 && intVal < 0xdbff + 1) {
              // <55296,56319> - highSurrogate
              this.highSurrogate = intVal;
            } else {
              if (this.highSurrogate) {
                this._appendBufferToString(new Buffer(String.fromCharCode(this.highSurrogate)));
                this.highSurrogate = null;
              }
              this._appendBufferToString(new Buffer(String.fromCharCode(intVal)));
            }
            this.tState = TOKEN.STRING1;
          }
        } else {
          return this._lexerError(buffer, i);
        }
      } else if (this.tState === TOKEN.NUMBER1 || this.tState === TOKEN.NUMBER3) {
        n = buffer[i];

        switch (n) {
          case 0x30: // 0
          case 0x31: // 1
          case 0x32: // 2
          case 0x33: // 3
          case 0x34: // 4
          case 0x35: // 5
          case 0x36: // 6
          case 0x37: // 7
          case 0x38: // 8
          case 0x39: // 9
          case 0x2e: // .
          case 0x65: // e
          case 0x45: // E
          case 0x2b: // +
          case 0x2d: // -
            this.string += String.fromCharCode(n);
            this.tState = TOKEN.NUMBER3;
            break;
          default:
            this.tState = TOKEN.START;
            const result = Number(this.string);

            if (isNaN(result)) {
              return this._lexerError(buffer, i);
            }

            // eslint-disable-next-line eqeqeq
            if (this.string.match(/[0-9]+/) == this.string && result.toString() != this.string) {
              // Long string of digits which is an ID string and not valid and/or safe JavaScript integer Number
              this._processToken(TOKEN.STRING, this.string);
            } else {
              this._processToken(TOKEN.NUMBER, result);
            }

            this.offset += this.string.length - 1;
            this.string = undefined;
            i--;
            break;
        }
      } else if (this.tState === TOKEN.TRUE1) {
        // r
        if (buffer[i] === 0x72) {
          this.tState = TOKEN.TRUE2;
        } else {
          return this._lexerError(buffer, i);
        }
      } else if (this.tState === TOKEN.TRUE2) {
        // u
        if (buffer[i] === 0x75) {
          this.tState = TOKEN.TRUE3;
        } else {
          return this._lexerError(buffer, i);
        }
      } else if (this.tState === TOKEN.TRUE3) {
        // e
        if (buffer[i] === 0x65) {
          this.tState = TOKEN.START;
          this._processToken(TOKEN.TRUE, true);
          this.offset += 3;
        } else {
          return this._lexerError(buffer, i);
        }
      } else if (this.tState === TOKEN.FALSE1) {
        // a
        if (buffer[i] === 0x61) {
          this.tState = TOKEN.FALSE2;
        } else {
          return this._lexerError(buffer, i);
        }
      } else if (this.tState === TOKEN.FALSE2) {
        // l
        if (buffer[i] === 0x6c) {
          this.tState = TOKEN.FALSE3;
        } else {
          return this._lexerError(buffer, i);
        }
      } else if (this.tState === TOKEN.FALSE3) {
        // s
        if (buffer[i] === 0x73) {
          this.tState = TOKEN.FALSE4;
        } else {
          return this._lexerError(buffer, i);
        }
      } else if (this.tState === TOKEN.FALSE4) {
        // e
        if (buffer[i] === 0x65) {
          this.tState = TOKEN.START;
          this._processToken(TOKEN.FALSE, false);
          this.offset += 4;
        } else {
          return this._lexerError(buffer, i);
        }
      } else if (this.tState === TOKEN.NULL1) {
        // u
        if (buffer[i] === 0x75) {
          this.tState = TOKEN.NULL2;
        } else {
          return this._lexerError(buffer, i);
        }
      } else if (this.tState === TOKEN.NULL2) {
        // l
        if (buffer[i] === 0x6c) {
          this.tState = TOKEN.NULL3;
        } else {
          return this._lexerError(buffer, i);
        }
      } else if (this.tState === TOKEN.NULL3) {
        // l
        if (buffer[i] === 0x6c) {
          this.tState = TOKEN.START;
          this._processToken(TOKEN.NULL, null);
          this.offset += 3;
        } else {
          return this._lexerError(buffer, i);
        }
      }
    }
    return null;
  }

  // eslint-disable-next-line complexity, max-statements
  _processToken(token, value) {
    // assert(Number.isFinite(this.state) && Number.isFinite(this.mode) && Number.isFinite(token));

    if (this.props.onToken(token, value)) {
      return null;
    }

    switch (this.state) {
      case STATE.VALUE:
        switch (token) {
          case TOKEN.STRING:
          case TOKEN.NUMBER:
          case TOKEN.TRUE:
          case TOKEN.FALSE:
          case TOKEN.NULL:
            if (this.value) {
              this.value[this.key] = value;
            }
            this._emit(value);
            break;
          case TOKEN.LEFT_BRACE:
            this._push();
            if (this.value) {
              this.value = this.value[this.key] = {};
            } else {
              this.value = {};
            }
            this.key = undefined;
            this.state = STATE.KEY;
            this.mode = MODE.OBJECT;
            break;
          case TOKEN.LEFT_BRACKET:
            this._push();
            if (this.value) {
              this.value = this.value[this.key] = [];
            } else {
              this.value = [];
            }
            this.key = 0;
            this.mode = MODE.ARRAY;
            this.state = STATE.VALUE;
            break;
          case TOKEN.RIGHT_BRACE:
            if (this.mode === MODE.OBJECT) {
              this._pop();
            } else {
              return this._parserError(token, value);
            }
            break;
          case TOKEN.RIGHT_BRACKET:
            if (this.mode === MODE.ARRAY) {
              this._pop();
            } else {
              return this._parserError(token, value);
            }
            break;
          default:
            return this._parserError(token, value);
        }
        break;
      case STATE.KEY:
        switch (token) {
          case TOKEN.STRING:
            this.key = value;
            this.state = TOKEN.COLON;
            break;
          case TOKEN.RIGHT_BRACE:
            this._pop();
            break;
          default:
            return this._parserError(token, value);
        }
        break;
      case TOKEN.COLON:
        switch (token) {
          case TOKEN.COLON:
            this.state = STATE.VALUE;
            break;
          default:
            return this._parserError(token, value);
        }
        break;
      case TOKEN.COMMA:
        switch (token) {
          case TOKEN.COMMA:
            if (this.mode === MODE.ARRAY) {
              this.key++;
              this.state = STATE.VALUE;
            } else if (this.mode === MODE.OBJECT) {
              this.state = STATE.KEY;
            }
            break;
          case TOKEN.RIGHT_BRACKET:
            if (this.mode === MODE.ARRAY) {
              this._pop();
            }
            break;
          case TOKEN.RIGHT_BRACE:
            if (this.mode === MODE.OBJECT) {
              this._pop();
            }
            break;
          default:
            return this._parserError(token, value);
        }
        break;
      default:
        return this._parserError(token, value);
    }
    return null;
  }
}
