// Attribution: Adapted from https://github.com/creationix/jsonparse under MIT license
// Copyright (c) 2012 Tim Caswell

/* eslint-disable camelcase */
/* global Buffer */
import test from 'tape-promise/tape';
import JSONParser, {TOKEN} from '@loaders.gl/json/lib/json-parser';

// unvalid.js

test('JSONLoader#unvalid', t => {
  let count = 0;

  const p = new JSONParser({
    onError: _ => {
      count++;
      t.equal(1, count);
      t.end();
    }
  });

  p.write('{"test": eer[');
});

// offset.js

const input = '{\n  "string": "value",\n  "number": 3,\n  "object"';
const input2 = ': {\n  "key": "vд"\n  },\n  "array": [\n  -1,\n  12\n  ]\n  ';
const input3 = '"null": null, "true": true, "false": false, "frac": 3.14 }';

const offsets = [
  [0, TOKEN.LEFT_BRACE],
  [4, TOKEN.STRING],
  [12, TOKEN.COLON],
  [14, TOKEN.STRING],
  [21, TOKEN.COMMA],
  [25, TOKEN.STRING],
  [33, TOKEN.COLON],
  [35, TOKEN.NUMBER],
  [36, TOKEN.COMMA],
  [40, TOKEN.STRING],
  [48, TOKEN.COLON],
  [50, TOKEN.LEFT_BRACE],
  [54, TOKEN.STRING],
  [59, TOKEN.COLON],
  [61, TOKEN.STRING],
  [69, TOKEN.RIGHT_BRACE],
  [70, TOKEN.COMMA],
  [74, TOKEN.STRING],
  [81, TOKEN.COLON],
  [83, TOKEN.LEFT_BRACKET],
  [87, TOKEN.NUMBER],
  [89, TOKEN.COMMA],
  [93, TOKEN.NUMBER],
  [98, TOKEN.RIGHT_BRACKET],
  [102, TOKEN.STRING],
  [108, TOKEN.COLON],
  [110, TOKEN.NULL],
  [114, TOKEN.COMMA],
  [116, TOKEN.STRING],
  [122, TOKEN.COLON],
  [124, TOKEN.TRUE],
  [128, TOKEN.COMMA],
  [130, TOKEN.STRING],
  [137, TOKEN.COLON],
  [139, TOKEN.FALSE],
  [144, TOKEN.COMMA],
  [146, TOKEN.STRING],
  [152, TOKEN.COLON],
  [154, TOKEN.NUMBER],
  [159, TOKEN.RIGHT_BRACE]
];

test('JSONLoader#offset', t => {
  t.plan(offsets.length * 2 + 1);

  let i = 0;

  const p = new JSONParser({
    onToken: token => {
      t.equal(p.offset, offsets[i][0], `${i}: offset ${p.offset} correct as ${offsets[i][0]}`);
      t.equal(
        token,
        offsets[i][1],
        `${i}: token ${p._getTokenName(token)} correct as ${offsets[i][1]}`
      );
      i++;
      return true; // Disable token processing
    }
  });

  p.write(input);
  p.write(input2);
  p.write(input3);

  t.equal(i, offsets.length);
});

// primitives.js

const PRIMITIVE_TEST_CASES = [
  [[], ''],
  [[], 'Hello'],
  [[], 'This"is'],
  [[], '\r\n\f\t\\/"'],
  [[], 'Λάμβδα'],
  [[], '\\'],
  [[], '/'],
  [[], '"'],
  [[0], 0],
  [[1], 1],
  [[2], -1],
  [[], [0, 1, -1]],
  [[0], 1],
  [[1], 1.1],
  [[2], -1.1],
  [[3], -1],
  [[], [1, 1.1, -1.1, -1]],
  [[0], -1],
  [[], [-1]],
  [[0], -0.1],
  [[], [-0.1]],
  [[0], 6.02e23],
  [[], [6.02e23]],
  [[0], '7161093205057351174'],
  [[], ['7161093205057351174']]
];

test('JSONLoader#primitives', t => {
  t.plan(25);

  const p = new JSONParser({
    onValue: value => {
      const keys = p.stack
        .slice(1)
        .map(item => item.key)
        .concat(p.key !== undefined ? p.key : []);
      const expect = PRIMITIVE_TEST_CASES.shift();
      t.deepEqual([keys, value], expect, `onValue(${value}) called with correct stack`);
    }
  });

  p.write('"""Hello""This\\"is""\\r\\n\\f\\t\\\\\\/\\""');
  p.write('"\\u039b\\u03ac\\u03bc\\u03b2\\u03b4\\u03b1"');
  p.write('"\\\\"');
  p.write('"\\/"');
  p.write('"\\""');
  p.write('[0,1,-1]');
  p.write('[1.0,1.1,-1.1,-1.0][-1][-0.1]');
  p.write('[6.02e23]');
  p.write('[7161093205057351174]');
});

// big-token.js

