import test from 'tape-promise/tape';

var fs = require ('fs')
  , join = require('path').join
  , file = join(__dirname, 'data','all_npm.json')
  , JSONStream = require('@loaders.gl/json/lib/jsonstream')

var expected = JSON.parse(fs.readFileSync(file))
  , parser = JSONStream.parse(['rows', /\d+/ /*, 'value'*/])
  , called = 0
  , ended = false
  , parsed = []

test('JSONStream#', t => {
  fs.createReadStream(file).pipe(parser)

  parser.on('data', function (data) {
    called++
    if (called < 10) {
      t.comment(JSON.stringify(data));
      t.ok(typeof data.id === 'string');
      t.ok(typeof data.value.rev === 'string');
      t.ok(typeof data.key === 'string');
    }
    parsed.push(data)
  })

  parser.on('end', function () {
    t.equal(called, expected.rows.length)
    t.deepEqual(parsed, expected.rows)
    t.end();
  })
});
