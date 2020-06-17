/* eslint-disable */
// var {readFileSync} = require('fs');
// var path = '../../shp/PADUS2_0CO_Shapefile/PADUS2_0Proclamation_CO.shx';
// var arrayBuffer = readFileSync(path).buffer;

var SHX_HEADER_SIZE = 100;

var LITTLE_ENDIAN = true;
var BIG_ENDIAN = false;

function parseShx(arrayBuffer) {
  // var headerView = new DataView(arrayBuffer, 0, SHX_HEADER_SIZE);
  // var header = parseHeader(headerView);

  var contentView = new DataView(arrayBuffer, SHX_HEADER_SIZE);

  // Note: this byteLength is incorrect for small buffers in Node; it'll always show 8192
  // https://github.com/protobufjs/protobuf.js/issues/852
  var {byteLength} = contentView;
  var byteOffsets = new Int32Array(byteLength);
  var byteLengths = new Int32Array(byteLength);

  var recordIndex = 0;
  while (true) {
    var recordOffset = contentView.getInt32(recordIndex * 8, BIG_ENDIAN);
    var recordByteLength = contentView.getInt32(recordIndex * 8 + 4, BIG_ENDIAN);
    if (recordOffset === 0) {
      break;
    }

    byteOffsets[recordIndex] = recordOffset;
    byteLengths[recordIndex] = recordByteLength;
    recordIndex++;
  }

  return {
    offsets: byteOffsets.subarray(0, recordIndex),
    lengths: byteLengths.subarray(0, recordIndex)
  };
}
