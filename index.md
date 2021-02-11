# Project Overview

[Aggie Experts](https://dev.experts.ucdavis.edu) is a joint pilot project between the Office of the Provost and the UC Davis Library. Its purpose is to create a central registry of UC Davis scholarship produced by faculty, researchers, experts and creators. Aggie Experts can be used as an expertise discovery platform for finding collaborators, mentors and expert opinions, as a showcase of the UC Davis excellence in research, teaching and community service, and as a tool that reduces the administrative load on UC Davis researchers and administrators. In the course of two years (2020-2022) we will be expanding the registry by adding faculty from the College of Engineering and adjusting its functionality based on user feedback.

## Infrastructure

The overarching principles of building out the Aggie Experts platform are to avoid hosting data locally and to present all content as linked data. The data sources are described in more detail below. Aggie Experts is inspired by the [VIVO software tool](https://duraspace.org/vivo/about/) and uses their schema to represent the data in RDF format. For more information, refer to our [GitHub repository](https://github.com/ucd-library/rp-ucd-deployment).

## Data Sources for Aggie Experts

* We use the UC Davis identity management system as the source for the scholar’s name, title and unit affiliation. Researchers can change that information in the [campus directory listing](https://org.ucdavis.edu/odr).
* Publications metadata is based on scholars’ claims of publications in support of the UC Open Access Policy. Faculty can review with publications they have claimed, and what additional publications are pending review and approval in the California Digital Library instance of [Symplectic Elements publication management system](https://oapolicy.universityofcalifornia.edu/).
* Research subject areas are generated in one of the following manners:
  * The researcher has already selected relevant keywords in the [Symplectic Elements publication management system](https://oapolicy.universityofcalifornia.edu/).
  * The keywords are extracted from the researchers’ claimed publications, and the ones that occur three or more times are added to their profiles.

## Feedback and Issue Reporting

To report an issue or provide feedback go to
[https://github.com/ucd-library/aggie-experts-public-issues/issues/new/choose](https://github.com/ucd-library/aggie-experts-public-issues/issues/new/choose)

Review [Issues](https://github.com/ucd-library/aggie-experts-public-issues/issues) to see all reported issues.

Thanks for taking an active role in the development of Aggie Experts!

## Schedule

**August 2019** Convene Faculty Advisory Board and establish the parameters for a minimal viable product

**October 2020** Roll out to the Department of Materials Science and Engineering

*Data fields:* affiliations, titles, email contact, publications

*Functionalities:*  search, export of publications as a RIS file

**March 2021** Roll out to the Department of Biological and Agricultural Engineering

*Data fields:* research areas

*Functionalities:* improved search

**May 2021** Roll out to the Department of Mechanical and Aerospace Engineering

*Data fields:* tbd at March meeting

*Functionalities:* tbd at March meeting
