import test from 'tape-promise/tape';
import parseShape from '@loaders.gl/shapefile/lib/parse-shp';
import {fetchFile} from '@loaders.gl/core';
import {geojsonToBinary} from '@loaders.gl/gis';

const POLYLINES = '@loaders.gl/shapefile/test/data/bostock/polylines';

// var json = require('../../test/data/bostock/polylines.json');
// var path = '../../test/data/bostock/polylines.shp';
// var arrayBuffer = readFileSync(path).buffer;
// var test = parseShape(arrayBuffer)
// test.features[0]

test('Polylines', async t => {
  let response = await fetchFile(`${POLYLINES}.shp`);
  const body = await response.arrayBuffer();

  response = await fetchFile(`${POLYLINES}.json`);
  const json = await response.json();
  const output = parseShape(body);

  for (let i = 0; i < json.features.length; i++) {
    const expBinary = geojsonToBinary([json.features[i]]).lines.positions;
    t.deepEqual(output.features[i].positions, expBinary);
  }

  t.end();
});