test('JSONLoader#can handle large tokens without running out of memory', t => {
  const chunkSize = 1024;
  const chunks = 1024 * 200; // 200mb

  t.plan(1);
  const parser = new JSONParser({
    onToken: (type, value) => {
      t.equal(value.length, chunkSize * chunks, 'token should be size of input json');
      t.end();
    }
  });

  const quote = Buffer.from ? Buffer.from('"') : new Buffer('"');

  parser.write(quote);
  for (let i = 0; i < chunks; ++i) {
    const buf = Buffer.alloc ? Buffer.alloc(chunkSize) : new Buffer(chunkSize);
    buf.fill('a');
    parser.write(buf);
  }
  parser.write(quote);
});

// utf8.js

test('JSONLoader#3 bytes of utf8', t => {
  t.plan(1);

  const p = new JSONParser({
    onValue: value => t.equal(value, '├──')
  });

  p.write('"├──"');
});

test('JSONLoader#utf8 snowman', t => {
  t.plan(1);

  const p = new JSONParser({
    onValue: value => t.equal(value, '☃')
  });

  p.write('"☃"');
});

test('JSONLoader#utf8 with regular ascii', t => {
  t.plan(4);

  const expected = ['snow: ☃!', 'xyz', '¡que!'];
  expected.push(expected.slice());

  const p = new JSONParser({
    onValue: value => t.deepEqual(value, expected.shift())
  });

  p.write('["snow: ☃!","xyz","¡que!"]');
});

// More UTF8 handling (boundary.js)

test("2 byte utf8 'De' character: д", t => {
  t.plan(1);

  const p = new JSONParser({
    onValue: value => t.equal(value, 'д')
  });

  const deBuffer = new Buffer([0xd0, 0xb4]);

  p.write('"');
  p.write(deBuffer);
  p.write('"');
});

test("3 byte utf8 'Han' character: 我", t => {
  t.plan(1);

  const p = new JSONParser({
    onValue: value => t.equal(value, '我')
  });

  const hanBuffer = new Buffer([0xe6, 0x88, 0x91]);
  p.write('"');
  p.write(hanBuffer);
  p.write('"');
});

test('JSONLoader#4 byte utf8 character (unicode scalar U+2070E): 𠜎', t => {
  t.plan(1);

  const p = new JSONParser({
    onValue: value => t.equal(value, '𠜎')
  });

  const Ux2070EBuffer = new Buffer([0xf0, 0xa0, 0x9c, 0x8e]);
  p.write('"');
  p.write(Ux2070EBuffer);
  p.write('"');
});

test("3 byte utf8 'Han' character chunked inbetween 2nd and 3rd byte: 我", t => {
  t.plan(1);

  const p = new JSONParser({
    onValue: value => t.equal(value, '我')
  });

  const hanBuffer_first = new Buffer([0xe6, 0x88]);
  const hanBuffer_second = new Buffer([0x91]);
  p.write('"');
  p.write(hanBuffer_first);
  p.write(hanBuffer_second);
  p.write('"');
});

test('JSONLoader#4 byte utf8 character (unicode scalar U+2070E) chunked inbetween 2nd and 3rd byte: 𠜎', t => {
  t.plan(1);

  const p = new JSONParser({
    onValue: value => t.equal(value, '𠜎')
  });

  const Ux2070EBuffer_first = new Buffer([0xf0, 0xa0]);
  const Ux2070EBuffer_second = new Buffer([0x9c, 0x8e]);
  p.write('"');
  p.write(Ux2070EBuffer_first);
  p.write(Ux2070EBuffer_second);
  p.write('"');
});

test('JSONLoader#1-4 byte utf8 character string chunked inbetween random bytes: Aж文𠜱B', t => {
  t.plan(1);

  const p = new JSONParser({
    onValue: value => t.equal(value, 'Aж文𠜱B')
  });

  const eclecticBuffer = new Buffer([
    0x41, // A
    0xd0,
    0xb6, // ж
    0xe6,
    0x96,
    0x87, // 文
    0xf0,
    0xa0,
    0x9c,
    0xb1, // 𠜱
    0x42
  ]); // B

  const rand_chunk = Math.floor(Math.random() * eclecticBuffer.length);
  const firstBuffer = eclecticBuffer.slice(0, rand_chunk);
  const secondBuffer = eclecticBuffer.slice(rand_chunk);

  // console.log('eclecticBuffer: ' + eclecticBuffer)
  // console.log('sliced from 0 to ' + rand_chunk);
  // console.log(firstBuffer);
  // console.log('then sliced from ' + rand_chunk + ' to the end');
  // console.log(secondBuffer);

  t.comment(`chunked after offset ${rand_chunk}`);
  p.write('"');
  p.write(firstBuffer);
  p.write(secondBuffer);
  p.write('"');
});

// surrogate.js

test('JSONLoader#parse surrogate pair', t => {
  t.plan(1);

  const p = new JSONParser({
    onValue: value => t.equal(value, '😋')
  });

  p.write('"\\uD83D\\uDE0B"');
});

test('JSONLoader#parse chunked surrogate pair', t => {
  t.plan(1);

  const p = new JSONParser({
    onValue: value => t.equal(value, '😋')
  });

  p.write('"\\uD83D');
  p.write('\\uDE0B"');
});
