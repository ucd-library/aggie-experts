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
 *   grants  -> id, category, type, title, c-pi, funder name, ...
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
 * Step 1: grants that are new or updated (matched by id).
 */
function diffGrants(newGrants, oldGrants) {
  const oldById = new Map(oldGrants.map(g => [g.id, g]));
  const delta = [];
  for (const g of newGrants) {
    const prev = oldById.get(g.id);
    if (!prev) {
      delta.push(g);
      continue;
    }
    if (rowsDiffer(prev, g)) delta.push(g);
  }
  return delta;
}

/**
 * Step 2: links that are new (id-2 missing in old), updated (same id-1+id-2
 * but different columns), or attached to a delta grant.
 */
function diffLinks(newLinks, oldLinks, deltaGrants) {
  const deltaGrantIds = new Set(deltaGrants.map(g => g.id));
  // Matches the legacy `oldLinks.find(...)` semantics: first match wins.
  // With multi-role participants (e.g. the same user listed as both PI and
  // Project Manager on one grant) there are two old links sharing the same
  // (id-1, id-2) key; using a last-write-wins Map would flip which link-type
  // acts as the "prev" for comparison and subtly change which new row gets
  // marked updated.
  const oldByPair = new Map();
  for (const l of oldLinks) {
    const k = `${l['id-1']}|${l['id-2']}`;
    if (!oldByPair.has(k)) oldByPair.set(k, l);
  }
  const oldByGrant = new Map();
  for (const l of oldLinks) {
    // The legacy code treats id-2 alone as the "new link" signal -
    // preserve that behavior.
    if (!oldByGrant.has(l['id-2'])) oldByGrant.set(l['id-2'], l);
  }

  const delta = [];
  for (const n of newLinks) {
    if (!oldByGrant.has(n['id-2'])) {
      delta.push(n);
      continue;
    }
    const prev = oldByPair.get(`${n['id-1']}|${n['id-2']}`);
    if (prev && rowsDiffer(prev, n)) {
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
 * deltaGrants. Mutates deltaGrants in place.
 *
 * Reproduces an off-by-variable bug in the legacy code
 * (grants-import/bin/experts-grant-feed-delta.js :: addGrantsLinked):
 * the loop iterates `i < deltaLinks.length` times but reads
 * `newLinks[i]["id-2"]`, so it effectively looks at the first N rows of
 * newLinks (N = current deltaLinks count), not at the delta links
 * themselves. That means it pulls in grants sitting at the top of the
 * alphabetically-sorted newLinks.csv regardless of whether they actually
 * changed — which is what the reference delta output contains, so we
 * match it here.
 */
function addGrantsLinked(deltaGrants, deltaLinks, newGrants, newLinks) {
  const haveIds = new Set(deltaGrants.map(g => g.id));
  const newById = new Map(newGrants.map(g => [g.id, g]));
  const n = Math.min(deltaLinks.length, newLinks.length);
  for (let i = 0; i < n; i++) {
    const gid = newLinks[i]?.['id-2'];
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
 * Note: the legacy code does NOT dedupe here — if a link was already
 * emitted by diffLinks (step 2) and its grant is also in deltaGrants, it
 * appears twice in the output. We replicate that so row counts match the
 * reference CSV byte-for-byte.
 */
function addLinks(deltaGrants, deltaLinks, newLinks) {
  const deltaGrantIds = new Set(deltaGrants.map(g => g.id));
  for (const l of newLinks) {
    if (!deltaGrantIds.has(l['id-2'])) continue;
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
 */
function findDeletedLinks(newLinks, oldLinks) {
  const newByPair = new Set(newLinks.map(l => `${l['id-1']}|${l['id-2']}`));
  const deletes = [];
  for (const o of oldLinks) {
    const key = `${o['id-1']}|${o['id-2']}`;
    if (newByPair.has(key)) continue;
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
 */
export function computeDelta({ newGrants, oldGrants, newLinks, oldLinks, newPersons, oldPersons }) {
  const deltaGrants = diffGrants(newGrants, oldGrants);
  const deltaLinks = diffLinks(newLinks, oldLinks, deltaGrants);
  addGrantsLinked(deltaGrants, deltaLinks, newGrants, newLinks);
  addLinks(deltaGrants, deltaLinks, newLinks);
  addUserLinks(deltaGrants, deltaLinks, newLinks);
  const deleteLinks = findDeletedLinks(newLinks, oldLinks);
  const deltaPersons = diffPersons(newPersons, oldPersons);
  return { deltaGrants, deltaLinks, deltaPersons, deleteLinks };
}

// Column order for the delete_user_grants_links.csv output (see legacy
// grants-import/bin/experts-grant-feed-delta.js).
export const DELETE_LINK_HEADERS = [
  'record_proprietary_id',
  'user_proprietary_id',
  'link_type_id'
];

export default computeDelta;
