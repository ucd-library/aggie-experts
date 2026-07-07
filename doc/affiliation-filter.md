# Affiliation Filter

The Affiliation filter lets users narrow Search and Browse results by UC Davis organizational unit. Departments are organized in a three-level hierarchy: **Category → Sub-category → Department**.

The filter is available on both the Search page (filtering across all result types) and the Browse by Experts / Grants / Works pages (filtering the displayed roster). Behavior differs between desktop and mobile, and between Search and Browse.

---

## Contents

1. [Data source](#data-source)
2. [Data structure](#data-structure)
3. [UI — desktop](#ui--desktop)
4. [UI — mobile](#ui--mobile)
5. [Updating the org lookup table](#updating-the-org-lookup-table)
6. [Key files](#key-files)

---

## Data source

The organization hierarchy is maintained in a Google Sheet and compiled into a static JavaScript module consumed by the front-end bundle.

**Google Sheet URL** is stored in `config.google.orgLookupSheetUrl` (commons config), set via the `ORG_LOOKUP_SHEET_URL` environment variable (required — no default is baked in).

### Sheet column mapping

| Sheet column | Maps to | Notes |
|---|---|---|
| `AE Filter Category` | Top-level category `label` | Rows with no value are skipped |
| `AE Filter Sub Category` | Sub-category `label` | Rows with no value are skipped |
| `Suggested Display Name` | `depts[].name` | User-facing department name |
| `Official Name` | `depts[].officialName` | Used for matching against HR/ES data |
| `Dept Code` | `depts[].deptCode` | ES filter value sent to the API |

> **Order in the sheet does not matter.** The front-end sorts all three levels alphabetically at runtime using `localeCompare`.

---

## Data structure

The compiled output is an ES module exporting `ORG_LOOKUP` — an array of category objects, each with nested sub-categories and departments.

```js
export const ORG_LOOKUP = [
  {
    label: "Colleges",
    subCategories: [
      {
        label: "Agricultural and Environmental Sciences",
        depts: [
          {
            name: "Animal Science",
            officialName: "ANIMAL SCIENCE",
            deptCode: "30045"
          },
          // ...
        ]
      },
      // ...
    ]
  },
  // ...
];
```

`deptCode` values are sent to Elasticsearch as filter terms. Selected codes are stored in the URL query string as the `dept` parameter (multiple values allowed).

---

## UI — desktop

On screens wider than 767 px the Affiliation filter renders in the left sidebar. Behavior is the same on Search and Browse.

**Search page:**
- Sidebar always visible alongside results
- Affiliation section is collapsible (caret toggle)
- Search box filters the department list in real time
- Sub-category rows have an expand/collapse caret
- Sub-category checkbox = select all depts in that sub-category (indeterminate when partial)
- Department checkboxes select individual depts
- Active filter chips shown in the `.results-filtered-to` row above results

**Browse pages:**
- Same sidebar layout as Search
- Experts browse: Affiliation is the first (and only) filter group
- Grants/Works browse: category selector (status / work type) appears above Affiliation in the sidebar
- Active filter chips shown above the letter list

### Checkbox states

Custom checkboxes (20 × 20 px) replace browser-native inputs. Three visual states:

| State | Appearance |
|---|---|
| Unchecked | White fill, `1px solid var(--ucd-blue-70)` border |
| Checked | `var(--ucd-blue-70)` fill, white checkmark via `::after` |
| Indeterminate | `var(--ucd-blue-70)` fill, white dash via `::after`; set programmatically on sub-category checkboxes when only some child depts are selected |

---

## UI — mobile

On screens 767 px wide and under, the sidebar is hidden and replaced with a full-screen drawer opened by the **Filter** button.

### Search mobile

1. **Main drawer** — Tapping *Filter* opens a full-screen overlay. The header reads *Refine Results* (italic). Filter rows — Affiliation, Date, Experts Open To — each have a right-pointing caret.

2. **Affiliation sub-drawer** — Tapping *Affiliation* opens a second full-screen view. A search box filters the list. Categories are rendered as group labels; sub-categories appear as tappable rows (no checkboxes at this level).

3. **Department sub-drawer** — Tapping a sub-category opens a third view listing individual departments with checkboxes. Selecting a department immediately applies the filter.

4. **Yellow "View N …" button** — Pinned at the bottom of every drawer level. The label updates dynamically based on the active category selection:

   | Active selection | Button label |
   |---|---|
   | All Results | `View N results` |
   | Experts | `View N experts` |
   | Grants | `View N grants` |
   | Active Grants | `View N active grants` |
   | Works (sub-type selected) | `View N journal articles` (etc.) |

   Tapping the button closes the drawer.

### Browse mobile

Same drawer pattern as Search with two differences:

- The drawer title is **Filter** (not "Refine Results") and there are no category options inside the drawer.
- For Grants and Works browse, a **category dropdown** appears to the left of the Filter button (outside the drawer). It shows the current selection (e.g. "All Grants", "Active", "Journal Articles") with a chevron. Selecting an option applies the change and closes the dropdown.
- Experts browse has no category dropdown — only the Filter button.

### Active filter chips

Selected filters appear as dismissible chips on the same flex row as the Filter button (and the category dropdown if present). Each chip shows the filter label with an × to remove it. Chips wrap to a second row if needed.

### Drawer state properties

| Property | Type | Description |
|---|---|---|
| `mobileSubDrawer` | `null \| 'affiliation' \| 'openTo' \| 'date'` | Which sub-drawer is open |
| `mobileAffSub` | `null \| string` | Label of the currently open affiliation sub-category |
| `mobileCategoryOpen` | `boolean` | Browse only — whether the category dropdown is open |

---

## Updating the org lookup table

Run the `update-org-lookup` CLI command whenever the Google Sheet changes. It fetches the sheet as CSV, converts it to the nested JSON structure, and overwrites `org-lookup.js`.

```bash
# From the harvest/ directory

# Write directly to org-lookup.js (default output path)
node bin/experts-admin.js update-org-lookup

# Preview without writing
node bin/experts-admin.js update-org-lookup --dry-run

# Write to a custom path
node bin/experts-admin.js update-org-lookup --output /path/to/org-lookup.js

# Use a different sheet URL
node bin/experts-admin.js update-org-lookup --url "https://docs.google.com/..."
```

### What the command does

1. **Fetch** — Downloads the sheet as CSV via the public export URL, following Google's redirect automatically (`node-fetch`).
2. **Parse** — Parses CSV rows using `csv-parse/sync` with column headers. Rows missing `AE Filter Category`, `AE Filter Sub Category`, `Suggested Display Name`, or `Dept Code` are skipped.
3. **Convert** — Groups rows into the three-level hierarchy using `Map` objects keyed by category and sub-category labels.
4. **Write** — Serializes as `export const ORG_LOOKUP = [...];` and writes to the output path.

> **After running the command, rebuild the SPA bundle:**
> ```bash
> docker exec aggie-experts-spa-1 node_modules/.bin/webpack --config spa/client/webpack-watch.config.js
> ```

---

## Key files

| File | Purpose |
|---|---|
| `webapp/spa/client/public/lib/org-lookup.js` | Generated ES module — the compiled `ORG_LOOKUP` array. Do not edit by hand; regenerate with the CLI. |
| `commons/lib/config.js` | Contains `config.google.orgLookupSheetUrl`. |
| `harvest/bin/experts-admin.js` | CLI entry point. The `update-org-lookup` subcommand fetches and rebuilds `org-lookup.js`. |
| `webapp/spa/client/public/elements/pages/search/app-search.js` | Search page component. Imports `ORG_LOOKUP`, sorts it in the constructor, manages drawer state and dept filter logic. |
| `webapp/spa/client/public/elements/pages/search/app-search.tpl.js` | Search page template. Desktop sidebar affiliation tree and mobile sub-drawers. |
| `webapp/spa/client/public/elements/pages/browse/app-browse-by.js` | Browse page component. Same `ORG_LOOKUP` import and drawer state, plus `mobileCategoryOpen` for the category dropdown. |
| `webapp/spa/client/public/elements/pages/browse/app-browse-by.tpl.js` | Browse page template. Desktop sidebar, mobile category dropdown, and mobile filter drawer. |
