/* eslint-disable */
import {BIG_ENDIAN, LITTLE_ENDIAN} from './util';

function parseRecord(view) {
  var offset = 0;
  var type = view.getInt32(offset, LITTLE_ENDIAN);
  offset += 4;
  switch (type) {
    case 0:
      return parseNull(view, offset);
    case 1:
      return parsePoint(view, offset);
    case 3:
      return parsePoly(view, offset);
    case 5:
      return parsePoly(view, offset);
    case 8:
      return parseMultiPoint(view, offset);
    // case 11: return parsePoint(view, offset); // PointZ
    // case 13: return parsePolyLine(view, offset); // PolyLineZ
    // case 15: return parsePolygon(view, offset); // PolygonZ
    // case 18: return parseMultiPoint(view, offset); // MultiPointZ
    // case 21: return parsePoint(view, offset); // PointM
    // case 23: return parsePolyLine(view, offset); // PolyLineM
    // case 25: return parsePolygon(view, offset); // PolygonM
    // case 28: return parseMultiPoint(view, offset);// MultiPointM
    default:
      throw new Error(`unsupported shape type: ${type}`);
  }
}

function parseNull(view, offset) {
  return null;
}

function parsePoint(view, offset) {
  var positions = new Float64Array(2);
  positions[0] = view.getFloat64(offset, LITTLE_ENDIAN);
  offset += 8;
  positions[1] = view.getFloat64(offset, LITTLE_ENDIAN);
  offset += 8;

  return positions;
}

function parseMultiPoint(view, offset) {
  // skip parsing box
  offset += 4 * 8;

  var nPoints = view.getInt32(offset, LITTLE_ENDIAN);
  offset += 4;

  return parse2dPositions(view, offset, nPoints);
}

// MultiPolygon doesn't exist? Multiple records with the same attributes?
// polygon and polyline parsing
// This is 2d only
function parsePoly(view, offset) {
  // Do I need to parse box, or just skip over it?
  var minX = view.getFloat64(offset, LITTLE_ENDIAN);
  offset += 8;
  var minY = view.getFloat64(offset, LITTLE_ENDIAN);
  offset += 8;
  var maxX = view.getFloat64(offset, LITTLE_ENDIAN);
  offset += 8;
  var maxY = view.getFloat64(offset, LITTLE_ENDIAN);
  offset += 8;

  var nParts = view.getInt32(offset, LITTLE_ENDIAN);
  offset += 4;
  var nPoints = view.getInt32(offset, LITTLE_ENDIAN);
  offset += 4;

  // Load parts directly into int32 array
  // Note, doesn't include length of positions; hence is one shorter than deck expects
  var indices = new Int32Array(view.buffer, view.byteOffset + offset, nParts);
  offset += nParts * 4;

  return {
    positions: parse2dPositions(view, offset, nPoints),
    indices
  };
}

function parse2dPositions(view, offset, nPoints) {
  // Loading array from a contiguous block of data is ~20x faster than a for
  // loop, but only a 50-50 chance of 8-byte alignment
  var positions;
  var bufferOffset = view.byteOffset + offset;
  if (bufferOffset % 8) {
    positions = new Float64Array(nPoints * 2);
    for (var i = 0; i < nPoints; i++) {
      positions[i * 2] = view.getFloat64(offset, LITTLE_ENDIAN);
      offset += 8;
      positions[i * 2 + 1] = view.getFloat64(offset, LITTLE_ENDIAN);
      offset += 8;
    }
  } else {
    // Note, host must be little endian
    positions = new Float64Array(view.buffer, view.byteOffset + offset, nPoints * 2);
  }

  return positions;
}
