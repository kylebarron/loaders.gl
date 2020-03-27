import test from 'tape-promise/tape';
import {fetchFile} from '@loaders.gl/core';
import {geojsonToBinary, TEST_EXPORTS} from '@loaders.gl/gis';

const {firstPass} = TEST_EXPORTS;

// Sample GeoJSON data derived from examples in GeoJSON specification
// https://tools.ietf.org/html/rfc7946#appendix-A
// All features have 2D coordinates
const FEATURES_2D = '@loaders.gl/gis/test/data/2d_features.json';
// All features have 3D coordinates
const FEATURES_3D = '@loaders.gl/gis/test/data/3d_features.json';
// All features have 3D coordinates
const FEATURES_MIXED = '@loaders.gl/gis/test/data/mixed_features.json';

test('gis#firstPass 2D features, no properties', async t => {
  const response = await fetchFile(FEATURES_2D);
  const {features} = await response.json();
  const firstPassData = firstPass(features);
  const {
    pointPositionsCount,
    pointFeaturesCount,
    linePositionsCount,
    linePathsCount,
    lineFeaturesCount,
    polygonPositionsCount,
    polygonObjectsCount,
    polygonRingsCount,
    polygonFeaturesCount,
    coordLength,
    numericPropKeys
  } = firstPassData;

  t.equal(pointPositionsCount, 3);
  t.equal(pointFeaturesCount, 2);
  t.equal(linePositionsCount, 6);
  t.equal(linePathsCount, 3);
  t.equal(lineFeaturesCount, 2);
  t.equal(polygonPositionsCount, 30);
  t.equal(polygonObjectsCount, 4);
  t.equal(polygonRingsCount, 6);
  t.equal(polygonFeaturesCount, 3);
  t.equal(coordLength, 2);
  t.deepEquals(numericPropKeys, []);
});

test('gis#firstPass 3D features, no properties', async t => {
  const response = await fetchFile(FEATURES_3D);
  const {features} = await response.json();
  const firstPassData = firstPass(features);
  const {
    pointPositionsCount,
    pointFeaturesCount,
    linePositionsCount,
    linePathsCount,
    lineFeaturesCount,
    polygonPositionsCount,
    polygonObjectsCount,
    polygonRingsCount,
    polygonFeaturesCount,
    coordLength,
    numericPropKeys
  } = firstPassData;

  t.equal(pointPositionsCount, 3);
  t.equal(pointFeaturesCount, 2);
  t.equal(linePositionsCount, 6);
  t.equal(linePathsCount, 3);
  t.equal(lineFeaturesCount, 2);
  t.equal(polygonPositionsCount, 30);
  t.equal(polygonObjectsCount, 4);
  t.equal(polygonRingsCount, 6);
  t.equal(polygonFeaturesCount, 3);
  t.equal(coordLength, 3);
  t.deepEquals(numericPropKeys, []);
});

test('gis#firstPass mixed-dimension features, no properties', async t => {
  const response = await fetchFile(FEATURES_MIXED);
  const {features} = await response.json();
  const firstPassData = firstPass(features);
  const {
    pointPositionsCount,
    pointFeaturesCount,
    linePositionsCount,
    linePathsCount,
    lineFeaturesCount,
    polygonPositionsCount,
    polygonObjectsCount,
    polygonRingsCount,
    polygonFeaturesCount,
    coordLength,
    numericPropKeys
  } = firstPassData;

  t.equal(pointPositionsCount, 3);
  t.equal(pointFeaturesCount, 2);
  t.equal(linePositionsCount, 6);
  t.equal(linePathsCount, 3);
  t.equal(lineFeaturesCount, 2);
  t.equal(polygonPositionsCount, 30);
  t.equal(polygonObjectsCount, 4);
  t.equal(polygonRingsCount, 6);
  t.equal(polygonFeaturesCount, 3);
  t.equal(coordLength, 3);
  t.deepEquals(numericPropKeys, []);
});

