function getFaqJsonLd() {
  const faqPageId = 'https://experts.ucdavis.edu/faq#faqpage';
  const webPageId = 'https://experts.ucdavis.edu/faq#webpage';
  const webSiteId = 'https://experts.ucdavis.edu/#website';
  const publisherId = 'https://www.ucdavis.edu/#organization';

  const faqPage = {
    '@id': faqPageId,
    '@type': 'FAQPage',
    url: 'https://experts.ucdavis.edu/faq',
    name: 'Aggie Experts FAQ',
    inLanguage: 'en-US',
    publisher: {
      '@id': publisherId
    },
    mainEntityOfPage: {
      '@id': webPageId
    },
    isPartOf: {
      '@id': webSiteId
    },
    mainEntity: [
      faqItem(
        'What is Aggie Experts?',
        'Aggie Experts is a platform for finding researchers and experts at UC Davis. It helps people discover collaborators, mentors, research expertise, publications, and grants across the university.'
      ),
      faqItem(
        'How does search work on Aggie Experts?',
        'Aggie Experts default search looks for matches of all keywords across work and grant titles, grant abstracts, expert bios, affiliations, and journal or publisher names. Advanced search behavior is also available through the search tips page.'
      ),
      faqItem(
        'I am faculty at UC Davis. Why am I not in Aggie Experts?',
        'Aggie Experts includes Academic Senate and Federation faculty and researchers. If you are a current member of one of those groups and do not see your profile, contact experts@ucdavis.edu for assistance.'
      ),
      faqItem(
        'How often do you update the data in Aggie Experts?',
        'Scholarly publications data is updated weekly. Grant data is updated quarterly.'
      ),
      faqItem(
        'What sources do you use for my publications?',
        'Aggie Experts uses the UC Publication Management System as the primary source of publication data. That system aggregates records from sources including Dimensions, Scopus, Crossref, Web of Science, Europe PubMed Central, PubMed, eScholarship, arXiv, RePEc, SSRN, DBLP, CiNii, figshare, and Google Books.'
      ),
      faqItem(
        'What sources do you use for my grants? Why can\'t I edit the grant records?',
        'Grant data comes from the university financial warehouse and is reconciled with UCOP award records. Because those records are treated as the official university record, they cannot be edited directly in Aggie Experts. If grant information displays incorrectly, contact experts@ucdavis.edu or your unit finance office as appropriate.'
      ),
      faqItem(
        'How do I export data?',
        'Signed-in users can export publications as RIS files from their profile and can export grants in spreadsheet form from the related editing interfaces.'
      ),
      faqItem(
        'How do I edit my Aggie Experts profile?',
        'Aggie Experts merges data from university-vetted systems, so profile changes are typically made in the original source systems. For example, publication and profile content updates are managed through the UC Publication Management System, while directory-based identity details come from UC Davis directory and HR systems.'
      ),
      faqItem(
        'How do I change my name, title, or affiliation?',
        'Name display settings are managed in UCPath, while title information is managed through the UC Davis campus directory. After updates are approved in those systems, the changes will appear in Aggie Experts on a later data refresh.'
      ),
      faqItem(
        'Why isn\'t my email address showing up in Aggie Experts?',
        'An email address may be hidden because the person is affiliated with UC Davis Health, where email visibility is restricted, or because the individual chose not to publish their email address in the campus Online Directory.'
      ),
      faqItem(
        'Why are there so few or no publications in my Aggie Experts profile?',
        'The most common reason is that publications have not yet been claimed in the UC Publication Management System. Reviewing and claiming pending publications there will improve what appears in Aggie Experts.'
      ),
      faqItem(
        'Why are there incorrect publications on my profile? How do I remove them?',
        'Publication lists are enriched from external identifier and aggregation systems, and those machine-generated matches can contain errors. Incorrect items can be rejected from the profile editing interface, or you can contact experts@ucdavis.edu if there are many incorrect publications.'
      ),
      faqItem(
        'How do I edit my publication record?',
        'Publication records are managed through the UC Publication Management System. From Aggie Experts, signed-in users can navigate to their works editing tools and then continue into the publication management workflow to review, claim, and organize publications.'
      ),
      faqItem(
        'How do I improve the search results for my publications?',
        'Improve publication matching by reviewing and claiming identifiers such as Scopus ID, Web of Science Researcher ID, Dimensions, and ORCID in the UC Publication Management System. Better identifier coverage improves automatic matching of publications to your profile.'
      ),
      faqItem(
        'How do I change the visibility of a publication or a grant?',
        'Use the edit tools in your Aggie Experts profile to change visibility. Those edits are then propagated to the UC Publication Management System, although temporary failures can occur if that downstream system is unavailable.'
      ),
      faqItem(
        'How do I reject a publication?',
        'Open the works management interface from your profile and reject the publication there. That change is then synchronized with the UC Publication Management System.'
      ),
      faqItem(
        'How do I delete my profile?',
        'After signing in, use the delete control on your profile to remove it from Aggie Experts. If you want to prevent reinstatement on later syncs, also update profile privacy in the UC Publication Management System.'
      ),
      faqItem(
        'How can I import my publications into MIV so that I only need to enter my information once?',
        'Publications can be exported from your profile as an RIS file and then imported into MIV. Grant information can also be imported into MIV, but the request must be initiated from within MIV.'
      ),
      faqItem(
        'I manage SiteFarm content for my department, college, or school. How can we integrate information from Aggie Experts into our website?',
        'In SiteFarm, add or edit a Person content item and use the Aggie Experts option in Additional Options to load expert data using a UC Davis email address. This can populate fields such as name, pronouns, email, website URL, bio, recent publications, and ORCID when available.'
      )
    ]
  };

  const webPage = {
    '@id': webPageId,
    '@type': 'WebPage',
    url: 'https://experts.ucdavis.edu/faq',
    name: 'Aggie Experts Help',
    inLanguage: 'en-US',
    isPartOf: {
      '@id': webSiteId
    },
    mainEntity: {
      '@id': faqPageId
    }
  };

  const webSite = {
    '@id': webSiteId,
    '@type': 'WebSite',
    name: 'Aggie Experts',
    url: 'https://experts.ucdavis.edu',
    publisher: {
      '@id': publisherId
    }
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      faqPage,
      webPage,
      webSite,
      getPublisher(publisherId)
    ]
  };

  return JSON.stringify(jsonLd).replace(/</g, '\\u003c');
}

