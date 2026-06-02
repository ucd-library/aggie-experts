# SiteFarm API Documentation

The SiteFarm API exposes the public expert profile data — identifiers, contact info, a short overview, and the expert's five most-recent works — in a shape consumed by the UCD SiteFarm websites that embed Aggie Experts content. All endpoints require SiteFarm access permission.

## Base URL

```
http://localhost:3000/api/sitefarm
```

## Authentication

All endpoints require bearer token authentication via the `has_access('sitefarm')` middleware.

---

## Business Rules

### Expert Visibility

The SiteFarm API only returns data for experts whose expert document is marked `is-visible: true`. Experts that fail the visibility gate (private profile, missing PPS associations, ODR `nameWwwFlag === 'N'`, etc.) are silently dropped from the response.

### Publication Selection

The `publications` array on each expert is capped at the **five most-recent works**, sorted by:

1. `issued` date, descending (most recent first)
2. `title`, ascending, as a tiebreaker

Works without a usable `issued` date sort to the bottom. Mis-formatted works (`invalid-title` or `invalid-issued` flags set during transform) are excluded.

### Per-Expert Filtering of `relatedBy`

Each publication's `relatedBy` array is filtered to **only the relationships where the queried expert is the subject** — i.e. relationships whose `relates` field includes the queried expert's `@id`. Co-author relationships keyed on other experts are dropped before the response is sent.

Additionally:

- The `ucdlib:favourite` flag is normalized to a boolean (defaults to `false` when missing).
- The `author` property is normalized to always be an array.

### Contact Info Composition

`contactInfo` is built by combining two vcard entries from the expert document:

- The **preferred contact** entry (`isPreferred: true`) supplies name, email, organizational unit, and title fields.
- The **rank-20 entry** (the OAP/CDL personal-websites bucket) supplies the `hasURL` list.

The resulting `contactInfo.hasURL` is always an array (or `null` if no websites were published), and each URL's `@type` is normalized to an array.

### Overview Composition

The `overview` field on the response is the concatenation of the expert's `overview` and `researchInterests` text values, joined by a single space when both are present.

---

## Endpoints

### 1. GET `/experts/:ids`

Returns one expert profile per requested identifier. Reads from Elasticsearch.

**Authentication:** Required (SiteFarm access)

**Path Parameters:**
- `ids` (string, required) — comma-separated list of expert identifiers. Each id can be an email, UCD Person UUID, or IAM ID; the route resolves each through Keycloak to an internal `expert/{expertId}` reference before querying.

**Query Parameters:**
- `modified_since` (string, optional) — only return experts whose expert document has been re-indexed on or after this date. Format: `YYYY-MM-DD`. Defaults to `2021-01-01`.
- `previewEsIndex` (string, optional) — when supplied, the route queries against the preview index suffix (`experts-{previewEsIndex}`, `works-{previewEsIndex}`, `grants-{previewEsIndex}`) rather than the live aliases.

**Response:**

```json
[
  {
    "@id": "expert/Z69UnXfY",
    "publications": [
      {
        "@id": "ark:/87287/d7mh2m/publication/14476891",
        "@type": ["Work", "Article"],
        "title": "Detecting intrusions in sensor networks",
        "issued": "2009",
        "container-title": "IEEE Transactions on Dependable and Secure Computing",
        "volume": "6",
        "page": "12-24",
        "DOI": "10.1109/TDSC.2009.12",
        "author": [
          { "given": "Matthew", "family": "Bishop", "rank": 1 },
          { "given": "Karl",    "family": "Levitt",  "rank": 2 }
        ],
        "relatedBy": [
          {
            "@id": "ark:/87287/d7mh2m/relationship/14476891",
            "@type": ["Authorship"],
            "relates": ["expert/Z69UnXfY", "ark:/87287/d7mh2m/publication/14476891"],
            "is-visible": true,
            "ucdlib:favourite": false,
            "rank": 1
          }
        ]
      }
    ],
    "contactInfo": {
      "@id": "ark:/87287/d7c08j/user/0000123#pps-11",
      "isPreferred": true,
      "name": "Bishop, Matthew § Professor, Computer Science",
      "hasEmail": "mailto:mbishop@ucdavis.edu",
      "hasURL": [
        {
          "@id": "http://experts.ucdavis.edu/expert/Z69UnXfY#vcard-oap-1-url-1",
          "@type": ["URL"],
          "url": "https://my.example.edu/lab"
        }
      ]
    },
    "orcidId": "0000-0002-1825-0097",
    "researcherId": "A-1234-5678",
    "scopusId": "7005012345",
    "overview": "Faculty in computer security. Research interests include intrusion detection, network forensics, and election security.",
    "modified-date": "2025-09-12T14:33:08.241Z"
  }
]
```

