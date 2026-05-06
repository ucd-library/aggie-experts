# MIV API Documentation

The MIV (Membership Initiative Visibility) API provides access to expert grant information for authorized users. All endpoints require MIV access permission.

## Base URL

```
http://localhost:3000/api/miv
```

## Authentication

All endpoints require bearer token authentication via the `has_access('miv')` middleware.

---

## Business Rules

### Grant Visibility & Attribution

The MIV API applies specific business rules when returning grant data:

#### 1. Queried Expert Attribution
- The `role_label` field represents **only the queried expert's role** on the grant
- This is determined by matching the expert's ID against the grant's `relatedBy[].inheres_in` field
- If the queried expert is a Principal Investigator (PI), `role_label` will be `PrincipalInvestigatorRole`
- If they are a Co-PI, it will be `CoPrincipalInvestigatorRole`

#### 2. Contributors List Filtering
- The `contributors` array contains **other experts on the grant, excluding the queried expert**
- This exclusion is done by filtering out any `relatedBy` entries where `inheres_in === expertId` (the queried expert)
- Also excluded: suppressed roles (where `ae-roleof-suppress` is true)
- Only PIs and Co-PIs are included in contributors; other role types are filtered out

#### 3. Example Scenario

Given a grant with these participants:
- **Alice** (expert ID: alice123) - Principal Investigator
- **Bob** (expert ID: bob456) - Co-Principal Investigator  
- **Carol** (expert ID: carol789) - Co-Principal Investigator

When querying `/grants?email=alice@ucdavis.edu`:
```json
{
  "role_label": "PrincipalInvestigatorRole",  // Alice's role
  "contributors": [
    { "name": "Bob", "role": "CoPrincipalInvestigatorRole" },
    { "name": "Carol", "role": "CoPrincipalInvestigatorRole" }
  ]
}
```

When querying `/grants?email=bob@ucdavis.edu`:
```json
{
  "role_label": "CoPrincipalInvestigatorRole",  // Bob's role
  "contributors": [
    { "name": "Alice", "role": "PrincipalInvestigatorRole" },
    { "name": "Carol", "role": "CoPrincipalInvestigatorRole" }
  ]
}
```

---

## Endpoints

### 1. GET `/user`

Returns the expertId of the authenticated user.

**Authentication:** Required (MIV access)

**Parameters:** None

**Response:**
```json
"expertId:abc12345"
```

**Status Codes:**
- `200` - Success
- `400` - Error (check console for details)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/miv/user
```

---

### 2. GET `/grants`

Returns an expert's grants in formatted output with contributor information and grant details.

**Authentication:** Required (MIV access)

**Query Parameters:**
- `email` (string) - Filter by expert email address. One of `email`, `ucdPersonUUID`, or `iamId` is required.
- `ucdPersonUUID` (string) - Filter by UCD Person UUID. One of `email`, `ucdPersonUUID`, or `iamId` is required.
- `iamId` (string) - Filter by IAM ID. One of `email`, `ucdPersonUUID`, or `iamId` is required.
- `since` (string, optional) - Filter grants starting from this date (inclusive). Format: `YYYY-MM-DD`
- `until` (string, optional) - Filter grants up to this date (inclusive). Format: `YYYY-MM-DD`. Defaults to today if not provided.

**Response:**
```json
{
  "@graph": [
    {
        "@id": "ark:/87287/d7gt0q/grant/K326761-109005",
        "title": "A Proposal to the NIST Information Technology Laboratory: Modeling the Process of Internet Voting",
        "end_date": "2017-06-30",
        "start_date": "2013-07-01",
        "grant_amount": "0000000",
        "sponsor_id": "60NANB13D165",
        "sponsor_name": "National Institute Of Standards And Technology",
        "type": [
            "Grant_Research",
            "Grant"
        ],
        "role_label": [
            "PrincipalInvestigatorRole",
            "GrantRole"
        ],
        "contributors": [
            {
                "@id": "ark:/87287/d7gt0q/grant/K326761-109005#roleof_peisert_sean",
                "name": "Peisert, Sean",
                "role": "CoPrincipalInvestigatorRole"
            }
        ]
    },
  ]
}
```

**Field Descriptions:**
- `@id` - Unique identifier for the grant
- `title` - Grant title (first part before `§` separator, trimmed whitespace)
- `start_date` - Grant start date (ISO format: YYYY-MM-DD)
- `end_date` - Grant end date (ISO format: YYYY-MM-DD)
- `grant_amount` - Total award amount in dollars
- `sponsor_id` - Sponsor's award identifier
- `sponsor_name` - Name of the sponsoring organization
- `type` - Array of grant types (e.g., "Grant_Research", "Grant")
- `role_label` - **The queried expert's role on this grant only**
  - Possible values: `PrincipalInvestigatorRole`, `CoPrincipalInvestigatorRole`
  - This field identifies what role the expert who was queried (via email, UUID, or IAM ID) holds on the grant
  - Other experts on the grant are listed in the `contributors` array
- `contributors` - Array of **other experts** involved in the grant (excludes the queried expert)
  - `@id` - Relationship identifier (not the expert ID)
  - `name` - Expert's name (PI/CoPI prefixes removed)
  - `role` - Expert's role on the grant (PrincipalInvestigatorRole or CoPrincipalInvestigatorRole)
  - Note: Suppressed roles and the queried expert are automatically filtered out

**Status Codes:**
- `200` - Success
- `400` - Invalid request or missing required identifier
- `404` - Expert not found

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/miv/grants?email=john.doe@ucdavis.edu&since=2020-01-01&until=2025-12-31"
```

---

### 3. GET `/raw_grants`

Returns an expert's grants in raw/unformatted output directly from Elasticsearch.

