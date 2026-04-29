function getFooterJsonLd() {
  const webSiteId = 'https://experts.ucdavis.edu/#website';
  const publisherId = 'https://www.ucdavis.edu/#organization';
  const libraryOrgId = 'https://library.ucdavis.edu/#organization';

  const webSite = {
    '@id': webSiteId,
    '@type': 'WebSite',
    name: 'Aggie Experts',
    url: 'https://experts.ucdavis.edu',
    publisher: {
      '@id': libraryOrgId
    },
    hasPart: [
      {
        '@type': 'SiteNavigationElement',
        name: 'Frequently Asked Questions',
        url: 'https://experts.ucdavis.edu/faq'
      },
      {
        '@type': 'SiteNavigationElement',
        name: 'Questions or Comments?',
        url: 'https://www.ucdavis.edu/contact'
      },
      {
        '@type': 'SiteNavigationElement',
        name: 'Privacy & Accessibility',
        url: 'https://www.ucdavis.edu/help/privacy-accessibility'
      },
      {
        '@type': 'SiteNavigationElement',
        name: 'University of California',
        url: 'https://www.universityofcalifornia.edu/'
      },
      {
        '@type': 'SiteNavigationElement',
        name: 'Terms of Use',
        url: 'https://experts.ucdavis.edu/termsofuse'
      }
    ]
  };

  const library = {
    '@id': libraryOrgId,
    '@type': 'LibrarySystem',
    name: 'UC Davis Library',
    url: 'https://library.ucdavis.edu',
    telephone: '+1-530-752-8792',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '100 NW Quad',
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
    ]
  };

  const publisher = {
    '@type': 'CollegeOrUniversity',
    '@id': publisherId,
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
    }
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      webSite,
      library,
      publisher
    ]
  };

  return JSON.stringify(jsonLd).replace(/</g, '\\u003c');
}

module.exports = getFooterJsonLd;