**Field Descriptions:**
- `@id` — Expert URI (matches the `expert/{expertId}` form used by other Aggie Experts APIs).
- `publications` — Array of up to five Work nodes, most-recent first. Each is the work's full JSON-LD document with `relatedBy` filtered to relationships involving this expert.
- `contactInfo` — The expert's preferred vcard, plus a `hasURL` list of personal websites pulled from the rank-20 OAP/CDL vcard. `hasURL` is always an array or `null`.
- `orcidId`, `researcherId`, `scopusId` — Persistent author identifiers, when present.
- `overview` — Concatenation of the expert's overview and research interests (space-joined when both exist).
- `modified-date` — Timestamp indicating when the expert document was last written to Elasticsearch (set by the `aggie-experts-pipeline` ingest pipeline).

**Status Codes:**
- `200` — Success (empty array if no requested ids resolve or pass the visibility gate)
- `400` — Invalid `modified_since` format
- `500` — Internal error fetching expert data

**Example:**

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/sitefarm/experts/mbishop@ucdavis.edu,jsmith@ucdavis.edu?modified_since=2025-01-01"
```

---

### 2. GET `/experts_pg/:ids`

Returns the same response shape as `/experts/:ids`, but sourced from the Postgres `api` schema projection rather than Elasticsearch. Provided so SiteFarm clients can be migrated off the Elasticsearch dependency.

**Authentication:** Required (SiteFarm access)

**Path Parameters:**
- `ids` (string, required) — same as `/experts/:ids`.

**Query Parameters:**
- `modified_since` (string, optional) — only return experts whose `api."user".last_seen_cdl` is on or after this date. Format: `YYYY-MM-DD`. When omitted, no time-based filter is applied.

**Response:**

Identical schema to `/experts/:ids`. Field-level differences worth knowing about:

- `modified-date` is `api."user".last_seen_cdl` rendered as an ISO timestamp. It bumps on every weekly load (analogous to the Elasticsearch ingest pipeline's `modified-date`).
- `publications` are pulled from the `api."work"` and `api.expert_work_role` tables. The work `raw_payload` JSONB column stores the full ae-std work node, so the publication body is byte-equivalent to what Elasticsearch returned — minus any fields that depended on ES-side transforms.
- `contactInfo` is reconstructed from the `api."user".contact_info` JSONB column, which was populated from `ae-std/person.jsonld` at load time.

**Status Codes:**
- `200` — Success (empty array if no requested ids match or pass `modified_since`)
- `400` — Invalid `modified_since` format
- `500` — Postgres error or internal error

**Example:**

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/sitefarm/experts_pg/mbishop@ucdavis.edu?modified_since=2026-01-01"
```

---

## Data Sources

| Endpoint           | Expert profile fields      | Works                              | Modified-date                                |
| ------------------ | -------------------------- | ---------------------------------- | -------------------------------------------- |
| `/experts/:ids`    | `experts-*` ES index       | `works-*` ES index, filtered to 5  | ES ingest pipeline timestamp (`modified-date`) |
| `/experts_pg/:ids` | `api."user"`               | `api."work"` + `api.expert_work_role`       | `api."user".last_seen_cdl`                   |

The Postgres path is populated by `harvest/lib/reporting/index.js` from ae-std documents:

- Profile fields ← `ae-std/person.jsonld`
- Work nodes + roles ← `ae-std/rel/{relationshipUri}.jsonld`

---

## Implementation notes (Postgres path)

The PG path bypasses the JSON-LD framing/compaction machinery used by the
elasticsearch path and instead normalizes the ae-std expanded form to the
ES-shape directly. A few non-obvious rules to know about — these all live in
`harvest/lib/reporting/index.js` and exist to keep the PG response byte-for-byte
equivalent to what ES returns.

