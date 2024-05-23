# Creates a new graph of VIVO formated grants from the Aggie Enterprise data

PREFIX : <http://www.ucdavis.edu/aggie_enterprise#>
PREFIX aggie: <http://www.ucdavis.edu/aggie_enterprise/>
PREFIX iam: <http://iam.ucdavis.edu/>
PREFIX obo: <http://purl.obolibrary.org/obo/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
prefix rems:  <http://rems.ucop.edu/sponsor#>
PREFIX schema: <http://schema.org/>
PREFIX ucdlib: <http://schema.library.ucdavis.edu/schema#>
PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
PREFIX vivo: <http://vivoweb.org/ontology/core#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

insert { graph <ark:/87287/d7c08j/> {
  #        construct {
  ?grant rdfs:label ?title;
         a vivo:Grant,?grant_type;
         ucdlib:grantPurpose ?purpose;
         vivo:dateTimeInterval ?duration;
         ucdlib:piName ?aggie_person_name;
         ucdlib:grantStatus ?status;
         ucdlib:grantType ?type;
         ucdlib:assistanceListingNumber ?assistanceListingNumber;
         vivo:relates ?role;
         ?vivo_pred ?g_value;
         vivo:assignedBy ?funding_org;
         ucdlib:flowThruFunding ?super_funding_org;
         .

  ?role a vivo:GrantRole, ?role_type;
          rdfs:label ?role_label;
          obo:RO_0000052 ?role_expert;
          vivo:relatedBy ?grant;
          ucdlib:role ?role_role;
          ucdlib:percentage ?role_percentage;
          .

  # Link Back
  ?role_expert obo:RO_0000053 ?role.


  ?duration a vivo:DateTimeInterval;
            vivo:start ?start;
            vivo:end ?end;
            .

  ?start a vivo:DateTimeValue;
         vivo:dateTime           ?start_date;
         vivo:dateTimePrecision  vivo:yearMonthDayPrecision.

  ?end a vivo:DateTimeValue;
       vivo:dateTime           ?end_date;
       vivo:dateTimePrecision  vivo:yearMonthDayPrecision.

  ?funding_org rdfs:label ?funder_label;
               a ?funder_type;
               vivo:assigns ?grant;
               .

  ?super_funding_org rdfs:label ?super_funder_label;
                     .
}
}
WHERE {
  values (?g_pred ?vivo_pred) {
    (:total_grant_amount vivo:totalAwardAmount)
    (:direct_costs vivo:grantDirectCost)
    (:indirect_costs ucdlib:grantIndirectCost)
    (:sponsor_award_number vivo:sponsorAwardId)
  }

  ?g :name ?title;
     :type ?type;
     :status ?status;
     ?g_pred ?g_value;
     .
  bind(uri(replace(str(?g),str(aggie:),"ark:/87287/d7c08j/grant/")) as ?grant)

  OPTIONAL {
    ?g :assistance_listing_numbers/:assistance_listing_number ?assistanceListingNumber.
  }

  {
    select ?g ?role ?role_ark ?role_percentage ?role_type ?aggie_person_name
    WHERE {
      {
        ?g :principal_investigator [:name ?aggie_person_name;
                                   :id ?aggie_person_id;
                                   :email ?aggie_person_email];
                                   .
        bind("100" as ?role_percentage)
        bind(vivo:PrincipalInvestigatorRole as ?role_type)
      } union {
        values (?role_role ?role_type) {
          ("Co-Principal Investigator" vivo:CoPrincipalInvestigatorRole )
          ("Project Manager" vivo:ProjectManagerRole )
          ("Project Administrator" vivo:ProjectAdministratorRole )
          ("Grants Administrator" vivo:GrantsAdministratorRole )
          ("Principal Investigator" vivo:PrincipalInvestigatorRole )
        }
        ?g :participants/:participant [:person ?aggie_person_id;
                                      :percentage ?role_percentage;
                                      :role ?role_role];
                                      .
      }
      bind(uri(replace(str(?g),str(aggie:),"ark:/87287/d7c08j/grant/")) as ?grant)
      bind(md5(replace(str(?aggie_person_id),str(aggie:),'')) as ?employee_id)
      bind(md5(replace(str(?aggie_person_id),str(aggie:),'employeeId/')) as ?role_ark_id)
      BIND(uri(concat(str(?grant), "#role_",?role_ark_id)) AS ?role)
      bind(concat('ark:/87287/d7c08j/',?role_ark_id) as ?role_ark)
    }
  }
  OPTIONAL {
    select ?role_expert ?employee_id (min(?l) as ?role_label) WHERE {
      SERVICE <http://localhost:3030/experts/query> {
        graph <http://iam.ucdavis.edu/> {
          ?role_expert ucdlib:employeeId ?employee_id;
                       rdfs:label ?l
          .
        }
      }
    } group by ?role_expert ?role_ark
  }

  OPTIONAL {
    VALUES (?purpose ?grant_type) {
      ("43-Academic Support" ucdlib:GrantAcademicSupport)
      ("45-Research AES" ucdlib:GrantResearchAES)
      ("68-Student Services" ucdlib:GrantStudentServices)
      ("Capital Projects" ucdlib:GrantCapitalProjects)
      ("78-Student Financial Aid" ucdlib:GrantStudentFinancialAid)
      ("40-Instruction" ucdlib:GrantInstruction)
      ("44-Research" ucdlib:GrantResearch)
      ("62-Public Service/Other" ucdlib:GrantPublicService)
    }
    ?g :purpose ?purpose.
  }

  OPTIONAL {
    ?g :start_date ?start_ymd.
    bind(xsd:date(replace(?start_ymd,'/','-')) as ?start_date)
    bind(uri(replace(str(?g),str(aggie:),"ark:/87287/d7c08j/grant/")) as ?grant)
    BIND(uri(concat(str(?grant), "#duration")) AS ?duration)
    BIND(uri(concat(str(?grant), "#start")) AS ?start)
  }
  OPTIONAL {
    ?g :end_date ?end_ymd.
    BIND(uri(concat(str(?grant), "#end")) AS ?end)
    bind(uri(replace(str(?g),str(aggie:),"ark:/87287/d7c08j/grant/")) as ?grant)
    BIND(uri(concat(str(?grant), "#duration")) AS ?duration)
    bind(xsd:date(replace(?end_ymd,'/','-')) as ?end_date)
  }

  OPTIONAL {
    ?g :financial/:funding_sources/:funding_source ?funding_org.
    bind(vivo:FundingOrganization as ?funder_type)
    OPTIONAL {
      ?funding_org :name ?funder_label.
    }
  }

  OPTIONAL {
    ?g :financial/:flow_thru_funding ?super_funding_org.
  }
}
