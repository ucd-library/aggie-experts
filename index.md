# Project Overview

[Aggie Experts](https://experts.ucdavis.edu) is a joint pilot project
between the Office of the Provost and the UC Davis Library
[team](team.md). It serves as a central registry of UC Davis scholarship produced by academic senate and federation
faculty, researchers, experts and creators. Aggie Experts can be used as an
expertise discovery platform for finding collaborators, mentors and expert
opinions, as a showcase of the UC Davis excellence in research, teaching and
community service, and as a tool that reduces the administrative load on UC
Davis researchers and administrators.

## Infrastructure

The overarching principles of building out the Aggie Experts platform are to
avoid hosting data locally and to present all content as linked data. The data
sources are described in more detail below. Aggie Experts is inspired by the
[VIVO software tool](https://duraspace.org/vivo/about/) and uses their schema to
represent the data in RDF format. For more information, refer to our [GitHub
repository](https://github.com/ucd-library/aggie-experts).

## Data Sources for Aggie Experts

* We use the UC Davis identity management system as the source for the scholar’s
  name, title and unit affiliation. Researchers can change that information in
  the [campus directory listing](https://org.ucdavis.edu/odr).

* Publications metadata is based on scholars’ claims of publications in support
  of the UC Open Access Policy. Faculty can review with publications they have
  claimed, and what additional publications are pending review and approval in
  the California Digital Library instance of [Symplectic Elements publication
  management system](https://oapolicy.universityofcalifornia.edu/).

* The grants data are obtained from the university’s financial data warehouse.

## Data Fields

Activities and contributions to research, teaching and the community are
extensive. We work with faculty to choose from the following list of fields for
each new iteration of the registry. It is by no means exhaustive, and we are
open to additions: Name, Home department, Current position, Additional
affiliations, Photo, Research bio, Openness to collaborations, Websites,
Courses, Awards, Patents, Grants, Publications, Datasets, Software, Exhibits,
Performances, Conference papers, Gray literature, Collaborations, Mentorship,
Service. This list is intended long-term
visioning.

## Functionalities

A good registry needs to have a good search mechanism. We enable discovery of
expertise on campus through researchers’ scholarship reflected in each field we
add to the registry.

Aggie Experts is intended to function in accordance with the [FAIR data
principles](https://www.force11.org/fairprinciples). In many cases faculty are
required to provide the same information to the university, grant-funding
agencies, and conferences. Exports from Aggie Experts would allow the faculty to
reformat their content for those needs and reduce the time spent on
administrative work.

## Feedback and Issue Reporting

To report an issue or provide feedback go to
[https://github.com/ucd-library/aggie-experts-public-issues/issues/new/choose](https://github.com/ucd-library/aggie-experts-public-issues/issues/new/choose)

Review
[Issues](https://github.com/ucd-library/aggie-experts-public-issues/issues) to
see all reported issues.

Thanks for taking an active role in the development of Aggie Experts!

## Milestones

**August 2019** Convene Faculty Advisory Board and establish the parameters for
a minimal viable product

**October 2020** Roll out to the Department of Materials Science and Engineering

*Data fields:* affiliations, titles, email contact, publications

*Functionalities:* search, export of publications as a RIS file

**March 2021** Roll out to the Department of Biological and Agricultural
Engineering

*Data fields:* research areas

*Functionalities:* improved search

**May 2021** Roll out to the Department of Mechanical and Aerospace Engineering

*Functionalities:* refinement of previous iteration

**July 2021**

*Data fields:* grants

**Fall 2021--Winter 2022** Completetion of the pilot with the College of Engineering

**Remainder of 2022--2023** Robust architecture to manage a campus-wide database

*Data fields:* sunset of research areas

**May 2024** Campus-wide pre-release of Aggie Experts to Senate Faculty (v1.0.0)

**September 2024** Campus-wide pre-release of Aggie Experts to Federation Faculty (v2.0.0)

*Functionalities:* grant index and grant landing pages; availability keyword search;
API subselect for smaller client payloads

**December 2024** Major architecture release (v3.0.0)

*Functionalities:* grant visibility controls; improved search and pagination; bug fixes
from broad faculty feedback

**February 2025** Works browseable and searchable (v3.2.0)

*Functionalities:* works added to browse and search pages alongside experts and grants;
full-text search across publications

**April 2025** Public launch (v4.0.0)

*Functionalities:* robots.txt and sitemap for search engine indexing; SEO metadata on
expert, work, and grant pages; Fin 2.11 infrastructure upgrade

**Summer 2025** Favorites and highlighted works (v4.5.x)

*Functionalities:* researchers and admins can mark works as favorites/highlighted;
highlighted works surface prominently on expert profiles and in the SiteFarm API;
propagation of favorites to CDL Elements

**October 2025** Share and discover (v4.6.0)

*Functionalities:* share buttons on expert, work, and grant landing pages

**November 2025** Timeline date filter (v4.7.0)

*Functionalities:* date range slider on search results page to filter works and grants
by year; results totals update dynamically with timeline filter

**April 2026** Harvest platform migration to Anduin and CaskFS (v5.0.0)

*Infrastructure:* replaced FIN/Fedora LDP and local Fuseki with
[project-anduin](https://github.com/ucd-library/project-anduin) (Dagster + CaskFS +
Superset + Auth Gateway); content-addressed artifact storage via
[CaskFS](https://github.com/ucd-library/caskfs); distributed Celery workers for
parallel per-user ETL; automated weekly scheduling with Superset reporting dashboards;
GitOps deployment via
[aggie-experts-deployment](https://github.com/ucd-library/aggie-experts-deployment)