**Type compaction is non-uniform** and driven by an explicit `TYPE_COMPACTION`
table. The webapp JSON-LD context defines named terms for some types (which
collapse to bare names: `Work`, `Authorship`, `Name`, `URL`, `Title`,
`ScholarlyArticle`, …) but not others (which keep their namespace prefix:
`vcard:Organization`, `vcard:Individual`, `ucdlib:Authorship`). The table
hardcodes this mapping; add new entries as new types appear.

**Most csl:\* publication fields compact to bare names** (`title`, `abstract`,
`DOI`, `volume`, `page`, `issue`, `publisher`, `status`, `type`,
`container-title`, `ISBN`, `ISSN`, `eissn`, `collection-number`, `language`,
`license`, `medium`, `note`, `url`, `author`). A few don't have named terms
and surface under the prefixed form — notably **`cite:date-available`**.

**Single-value arrays collapse to scalars** at the response boundary. JSON-LD
framing's default is to emit a scalar when a property has exactly one value
and an array when it has more. `jsonldCollapse(node, uri)` mirrors this: it
returns the bare value for one, an array for multiple, `null` for none. Applied
to `container-title`, `ISBN`, `ISSN`, `scopusId`, etc.

**`raw_payload` and `expert_raw_payload` columns hold the full ae-std node**
(work or expert respectively) and serve as the source of truth for API
responses. The structured columns (`title`, `issued`, `orcid_id`, …) exist for
indexed lookups; the API itself reads `raw_payload` first and falls back to
the structured columns only if the payload is missing or malformed. If you add
a new field to the normalizer, it needs to land in both the structured column
(for query support) and the raw_payload (for the API to surface it).

**Expert URIs are returned in short form** (`expert/{id}`), not full
(`http://experts.ucdavis.edu/expert/{id}`). VCard URL `@id`s likewise have the
`http://experts.ucdavis.edu/` base stripped. The `stripAeBase` helper handles
this; apply it whenever you emit an `@id` that the ae-std doc stores in full
form.

---

## Error Handling

### 400 Bad Request

Returned when `modified_since` is not a valid `YYYY-MM-DD` date.

```json
{ "error": "Invalid modified_since date format" }
```

### 500 Internal Server Error

Returned on transient backend failures (Elasticsearch search failure on the ES path, Postgres query failure on the PG path). The response body includes the error message:

```json
{ "error": "Error fetching expert data", "details": "<message>" }
```

### Empty Response

The API returns `200` with an empty array (`[]`) when:

- None of the supplied identifiers resolve to known experts.
- All resolved experts fail the `is-visible: true` gate.
- All resolved experts have `modified-date` (or `last_seen_cdl` on the PG path) earlier than `modified_since`.

---

## Usage Examples

### Get a single expert profile

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/sitefarm/experts/mbishop@ucdavis.edu"
```

### Get several experts and only those modified this year

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/sitefarm/experts/mbishop@ucdavis.edu,jsmith@ucdavis.edu,acooper@ucdavis.edu?modified_since=2026-01-01"
```

### Query the Postgres path (preview)

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/sitefarm/experts_pg/mbishop@ucdavis.edu?modified_since=2026-01-01"
```

### Query a preview Elasticsearch index

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/sitefarm/experts/mbishop@ucdavis.edu?previewEsIndex=preview-2026-w20"
```

---

## Notes

- The two endpoints are intentionally **identical in shape** so clients can switch between them by changing the URL path only.
- `publications` is **capped at 5** by both endpoints; the cap is enforced in the ES template's subselect on the ES path and in a `ROW_NUMBER() OVER (PARTITION BY expert_id ...)` window on the Postgres path.
- `modified-date` semantics differ slightly between sources: ES sets it on every reindex (via the ingest pipeline); Postgres sets `last_seen_cdl` on every load upsert. In practice both bump weekly during the standard ETL cycle.
- The `relatedBy` filter rule applies equally to both endpoints — co-author relationships are dropped from the response. If a SiteFarm caller needs co-author data, that's a future addition rather than a change to the current contract.
- The `/experts_pg/:ids` endpoint preserves the **order of the supplied `ids`**. Experts that don't match or that fail `modified_since` are skipped (the response is shorter than the request list, not padded with nulls).
- Both endpoints accept the same identifier types as the MIV API's `expertId` resolution: email, UCD Person UUID, and IAM ID.
