# Project Overview

[Aggie Experts](https://dev.experts.ucdavis.edu) is a joint pilot project
between the Office of the Provost and the UC Davis Library
[team](team.md). Its
purpose is to create a central registry of UC Davis scholarship produced by
faculty, researchers, experts and creators. Aggie Experts can be used as an
expertise discovery platform for finding collaborators, mentors and expert
opinions, as a showcase of the UC Davis excellence in research, teaching and
community service, and as a tool that reduces the administrative load on UC
Davis researchers and administrators. In the course of two years (2020-2022) we
will be expanding the registry by adding faculty from the College of Engineering
and adjusting its functionality based on user feedback.

## Infrastructure

The overarching principles of building out the Aggie Experts platform are to
avoid hosting data locally and to present all content as linked data. The data
sources are described in more detail below. Aggie Experts is inspired by the
[VIVO software tool](https://duraspace.org/vivo/about/) and uses their schema to
represent the data in RDF format. For more information, refer to our [GitHub
repository](https://github.com/ucd-library/rp-ucd-deployment).

## Data Sources for Aggie Experts

* We use the UC Davis identity management system as the source for the scholar’s
  name, title and unit affiliation. Researchers can change that information in
  the [campus directory listing](https://org.ucdavis.edu/odr).

* Publications metadata is based on scholars’ claims of publications in support
  of the UC Open Access Policy. Faculty can review with publications they have
  claimed, and what additional publications are pending review and approval in
  the California Digital Library instance of [Symplectic Elements publication
  management system](https://oapolicy.universityofcalifornia.edu/).

* Research subject areas are generated in one of the following manners:

* The researcher has already selected relevant keywords in the [Symplectic
  Elements publication management
  system](https://oapolicy.universityofcalifornia.edu/).

* The keywords are extracted from the researchers’ claimed publications, and the
  ones that occur three or more times are added to their profiles.
 
* The grants data are obtained from the university’s financial data warehouse.

## Data Fields

Activities and contributions to research, teaching and the community are
extensive. We work with faculty to choose from the following list of fields for
each new iteration of the registry. It is by no means exhaustive, and we are
open to additions: Name, Home department, Current position, Additional
affiliations, Photo, Research bio, Openness to collaborations, Websites,
Courses, Awards, Patents, Grants, Publications, Datasets, Software, Exhibits,
Performances, Conference papers, Gray literature, Collaborations, Mentorship,
Service. This list exceeds the scope of the pilot and is intended long-term
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

## Schedule

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

**TBD**

*Data fields:* grants

*Functionalities:* website plug-in, subject-expertise visualization
