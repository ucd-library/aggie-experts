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

  ?pi_role a vivo:GrantRole, vivo:PrincipalInvestigatorRole;
          obo:RO_0000052 ?pi;
          vivo:relatedBy ?grant;
          ucdlib:percentage 100;
          .

  ?pi a vivo:FacultyMember;
      rdfs:label ?aggie_person_name;
      ucdlib:proprietary_id ?pi_id;
      .

  ?role a vivo:GrantRole, ?role_type;
          obo:RO_0000052 ?role_expert;
          vivo:relatedBy ?grant;
          ucdlib:percentage ?role_percentage;
          .

  ?role_expert a vivo:FacultyMember;
      rdfs:label ?participant_name;
      ucdlib:proprietary_id ?participant_id;
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
     :number ?number;
     :status ?status;
     ?g_pred ?g_value;
     .

  ?g :principal_investigator [:name ?aggie_person_name;
                             :number ?pi_id;
                             :email ?aggie_person_email];
                             .

  OPTIONAL {
    ?g :start_date ?start_ymd.
  }
  OPTIONAL {
    ?g :end_date ?end_ymd.
  }
  OPTIONAL {
    ?g :assistance_listing_numbers/:assistance_listing_number ?assistanceListingNumber.
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
    ?g :financial/:funding_sources/:funding_source ?funding_org.
    bind(vivo:FundingOrganization as ?funder_type)
    OPTIONAL {
      ?funding_org :name ?funder_label.
    }
  }

  OPTIONAL {
    ?g :financial/:flow_thru_funding ?super_funding_org.
  }

  OPTIONAL {
    values (?role_role ?role_type) {
      ("Co-Principal Investigator" vivo:CoPrincipalInvestigatorRole )
      ("Project Manager" vivo:ProjectManagerRole )
      ("Project Administrator" vivo:ProjectAdministratorRole )
      ("Grants Administrator" vivo:GrantsAdministratorRole )
      ("Principal Investigator" vivo:PrincipalInvestigatorRole )
    }
    ?g :participants/:participant [:person ?participant;
                                  :percentage ?role_percentage;
                                  :role ?role_role];
                                  .
    ?participant :number ?participant_number;
                 :name ?participant_name;
                 :email ?participant_email.
  }

  bind(uri(concat("ark:/87287/d7c08j/grant/",?number)) as ?grant)
  bind(uri(concat("ark:/87287/d7c08j/",md5(?pi_id))) as ?pi)
  BIND(uri(concat(str(?grant), "#role_",md5(?pi_id))) AS ?pi_role)

  bind(uri(concat("ark:/87287/d7c08j/",md5(?participant_number))) as ?role_expert)
  BIND(uri(concat(str(?grant), "#role_",md5(?participant_number))) AS ?role)

  bind(xsd:date(replace(?start_ymd,'/','-')) as ?start_date)
  BIND(uri(concat(str(?grant), "#duration")) AS ?duration)
  BIND(uri(concat(str(?grant), "#start")) AS ?start)
  BIND(uri(concat(str(?grant), "#end")) AS ?end)
  bind(xsd:date(replace(?end_ymd,'/','-')) as ?end_date)
}
