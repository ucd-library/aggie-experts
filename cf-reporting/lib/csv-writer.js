import fs from 'fs';
import path from 'path';
import { stringify } from 'csv-stringify/sync';

/**
 * @description Serializes an array of flat row objects to CSV text, columns
 * taken from the first row's keys unless `columns` is given explicitly.
 * @param {Object} opts
 * @param {Array<Object>} opts.rows
 * @param {string[]} [opts.columns] - Explicit column order/selection.
 * @returns {string} CSV text, including a header row.
 */
export function rowsToCsv({ rows, columns } = {}) {
  const resolvedColumns = columns || (rows[0] ? Object.keys(rows[0]) : []);
  return stringify(rows, { header: true, columns: resolvedColumns });
}

/**
 * @description rowsToCsv() plus a write to disk, creating parent directories
 * as needed.
 * @param {Object} opts
 * @param {Array<Object>} opts.rows
 * @param {string[]} [opts.columns]
 * @param {string} opts.filePath
 * @returns {Promise<void>}
 */
export async function writeCsvFile({ rows, columns, filePath } = {}) {
  const csv = rowsToCsv({ rows, columns });
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, csv);
}

export default writeCsvFile;
