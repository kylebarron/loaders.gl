/* global Buffer */
import {AsyncQueue} from '@loaders.gl/experimental';
import {TableBatchBuilder, RowTableBatch} from '@loaders.gl/experimental/categories/table';
import JSONParser from './json-parser/json-parser';

export function parseTextSync(text, options) {
  return JSON.parse(text);
}

export function parse(data, options) {
  return new Promise((resolve, reject) => {
    const buffer = new Buffer(data);
    const parser = new JSONParser();
    parser.onValue = resolve;
    parser.onError = reject;
    parser.parseChunk(buffer);
    parser.parseEnd();
  });
}

// TODO - support batch size 0 = no batching/single batch?
export async function parseInBatches(asyncIterator, options) {
  // options
  const {batchSize = 10, TableBatch = RowTableBatch} = options;

  const asyncQueue = new AsyncQueue();
  let tableBatchBuilder = null;

  // called on every "row"
  function onValue(results, parser) {
    const row = results.data;

    // If first data row, we can deduce the schema
    if (!tableBatchBuilder) {
      const schema = options.schema || deduceSchema(row);
      tableBatchBuilder = new TableBatchBuilder(TableBatch, schema, batchSize);
    }

    // Add the row
    tableBatchBuilder.addRow(row);

    // If a batch has been completed, emit it
    if (tableBatchBuilder.isFull()) {
      asyncQueue.enqueue(tableBatchBuilder.getNormalizedBatch());
    }
  }
  const jsonParser = new JSONParser({
    dynamicTyping: true, // Convert numbers and boolean values in rows from strings
    onValue
  });

  for await (const chunk of asyncIterator) {
    jsonParser.parseChunk(chunk);
    // TODO - By default, we generate batch for each chunk. Disable if batchSize is requested?
    // TODO - No need to enqueue? Just yield it?
    asyncQueue.enqueue(tableBatchBuilder.getNormalizedBatch());
  }
  jsonParser.parseEnd();

  // Ensure any final (partial) batch gets emitted
  const batch = tableBatchBuilder.getNormalizedBatch();
  if (batch) {
    asyncQueue.enqueue(batch);
  }
  asyncQueue.close();

  return asyncQueue;
}

function deduceSchema(row, headerRow) {
  const schema = headerRow ? {} : [];
  for (let i = 0; i < row.length; i++) {
    const columnName = (headerRow && headerRow[i]) || i;
    const value = row[i];
    switch (typeof value) {
      case 'number':
      case 'boolean':
        // TODO - booleans could be handled differently...
        schema[columnName] = {name: String(columnName), index: i, type: Float32Array};
        break;
      case 'string':
      default:
        schema[columnName] = {name: String(columnName), index: i, type: Array};
      // We currently only handle numeric rows
      // TODO we could offer a function to map strings to numbers?
    }
  }
  return schema;
}
