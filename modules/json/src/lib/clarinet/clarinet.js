/* eslint-disable */
// non node-js needs to set clarinet debug on root
var env = typeof process === 'object' && process.env ? process.env : window;

export const parser = function(opt) {
  return new CParser(opt);
};

const MAX_BUFFER_LENGTH = 64 * 1024;
const DEBUG = env.CDEBUG === 'debug';
const INFO = env.CDEBUG === 'debug' || env.CDEBUG === 'info';
const EVENTS = [
  'value',
  'string',
  'key',
  'openobject',
  'closeobject',
  'openarray',
  'closearray',
  'error',
  'end',
  'ready'
];

const buffers = {
  textNode: undefined,
  numberNode: ''
};
const streamWraps = EVENTS.filter(ev => ev !== 'error' && ev !== 'end');

let Stream;

const CHAR = {
  tab: 0x09, // \t
  lineFeed: 0x0a, // \n
  carriageReturn: 0x0d, // \r
  space: 0x20, // " "

  doubleQuote: 0x22, // "
  plus: 0x2b, // +
  comma: 0x2c, // ,
  minus: 0x2d, // -
  period: 0x2e, // .

  _0: 0x30, // 0
  _9: 0x39, // 9

  colon: 0x3a, // :

  E: 0x45, // E

  openBracket: 0x5b, // [
  backslash: 0x5c, // \
  closeBracket: 0x5d, // ]

  a: 0x61, // a
  b: 0x62, // b
  e: 0x65, // e
  f: 0x66, // f
  l: 0x6c, // l
  n: 0x6e, // n
  r: 0x72, // r
  s: 0x73, // s
  t: 0x74, // t
  u: 0x75, // u

  openBrace: 0x7b, // {
  closeBrace: 0x7d // }
};

let S = 0;
const STATE = {
  BEGIN: S++,
  VALUE: S++, // general stuff
  OPEN_OBJECT: S++, // {
  CLOSE_OBJECT: S++, // }
  OPEN_ARRAY: S++, // [
  CLOSE_ARRAY: S++, // ]
  TEXT_ESCAPE: S++, // \ stuff
  STRING: S++, // ""
  BACKSLASH: S++,
  END: S++, // No more stack
  OPEN_KEY: S++, // , "a"
  CLOSE_KEY: S++, // :
  TRUE: S++, // r
  TRUE2: S++, // u
  TRUE3: S++, // e
  FALSE: S++, // a
  FALSE2: S++, // l
  FALSE3: S++, // s
  FALSE4: S++, // e
  NULL: S++, // u
  NULL2: S++, // l
  NULL3: S++, // l
  NUMBER_DECIMAL_POINT: S++, // .
  NUMBER_DIGIT: S++ // [0-9]
};

for (var s_ in STATE) {
  STATE[STATE[s_]] = s_;
}

// switcharoo
S = STATE;

function checkBufferLength(parser) {
  const maxAllowed = Math.max(MAX_BUFFER_LENGTH, 10);
  let maxActual = 0;

  for (const buffer in buffers) {
    const len = parser[buffer] === undefined ? 0 : parser[buffer].length;
    if (len > maxAllowed) {
      switch (buffer) {
        case 'text':
          closeText(parser);
          break;

        default:
          error(parser, 'Max buffer length exceeded: ' + buffer);
      }
    }
    maxActual = Math.max(maxActual, len);
  }
  parser.bufferCheckPosition = MAX_BUFFER_LENGTH - maxActual + parser.position;
}

function clearBuffers(parser) {
  for (var buffer in buffers) {
    parser[buffer] = buffers[buffer];
  }
}

