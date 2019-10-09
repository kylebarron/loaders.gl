import {RowTableBatch} from '@loaders.gl/experimental/categories/table';
import {parse, parseInBatches, parseTextSync} from './lib/parse-json';

export default {
  name: 'JSON',
  extensions: ['json'],
  testText: null,
  parseTextSync
};

export const JSONTableLoader = {
  name: 'JSON',
  extensions: {
    json: null,
    jsonl: {stream: true},
    ndjson: {stream: true}
  },
  mimeTypes: {
    'application/json': null,
    'application/json-seq': {stream: true},
    'application/x-ndjson': {stream: true}
  },
  testText: null,
  parse,
  parseInBatches,
  options: {
    TableBatch: RowTableBatch
  }
};
