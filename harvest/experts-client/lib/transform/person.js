import jsonpath from 'jsonpath';
import fs from 'fs';
import path from 'path';
import verify from './verify.js';
import md5 from 'md5';

function run(profile, cdl, ucopVocab) {
  const result = [];

  // Extract expert ID from profile
  const expertId = jsonpath.value(profile, '$["@graph"][0].expertId');
  const expertUri = `http://experts.ucdavis.edu/expert/${expertId}`;

  // Extract basic info from profile
  const iamId = jsonpath.value(profile, '$["@graph"][0].iamId');
  const email = jsonpath.value(profile, '$["@graph"][0].email');
  const firstName = jsonpath.value(profile, '$["@graph"][0].dFirstName');
  const middleName = jsonpath.value(profile, '$["@graph"][0].dMiddleName');
  const lastName = jsonpath.value(profile, '$["@graph"][0].dLastName');
  const isFaculty = jsonpath.value(profile, '$["@graph"][0].isFaculty') || false;
  const isHSEmployee = jsonpath.value(profile, '$["@graph"][0].isHSEmployee') || false;
  const fullName = jsonpath.value(profile, '$["@graph"][0].dFullName');
  const pronouns = jsonpath.value(profile, '$["@graph"][0].directory.displayName.preferredPronouns');

  // Extract employment info from profile
  const ppsAssociations = jsonpath.value(profile, '$["@graph"][0].ppsAssociations');
  const directoryListings = jsonpath.value(profile, '$["@graph"][0].directory.listings');
  const isOdrVisible = jsonpath.value(profile, '$["@graph"][0].directory.displayName.nameWwwFlag') === 'N' ? false : true;

  // Extract research areas from CDL data
  const researchAreas = (jsonpath.query(cdl, '$["@graph"][0]["api:object"]["api:all-labels"]["api:keywords"]["api:keyword"][*]') || [])
    .filter(area => area.scheme === 'for');

  // Extract availability areas from CDL data
  // const availabilities = (jsonpath.query(cdl, '$["@graph"][0]["api:object"]["api:all-labels"]["api:keywords"]["api:keyword"][*]') || [])
  //   .filter(area => area.scheme === 'c-ucd-avail');
  const availabilities = (jsonpath.query(cdl, '$["@graph"][0]["api:object"]["api:all-labels"]["api:keywords"]["api:keyword"][*]') || [])
    .filter(area => area.scheme === 'c-ucd-avail');

  // Extract CDL profile info
  const cdlUserFirstName = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:first-name"]');
  const cdlUserLastName = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:last-name"]');
  const cdlDepartment = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:department"]');
  const cdlPosition = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:position"]');
  const cdlUserId = jsonpath.value(cdl, '$["@graph"][0]["api:object"].id');
  const cdlOverview = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:records"]["api:record"]["api:native"]["api:field"][?(@.name=="overview")]["api:text"]["$t"]');
  const cdlResearchInterests = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:records"]["api:record"]["api:native"]["api:field"][?(@.name=="research-interests")]["api:text"]["$t"]');
  const cdlTeachingSummary = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:records"]["api:record"]["api:native"]["api:field"][?(@.name=="teaching-summary")]["api:text"]["$t"]');
  const cdlWebsites = jsonpath.query(cdl, '$["@graph"][0]["api:object"]["api:records"]["api:record"]["api:native"]["api:field"][?(@.name=="personal-websites")]["api:web-addresses"]["api:web-address"][*]');
  const orcidId = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:user-identifier-associations"]["api:user-identifier-association"][?(@.scheme=="orcid")]["$t"]');
  const scopusId = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:user-identifier-associations"]["api:user-identifier-association"][?(@.scheme=="scopus-author-id")]["$t"]');
  const researcherId = jsonpath.value(cdl, '$["@graph"][0]["api:object"]["api:user-identifier-associations"]["api:user-identifier-association"][?(@.scheme=="researcherid")]["$t"]');

  // Build name variations for matching
  const nameMatches = [
    `${lastName.toLowerCase()}_${firstName.charAt(0).toLowerCase()}`,
    `${lastName.toLowerCase()}_${firstName.charAt(0).toLowerCase()}${middleName ? middleName.charAt(0).toLowerCase() : ''}`,
    `${lastName.toLowerCase()}_${firstName.toLowerCase()}`,
    `${lastName.toLowerCase()}_${firstName.toLowerCase()}${middleName ? middleName.charAt(0).toLowerCase() : ''}`
  ];

  // Create expert type based on faculty status
  const expertType = (isFaculty ? "http://vivoweb.org/ontology/core#FacultyMember" : "http://vivoweb.org/ontology/core#NonAcademic");

  // Create main expert record
  const expert = {
    "@id": expertUri,
    "@type": [
      expertType,
      "http://schema.org/Person",
      "http://schema.library.ucdavis.edu/schema#Expert"
    ],
    "http://purl.obolibrary.org/obo/ARG_2000028": [
      ...ppsAssociations.map((assoc) => ({
        "@id": `ark:/87287/d7c08j/user/${iamId}#pps-${assoc.assocRank + 10}`
      })),
      ...directoryListings.map((listing, index) => ({
        "@id": `ark:/87287/d7c08j/user/${iamId}#odr-${index + 1}`
      })),
      { "@id": `${expertUri}#vcard-oap-1` }
    ],
    "http://www.w3.org/2000/01/rdf-schema#label": [
      { "@value": `${lastName}, ${firstName}` }
    ],
    "http://schema.org/identifier": [
      { "@id": expertUri },
      { "@id": `ark:/87287/d7c08j/user/${iamId}` },
      { "@id": `ark:/87287/d7mh2m/user/${cdlUserId}` },
      { "@id": `mailto:${email}` },
      { "@id": `http://orcid.org/${orcidId}` },
      ...(scopusId ? [{"@id": `https://www.scopus.com/authid/detail.uri?authorId=${scopusId}`}] : []),
    ],
    "http://schema.library.ucdavis.edu/schema#is-visible": [
      { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": isOdrVisible+"" }
    ],
    "http://schema.library.ucdavis.edu/schema#isHSEmployee": [
      { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": isHSEmployee+"" }
    ],
    "http://schema.library.ucdavis.edu/schema#name_match": nameMatches.map(match => ({ "@value": match })),
    "http://www.w3.org/2006/vcard/ns#hasName": [
      { "@id": `ark:/87287/d7c08j/user/${iamId}#name` }
    ],
    "http://vivoweb.org/ontology/core#orcidId": [
      { "@value": orcidId }
    ],
    "http://vivoweb.org/ontology/core#overview": [
      { "@value": cdlOverview }
    ]
  };

  if( scopusId ) {
    expert["http://vivoweb.org/ontology/core#scopusId"] = [
      { "@value": scopusId }
    ];
  }
  if( researcherId ) {
    expert["http://vivoweb.org/ontology/core#researcherId"] = [
      { "@value": researcherId }
    ];
  }

  if( cdlResearchInterests ) {
    expert["http://schema.library.ucdavis.edu/schema#researchInterests"] = [
      { "@value": cdlResearchInterests }
    ];
  }

  if (cdlTeachingSummary) {
    expert["http://schema.library.ucdavis.edu/schema#teachingSummary"] = [
      { "@value": cdlTeachingSummary }
    ];
  }

  if( researchAreas.length > 0 ) {
    expert["http://vivoweb.org/ontology/core#hasResearchArea"] = researchAreas.map(area => ({
      "@id": `ark:/87287/d7mh2m/keyword/for/${area['$t'].split(' ')[0]}`
    }));
  }

  if( availabilities.length > 0 ) {
    expert["http://schema.library.ucdavis.edu/schema#hasAvailability"] = availabilities.map(area => ({
      "@id": `ark:/87287/d7mh2m/keyword/c-ucd-avail/${encodeURIComponent(area['$t'])}`
    }));
  }

  result.push(expert);

  // Create research area concepts
  researchAreas.forEach(area => {
    if (area.scheme === 'for') {
      const conceptId = `ark:/87287/d7mh2m/keyword/for/${area['$t'].split(' ')[0]}`;
      const concept = {
        "@id": conceptId,
        "@type": ["http://www.w3.org/2004/02/skos/core#Concept"],
        "http://www.w3.org/2004/02/skos/core#inScheme": [
          { "@id": "ark:/87287/d7mh2m/keyword/for/" }
        ],
        "http://www.w3.org/2004/02/skos/core#prefLabel": [
          { "@value": area['$t'].substring(area['$t'].indexOf(' ') + 1) }
        ],
        "http://vivoweb.org/ontology/core#researchAreaOf": [
          { "@id": expertUri }
        ]
      };
      result.push(concept);
    }
  });

  availabilities.forEach(area => {
    if( area.scheme === 'c-ucd-avail' ) {
      const conceptId = `ark:/87287/d7mh2m/keyword/c-ucd-avail/${encodeURIComponent(area['$t'])}`;
      const concept = {
        "@id": conceptId,
        "@type": ["http://www.w3.org/2004/02/skos/core#Concept"],
        "http://www.w3.org/2004/02/skos/core#inScheme": [
          { "@id": "ark:/87287/d7mh2m/keyword/c-ucd-avail/" }
        ],
        "http://www.w3.org/2004/02/skos/core#prefLabel": [
          { "@value": area['$t'] }
        ],
        "http://schema.library.ucdavis.edu/schema#availabilityOf": [
          { "@id": expertUri }
        ]
      };
      result.push(concept);
    }
  });

  // Create name record
  const nameRecord = {
    "@id": `ark:/87287/d7c08j/user/${iamId}#name`,
    "@type": ["http://www.w3.org/2006/vcard/ns#Name"],
    "http://www.w3.org/2006/vcard/ns#familyName": [{ "@value": lastName }],
    "http://www.w3.org/2006/vcard/ns#givenName": [{ "@value": firstName }]
  };

  if (middleName) {
    nameRecord["http://www.w3.org/2006/vcard/ns#middleName"] = [{ "@value": middleName }];
  }

  if (pronouns) {
    nameRecord["http://www.w3.org/2006/vcard/ns#pronouns"] = [{ "@value": pronouns }];
  }

  result.push(nameRecord);

  let odrTitles = [];

  // Create directory contact info (preferred)
  if (directoryListings) {
    directoryListings.forEach(directoryListing => {
      let baseUrl = `ark:/87287/d7c08j/user/${iamId}#odr-${directoryListing.listingOrder}`;

      const odrContact = {
        "@id": baseUrl,
        "@type": ["http://www.w3.org/2006/vcard/ns#Individual"],
        "http://schema.org/name": [
          { "@value": `${lastName}, ${firstName} § ${directoryListing.title}, ${directoryListing.deptName}` }
        ],
        // if there is an odr, it's preferred?
        "http://schema.library.ucdavis.edu/schema#isPreferred": [
          { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": "true" }
        ],
        "http://www.w3.org/2006/vcard/ns#hasEmail": [
          { "@id": `mailto:${email}` }
        ],
        "http://www.w3.org/2006/vcard/ns#hasName": [
          { "@id": `ark:/87287/d7c08j/user/${iamId}#name` }
        ],
        "http://www.w3.org/2006/vcard/ns#hasOrganizationalUnit": [
          { "@id": `ark:/87287/d7c08j/dept/odr/${directoryListing.deptCode}` }
        ],
        "http://vivoweb.org/ontology/core#rank": [
          { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value":  directoryListing.listingOrder + "" }
        ]
      };

      if( directoryListing.title ) {
        odrTitles.push({
          "@id": `ark:/87287/d7c08j/position/odr/${md5(directoryListing.title)}`,
          "@type": ["http://www.w3.org/2006/vcard/ns#Title"],
          "http://www.w3.org/2006/vcard/ns#title": [
            { "@value": directoryListing.title }
          ]
        });
      }

      // Add website if available
      if (directoryListing.website) {
        odrContact["http://www.w3.org/2006/vcard/ns#hasURL"] = [
          { "@id": `${baseUrl}-url` }
        ];

        // Create URL record
        result.push({
          "@id": `${baseUrl}-url`,
          "@type": ["http://www.w3.org/2006/vcard/ns#URL"],
          "http://www.w3.org/2006/vcard/ns#url": [
            { "@value": directoryListing.website }
          ]
        });
      }

      result.push(odrContact);

      // Create position record
      if( odrTitles.length > 0 ) {
        odrContact["http://www.w3.org/2006/vcard/ns#hasTitle"] = odrTitles.map(title => ({ "@id": title["@id"] }));
        odrTitles.forEach(title => {
          result.push(title);
        });
      }

      // Create department record
      result.push({
        "@id": `ark:/87287/d7c08j/dept/odr/${directoryListing.deptCode}`,
        "@type": ["http://www.w3.org/2006/vcard/ns#Organization"],
        "http://www.w3.org/2006/vcard/ns#title": [
          { "@value": directoryListing.deptName }
        ]
      });

    });
  }

  // Create PPS contact info (non-preferred)
  if (ppsAssociations) {
    ppsAssociations.forEach(ppsAssociation => {
      // to get the prefLabel, we use the UCOP vocabulary to match the title (ppsAssociation.titleCode) to a UC position
      // https://github.com/ucd-library/aggie-experts/blob/dev/harvest/vocabularies/experts.ucdavis.edu%252Fucop/pos_codes.jsonld
      // described in detail at https://github.com/ucd-library/aggie-experts/tree/dev/harvest/vocabularies/experts.ucdavis.edu%252Fucop
      let ucopPrefLabel = ucopVocab.find(code => code['@id'] === ppsAssociation.titleCode);
      if (ucopPrefLabel) ucopPrefLabel = ucopPrefLabel.prefLabel;

      const ppsContact = {
        "@id": `ark:/87287/d7c08j/user/${iamId}#pps-${ppsAssociation.assocRank+10}`,
        "@type": ["http://www.w3.org/2006/vcard/ns#Individual"],
        "http://schema.org/name": [
          { "@value": `${lastName}, ${firstName} § ${ucopPrefLabel || ppsAssociation.titleDisplayName}, ${ppsAssociation.deptDisplayName}` }
        ],
        "http://schema.library.ucdavis.edu/schema#isPreferred": [
          { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": directoryListings.length === 0 ? "true" : "false" }
        ],
        "http://www.w3.org/2006/vcard/ns#hasEmail": [
          { "@id": `mailto:${email}` }
        ],
        "http://www.w3.org/2006/vcard/ns#hasName": [
          { "@id": `ark:/87287/d7c08j/user/${iamId}#name` }
        ],
        "http://www.w3.org/2006/vcard/ns#hasOrganizationalUnit": [
          { "@id": `ark:/87287/d7c08j/dept/${ppsAssociation.deptCode}` }
        ],
        "http://www.w3.org/2006/vcard/ns#hasTitle": [
          { "@id": `ark:/87287/d7c08j/position/${ppsAssociation.titleCode}` }
        ],
        "http://vivoweb.org/ontology/core#rank": [
          {
            "@type": "http://www.w3.org/2001/XMLSchema#integer",
            "@value": (ppsAssociation.assocRank+10)+""
          }
        ]
      };

      result.push(ppsContact);

      // Create PPS department record
      result.push({
        "@id": `ark:/87287/d7c08j/dept/${ppsAssociation.deptCode}`,
        "@type": ["http://www.w3.org/2006/vcard/ns#Organization"],
        "http://www.w3.org/2006/vcard/ns#title": [
          { "@value": ppsAssociation.deptDisplayName }
        ]
      });

      // Create PPS position record
      result.push({
        "@id": `ark:/87287/d7c08j/position/${ppsAssociation.titleCode}`,
        "@type": ["http://www.w3.org/2006/vcard/ns#Title"],
        "http://www.w3.org/2006/vcard/ns#title": [
          { "@value": ppsAssociation.titleOfficialName }
        ],
        ...(ucopPrefLabel && {
          "http://www.w3.org/2004/02/skos/core#prefLabel": [
            { "@value": ucopPrefLabel }
          ],
        })
      });
    });
  }

  // Create CDL vcard (OAP)
  const oapVcard = {
    "@id": `${expertUri}#vcard-oap-1`,
    "@type": ["http://www.w3.org/2006/vcard/ns#Individual"],
    "http://schema.org/name": [
      { "@value": `${cdlUserLastName}, ${cdlUserFirstName} § ${cdlPosition || ""}, ${cdlDepartment || ""}` }
    ],
    // this seems to be hard coded...
    "http://schema.library.ucdavis.edu/schema#isPreferred": [
      { "@type": "http://www.w3.org/2001/XMLSchema#boolean", "@value": "false" }
    ],
    "http://www.w3.org/2006/vcard/ns#hasName": [
      { "@id": `${expertUri}#vcard-oap-1-name` }
    ],
    "http://www.w3.org/2006/vcard/ns#hasURL": [],
    // this seems to be hard coded...
    "http://vivoweb.org/ontology/core#rank": [
      { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": "20" }
    ]
  };

  // Add CDL websites
  if (cdlWebsites) {
    cdlWebsites.forEach((website, index) => {
      const urlId = `${expertUri}#vcard-oap-1-web-${index}`;
      oapVcard["http://www.w3.org/2006/vcard/ns#hasURL"].push({ "@id": urlId });

      const urlRecord = {
        "@id": urlId,
        "@type": ["http://www.w3.org/2006/vcard/ns#URL"],
        "http://www.w3.org/2006/vcard/ns#url": [
          { "@value": website["api:url"] }
        ],
        "http://vivoweb.org/ontology/core#rank": [
          { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": index.toString() }
        ]
      };

      if (website["api:type"] === "other") {
        urlRecord["@type"].push("http://schema.library.ucdavis.edu/schema#URL_other");
      }

      if (website["api:label"]) {
        urlRecord["http://www.w3.org/2006/vcard/ns#title"] = [
          { "@value": website["api:label"] }
        ];
      }

      result.push(urlRecord);
    });
  }

  result.push(oapVcard);

  // Create CDL name record
  result.push({
    "@id": `${expertUri}#vcard-oap-1-name`,
    "@type": ["http://www.w3.org/2006/vcard/ns#Name"],
    "http://www.w3.org/2006/vcard/ns#familyName": [{ "@value": lastName }],
    "http://www.w3.org/2006/vcard/ns#givenName": [{ "@value": firstName }]
  });

  return result;
}

function runFromFiles(odrFile, cdlFiles, ucopVocabFile) {
  const profile = JSON.parse(fs.readFileSync(odrFile, 'utf8'));

  let cdlData = {
    '@graph': []
  }

  cdlFiles.forEach(cdlFilePath => {
    const cdl = JSON.parse(fs.readFileSync(cdlFilePath, 'utf8'));
    cdlData['@graph'].push(...cdl['@graph']);
  });

  let ucopVocab = JSON.parse(fs.readFileSync(ucopVocabFile, 'utf8'));
  if( ucopVocab['@graph'] && ucopVocab['@graph'].length > 0 ) {
    ucopVocab = ucopVocab['@graph'][0];
  }

  return run(profile, cdlData, ucopVocab);
}

export { run, runFromFiles };
