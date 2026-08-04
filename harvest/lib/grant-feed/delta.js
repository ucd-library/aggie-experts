/**
 * Compute the grant-feed delta (new/updated/deleted) between two generations
 * of the AE grant CSVs.
 *
 * Ported from the old grants-import/bin/experts-grant-feed-delta.js but
 * reshaped as pure async functions that take and return rows, so the CLI
 * wrapper owns all filesystem IO.
 *
 * Inputs (per generation): arrays of row objects keyed by the header names
 * emitted by ../transform.js:
 *   grants  -> id, category, type, title, c-pi, funder, ...
 *   links   -> category-1, id-1, category-2, id-2, link-type-id, visible
 *   persons -> category, id, field-name, surname, first-name, full-name
 *
 * Outputs:
 *   deltaGrants, deltaLinks, deltaPersons, deleteLinks
 *
 * The algorithm is the one the old pipeline used, just de-tangled from the
 * streaming csv-parser callbacks:
 *
 *   1. deltaGrants  = grants whose "id" is new or whose columns differ
 *   2. deltaLinks   = links that are new, updated, OR whose id-2 is a delta grant
 *   3. addGrantsLinked   pulls in grants referenced by delta links
 *   4. addLinks          pulls in every newLink whose id-2 is a delta grant
 *   5. addUserLinks      ensures each delta grant has at least one user link
 *   6. findDeletedLinks  finds oldLinks whose (id-1, id-2) vanished from newLinks
 *   7. deltaPersons = persons that are new or whose columns differ
 */

/**
 * Shallow "any column changed" comparison used to detect updates.
 */
function rowsDiffer(a, b) {
  for (const key of Object.keys(a)) {
    if (a[key] !== b[key]) return true;
  }
  for (const key of Object.keys(b)) {
    if (a[key] !== b[key]) return true;
  }
  return false;
}

/**
 * Canonical, order-independent key for a full CSV row, so sets of rows can be
 * compared as multisets regardless of column or row ordering.
 */
function rowKey(row) {
  return Object.keys(row)
    .sort()
    .map(k => `${k}=${row[k]}`)
    .join('');
}

/**
 * True if two lists of rows differ as multisets (same rows, any order = equal).
 */
function rowSetsDiffer(a, b) {
  if (a.length !== b.length) return true;
  const ka = a.map(rowKey).sort();
  const kb = b.map(rowKey).sort();
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return true;
  }
  return false;
}

/**
 * Group rows by grant id, preserving first-seen order of the ids.
 */
function groupById(rows) {
  const byId = new Map();
  for (const r of rows) {
    const bucket = byId.get(r.id);
    if (bucket) bucket.push(r);
    else byId.set(r.id, [r]);
  }
  return byId;
}

/**
 * Step 1: grants that are new or updated.
 *
 * A single grant can span multiple metadata rows — e.g. a grant with two
 * funding sources produces two rows sharing the same id that differ only in
 * the "funder name" column. The previous implementation keyed the old rows by
 * id alone (last-write-wins), so for such grants one row always compared
 * against the wrong twin and the grant was reported as "updated" on every
 * run even when nothing had changed (a phantom delta that also cascaded into
 * links via addGrantsLinked/addLinks). We instead compare the full set of
 * rows for each id and, when it changed, emit all of that grant's new rows
 * (in input order) so Symplectic receives the complete record.
 */
function diffGrants(newGrants, oldGrants) {
  const oldById = groupById(oldGrants);
  const newById = groupById(newGrants);
  const changedIds = new Set();
  for (const [id, rows] of newById) {
    const prev = oldById.get(id);
    if (!prev || rowSetsDiffer(prev, rows)) changedIds.add(id);
  }
  return newGrants.filter(g => changedIds.has(g.id));
}

