import {parseHeader, BIG_ENDIAN} from './util';
import {parseRecord} from './parse-geometry';


const SHAPE_HEADER_SIZE = 100;
// In line with the spec; the record header is just index, byte length
// geometry type is part of the record
const SHAPE_RECORD_HEADER_SIZE = 8;

export default function parseShape(arrayBuffer) {
  const headerView = new DataView(arrayBuffer, 0, SHAPE_HEADER_SIZE);
  const header = parseHeader(headerView);

  // eslint-disable-next-line
  let currentIndex = 0;
  const features = [];

  let offset = SHAPE_HEADER_SIZE;

  while (offset + SHAPE_RECORD_HEADER_SIZE < arrayBuffer.byteLength) {
    const recordHeaderView = new DataView(arrayBuffer, offset, SHAPE_RECORD_HEADER_SIZE);
    // Numbering starts at 1
    // eslint-disable-next-line
    const recordNumber = recordHeaderView.getInt32(0, BIG_ENDIAN);
    // 2 byte words; includes the four words of record header
    const byteLength = recordHeaderView.getInt32(4, BIG_ENDIAN) * 2;
    offset += Int32Array.BYTES_PER_ELEMENT * 2;
    // var type = recordHeaderView.getInt32(8, true);

    const recordView = new DataView(arrayBuffer, offset, byteLength);
    features.push(parseRecord(recordView));
    currentIndex++;
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

  return {
    header,
    features
  };
}
