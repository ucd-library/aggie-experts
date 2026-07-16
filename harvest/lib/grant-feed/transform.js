/**
 * Aggie Enterprise grant feed transform.
 *
 * Pure, fs-free XML -> CSV transformation for the AE grant feed. Replaces the
 * old Fuseki/SPARQL pipeline (grants2vivo.ru + grants.rq/links.rq/roles.rq).
 *
 * Input:  the fast-xml-parser JSON produced by commons/xml-to-json.js from an
 *         Aggie Enterprise award XML file (one <Document> with many <award>
 *         children).
 * Output: three arrays of row objects (metadata / links / persons) shaped for
 *         the Symplectic Elements import CSVs.
 *
 * The CSV column order, naming, filtering, sort order, title cleaning, and
 * cross-grant sponsor-label join are all faithful to the legacy SPARQL
 * pipeline so that `writeCsvs()` can reproduce the old CSV output byte-for-
 * byte given the same XML input.
 */
import { stringify } from 'csv-stringify/sync';

// vivo:Grant IRI prefix used by the old pipeline.
export const GRANT_IRI_PREFIX = 'ark:/87287/d7c08j/grant/';

// UCOP sponsor IRI prefix (from the old JSON-LD context @base).
export const SPONSOR_IRI_PREFIX = 'http://rems.ucop.edu/sponsor/';

// Purpose value (from <purpose>) -> funding-type column value emitted in the
// grants_metadata CSV. Purposes not in this map produce a grant_class that is
// filtered out by the old grants.rq VALUES clause (e.g.
// "78-Student Financial Aid" -> GrantStudentFinancialAid, which is commented
// out of grants.rq) or are simply unknown; those grants are excluded from the
// metadata CSV.
export const PURPOSE_TO_FUNDING_TYPE = {
  '43-Academic Support': 'Academic Support',
  '45-Research AES': 'Research',
  '68-Student Services': 'Student Services',
  'Capital Projects': 'Capital Projects',
  '40-Instruction': 'Instruction',
  '44-Research': 'Research',
  '62-Public Service/Other': 'Public Service / Other'
};

// XML participant <role> -> Symplectic link-type-id for the grants_links CSV.
// Mirrors the VALUES clause in query/links.rq (Grants Administrator is
// commented out there and is therefore excluded here too).
export const LINK_ROLE_TO_TYPE_ID = {
  'Principal Investigator': '120',
  'Co-Principal Investigator': '121',
  'Project Manager': '118',
  'Project Administrator': '137'
};

// Roles that produce a row in grants_persons.csv. From query/roles.rq the only
// roles selected are PI and Co-PI.
export const PERSON_ROLES = new Set([
  'Principal Investigator',
  'Co-Principal Investigator'
]);

// Exact CSV headers Symplectic expects. Historically the funder column was
// "funder name" (a literal space, from Fuseki rendering ?funder_name);
// Symplectic has since simplified that underlying field to "funder", so we 
// emit "funder".
export const METADATA_HEADERS = [
  'id',
  'category',
  'type',
  'title',
  'c-pi',
  'funder',
  'funder-reference',
  'start-date',
  'end-date',
  'amount-value',
  'amount-currency-code',
  'funding-type',
  'c-ucop-sponsor',
  'c-flow-thru-funding',
  'visible'
];

export const LINK_HEADERS = [
  'category-1',
  'id-1',
  'category-2',
  'id-2',
  'link-type-id',
  'visible'
];

export const PERSON_HEADERS = [
  'category',
  'id',
  'field-name',
  'surname',
  'first-name',
  'full-name'
];

/**
 * fast-xml-parser returns a single child object when an element appears once
 * and an array when it appears more than once. Normalize to an array.
 */
function toArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Does an XML <participant> carry every field the old grants2vivo.ru
 * OPTIONAL block requires? That block binds:
 *   ?g :participants/:participant [:person ?participant;
 *                                 :percentage ?role_percentage;
 *                                 :role ?role_role];
 *   ?participant :number ?p_number; :name ?p_name; :email ?p_email .
 * Missing any of these causes the triple pattern to fail, so the participant
 * is not inserted as an RDF role and therefore never appears in either
 * links.rq or roles.rq output. Notably, many AE awards list a PI participant
 * with no <percentage> element — those rows are silently dropped by the
 * legacy pipeline and we match that here.
 */
function isCompleteParticipant(p) {
  if (!p) return false;
  if (p.percentage === undefined || p.percentage === null || p.percentage === '') return false;
  if (!p.role) return false;
  const person = p.person;
  if (!person) return false;
  if (!person.number) return false;
  if (!person.name) return false;
  if (!person.email) return false;
  return true;
}

/**
 * Convert YYYY/MM/DD -> YYYY-MM-DD. The old SPARQL used
 * xsd:date(replace(?start_ymd,'/','-')).
 */
function normalizeDate(ymd) {
  if (!ymd) return '';
  return String(ymd).replace(/\//g, '-');
}

/**
 * Title cleaning from the old cleanTitles() step:
 *   - strip double-quotes
 *   - strip standalone PO references (incl. "PO# 12345", "PO#-")
 *   - strip dollar amounts like "$1,234.56"
 */
export function cleanTitle(title) {
  if (title === undefined || title === null) return '';
  let t = String(title);
  t = t.replace(/"/g, '');
  t = t.replace(/\bPO#?\s*?\:? ?[A-Za-z0-9\-]*\d+\b/g, '');
  t = t.replace(/\$\d+(?:,\d{3})*(?:\.\d{2})?/g, '');
  return t;
}

/**
 * Split a full name into (first_name, surname) the same way the old
 * roles.rq BIND clauses do:
 *   first_name = everything up to the last space
 *   surname    = the last token
 * When there is no space the SPARQL `replace` returns the input unchanged,
 * so both fields collapse to the full name.
 */
export function splitFullName(fullName) {
  const name = (fullName || '').trim();
  const m = /^(.*) ([^ ]+)$/.exec(name);
  if (!m) return { firstName: name, surname: name };
  return { firstName: m[1], surname: m[2] };
}

/**
 * Pull all awards out of the parsed XML. Handles both shapes
 * fast-xml-parser may produce (array vs single object).
 */
function getAwards(json) {
  const doc = json?.Document;
  if (!doc) return [];
  return toArray(doc.award);
}

/**
 * The old grants2vivo.ru rule IRI-concatenates the award number onto
 * <ark:/87287/d7c08j/grant/>. A `<number>` containing whitespace, `/`, or
 * `#` produces a syntactically invalid IRI and the INSERT silently drops
 * the grant, so it never appears in *any* of the three CSVs. We match that
 * behavior here: anything that would not round-trip as an IRI segment is
 * rejected.
 *
 * Observed offenders in production XML: numbers with spaces ("State Appro
 * Climate Initiative"), embedded PO paths ("A26-1696-S006/PO#UCDPO00242261"),
 * comma-separated pairs, etc.
 */
function isValidGrantNumber(number) {
  if (number === undefined || number === null) return false;
  const s = String(number);
  if (s.length === 0) return false;
  // Anything that breaks out of an IRI segment.
  return !/[\s\/#?&]/.test(s);
}

/**
 * Does this award have the minimum fields that the old grants2vivo.ru
 * rule requires to emit the vivo:Grant node? From the WHERE clause:
 *   ?g :name ?title; :type ?type; :number ?number; :status ?status;
 *      ?g_pred ?g_value;   <-- one of total_grant_amount / direct_costs /
 *                              indirect_costs / sponsor_award_number
 * Plus the implicit requirement that <number> be IRI-safe (see
 * isValidGrantNumber). Without these the grant does not appear in the
 * graph at all, so it cannot appear in links.csv or persons.csv either.
 */
function isCompleteForGraph(award) {
  if (!award) return false;
  if (!award.name || !award.type || !award.number || !award.status) return false;
  if (!isValidGrantNumber(award.number)) return false;
  return !!(
    award.total_grant_amount ||
    award.direct_costs ||
    award.indirect_costs ||
    award.sponsor_award_number
  );
}

/**
 * Build the global sponsor_code -> Set<label> index.
 *
 * The legacy SPARQL pipeline loaded every funding_source across every award
 * as `<sponsor_iri> rdfs:label <name>`; when grants.rq then joined
 * `?c_ucop_sponsor rdfs:label ?funder_name` each grant picked up *every*
 * label ever bound to its sponsor IRI, not just the label local to this
 * award. That's why single-funding-source awards sometimes produce multiple
 * rows in grants_metadata.csv with different funder-name spellings — we
 * reproduce that cross-grant join here.
 */
function buildSponsorLabelIndex(awards) {
  const labels = new Map(); // code -> Set<label>
  for (const award of awards) {
    if (!isCompleteForGraph(award)) continue;
    const sources = toArray(award.financial?.funding_sources?.funding_source);
    for (const src of sources) {
      const code = src?.ucop_sponsor_code;
      if (!code) continue;
      const name = src?.name || '';
      if (!labels.has(code)) labels.set(code, new Set());
      labels.get(code).add(name);
    }
  }
  return labels;
}

/**
 * Does an award qualify for a row in grants_metadata.csv?
 *
 * The old grants.rq query requires: rdfs:label (title), ucdlib:piName,
 * vivo:totalAwardAmount, vivo:dateTimeInterval start+end, and a
 * grant_class binding from the 7-row purpose VALUES clause (which
 * excludes "78-Student Financial Aid").
 */
function qualifiesForMetadata(award) {
  if (!isCompleteForGraph(award)) return false;
  if (!award.total_grant_amount) return false;
  if (!award.start_date || !award.end_date) return false;
  if (!award.principal_investigator?.name) return false;
  if (!(award.purpose in PURPOSE_TO_FUNDING_TYPE)) return false;
  return true;
}

/**
 * Build the rows for grants_metadata.csv.
 *
 * One row per (award, sponsor-label) pair. Awards whose funding_sources
 * contain no ucop_sponsor_code produce a single row with the funder,
 * funder-reference, and c-ucop-sponsor columns left blank (the old SPARQL
 * OPTIONAL fails for those).
 */
export function buildMetadataRows(awards) {
  const sponsorLabels = buildSponsorLabelIndex(awards);
  const rows = [];

  for (const award of awards) {
    if (!qualifiesForMetadata(award)) continue;

    const id = GRANT_IRI_PREFIX + award.number;
    const title = cleanTitle(award.name);
    const cPi = award.principal_investigator?.name || '';
    const fundingType = PURPOSE_TO_FUNDING_TYPE[award.purpose];
    const startDate = normalizeDate(award.start_date);
    const endDate = normalizeDate(award.end_date);
    const amount = award.total_grant_amount;
    // Intentional deviation from the legacy output: if the XML
    // <flow_thru_funding> node has no <ucop_sponsor_code>, it became a
    // blank node in JSON-LD and the old SPARQL OPTIONAL bound that blank
    // node, which Fuseki serialized as `b0`, `b1`, ... into this column
    // for ~5 grants per run. We emit an empty cell instead; downstream
    // consumers treat both the same (neither is a real sponsor IRI).
    const flowCode = award.financial?.flow_thru_funding?.ucop_sponsor_code;
    const cFlow = flowCode ? SPONSOR_IRI_PREFIX + flowCode : '';
    const funderRef = award.sponsor_award_number || '';

    // Funding sources with a ucop_sponsor_code drive "funder" rows; the
    // old SPARQL OPTIONAL { ?grant vivo:assignedBy ?c_ucop_sponsor; ... }
    // plus filter(isIRI(?c_ucop_sponsor)) excludes `<funding_source>` nodes
    // that had no code (they became blank nodes in JSON-LD).
    const sources = toArray(award.financial?.funding_sources?.funding_source)
      .filter(s => s?.ucop_sponsor_code);

    // The old SPARQL OPTIONAL also joins vivo:sponsorAwardId -> funder_ref,
    // so if there is no sponsor_award_number the whole OPTIONAL fails and
    // funder cells come out blank.
    const hasFunderBlock = sources.length > 0 && !!funderRef;

    if (!hasFunderBlock) {
      rows.push({
        id,
        category: 'grant',
        type: 'c-ucd-enterprise',
        title,
        'c-pi': cPi,
        'funder': '',
        'funder-reference': '',
        'start-date': startDate,
        'end-date': endDate,
        'amount-value': String(amount),
        'amount-currency-code': 'USD',
        'funding-type': fundingType,
        'c-ucop-sponsor': '',
        'c-flow-thru-funding': cFlow,
        visible: 'TRUE'
      });
      continue;
    }

    // Emit one row per (sponsor-code, label) using the cross-grant label
    // index so we match the SPARQL behavior described above.
    const seen = new Set();
    for (const src of sources) {
      const code = src.ucop_sponsor_code;
      const labels = sponsorLabels.get(code) || new Set([src.name || '']);
      // Stable alphabetical order so the output is deterministic regardless
      // of XML ordering.
      const sortedLabels = Array.from(labels).sort();
      for (const label of sortedLabels) {
        // The SELECT DISTINCT in grants.rq dedupes rows that would
        // otherwise collide on the whole row.
        const key = `${code}|${label}`;
        if (seen.has(key)) continue;
        seen.add(key);

        rows.push({
          id,
          category: 'grant',
          type: 'c-ucd-enterprise',
          title,
          'c-pi': cPi,
          'funder': label,
          'funder-reference': funderRef,
          'start-date': startDate,
          'end-date': endDate,
          'amount-value': String(amount),
          'amount-currency-code': 'USD',
          'funding-type': fundingType,
          'c-ucop-sponsor': SPONSOR_IRI_PREFIX + code,
          'c-flow-thru-funding': cFlow,
          visible: 'TRUE'
        });
      }
    }
  }

  // `order by ?id` in grants.rq -> lexicographic by grant IRI.
  rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return rows;
}

/**
 * Collect the set of every grant-level principal_investigator <number> across
 * every graph-complete award. This replicates the `?expert ucdlib:proprietary_id
 * ?ucpath` join in links.rq. In grants2vivo.ru the proprietary_id triple is
 * only inserted for `?pi` (not `?role_expert` — `?participant_id` in that
 * template is an unbound variable, so the triple silently drops for role
 * experts). Both `?pi` and `?role_expert` are derived from
 * md5(person_number), so a participant only carries a proprietary_id when
 * their number matches some grant's PI number. Participants who are never a
 * PI anywhere are filtered out of links.csv by the old query; we do the
 * same here.
 */
function buildPiNumberSet(awards) {
  const set = new Set();
  for (const award of awards) {
    if (!isCompleteForGraph(award)) continue;
    const num = award.principal_investigator?.number;
    if (num) set.add(String(num));
  }
  return set;
}

/**
 * Build the rows for grants_links.csv.
 *
 * One row per (award, participant, role) where the participant's <role> maps
 * to a Symplectic link-type-id. Operates over every award that has the
 * minimum grant fields (no purpose filter — links.rq only requires
 * `?grant a vivo:Grant`).
 *
 * Deduplication: Aggie Enterprise XML often lists the same person twice on
 * the same grant (e.g. PI-of-record entry plus an explicit PI participant
 * entry with identical fields). The old SPARQL pipeline collapsed these
 * because `?role = uri(concat(str(?grant), "#role_", md5(?participant_number)))`
 * is deterministic — identical participant_number values produced the same
 * RDF node. We reproduce that by deduping on (grant_id, participant_number,
 * role) before emitting rows.
 *
 * Proprietary-id filter: participants whose <number> is never used as a
 * grant-level PI in the dataset are filtered out (see buildPiNumberSet).
 */
export function buildLinkRows(awards) {
  const rows = [];
  const seen = new Set();
  const piNumbers = buildPiNumberSet(awards);

  for (const award of awards) {
    if (!isCompleteForGraph(award)) continue;
    const id = GRANT_IRI_PREFIX + award.number;
    const participants = toArray(award.participants?.participant);
    for (const p of participants) {
      if (!isCompleteParticipant(p)) continue;
      const role = p.role;
      const linkTypeId = LINK_ROLE_TO_TYPE_ID[role];
      if (!linkTypeId) continue;
      const number = String(p.person.number);
      if (!piNumbers.has(number)) continue;
      const key = `${id}|${number}|${linkTypeId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        'category-1': 'user',
        'id-1': String(number),
        'category-2': 'grant',
        'id-2': id,
        'link-type-id': linkTypeId,
        visible: 'TRUE'
      });
    }
  }

  // `order by ?id_2 ?id_1` -> by grant IRI, then user id.
  rows.sort((a, b) => {
    if (a['id-2'] !== b['id-2']) return a['id-2'] < b['id-2'] ? -1 : 1;
    if (a['id-1'] !== b['id-1']) return a['id-1'] < b['id-1'] ? -1 : 1;
    return 0;
  });
  return rows;
}

/**
 * Build the rows for grants_persons.csv — one row per (award, PI-or-Co-PI).
 *
 * Deduplication: same rationale as buildLinkRows. The old SPARQL collapses
 * duplicate participants on the same grant through a deterministic
 * md5(participant_number)-based IRI; we dedupe on (grant_id, number) here
 * before emitting rows.
 */
export function buildPersonRows(awards) {
  const rows = [];
  const seen = new Set();

  for (const award of awards) {
    if (!isCompleteForGraph(award)) continue;
    const id = GRANT_IRI_PREFIX + award.number;
    const participants = toArray(award.participants?.participant);
    for (const p of participants) {
      if (!isCompleteParticipant(p)) continue;
      if (!PERSON_ROLES.has(p.role)) continue;
      const fullName = p.person.name;
      const number = p.person.number;
      const key = `${id}|${number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const { firstName, surname } = splitFullName(fullName);
      rows.push({
        category: 'grant',
        id,
        'field-name': 'c-co-pis',
        surname,
        'first-name': firstName,
        'full-name': fullName
      });
    }
  }

  // `order by ?id ?surname ?first_name`.
  rows.sort((a, b) => {
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    if (a.surname !== b.surname) return a.surname < b.surname ? -1 : 1;
    if (a['first-name'] !== b['first-name']) return a['first-name'] < b['first-name'] ? -1 : 1;
    return 0;
  });
  return rows;
}

/**
 * Convenience that turns parsed-XML JSON into all three row arrays.
 */
export function buildAllRows(json) {
  const awards = getAwards(json);
  return {
    metadataRows: buildMetadataRows(awards),
    linkRows: buildLinkRows(awards),
    personRows: buildPersonRows(awards)
  };
}

/**
 * Serialize a row array to a CSV string with the supplied header order.
 * csv-stringify handles quoting per RFC 4180. We emit LF line endings
 * uniformly. (These generation files are intermediate and re-parsed by the
 * delta step, which accepts either; LF keeps them consistent with the delta
 * output that goes to Symplectic.)
 */
export function rowsToCsv(rows, columns) {
  return stringify(rows, { header: true, columns, record_delimiter: '\n' });
}

export default buildAllRows;