/**
 * Step 2: a link belongs in the delta if it is new, updated, or attached to a
 * delta grant.
 *
 * Both the "new?" and "updated?" checks are keyed by the full link identity
 * (id-1, id-2, link-type-id). A user can hold two roles on one grant (e.g. PI
 * and Project Manager), producing two links that share the same (id-1, id-2)
 * pair but differ only in link-type-id. The previous implementation keyed the
 * "updated?" comparison by that pair alone, so the second role compared
 * against the first and was reported as "updated" on every run even when
 * nothing changed — a phantom delta. It also detected "new" links by grant
 * (id-2) alone, which could not distinguish a brand-new grant from a new role
 * added to an existing grant (that case only got picked up as a side effect
 * of the same pair collision). Keying everything by the triple fixes both:
 *   - new link (including a newly-added role/user on an existing grant):
 *       triple absent from old
 *   - updated link (e.g. visibility flipped): triple present, columns differ
 *   - otherwise included only if its grant is itself in the delta
 */
function diffLinks(newLinks, oldLinks, deltaGrants) {
  const deltaGrantIds = new Set(deltaGrants.map(g => g.id));
  const oldByTriple = new Map();
  for (const l of oldLinks) {
    const k = `${l['id-1']}|${l['id-2']}|${l['link-type-id']}`;
    if (!oldByTriple.has(k)) oldByTriple.set(k, l);
  }

  const delta = [];
  for (const n of newLinks) {
    const prev = oldByTriple.get(`${n['id-1']}|${n['id-2']}|${n['link-type-id']}`);
    if (!prev) {
      delta.push(n);
      continue;
    }
    if (rowsDiffer(prev, n)) {
      delta.push(n);
      continue;
    }
    if (deltaGrantIds.has(n['id-2'])) {
      delta.push(n);
    }
  }
  return delta;
}

/**
 * Step 3: pull grants that are referenced by delta links but not yet in
 * deltaGrants (e.g. a grant whose metadata is unchanged but which gained a
 * new or updated link). Mutates deltaGrants in place.
 *
 * The legacy code (grants-import/bin/experts-grant-feed-delta.js ::
 * addGrantsLinked) had an off-by-variable bug: it iterated
 * `i < deltaLinks.length` but read `newLinks[i]["id-2"]`, so it pulled in
 * whatever grants happened to sit at the top of the alphabetically-sorted
 * newLinks.csv rather than the grants actually referenced by the delta
 * links. That both included unchanged grants and missed genuinely
 * link-changed ones. We iterate the delta links themselves, as intended.
 */
function addGrantsLinked(deltaGrants, deltaLinks, newGrants) {
  const haveIds = new Set(deltaGrants.map(g => g.id));
  const newById = new Map(newGrants.map(g => [g.id, g]));
  for (const l of deltaLinks) {
    const gid = l['id-2'];
    if (!gid || haveIds.has(gid)) continue;
    const g = newById.get(gid);
    if (g) {
      deltaGrants.push(g);
      haveIds.add(gid);
    }
  }
}

/**
 * Step 4: for each delta grant, pull in every new link that points at it
 * (so downstream gets the full link set for changed grants).
 *
 * The legacy code had a bug here: it did NOT dedupe, so any link already
 * emitted by diffLinks (step 2) whose grant is also in deltaGrants appeared
 * twice in grants_links.csv. That duplication is a real defect in the old
 * output (Symplectic would receive the same user->grant link row twice), not
 * intended behavior, so we skip links already present. Links are keyed by
 * (id-1, id-2, link-type-id) because one user can hold two roles on the same
 * grant, producing two legitimately distinct link rows.
 */