test('gis#geojson-to-binary 2D features', async t => {
  const response = await fetchFile(FEATURES_2D);
  const {features} = await response.json();
  const {points, lines, polygons} = geojsonToBinary(features);

  // 2D size
  t.equal(points.positions.size, 2);
  t.equal(lines.positions.size, 2);
  t.equal(polygons.positions.size, 2);

  // Other arrays have coordinate size 1
  t.equal(points.globalFeatureIds.size, 1);
  t.equal(points.featureIds.size, 1);
  t.equal(lines.pathIndices.size, 1);
  t.equal(lines.globalFeatureIds.size, 1);
  t.equal(lines.featureIds.size, 1);
  t.equal(polygons.polygonIndices.size, 1);
  t.equal(polygons.primitivePolygonIndices.size, 1);
  t.equal(polygons.globalFeatureIds.size, 1);
  t.equal(polygons.featureIds.size, 1);

  // Point value equality
  t.deepEqual(points.positions.value, [100, 0, 100, 0, 101, 1]);
  t.deepEqual(points.globalFeatureIds.value, [0, 1, 1]);

  // LineString value equality
  t.deepEqual(lines.pathIndices.value, [0, 2, 4, 6]);
  t.deepEqual(lines.positions.value, [100, 0, 101, 1, 100, 0, 101, 1, 102, 2, 103, 3]);
  t.deepEqual(lines.globalFeatureIds.value, [2, 2, 3, 3, 3, 3]);

  // Polygon value equality
  t.deepEqual(polygons.polygonIndices.value, [0, 5, 15, 20, 30]);
  t.deepEqual(polygons.primitivePolygonIndices.value, [0, 5, 10, 15, 20, 25, 30]);
  t.deepEqual(
    polygons.positions.value,
    Float32Array.from([
      100,
      0,
      101,
      0,
      101,
      1,
      100,
      1,
      100,
      0,
      100,
      0,
      101,
      0,
      101,
      1,
      100,
      1,
      100,
      0,
      100.8,
      0.8,
      100.8,
      0.2,
      100.2,
      0.2,
      100.2,
      0.8,
      100.8,
      0.8,
      102,
      2,
      103,
      2,
      103,
      3,
      102,
      3,
      102,
      2,
      100,
      0,
      101,
      0,
      101,
      1,
      100,
      1,
      100,
      0,
      100.2,
      0.2,
      100.2,
      0.8,
      100.8,
      0.8,
      100.8,
      0.2,
      100.2,
      0.2
    ])
  );
  t.deepEqual(polygons.globalFeatureIds.value, [
    4,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6
  ]);
  t.end();
});

test('gis#geojson-to-binary 3D features', async t => {
  const response = await fetchFile(FEATURES_3D);
  const {features} = await response.json();
  const {points, lines, polygons} = geojsonToBinary(features);

  // 3D size
  t.equal(points.positions.size, 3);
  t.equal(lines.positions.size, 3);
  t.equal(polygons.positions.size, 3);

  // Other arrays have coordinate size 1
  t.equal(points.globalFeatureIds.size, 1);
  t.equal(points.featureIds.size, 1);
  t.equal(lines.pathIndices.size, 1);
  t.equal(lines.globalFeatureIds.size, 1);
  t.equal(lines.featureIds.size, 1);
  t.equal(polygons.polygonIndices.size, 1);
  t.equal(polygons.primitivePolygonIndices.size, 1);
  t.equal(polygons.globalFeatureIds.size, 1);
  t.equal(polygons.featureIds.size, 1);

  // Point value equality
  t.deepEqual(points.positions.value, [100, 0, 1, 100, 0, 2, 101, 1, 3]);
  t.deepEqual(points.globalFeatureIds.value, [0, 1, 1]);

  // LineString value equality
  t.deepEqual(lines.pathIndices.value, [0, 2, 4, 6]);
  t.deepEqual(lines.positions.value, [
    100,
    0,
    4,
    101,
    1,
    5,
    100,
    0,
    6,
    101,
    1,
    7,
    102,
    2,
    8,
    103,
    3,
    9
  ]);
  t.deepEqual(lines.globalFeatureIds.value, [2, 2, 3, 3, 3, 3]);

  // Polygon value equality
  t.deepEqual(polygons.polygonIndices.value, [0, 5, 15, 20, 30]);
  t.deepEqual(polygons.primitivePolygonIndices.value, [0, 5, 10, 15, 20, 25, 30]);
  t.deepEqual(
    polygons.positions.value,
    Float32Array.from([
      100,
      0,
      10,
      101,
      0,
      11,
      101,
      1,
      12,
      100,
      1,
      13,
      100,
      0,
      14,
      100,
      0,
      15,
      101,
      0,
      16,
      101,
      1,
      17,
      100,
      1,
      18,
      100,
      0,
      19,
      100.8,
      0.8,
      20,
      100.8,
      0.2,
      21,
      100.2,
      0.2,
      22,
      100.2,
      0.8,
      23,
      100.8,
      0.8,
      24,
      102,
      2,
      25,
      103,
      2,
      26,
      103,
      3,
      27,
      102,
      3,
      28,
      102,
      2,
      29,
      100,
      0,
      30,
      101,
      0,
      31,
      101,
      1,
      32,
      100,
      1,
      33,
      100,
      0,
      34,
      100.2,
      0.2,
      35,
      100.2,
      0.8,
      36,
      100.8,
      0.8,
      37,
      100.8,
      0.2,
      38,
      100.2,
      0.2,
      39
    ])
  );
  t.end();
});
