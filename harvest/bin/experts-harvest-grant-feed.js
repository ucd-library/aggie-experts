#!/usr/bin/env node
/**
 * experts harvest grant-feed
 *
 * Replaces the old grants-import/bin/experts-grant-feed.js. Reads an Aggie
 * Enterprise award XML (local path or gs://...), parses it with
 * fast-xml-parser (via commons/xml-to-json.js), and writes the three
 * Symplectic Elements import CSVs to
 *     <output>/generation-<N>/{Prod_UCD_,}grants_metadata.csv
 *     <output>/generation-<N>/{Prod_UCD_,}grants_links.csv
 *     <output>/generation-<N>/{Prod_UCD_,}grants_persons.csv
 *
 * The old pipeline used Fuseki + SPARQL to produce these CSVs; this script
 * does the transform directly in JS. See ../lib/grant-feed/transform.js for
 * the detailed mapping of SPARQL -> JS rules.
 */
import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { logger, xmlToJson } from '@ucd-lib/experts-commons';
import {
  buildAllRows,
  rowsToCsv,
  METADATA_HEADERS,
  LINK_HEADERS,
  PERSON_HEADERS
} from '../lib/grant-feed/index.js';
import {
  parseGsUri,
  listGenerations,
  downloadGeneration
} from '../lib/grant-feed/gcs.js';

const program = new Command();

program
  .name('experts-harvest-grant-feed')
  .description('Transform an Aggie Enterprise grant XML feed into Symplectic import CSVs')
  .version('1.0.0')
  .option('--env <env>', 'QA | PROD (controls Prod_UCD_ filename prefix)', 'QA')
  .requiredOption('--xml <xml>', 'Source XML file: local path OR gs://bucket/path/to/file.xml')
  .requiredOption('-o, --output <output>', 'Root output directory (a generation-<N> subdir is created under this)')
  .option('-g, --generation <generation>', 'When --xml is a gs:// URI, which GCS generation to pull (0 = most recent)', '0')
  .action(async (opts) => {
    const prefix = opts.env === 'PROD' ? 'Prod_UCD_' : '';
    const outDir = path.join(opts.output, `generation-${opts.generation}`);
    fs.mkdirSync(outDir, { recursive: true });

    const xmlPath = await resolveXmlSource(opts.xml, outDir, opts.generation);

    logger.info(`Reading XML: ${xmlPath}`);
    const xml = fs.readFileSync(xmlPath, 'utf8');

    logger.info('Parsing XML -> JSON');
    const json = await xmlToJson(xml);

    logger.info('Building CSV rows');
    const { metadataRows, linkRows, personRows } = buildAllRows(json);
    logger.info(`Rows — metadata: ${metadataRows.length}, links: ${linkRows.length}, persons: ${personRows.length}`);

    const metaFile = path.join(outDir, `${prefix}grants_metadata.csv`);
    const linkFile = path.join(outDir, `${prefix}grants_links.csv`);
    const personFile = path.join(outDir, `${prefix}grants_persons.csv`);

    fs.writeFileSync(metaFile, rowsToCsv(metadataRows, METADATA_HEADERS));
    fs.writeFileSync(linkFile, rowsToCsv(linkRows, LINK_HEADERS));
    fs.writeFileSync(personFile, rowsToCsv(personRows, PERSON_HEADERS));

    logger.info(`Wrote ${metaFile}`);
    logger.info(`Wrote ${linkFile}`);
    logger.info(`Wrote ${personFile}`);
  });

/**
 * Accept either a local filesystem path or a gs://... URI. For GCS, pick the
 * requested generation (0 = newest) and save it under
 *   <outDir>/xml/<filename> so the raw input is preserved alongside the CSVs.
 */
async function resolveXmlSource(xmlOpt, outDir, generationIndex) {
  const gs = parseGsUri(xmlOpt);
  if (!gs) {
    // Local file: accept as-is.
    if (!fs.existsSync(xmlOpt)) {
      throw new Error(`XML not found at local path: ${xmlOpt}`);
    }
    return xmlOpt;
  }

  const xmlDir = path.join(outDir, 'xml');
  fs.mkdirSync(xmlDir, { recursive: true });
  const localPath = path.join(xmlDir, gs.fileName);

  const idx = parseInt(generationIndex, 10);
  const generations = await listGenerations(gs.bucket, gs.filePath);
  if (generations.length === 0) {
    throw new Error(`No generations of ${gs.filePath} found in bucket ${gs.bucket}`);
  }
  if (idx >= generations.length) {
    throw new Error(`Requested generation ${idx} but only ${generations.length} generation(s) exist`);
  }
  await downloadGeneration(gs.bucket, gs.filePath, localPath, generations[idx]);
  return localPath;
}

program.parseAsync(process.argv).catch(err => {
  logger.error('grant-feed transform failed', err);
  process.exit(1);
});