var stringTokenPattern = /[\\"\n]/g;

class CParser {
  constructor(opt) {
    this._initialize(opt);
  }

  write(chunk) {
    if (this.error) {
      throw this.error;
    }
    if (this.closed) {
      return error(this, `Cannot write after close. Assign an onready handler.`);
    }
    if (chunk === null) {
      return this.end();
    }
    this._write(chunk);
  }
  resume() {
    this.error = null;
    return this;
  }
  close() {
    return this.write(null);
  }

  end() {
    if (this.state !== S.VALUE || this.depth !== 0) error(this, 'Unexpected end');

    closeValue(this);
    this.c = '';
    this.closed = true;
    emit(this, 'onend');
    this._initialize(this.opt);
    return this;
  }

  // PRIVATE

  _initialize(opt) {
    clearBuffers(this);
    this.bufferCheckPosition = MAX_BUFFER_LENGTH;
    this.q = this.c = this.p = '';
    this.opt = opt || {};
    this.closed = this.closedRoot = this.sawRoot = false;
    this.tag = this.error = null;
    this.state = S.BEGIN;
    this.stack = new Array();
    // mostly just for error reporting
    this.position = this.column = 0;
    this.line = 1;
    this.slashed = false;
    this.unicodeI = 0;
    this.unicodeS = null;
    this.depth = 0;
    emit(this, 'onready');
  }

  // eslint-disable-next-line
  _write(chunk) {
    var parser = this;
    var i = 0,
      c = chunk.charCodeAt(0),
      p = parser.p;
    if (DEBUG) console.log('write -> [' + chunk + ']');
    while (c) {
      p = c;
      parser.c = c = chunk.charCodeAt(i++);
      // if chunk doesnt have next, like streaming char by char
      // this way we need to check if previous is really previous
      // if not we need to reset to what the parser says is the previous
      // from buffer
      if (p !== c) parser.p = p;
      else p = parser.p;

      if (!c) break;

      if (DEBUG) console.log(i, c, STATE[parser.state]);
      parser.position++;
      if (c === CHAR.lineFeed) {
        parser.line++;
        parser.column = 0;
      } else parser.column++;
      switch (parser.state) {
        case S.BEGIN:
          if (c === CHAR.openBrace) parser.state = S.OPEN_OBJECT;
          else if (c === CHAR.openBracket) parser.state = S.OPEN_ARRAY;
          else if (!isWhitespace(c)) error(parser, 'Non-whitespace before {[.');
          continue;

        case S.OPEN_KEY:
        case S.OPEN_OBJECT:
          if (isWhitespace(c)) continue;
          if (parser.state === S.OPEN_KEY) parser.stack.push(S.CLOSE_KEY);
          else {
            if (c === CHAR.closeBrace) {
              emit(parser, 'onopenobject');
              this.depth++;
              emit(parser, 'oncloseobject');
              this.depth--;
              parser.state = parser.stack.pop() || S.VALUE;
              continue;
            } else parser.stack.push(S.CLOSE_OBJECT);
          }
          if (c === CHAR.doubleQuote) parser.state = S.STRING;
          else error(parser, 'Malformed object key should start with "');
          continue;

        case S.CLOSE_KEY:
        case S.CLOSE_OBJECT:
          if (isWhitespace(c)) continue;
          var event = parser.state === S.CLOSE_KEY ? 'key' : 'object';
          if (c === CHAR.colon) {
            if (parser.state === S.CLOSE_OBJECT) {
              parser.stack.push(S.CLOSE_OBJECT);
              closeValue(parser, 'onopenobject');
              this.depth++;
            } else closeValue(parser, 'onkey');
            parser.state = S.VALUE;
          } else if (c === CHAR.closeBrace) {
            emitNode(parser, 'oncloseobject');
            this.depth--;
            parser.state = parser.stack.pop() || S.VALUE;
          } else if (c === CHAR.comma) {
            if (parser.state === S.CLOSE_OBJECT) parser.stack.push(S.CLOSE_OBJECT);
            closeValue(parser);
            parser.state = S.OPEN_KEY;
          } else error(parser, 'Bad object');
          continue;

        case S.OPEN_ARRAY: // after an array there always a value
        case S.VALUE:
          if (isWhitespace(c)) continue;
          if (parser.state === S.OPEN_ARRAY) {
            emit(parser, 'onopenarray');
            this.depth++;
            parser.state = S.VALUE;
            if (c === CHAR.closeBracket) {
              emit(parser, 'onclosearray');
              this.depth--;
              parser.state = parser.stack.pop() || S.VALUE;
              continue;
            } else {
              parser.stack.push(S.CLOSE_ARRAY);
            }
          }
          if (c === CHAR.doubleQuote) parser.state = S.STRING;
          else if (c === CHAR.openBrace) parser.state = S.OPEN_OBJECT;
          else if (c === CHAR.openBracket) parser.state = S.OPEN_ARRAY;
          else if (c === CHAR.t) parser.state = S.TRUE;
          else if (c === CHAR.f) parser.state = S.FALSE;
          else if (c === CHAR.n) parser.state = S.NULL;
          else if (c === CHAR.minus) {
            // keep and continue
            parser.numberNode += '-';
          } else if (CHAR._0 <= c && c <= CHAR._9) {
            parser.numberNode += String.fromCharCode(c);
            parser.state = S.NUMBER_DIGIT;
          } else error(parser, 'Bad value');
          continue;

        case S.CLOSE_ARRAY:
          if (c === CHAR.comma) {
            parser.stack.push(S.CLOSE_ARRAY);
            closeValue(parser, 'onvalue');
            parser.state = S.VALUE;
          } else if (c === CHAR.closeBracket) {
            emitNode(parser, 'onclosearray');
            this.depth--;
            parser.state = parser.stack.pop() || S.VALUE;
          } else if (isWhitespace(c)) continue;
          else error(parser, 'Bad array');
          continue;

        case S.STRING:
          if (parser.textNode === undefined) {
            parser.textNode = '';
          }

          // thanks thejh, this is an about 50% performance improvement.
          var starti = i - 1,
            slashed = parser.slashed,
            unicodeI = parser.unicodeI;
          STRING_BIGLOOP: while (true) {
            if (DEBUG) console.log(i, c, STATE[parser.state], slashed);
            // zero means "no unicode active". 1-4 mean "parse some more". end after 4.
            while (unicodeI > 0) {
              parser.unicodeS += String.fromCharCode(c);
              c = chunk.charCodeAt(i++);
              parser.position++;
              if (unicodeI === 4) {
                // TODO this might be slow? well, probably not used too often anyway
                parser.textNode += String.fromCharCode(parseInt(parser.unicodeS, 16));
                unicodeI = 0;
                starti = i - 1;
              } else {
                unicodeI++;
              }
              // we can just break here: no stuff we skipped that still has to be sliced out or so
              if (!c) break STRING_BIGLOOP;
            }
            if (c === CHAR.doubleQuote && !slashed) {
              parser.state = parser.stack.pop() || S.VALUE;
              parser.textNode += chunk.substring(starti, i - 1);
              parser.position += i - 1 - starti;
              break;
            }
            if (c === CHAR.backslash && !slashed) {
              slashed = true;
              parser.textNode += chunk.substring(starti, i - 1);
              parser.position += i - 1 - starti;
              c = chunk.charCodeAt(i++);
              parser.position++;
              if (!c) break;
            }
            if (slashed) {
              slashed = false;
              if (c === CHAR.n) {
                parser.textNode += '\n';
              } else if (c === CHAR.r) {
                parser.textNode += '\r';
              } else if (c === CHAR.t) {
                parser.textNode += '\t';
              } else if (c === CHAR.f) {
                parser.textNode += '\f';
              } else if (c === CHAR.b) {
                parser.textNode += '\b';
              } else if (c === CHAR.u) {
                // \uxxxx. meh!
                unicodeI = 1;
                parser.unicodeS = '';
              } else {
                parser.textNode += String.fromCharCode(c);
              }
              c = chunk.charCodeAt(i++);
              parser.position++;
              starti = i - 1;
              if (!c) break;
              else continue;
            }

            stringTokenPattern.lastIndex = i;
            var reResult = stringTokenPattern.exec(chunk);
            if (reResult === null) {
              i = chunk.length + 1;
              parser.textNode += chunk.substring(starti, i - 1);
              parser.position += i - 1 - starti;
              break;
            }
            i = reResult.index + 1;
            c = chunk.charCodeAt(reResult.index);
            if (!c) {
              parser.textNode += chunk.substring(starti, i - 1);
              parser.position += i - 1 - starti;
              break;
            }
          }
          parser.slashed = slashed;
          parser.unicodeI = unicodeI;
          continue;

        case S.TRUE:
          if (c === CHAR.r) parser.state = S.TRUE2;
          else error(parser, 'Invalid true started with t' + c);
          continue;

        case S.TRUE2:
          if (c === CHAR.u) parser.state = S.TRUE3;
          else error(parser, 'Invalid true started with tr' + c);
          continue;

        case S.TRUE3:
          if (c === CHAR.e) {
            emit(parser, 'onvalue', true);
            parser.state = parser.stack.pop() || S.VALUE;
          } else error(parser, 'Invalid true started with tru' + c);
          continue;

        case S.FALSE:
          if (c === CHAR.a) parser.state = S.FALSE2;
          else error(parser, 'Invalid false started with f' + c);
          continue;

        case S.FALSE2:
          if (c === CHAR.l) parser.state = S.FALSE3;
          else error(parser, 'Invalid false started with fa' + c);
          continue;

        case S.FALSE3:
          if (c === CHAR.s) parser.state = S.FALSE4;
          else error(parser, 'Invalid false started with fal' + c);
          continue;

        case S.FALSE4:
          if (c === CHAR.e) {
            emit(parser, 'onvalue', false);
            parser.state = parser.stack.pop() || S.VALUE;
          } else error(parser, 'Invalid false started with fals' + c);
          continue;

        case S.NULL:
          if (c === CHAR.u) parser.state = S.NULL2;
          else error(parser, 'Invalid null started with n' + c);
          continue;

        case S.NULL2:
          if (c === CHAR.l) parser.state = S.NULL3;
          else error(parser, 'Invalid null started with nu' + c);
          continue;

        case S.NULL3:
          if (c === CHAR.l) {
            emit(parser, 'onvalue', null);
            parser.state = parser.stack.pop() || S.VALUE;
          } else error(parser, 'Invalid null started with nul' + c);
          continue;

        case S.NUMBER_DECIMAL_POINT:
          if (c === CHAR.period) {
            parser.numberNode += '.';
            parser.state = S.NUMBER_DIGIT;
          } else error(parser, 'Leading zero not followed by .');
          continue;

        case S.NUMBER_DIGIT:
          if (CHAR._0 <= c && c <= CHAR._9) parser.numberNode += String.fromCharCode(c);
          else if (c === CHAR.period) {
            if (parser.numberNode.indexOf('.') !== -1) error(parser, 'Invalid number has two dots');
            parser.numberNode += '.';
          } else if (c === CHAR.e || c === CHAR.E) {
            if (parser.numberNode.indexOf('e') !== -1 || parser.numberNode.indexOf('E') !== -1)
              error(parser, 'Invalid number has two exponential');
            parser.numberNode += 'e';
          } else if (c === CHAR.plus || c === CHAR.minus) {
            if (!(p === CHAR.e || p === CHAR.E)) error(parser, 'Invalid symbol in number');
            parser.numberNode += String.fromCharCode(c);
          } else {
            closeNumber(parser);
            i--; // go back one
            parser.state = parser.stack.pop() || S.VALUE;
          }
          continue;

        default:
          error(parser, 'Unknown state: ' + parser.state);
      }
    }
    if (parser.position >= parser.bufferCheckPosition) checkBufferLength(parser);
    return parser;
  }
}

class CStream {
  constructor(opt) {
    this._parser = new CParser(opt);
    this.writable = true;
    this.readable = true;

    // var Buffer = this.Buffer || function Buffer () {}; // if we don't have Buffers, fake it so we can do `var instanceof Buffer` and not throw an error
    this.bytes_remaining = 0; // number of bytes remaining in multi byte utf8 char to read after split boundary
    this.bytes_in_sequence = 0; // bytes in multi byte utf8 char to read
    this.temp_buffs = {'2': new Buffer(2), '3': new Buffer(3), '4': new Buffer(4)}; // for rebuilding chars split before boundary is reached
    this.string = '';

    var me = this;
    Stream.apply(me);

    this._parser.onend = function() {
      me.emit('end');
    };
    this._parser.onerror = function(er) {
      me.emit('error', er);
      me._parser.error = null;
    };

    streamWraps.forEach(function(ev) {
      Object.defineProperty(me, 'on' + ev, {
        get: function() {
          return me._parser['on' + ev];
        },
        set: function(h) {
          if (!h) {
            me.removeAllListeners(ev);
            me._parser['on' + ev] = h;
            return h;
          }
          me.on(ev, h);
        },
        enumerable: true,
        configurable: false
      });
    });
  }

  write(data) {
    data = new Buffer(data);
    for (var i = 0; i < data.length; i++) {
      var n = data[i];

      // check for carry over of a multi byte char split between data chunks
      // & fill temp buffer it with start of this data chunk up to the boundary limit set in the last iteration
      if (this.bytes_remaining > 0) {
        for (var j = 0; j < this.bytes_remaining; j++) {
          this.temp_buffs[this.bytes_in_sequence][
            this.bytes_in_sequence - this.bytes_remaining + j
          ] = data[j];
        }
        this.string = this.temp_buffs[this.bytes_in_sequence].toString();
        this.bytes_in_sequence = this.bytes_remaining = 0;

        // move iterator forward by number of byte read during sequencing
        i = i + j - 1;

        // pass data to parser and move forward to parse rest of data
        this._parser.write(this.string);
        this.emit('data', this.string);
        continue;
      }

      // if no remainder bytes carried over, parse multi byte (>=128) chars one at a time
      if (this.bytes_remaining === 0 && n >= 128) {
        if (n >= 194 && n <= 223) this.bytes_in_sequence = 2;
        if (n >= 224 && n <= 239) this.bytes_in_sequence = 3;
        if (n >= 240 && n <= 244) this.bytes_in_sequence = 4;
        if (this.bytes_in_sequence + i > data.length) {
          // if bytes needed to complete char fall outside data length, we have a boundary split

          for (var k = 0; k <= data.length - 1 - i; k++) {
            this.temp_buffs[this.bytes_in_sequence][k] = data[i + k]; // fill temp data of correct size with bytes available in this chunk
          }
          this.bytes_remaining = i + this.bytes_in_sequence - data.length;

          // immediately return as we need another chunk to sequence the character
          return true;
        } else {
          this.string = data.slice(i, i + this.bytes_in_sequence).toString();
          i = i + this.bytes_in_sequence - 1;

          this._parser.write(this.string);
          this.emit('data', this.string);
          continue;
        }
      }

      // is there a range of characters that are immediately parsable?
      for (var p = i; p < data.length; p++) {
        if (data[p] >= 128) break;
      }
      this.string = data.slice(i, p).toString();
      this._parser.write(this.string);
      this.emit('data', this.string);
      i = p - 1;

      // handle any remaining characters using multibyte logic
      continue;
    }
  }

  end(chunk) {
    if (chunk && chunk.length) this._parser.write(chunk.toString());
    this._parser.end();
    return true;
  }

  on(ev, handler) {
    var me = this;
    if (!me._parser['on' + ev] && streamWraps.indexOf(ev) !== -1) {
      me._parser['on' + ev] = function() {
        var args = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments);
        args.splice(0, 0, ev);
        me.emit.apply(me, args);
      };
    }
    return Stream.prototype.on.call(me, ev, handler);
  }

  destroy() {
    clearBuffers(this._parser);
    this.emit('close');
  }
}

function emit(parser, event, data) {
  if (INFO) console.log('-- emit', event, data);
  if (parser[event]) parser[event](data);
}

function emitNode(parser, event, data) {
  closeValue(parser);
  emit(parser, event, data);
}

function closeValue(parser, event) {
  parser.textNode = textopts(parser.opt, parser.textNode);
  if (parser.textNode !== undefined) {
    emit(parser, event ? event : 'onvalue', parser.textNode);
  }
  parser.textNode = undefined;
}

function closeNumber(parser) {
  if (parser.numberNode) emit(parser, 'onvalue', parseFloat(parser.numberNode));
  parser.numberNode = '';
}

function textopts(opt, text) {
  if (text === undefined) {
    return text;
  }
  if (opt.trim) text = text.trim();
  if (opt.normalize) text = text.replace(/\s+/g, ' ');
  return text;
}

function error(parser, er) {
  closeValue(parser);
  er += `Line: ${parser.line} Column: ${parser.column} Char: ${parser.c}`;
  er = new Error(er);
  parser.error = er;
  emit(parser, 'onerror', er);
  return parser;
}

function isWhitespace(c) {
  return c === CHAR.carriageReturn || c === CHAR.lineFeed || c === CHAR.space || c === CHAR.tab;
}
