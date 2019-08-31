var stream = require('stream');
var test = require('tape');
import { StreamingJSONLoader } from '@loaders.gl/experimental';
const Parser = StreamingJSONLoader;
const JsonParse = StreamingJSONLoader;

// big-token.js

test('JSONLoader#can handle large tokens without running out of memory', function(t) {
  var parser = new JsonParse();
  var chunkSize = 1024;
  var chunks = 1024 * 200; // 200mb
  var quote = Buffer.from ? Buffer.from('"') : new Buffer('"');
  t.plan(1);

  parser.onToken = function(type, value) {
    t.equal(value.length, chunkSize * chunks, 'token should be size of input json');
    t.end();
  };

  parser.write(quote);
  for (var i = 0; i < chunks; ++i) {
    var buf = Buffer.alloc ? Buffer.alloc(chunkSize) : new Buffer(chunkSize);
    buf.fill('a');
    parser.write(buf);
  }
  parser.write(quote);
});

// boundary.js

test("2 byte utf8 'De' character: д", function(t) {
  t.plan(1);

  var p = new Parser();
  p.onValue = function(value) {
    t.equal(value, 'д');
  };

  var de_buffer = new Buffer([0xd0, 0xb4]);

  p.write('"');
  p.write(de_buffer);
  p.write('"');
});

test("3 byte utf8 'Han' character: 我", function(t) {
  t.plan(1);

  var p = new Parser();
  p.onValue = function(value) {
    t.equal(value, '我');
  };

  var han_buffer = new Buffer([0xe6, 0x88, 0x91]);
  p.write('"');
  p.write(han_buffer);
  p.write('"');
});

test('JSONLoader#4 byte utf8 character (unicode scalar U+2070E): 𠜎', function(t) {
  t.plan(1);

  var p = new Parser();
  p.onValue = function(value) {
    t.equal(value, '𠜎');
  };

  var Ux2070E_buffer = new Buffer([0xf0, 0xa0, 0x9c, 0x8e]);
  p.write('"');
  p.write(Ux2070E_buffer);
  p.write('"');
});

test("3 byte utf8 'Han' character chunked inbetween 2nd and 3rd byte: 我", function(t) {
  t.plan(1);

  var p = new Parser();
  p.onValue = function(value) {
    t.equal(value, '我');
  };

  var han_buffer_first = new Buffer([0xe6, 0x88]);
  var han_buffer_second = new Buffer([0x91]);
  p.write('"');
  p.write(han_buffer_first);
  p.write(han_buffer_second);
  p.write('"');
});

test('JSONLoader#4 byte utf8 character (unicode scalar U+2070E) chunked inbetween 2nd and 3rd byte: 𠜎', function(t) {
  t.plan(1);

  var p = new Parser();
  p.onValue = function(value) {
    t.equal(value, '𠜎');
  };

  var Ux2070E_buffer_first = new Buffer([0xf0, 0xa0]);
  var Ux2070E_buffer_second = new Buffer([0x9c, 0x8e]);
  p.write('"');
  p.write(Ux2070E_buffer_first);
  p.write(Ux2070E_buffer_second);
  p.write('"');
});

