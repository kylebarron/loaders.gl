import {parseHeader, BIG_ENDIAN, LITTLE_ENDIAN} from './util';


var SHAPE_HEADER_SIZE = 100;
// In line with the spec; the record header is just index, byte length
// geometry type is part of the record
var SHAPE_RECORD_HEADER_SIZE = 8;


export function parseShape(arrayBuffer) {
  var headerView = new DataView(arrayBuffer, 0, SHAPE_HEADER_SIZE);
  var header = parseHeader(headerView);

  var currentIndex = 0;
  var features = [];

  var offset = SHAPE_HEADER_SIZE;

  while (offset + SHAPE_RECORD_HEADER_SIZE < arrayBuffer.byteLength) {
    var recordHeaderView = new DataView(arrayBuffer, offset, SHAPE_RECORD_HEADER_SIZE);
    // Numbering starts at 1
    var recordNumber = recordHeaderView.getInt32(0, BIG_ENDIAN);
    // 2 byte words; includes the four words of record header
    var byteLength = recordHeaderView.getInt32(4, BIG_ENDIAN) * 2;
    // var type = recordHeaderView.getInt32(8, true);

    offset += 8;
    var recordView = new DataView(arrayBuffer, offset, byteLength);
    features.push(parseRecord(recordView));
    currentIndex++
    offset += byteLength;

    // // All records must have at least four bytes (for the record shape type)
    // if (byteLength < 4 || type !== header.type || recordNumber !== currentIndex) {
    //   // Malformed record, try again after advancing 4 bytes
    //   offset += 4;
    // } else {
    //   var recordView = new DataView(arrayBuffer, offset + 8, 4 + length);
    //   features.push(parseRecord(recordView));
    //   currentIndex++;
    //   offset += SHAPE_RECORD_HEADER_SIZE + byteLength;
    // }
  }

  features
  // TODO convert to geojson?
  return {
    header,
    features
  };
}

