# Aggie Experts Grant Feed workflow

UCD grants are imported into the CDL Elements system using the Symplectic Elements file upload feed mechanism.
A CSV format file is created from a Fuseki [Sparql] (harvest/experts-client/lib/query/grant_feed) query and uploaded to the "ucdavis" FTP account at ftp.use.symplectic.org. The file is
then processed by the Symplectic Elements system and the grants are added to the CDL Elements system on a nightly basis. Once UCD grants are imported into CDL Elements, they are harvested into Aggie Experts using the Elements API.  

ftp.use.symplectic.org 

username: ucdavis

password: [via GCS Secret Manager]

Note that directories have been created on the Symplectic FTP server under the ucdavis account for QA and Production.

## Process Data Flow
```mermaid
graph TD;
    UCDGrantData-->FusekiDB;
    FusekiDB-->CSV-files; 
    CSV-files-->SymplecticFTP;
    SymplecticFTP-->CDLElements;
    CDLElements-->AggieExperts
```

## Legacy KFS Grant Feed Workflow

A one-time workflow to load all the grants from KFS into CDL Elements.

A subset of the grants present in the KFS system have been designated as legacy.
They will not be carried over to the new Aggie Enterpise system. The legacy grants are loaded into CDL Elements using the Symplectic Elements feed mechanism.
A CSV format file is uploaded to the "ucdavis" FTP account at ftp.use.symplectic.org. The file is
then processed by the Symplectic Elements system and the grants are added to the CDL Elements system.
The grants are then harvested by the Aggie Experts via the CDL Elements API in the same fashion as publications.


### Three csv files or uploaded to the Symplectic server:
#### grants.csv for grants
#### links.csv for linking Elements users to grants with roles.
#### persons.csv for linking persons who are not Elements users. We use this to include Co-PIs that are not in the Elements system.

### Grant Feed File Format
Two CSV file are need to load the legacy grants. The first file contains the grant data. The second file contains the links to associate grants with researchers.
The grant data file is named "grants.csv". The grant links file is named "links.csv". Both files are uploaded to the appropriate Symplectic FTP directory.

#### Columns of the grants.csv import file are:

|field|format|notes|
|-----|------|-----|
|id|Ark ID|ARK identifier used by Aggie Experts|
|category|text|Default to "grant"|
|type|text|The grant type as defined in Elements."c-ucdavis-pre-ae" for archived (KFS) grants. "c-ucd-enterprise" for Aggie Enterprise managed grants|
|title|text| Grant title|
|c-pi|text|Principle Investigator|
|funder-name|text||
|funder-reference|text|Funder ID|
|start-date|YYYY-MM-DD|Grant start date|
|end-date| YYYY-MM-DD|Grant end date|
|amount-value|number|USD amount|
|amount-currency-code|currency type|USD|
|funding-type|text| Research, Service/Other, Instruction,   |
|c-ucop-sponsor|http:/rems.ucop.edu/sponsor/[CODE]|URL with valid REMS sponsor code|
|c-flow-thru-funding|http:/rems.ucop.edu/sponsor/[CODE]|URL with valid REMS sponsor code| 
|visible|true/false|Determines whether matching records ... |

These column names correspond to the grant data "underlying fields" in the Symplectic Elements system.
Values are mapped to matching fields in the CDL Elements system in the Grants table.
Note that custom underlying fields can be added to the CDL Elements system to capture additional grant data.
See "Manage underlying fields: grant" in the Symplectic Elements documentation for more information.

#### Column names for the links.csv file are

|field|format|notes|
|-----|------|-----|
|category-1|text|Default to "user"|
|id-1|number|CDL Elements user ID|
|category-2|text|Default to "grant"|
|id-2|ARK ID|ARK ID of grant|
|link-type-id|number|Relationship type code|
|visible|true/false|Determines whether matching  **NOT SUPPORTED |

#### Column names for the persons.csv file are

|field|format|notes|
|-----|------|-----|
|category|text|Default to "grant" |
|id|number|Ark format ID of grant|
|field-name|text|field to apply value to|
|surname|text|last name of related person|
|first-name|text|first name of related person|
|full-name|text|full name of related person|

### Sparql Queries  
see: ([Grant Feed Sparql Query](../harvest/experts-client/lib/query/grant_feed/grants_feed.rq))

