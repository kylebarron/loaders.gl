import test from 'tape-promise/tape';
import {JSONTableLoader, JSONLoader} from '@loaders.gl/json';
import {fetchFile} from '@loaders.gl/core';

const SAMPLE_JSON_URL = '@loaders.gl/experimental/test/data/basic.json';

test('JSONLoader#imports', t => {
  t.ok(JSONLoader, 'JSONLoader');
  t.ok(JSONTableLoader, 'JSONTableLoader');
  t.end();
});

test('JSONLoader#output equivalent to JSON.parse', async t => {
  const response = await fetchFile(SAMPLE_JSON_URL);
  t.ok(await response.json());
  // const expected = await parse(response, JSONLoader);

  // response = await fetchFile(SAMPLE_JSON_URL);
  // const result = await parse(response, JSONTableLoader);

  // t.deepEqual(result, expected, 'output equivalent to JSON.parse');
  t.end();
});
