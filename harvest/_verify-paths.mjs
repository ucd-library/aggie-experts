import path from 'path';
import { config } from '@ucd-lib/experts-commons';
import * as cp from './lib/cache-paths.js';

const join = (k) => Array.isArray(k) ? path.join(...k) : k;
const uri = 'ark:/foo/bar-123';
const grp = 'experts';

const cases = [
  ['aeStdDirKey',               join(cp.aeStdDirKey()),               config.cache.aeStdFormatDir],
  ['aeStdPersonKey',            join(cp.aeStdPersonKey()),            path.join(config.cache.aeStdFormatDir, 'person.jsonld')],
  ['aeStdPersonKey (str form)', join(cp.aeStdPersonKey()),            'ae-std/person.jsonld'],
  ['aeStdPersonKey (arr form)', join(cp.aeStdPersonKey()),            join(['ae-std','person.jsonld'])],
  ['aeStdRelKey',               join(cp.aeStdRelKey(uri)),            path.join(config.cache.aeStdFormatDir, 'rel', `${uri}.jsonld`)],
  ['aeStdRelKey (arr form)',    join(cp.aeStdRelKey(uri)),            join(['ae-std','rel', uri+'.jsonld'])],
  ['aeWebappWorkKey',           join(cp.aeWebappWorkKey(uri)),        `${config.cache.aeWebappDir}/${uri}.json`],
  ['aeWebappWorkKey (str)',     join(cp.aeWebappWorkKey(uri)),        path.join('ae-webapp', uri+'.json')],
  ['webappExpertKey',           join(cp.webappExpertKey()),           'webapp/expert.jsonld'],
  ['webappExpertKey (arr)',     join(cp.webappExpertKey()),           join(['webapp','expert.jsonld'])],
  ['webappExpertBaseKey',       join(cp.webappExpertBaseKey()),       'webapp/expert-base.jsonld'],
  ['webappExpertSimplifiedKey', join(cp.webappExpertSimplifiedKey()), 'webapp/expert-simplified.jsonld'],
  ['metadataKey',               join(cp.metadataKey()),               'metadata.json'],
  ['privateMarkerKey',          join(cp.privateMarkerKey()),          'PRIVATE'],
  ['usersListFilename',         cp.usersListFilename(grp),            `users-list-${grp}.json`],
];

let fail = 0;
for (const [label, got, want] of cases) {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(28)} new="${got}"  old="${want}"`);
}
console.log(`\nconfig.cache.aeStdFormatDir=${config.cache.aeStdFormatDir}  aeWebappDir=${config.cache.aeWebappDir}`);
console.log(fail ? `\n${fail} MISMATCH(ES)` : '\nAll before/after paths identical');
process.exit(fail ? 1 : 0);
