import {LITTLE_ENDIAN} from './util';

export function parseRecord(view) {
  let offset = 0;
  const type = view.getInt32(offset, LITTLE_ENDIAN);
  offset += Int32Array.BYTES_PER_ELEMENT;

  switch (type) {
    case 0:
      return parseNull(view, offset);
    case 1:
      return parsePoint(view, offset, 2);
    case 3:
      return parsePoly(view, offset);
    case 5:
      return parsePoly(view, offset);
    case 8:
      return parseMultiPoint(view, offset);
    case 11:
      return parsePoint(view, offset, 4); // PointZ
    // case 13: return parsePolyLine(view, offset); // PolyLineZ
    // case 15: return parsePolygon(view, offset); // PolygonZ
    // case 18: return parseMultiPoint(view, offset); // MultiPointZ
    case 21:
      return parsePoint(view, offset, 3); // PointM
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

function parsePoint(view, offset, dim) {
  const bufferOffset = view.byteOffset + offset;
  const bufferLength = dim * Float64Array.BYTES_PER_ELEMENT;
  return new Float64Array(view.buffer.slice(bufferOffset, bufferOffset + bufferLength));
}

function parseMultiPoint(view, offset) {
  // skip parsing box
  offset += 4 * Float64Array.BYTES_PER_ELEMENT;

  const nPoints = view.getInt32(offset, LITTLE_ENDIAN);
  offset += Int32Array.BYTES_PER_ELEMENT;

  return parse2dPositions(view, offset, nPoints);
}

// MultiPolygon doesn't exist? Multiple records with the same attributes?
// polygon and polyline parsing
// This is 2d only
function parsePoly(view, offset) {
  // skip parsing bounding box
  offset += 4 * Float64Array.BYTES_PER_ELEMENT;

  const nParts = view.getInt32(offset, LITTLE_ENDIAN);
  offset += Int32Array.BYTES_PER_ELEMENT;
  const nPoints = view.getInt32(offset, LITTLE_ENDIAN);
  offset += Int32Array.BYTES_PER_ELEMENT;

  // Load parts directly into int32 array
  // Note, doesn't include length of positions; hence is one shorter than deck expects
  const bufferOffset = view.byteOffset + offset;
  const bufferLength = nParts * Int32Array.BYTES_PER_ELEMENT;
  const indices = new Int32Array(view.buffer.slice(bufferOffset, bufferOffset + bufferLength));
  offset += nParts * Int32Array.BYTES_PER_ELEMENT;

  return {
    positions: parse2dPositions(view, offset, nPoints),
    indices
  };
}

function parse2dPositions(view, offset, nPoints) {
  const bufferOffset = view.byteOffset + offset;
  const bufferLength = nPoints * 2 * Float64Array.BYTES_PER_ELEMENT;
  return new Float64Array(view.buffer.slice(bufferOffset, bufferOffset + bufferLength));
}