function addLinks(deltaGrants, deltaLinks, newLinks) {
  const deltaGrantIds = new Set(deltaGrants.map(g => g.id));
  const seen = new Set(
    deltaLinks.map(l => `${l['id-1']}|${l['id-2']}|${l['link-type-id']}`)
  );
  for (const l of newLinks) {
    if (!deltaGrantIds.has(l['id-2'])) continue;
    const key = `${l['id-1']}|${l['id-2']}|${l['link-type-id']}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deltaLinks.push(l);
  }
}

/**
 * Step 5: if a delta grant has no matching link in deltaLinks, copy the
 * first new link that references that grant (preserves the legacy fallback
 * so Symplectic doesn't receive an orphaned grant).
 */
function addUserLinks(deltaGrants, deltaLinks, newLinks) {
  const haveForGrant = new Set(deltaLinks.map(l => l['id-2']));
  for (const g of deltaGrants) {
    if (haveForGrant.has(g.id)) continue;
    const replacement = newLinks.find(l => l['id-2'] === g.id);
    if (replacement) {
      deltaLinks.push(replacement);
      haveForGrant.add(g.id);
    }
  }
}

/**
 * Step 6: old links that are no longer in the new feed, remapped to the
 * delete_user_grants_links schema (record_proprietary_id,
 * user_proprietary_id, link_type_id).
 *
 * Corrected an existing bug in the legacy Fuseki/SPARQL logic:
 * Now keyed by the full (id-1, id-2, link-type-id) triple — same as the rest of 
 * the delta — not just the (id-1, id-2) user/grant pair. Symplectic's delete 
 * utility removes one specific link type per row, so a user who drops one role 
 * but keeps another on the same grant must still emit a delete for the dropped 
 * role; pair-keying would suppress it (the pair still exists via the surviving 
 * role) and leave the stale role link in Elements.
 */
function findDeletedLinks(newLinks, oldLinks) {
  const newByTriple = new Set(
    newLinks.map(l => `${l['id-1']}|${l['id-2']}|${l['link-type-id']}`)
  );
  const deletes = [];
  for (const o of oldLinks) {
    const key = `${o['id-1']}|${o['id-2']}|${o['link-type-id']}`;
    if (newByTriple.has(key)) continue;
    deletes.push({
      record_proprietary_id: o['id-2'],
      user_proprietary_id: o['id-1'],
      link_type_id: o['link-type-id']
    });
  }
  return deletes;
}

/**
 * Step 7: persons that are new or updated. The legacy code matched on
 * (id, full-name) because the same grant can have multiple persons.
 */
function diffPersons(newPersons, oldPersons) {
  const oldByKey = new Map(
    oldPersons.map(p => [`${p.id}|${p['full-name']}`, p])
  );
  const delta = [];
  for (const n of newPersons) {
    const key = `${n.id}|${n['full-name']}`;
    const prev = oldByKey.get(key);
    if (!prev) {
      delta.push(n);
      continue;
    }
    if (rowsDiffer(prev, n)) delta.push(n);
  }
  return delta;
}

/**
 * Compute all four delta sets in one pass.
 *
 * Also returns newGrantIds: the delta grants whose id is absent from
 * oldGrants (last week's full generation) — i.e. genuinely new grants, as
 * opposed to updated ones. This is computed here (where both generations are
 * already in hand) so downstream reporting doesn't have to re-read and
 * re-diff last week's generation to classify new vs updated.
 */
export function computeDelta({ newGrants, oldGrants, newLinks, oldLinks, newPersons, oldPersons }) {
  const deltaGrants = diffGrants(newGrants, oldGrants);
  const deltaLinks = diffLinks(newLinks, oldLinks, deltaGrants);
  addGrantsLinked(deltaGrants, deltaLinks, newGrants);
  addLinks(deltaGrants, deltaLinks, newLinks);
  addUserLinks(deltaGrants, deltaLinks, newLinks);
  const deleteLinks = findDeletedLinks(newLinks, oldLinks);
  const deltaPersons = diffPersons(newPersons, oldPersons);

  const oldGrantIds = new Set(oldGrants.map(g => g.id));
  const newGrantIds = [...new Set(deltaGrants.map(g => g.id))].filter(id => !oldGrantIds.has(id));

  return { deltaGrants, deltaLinks, deltaPersons, deleteLinks, newGrantIds };
}

// Column order for the delete_user_grants_links.csv output (see legacy
// grants-import/bin/experts-grant-feed-delta.js).
export const DELETE_LINK_HEADERS = [
  'record_proprietary_id',
  'user_proprietary_id',
  'link_type_id'
];

export default computeDelta;
