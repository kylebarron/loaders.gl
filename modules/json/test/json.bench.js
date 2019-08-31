import {fetchFile, parse} from '@loaders.gl/core';
import {JSONLoader, StreamingJSONLoader} from '@loaders.gl/experimental';

const SAMPLE_JSON_URL = '@loaders.gl/experimental/test/data/json/basic.json';

export default async function csvBench(bench) {
  const sample = await fetchFile(SAMPLE_JSON_URL);

  bench = bench.group('JSON Decode');

  bench = bench.addAsync('JSONLoader#decode', async () => {
    parse(sample, JSONLoader);
  });

  bench = bench.addAsync('StreamingJSONLoader#decode', async () => {
    parse(sample, StreamingJSONLoader);
  });

  return bench;
}