test('JSONLoader#1-4 byte utf8 character string chunked inbetween random bytes: Aж文𠜱B', function(t) {
  t.plan(1);

  var p = new Parser();
  p.onValue = function(value) {
    t.equal(value, 'Aж文𠜱B');
  };

  var eclectic_buffer = new Buffer([
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

  var rand_chunk = Math.floor(Math.random() * eclectic_buffer.length);
  var first_buffer = eclectic_buffer.slice(0, rand_chunk);
  var second_buffer = eclectic_buffer.slice(rand_chunk);

  //console.log('eclectic_buffer: ' + eclectic_buffer)
  //console.log('sliced from 0 to ' + rand_chunk);
  //console.log(first_buffer);
  //console.log('then sliced from ' + rand_chunk + ' to the end');
  //console.log(second_buffer);

  console.log('chunked after offset ' + rand_chunk);
  p.write('"');
  p.write(first_buffer);
  p.write(second_buffer);
  p.write('"');
});

// offset.js

var input = '{\n  "string": "value",\n  "number": 3,\n  "object"';
var input2 = ': {\n  "key": "vд"\n  },\n  "array": [\n  -1,\n  12\n  ]\n  ';
var input3 = '"null": null, "true": true, "false": false, "frac": 3.14 }';

var offsets = [
  [0, Parser.C.LEFT_BRACE],
  [4, Parser.C.STRING],
  [12, Parser.C.COLON],
  [14, Parser.C.STRING],
  [21, Parser.C.COMMA],
  [25, Parser.C.STRING],
  [33, Parser.C.COLON],
  [35, Parser.C.NUMBER],
  [36, Parser.C.COMMA],
  [40, Parser.C.STRING],
  [48, Parser.C.COLON],
  [50, Parser.C.LEFT_BRACE],
  [54, Parser.C.STRING],
  [59, Parser.C.COLON],
  [61, Parser.C.STRING],
  [69, Parser.C.RIGHT_BRACE],
  [70, Parser.C.COMMA],
  [74, Parser.C.STRING],
  [81, Parser.C.COLON],
  [83, Parser.C.LEFT_BRACKET],
  [87, Parser.C.NUMBER],
  [89, Parser.C.COMMA],
  [93, Parser.C.NUMBER],
  [98, Parser.C.RIGHT_BRACKET],
  [102, Parser.C.STRING],
  [108, Parser.C.COLON],
  [110, Parser.C.NULL],
  [114, Parser.C.COMMA],
  [116, Parser.C.STRING],
  [122, Parser.C.COLON],
  [124, Parser.C.TRUE],
  [128, Parser.C.COMMA],
  [130, Parser.C.STRING],
  [137, Parser.C.COLON],
  [139, Parser.C.FALSE],
  [144, Parser.C.COMMA],
  [146, Parser.C.STRING],
  [152, Parser.C.COLON],
  [154, Parser.C.NUMBER],
  [159, Parser.C.RIGHT_BRACE]
];

test('JSONLoader#offset', function(t) {
  t.plan(offsets.length * 2 + 1);

  var p = new Parser();
  var i = 0;
  p.onToken = function(token) {
    t.equal(p.offset, offsets[i][0]);
    t.equal(token, offsets[i][1]);
    i++;
  };

  p.write(input);
  p.write(input2);
  p.write(input3);

  t.equal(i, offsets.length);
});

// primitives.js

var expected = [
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

test('JSONLoader#primitives', function(t) {
  t.plan(25);

  var p = new Parser();
  p.onValue = function(value) {
    var keys = this.stack
      .slice(1)
      .map(function(item) {
        return item.key;
      })
      .concat(this.key !== undefined ? this.key : []);
    t.deepEqual([keys, value], expected.shift());
  };

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

// surrogate.js

test('JSONLoader#parse surrogate pair', function(t) {
  t.plan(1);

  var p = new Parser();
  p.onValue = function(value) {
    t.equal(value, '😋');
  };

  p.write('"\\uD83D\\uDE0B"');
});

test('JSONLoader#parse chunked surrogate pair', function(t) {
  t.plan(1);

  var p = new Parser();
  p.onValue = function(value) {
    t.equal(value, '😋');
  };

  p.write('"\\uD83D');
  p.write('\\uDE0B"');
});

// unvalid.js

test('JSONLoader#unvalid', function(t) {
  var count = 0;

  var p = new Parser();
  p.onError = function(value) {
    count++;
    t.equal(1, count);
    t.end();
  };

  p.write('{"test": eer[');
});

// utf8.js

test('JSONLoader#3 bytes of utf8', function(t) {
  t.plan(1);

  var p = new Parser();
  p.onValue = function(value) {
    t.equal(value, '├──');
  };

  p.write('"├──"');
});

test('JSONLoader#utf8 snowman', function(t) {
  t.plan(1);

  var p = new Parser();
  p.onValue = function(value) {
    t.equal(value, '☃');
  };

  p.write('"☃"');
});

test('JSONLoader#utf8 with regular ascii', function(t) {
  t.plan(4);

  var p = new Parser();
  var expected = ['snow: ☃!', 'xyz', '¡que!'];
  expected.push(expected.slice());

  p.onValue = function(value) {
    t.deepEqual(value, expected.shift());
  };

  p.write('["snow: ☃!","xyz","¡que!"]');
});
