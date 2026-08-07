# OpenAlex Subject Dataset

A SQLite database mapping Aggie Experts works (by DOI) to OpenAlex's subject
vocabulary — Topic, Subfield, Field, and Domain — with confidence scores
where OpenAlex provides them. Built to give a candidate vocabulary to test
with faculty before any user-facing feature work.

Built by `experts harvest openalex` (see
[`harvest/lib/openalex/`](../harvest/lib/openalex/) and
[`harvest/bin/experts-harvest-openalex.js`](../harvest/bin/experts-harvest-openalex.js)).
Source data: the `api` postgres schema (already-harvested experts/works —
see [`harvest/lib/api/schema.sql`](../harvest/lib/api/schema.sql)) joined
against live lookups to the [OpenAlex API](https://docs.openalex.org/api-entities/works),
plus a static topic taxonomy reference loaded from
[`harvest/vocabularies/OpenAlex_topic_mapping_table.csv`](../harvest/vocabularies/OpenAlex_topic_mapping_table.csv).

## Quick start

The `dataset` view provides one row per
(work, expert, topic), already flattened and joined:

```sh
sqlite3 openalex-experts.sqlite "SELECT * FROM dataset LIMIT 20;"

# or export the whole thing to CSV for a spreadsheet
sqlite3 -header -csv openalex-experts.sqlite "SELECT * FROM dataset;" > dataset.csv
```

Any SQLite browser (e.g. [DB Browser for SQLite](https://sqlitebrowser.org/))
can also open the file directly — the `dataset` view shows up alongside the
tables.

## The `dataset` view

| Column | Description |
|---|---|
| `work_doi` | DOI of the work |
| `expert_id` | Expert's Aggie Experts ID |
| `expert_name` | Expert's display name |
| `expert_email` | Expert's email |
| `topic` | OpenAlex Topic name assigned to this work |
| `topic_score` | OpenAlex's confidence score for this topic (0–1) |
| `subfield` | OpenAlex Subfield the topic belongs to |
| `subfield_score` | Always `NULL` — see [Confidence scores](#confidence-scores-only-exist-at-the-topic-level) |
| `field` | OpenAlex Field the subfield belongs to |
| `field_score` | Always `NULL` (same reason) |
| `domain` | OpenAlex Domain the field belongs to |
| `domain_score` | Always `NULL` (same reason) |

A work can have multiple topics (OpenAlex typically returns up to 3, most-confident
first), so it can appear on multiple rows. A work with no successful OpenAlex
match (not found, or not yet fetched) still appears once, with `topic` and
everything below it `NULL` — a `LEFT JOIN`, not an inner join, so no work is
silently dropped from the view.

### Confidence scores only exist at the topic level

OpenAlex scores the **Topic** assignment only; Subfield/Field/Domain are just
static attributes of whichever Topic matched — there's no independent
confidence value for them in the API. Rather than invent one, `subfield_score`/
`field_score`/`domain_score` are left `NULL` in the view.

## Underlying tables

| Table | Purpose |
|---|---|
| `expert` | `expert_id`, `name`, `email` — one row per expert |
| `work` | `doi` (primary key), `title` — one row per DOI |
| `expert_work` | join table: `(expert_id, doi)` — which experts are associated with which work |
| `topic` | OpenAlex's topic taxonomy: `topic_id`, `topic_name`, `subfield_id/name`, `field_id/name`, `domain_id/name`, plus `keywords` and `summary` (useful cluster descriptions for the faculty-facing vocabulary test) and `wikipedia_url`. Seeded from the mapping CSV; a handful of rows may be inserted from live OpenAlex responses if OpenAlex's taxonomy has grown since the CSV snapshot |
| `work_topic` | `(doi, topic_id)` with `score` and `rank` (`rank` 1 = OpenAlex's `primary_topic`) — the actual per-work topic assignments |
| `openalex_response_cache` | Raw OpenAlex API response JSON per DOI, plus `http_status` and `fetched_at`. This is the fetch cache, not meant for direct querying, but useful if you need a field OpenAlex returns that isn't in the normalized tables |

**Note on `work.doi` as the key:** the harvest postgres database can have the
same DOI under more than one internal `work_id` (e.g. the same paper
harvested independently through two different experts' Elements profiles).
This dataset collapses those onto a single `work` row keyed by DOI, since DOI
is what matters here — `expert_work` is where the multiple-experts-per-DOI
relationship actually lives.

## Known gaps / caveats

- Only works with a non-null DOI in the harvest data are included.
- A DOI OpenAlex doesn't recognize (typo, not indexed, etc.) gets
  `openalex_response_cache.http_status` != 200 and no `work_topic` rows — it
  still shows up in `dataset` with `NULL` topic columns.
- This is a point-in-time snapshot: re-running the `fetch` step only fetches
  DOIs not already cached, so scores won't change on their own if OpenAlex
  revises a work's topics later. Use `--force` to refresh.
