PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX experts: <http://experts.ucdavis.edu/>
PREFIX person: <http://experts.ucdavis.edu/person/>
PREFIX experts: <http://experts.ucdavis.edu/>
PREFIX harvest_iam: <http://iam.ucdavis.edu/>
PREFIX iam: <http://iam.ucdavis.edu/schema#>
PREFIX obo: <http://purl.obolibrary.org/obo/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX ucdrp: <http://experts.ucdavis.edu/schema#>
PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
PREFIX vivo: <http://vivoweb.org/ontology/core#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

CONSTRUCT {
  ?user a ?emp_type,ucdrp:person,foaf:Person;
        rdfs:label ?label;
        ucdrp:casId ?kerb;
        ucdrp:identifier ?user_id;
        .

  ?user a ?emp_type,ucdrp:person;
        rdfs:label ?label;
        ucdrp:casId ?kerb;
        vcard:hasName ?vcard_name;
        .

  ?vcard_name a vcard:Name;
                 vcard:givenName ?fname;
                 vcard:middleName ?mname;
                 vcard:familyName ?lname;
                 vcard:pronoun ?pronoun;
                 .

  ?user obo:ARG_2000028 ?vcard.
  ?vcard a vcard:Individual;
         ucdrp:identifier ?vid;
         vivo:rank ?order;
         vcard:hasName ?vcard_name;
         vcard:hasTitle ?vcard_title;
         vcard:hasOrganizationalUnit ?vcard_unit;
         vcard:hasEmail ?email_uri;
         vcard:hasURL ?vcard_url;
         .

  ?vcard_title a vcard:Title;
               vcard:title ?title;
               .

  ?vcard_unit a vcard:Organization;
              vcard:title ?dept;
              .

  ?vcard_url a vcard:URL;
             vcard:url ?website;
             ucdrp:urlType ucdrp:URLType_other;
             .
}
WHERE {
  graph harvest_iam: {
    ?s iam:email ?default_email;
       iam:userID ?kerb;
       iam:dLastName ?iam_lname;
       iam:dFirstName ?iam_fname;
       iam:isFaculty ?faculty;
       .
    bind(concat(?kerb,"@ucdavis.edu") as ?username)

    OPTIONAL { ?s iam:dMiddleName ?iam_mname . }
    OPTIONAL {
      ?s iam:directory/iam:displayName ?dname.
      ?dname iam:nameWwwFlag "Y";
             iam:preferredFname ?better_fname;
             iam:preferredLname ?better_lname;
             .
      OPTIONAL {
        ?dname iam:preferredMname ?better_mname .
        bind(concat(?better_fname," ",?better_mname," ",?better_lname) as ?better_mlabel)
      }
      OPTIONAL {
        ?dname iam:preferredPronouns ?pronoun .
      }
    }
    bind(coalesce(?better_fname,?iam_fname) as ?fname)
    bind(coalesce(?better_lname,?iam_lname) as ?lname)
    bind(?better_mname as ?mname)
    bind(coalesce(?better_mlabel,concat(?fname," ",?lname)) as ?label)
    bind(md5(?username) as ?user_id)
    bind(uri(concat(str(person:),?user_id)) as ?user)
    bind(if(?faculty=true,vivo:FacultyMember,vivo:NonAcademic) as ?emp_type)
    bind(uri(concat(str(?user),"#name")) as ?vcard_name)
  }
  OPTIONAL {
    {
      select ?s ?vid ?vcard_unit ?title ?dept ?order ?website ?title_email
      WHERE { graph harvest_iam: {
        ?s iam:directory ?dir .
        ?dir iam:listings ?list.
        OPTIONAL {
          ?list iam:deptWwwFlag "Y";
                iam:listingOrder ?order;
                iam:title ?title;
                iam:deptName ?dept;
                iam:deptCode ?deptCode;
                .
          OPTIONAL {
            ?list iam:websiteWwwFlag "Y";
                  iam:website ?website;
                  .
          }
          OPTIONAL {
            ?list iam:emailWwwFlag "Y";
                  iam:email ?title_email;
                  .
          }
          bind(concat("odr-",str(?order)) as ?vid)
        }
        bind(uri(concat(str(experts:),"dept/odr/",?deptCode)) as ?vcard_unit)
      }}
    }
    UNION {
      select ?s ?vid ?vcard_unit ?ucd_title ?title ?dept ?order ?use_default_email
      where { graph harvest_iam: {
        ?s iam:ppsAssociations [iam:assocRank ?a_order;
                               iam:titleOfficialName ?otitle;
                               iam:titleCode ?titleCode;
                               iam:deptCode ?deptCode;
                               iam:deptOfficialName ?dept ];
                                                    .
        bind(replace(?otitle," -.*","") as ?title)
        bind(xsd:integer(?a_order)+10 as ?order)
        bind(concat("pps-",str(?a_order)) as ?vid)
        bind(true as ?use_default_email)
        bind(uri(concat(str(experts:),"dept/pps/",?deptCode)) as ?vcard_unit)
        bind(uri(concat(str(experts:),"title/pps/",?titleCode)) as ?ucd_title)
      }
      }
    }
  }
  bind(uri(concat(str(?user),"#vcard-",?vid)) as ?vcard)
  bind(if(bound(?title_email),?title_email,if(bound(?use_default_email),?default_email,?undefined_var)) as ?email)
  bind(if(bound(?email),uri(concat("email:",?email)),?undefined_var) as ?email_uri)
  bind(coalesce(?ucd_title,uri(concat(str(?vcard),"-title"))) as ?vcard_title)
  bind(if(bound(?website),uri(concat(str(?vcard),"-url")),?undefined_var) as ?vcard_url)
}