**Authentication:** Required (MIV access)

**Query Parameters:**
- `email` (string) - Filter by expert email address. One of `email`, `ucdPersonUUID`, or `iamId` is required.
- `ucdPersonUUID` (string) - Filter by UCD Person UUID. One of `email`, `ucdPersonUUID`, or `iamId` is required.
- `iamId` (string) - Filter by IAM ID. One of `email`, `ucdPersonUUID`, or `iamId` is required.
- `since` (string, optional) - Filter grants starting from this date (inclusive). Format: `YYYY-MM-DD`
- `until` (string, optional) - Filter grants up to this date (inclusive). Format: `YYYY-MM-DD`. Defaults to today if not provided.

**Response:**
Array of raw grant objects from Elasticsearch, each containing:
```json
[
  {
    "identifier": [
        "ark:/87287/d7mh2m/4488764",
        "ark:/87287/d7gt0q/grant/K321287-1484"
    ],
    "assignedBy": {
        "@type": "FundingOrganization",
        "name": "National Science Foundation",
        "@id": "ark:/87287/d7gt0q/grant/K321287-1484#funder"
    },
    "dateTimeInterval": {
        "start": {
            "dateTime": "2005-08-01",
            "@id": "ark:/87287/d7gt0q/grant/K321287-1484#start_date",
            "dateTimePrecision": "vivo:yearMonthDayPrecision"
        },
        "end": {
            "dateTime": "2009-07-31",
            "@id": "ark:/87287/d7gt0q/grant/K321287-1484#end_date",
            "dateTimePrecision": "vivo:yearMonthDayPrecision"
        },
        "@id": "ark:/87287/d7gt0q/grant/K321287-1484#interval"
    },
    "@type": [
        "Grant_Research",
        "Grant"
    ],
    "name": "NETS-NOSS: SNIDS: SENSOR NETWORK INTRUSION DETECTION SYSTEMS",
    "totalAwardAmount": "000000",
    "@id": "ark:/87287/d7gt0q/grant/K321287-1484",
    "relatedBy": [
        {
            "inheres_in": "expert/Z69UnXfY",
            "relates": [
                "expert/Z69UnXfY",
                "ark:/87287/d7gt0q/grant/K321287-1484"
            ],
            "@type": [
                "CoPrincipalInvestigatorRole",
                "GrantRole"
            ],
            "name": "CoPI: Bishop, Matthew",
            "@id": "ark:/87287/d7mh2m/14476891",
            "is-visible": true
        },
        {
            "ae-roleof": "true",
            "relates": [
                "ark:/87287/d7gt0q/grant/K321287-1484",
                "ark:/87287/d7gt0q/grant/K321287-1484#wu_felix"
            ],
            "@type": "PrincipalInvestigatorRole",
            "name": "PI: Wu, Felix",
            "@id": "ark:/87287/d7gt0q/grant/K321287-1484#roleof_wu_felix"
        },
        {
            "ae-roleof": "true",
            "relates": [
                "ark:/87287/d7gt0q/grant/K321287-1484",
                "ark:/87287/d7gt0q/grant/K321287-1484#levitt_karln"
            ],
            "@type": "CoPrincipalInvestigatorRole",
            "name": "COPI: Levitt, Karl N",
            "@id": "ark:/87287/d7gt0q/grant/K321287-1484#roleof_levitt_karln"
        },
        {
            "ae-roleof": "true",
            "relates": [
                "ark:/87287/d7gt0q/grant/K321287-1484",
                "ark:/87287/d7gt0q/grant/K321287-1484#wu_shyhtsunf"
            ],
            "@type": "CoPrincipalInvestigatorRole",
            "name": "COPI: Wu, Shyhtsun F",
            "@id": "ark:/87287/d7gt0q/grant/K321287-1484#roleof_wu_shyhtsunf"
        }
    ],
    "status": "Completed",
    "sponsorAwardId": "0520269"
},
]
```

**Status Codes:**
- `200` - Success
- `400` - Invalid request or missing required identifier
- `404` - Expert not found

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/miv/raw_grants?ucdPersonUUID=550e8400-e29b-41d4-a716-446655440000"
```

---

## Error Handling

### 400 Bad Request
Returned when:
- Required query parameters (email, ucdPersonUUID, or iamId) are missing
- Invalid date format in `since` or `until` parameters
- Invalid request payload for POST/PATCH operations

Response:
```json
{
  "message": "Error message describing the issue"
}
```

### 404 Not Found
Returned when the expert cannot be found for the given identifier.

### 400 Bad Request with Error Details
The response may include detailed error information logged to console.

---

## Usage Examples

### Get grants for a specific expert by email
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/miv/grants?email=user@ucdavis.edu"
```

### Get grants within a date range
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/miv/grants?email=user@ucdavis.edu&since=2023-01-01&until=2023-12-31"
```

### Get raw grant data
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/miv/raw_grants?iamId=jsmith"
```

### Get current user's expertId
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/miv/user"
```

---

## Notes

- The `until` date defaults to today's date if not provided
- Grant names are truncated at the `§` separator in the formatted `/grants` endpoint
- **The `role_label` field represents ONLY the queried expert's role** on that grant
- **The `contributors` array excludes the queried expert** and includes only PI/CoPI roles
- Suppressed roles (`ae-roleof-suppress: true`) are automatically filtered from the contributors list
- The contributors array shows each other expert's role relative to the grant, not to the queried expert
- All date parameters must be in `YYYY-MM-DD` format (e.g., 2025-12-31)
- The `/raw_grants` endpoint includes all unmodified Elasticsearch fields for advanced use cases
- If an expert has the same role on a grant as another person, both appear in the contributors list (unless one is the queried expert)