function getPublisher(id) {
  return {
    '@type': 'CollegeOrUniversity',
    '@id': id,
    name: 'University of California, Davis',
    url: 'https://www.ucdavis.edu',
    logo: {
      '@type': 'ImageObject',
      url: 'https://www.ucdavis.edu/sites/default/files/media/images/uc-davis-logo.svg'
    },
    sameAs: [
      'https://www.facebook.com/UCDavis',
      'https://www.instagram.com/ucdavis',
      'https://www.linkedin.com/school/uc-davis',
      'https://x.com/ucdavis',
      'https://www.youtube.com/user/UCDavis'
    ],
    parentOrganization: {
      '@type': 'Organization',
      name: 'University of California'
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'One Shields Avenue',
      addressLocality: 'Davis',
      addressRegion: 'CA',
      postalCode: '95616',
      addressCountry: 'US'
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'experts@ucdavis.edu',
        availableLanguage: ['en']
      }
    ],
    department: [
      {
        '@type': 'Organization',
        name: 'Aggie Experts',
        url: 'https://experts.ucdavis.edu',
        email: 'experts@ucdavis.edu'
      }
    ]
  };
}

function faqItem(question, answer) {
  return {
    '@type': 'Question',
    name: question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: answer
    }
  };
}

module.exports = getFaqJsonLd;