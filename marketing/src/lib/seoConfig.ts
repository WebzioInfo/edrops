/**
 * eDrops Centralized SEO, Entity & Schema Architecture Configuration
 * High-authority Knowledge Graph declarations, canonical domain rules,
 * Google Sitelinks navigation map, and Schema.org JSON-LD builders.
 */

export const CANONICAL_DOMAIN = 'www.edrops.in';
export const SITE_URL = 'https://www.edrops.in';
export const APP_URL = 'https://app.edrops.in';

export const ENTITY_CONFIG = {
  brandName: 'eDrops',
  brandNameFull: 'eDrops™',
  legalName: 'eDrops Technologies Private Limited',
  alternateNames: [
    'eDrops Water',
    'eDrops App',
    'eDrops 20L Water Jar Delivery',
    'eDrops Technologies',
    'Edrops'
  ],
  disambiguatingDescription:
    'eDrops is a 20L water jar delivery app that lets customers order jars online, subscribe to recurring deliveries, and pay from a prepaid wallet, with doorstep jar swap.',
  slogan: 'Order 20L water jars online — subscribe, recharge, get doorstep delivery.',
  description:
    'eDrops is a 20L water jar delivery app. Order jars online, subscribe to recurring deliveries, top up a prepaid wallet, and get doorstep jar swaps on time.',
  url: SITE_URL,
  appUrl: APP_URL,
  logo: `${SITE_URL}/logo.png`,
  logoIcon: `${SITE_URL}/icon-512.png`,
  ogImage: `${SITE_URL}/og-image.jpg`,
  foundingDate: '2024',
  telephone: '+91-7907805626',
  telephoneFormatted: '+91 7907805626',
  email: 'support@edrops.in',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Kondotty',
    addressLocality: 'Kondotty, Malappuram',
    addressRegion: 'Kerala',
    postalCode: '673638',
    addressCountry: 'IN'
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 11.1485,
    longitude: 75.9616
  },
  /* TODO: Verify all service areas. Confirm whether Kozhikode, Kochi, Bangalore are actually served. */
  areaServed: [
    { '@type': 'City', name: 'Kondotty' },
    { '@type': 'City', name: 'Malappuram' }
  ],
  currenciesAccepted: 'INR',
  paymentAccepted: 'UPI, Credit Card, Debit Card, Net Banking, Wallet',
  priceRange: '₹₹',
  /* TODO: Add real social profile URLs. Verify Twitter and LinkedIn exist. */
  sameAs: [
    'https://twitter.com/edrops_in',
    'https://www.linkedin.com/company/edrops-in'
  ],
  openingHours: 'Mo-Sa 07:00-20:00'
};

/**
 * Normalizes any incoming pathname or URL to the canonical URL format.
 * Prevents 301/308 redirect hops by enforcing:
 * - https://www.edrops.in protocol and canonical domain
 * - Strict lowercase pathname
 * - Clean trailing slash matching Astro static output
 * - Strips query parameters and URL hashes
 */
export function getCanonicalUrl(input?: string): string {
  if (!input) return `${SITE_URL}/`;

  try {
    const url = input.startsWith('http')
      ? new URL(input)
      : new URL(input, SITE_URL);

    let pathname = url.pathname.toLowerCase();

    // Remove multiple consecutive slashes
    pathname = pathname.replace(/\/+/g, '/');

    // Ensure trailing slash for all paths except file extensions
    const hasExtension = /\.[a-z0-9]+$/i.test(pathname);
    if (!hasExtension && !pathname.endsWith('/')) {
      pathname = `${pathname}/`;
    }

    return `${SITE_URL}${pathname}`;
  } catch {
    return `${SITE_URL}/`;
  }
}

/**
 * Core Sitelinks Navigation List
 * Mapped for Google Search expanded sitelinks and SiteNavigationElement schema
 */
export const CORE_SITELINKS_NAV = [
  {
    name: 'Features',
    url: `${SITE_URL}/features/`,
    description:
      'Explore eDrops features: subscriptions, prepaid wallet, doorstep jar swap, live order tracking, and flexible scheduling.'
  },
  {
    name: 'Pricing',
    url: `${SITE_URL}/pricing/`,
    description:
      'See eDrops delivery pricing — transparent per-jar rates with no hidden fees.'
  },
  {
    name: 'How It Works',
    url: `${SITE_URL}/how-it-works/`,
    description:
      'Learn how to order 20L water jars with eDrops: choose a plan, top up your wallet, and get doorstep delivery.'
  },
  {
    name: 'Bulk Orders for Offices',
    url: `${SITE_URL}/industries/`,
    description:
      'Bulk 20L water jar delivery for offices, cafes, clinics, and commercial spaces with volume-based pricing.'
  },
  {
    name: 'Blog',
    url: `${SITE_URL}/blog/`,
    description:
      'Tips on staying hydrated, managing your water subscription, and getting the most out of eDrops.'
  },
  {
    name: 'About eDrops',
    url: `${SITE_URL}/about/`,
    description:
      'The story behind eDrops — making 20L water jar delivery simple, reliable, and fully digital.'
  },
  {
    name: 'Contact & Support',
    url: `${SITE_URL}/contact/`,
    description:
      'Get in touch with eDrops customer support for orders, delivery queries, or account help.'
  },
  {
    name: 'FAQ',
    url: `${SITE_URL}/faq/`,
    description:
      'Frequently asked questions about ordering water jars, subscriptions, wallet top-ups, and delivery areas.'
  }
];

// ==========================================
// REUSABLE SCHEMA.ORG BUILDERS
// ==========================================

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: ENTITY_CONFIG.brandName,
    legalName: ENTITY_CONFIG.legalName,
    alternateName: ENTITY_CONFIG.alternateNames,
    disambiguatingDescription: ENTITY_CONFIG.disambiguatingDescription,
    description: ENTITY_CONFIG.description,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: ENTITY_CONFIG.logo,
      caption: `${ENTITY_CONFIG.brandName} Logo`,
      width: 516,
      height: 119
    },
    image: ENTITY_CONFIG.logoIcon,
    telephone: ENTITY_CONFIG.telephone,
    email: ENTITY_CONFIG.email,
    address: ENTITY_CONFIG.address,
    sameAs: ENTITY_CONFIG.sameAs,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: ENTITY_CONFIG.telephone,
        contactType: 'customer service',
        email: ENTITY_CONFIG.email,
        areaServed: 'IN',
        availableLanguage: ['English', 'Hindi', 'Malayalam']
      }
    ]
  };
}

export function buildWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: ENTITY_CONFIG.brandName,
    alternateName: 'eDrops — 20L Water Jar Delivery App',
    description: ENTITY_CONFIG.slogan,
    publisher: {
      '@id': `${SITE_URL}/#organization`
    },
    inLanguage: 'en-IN'
  };
}

export function buildSiteNavigationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${SITE_URL}/#sitenavigation`,
    name: 'eDrops Navigation',
    description: 'Main navigation links for the eDrops water jar delivery website',
    itemListElement: CORE_SITELINKS_NAV.map((item, idx) => ({
      '@type': 'SiteNavigationElement',
      position: idx + 1,
      name: item.name,
      description: item.description,
      url: item.url
    }))
  };
}

export function buildLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}/#localbusiness`,
    name: ENTITY_CONFIG.brandName,
    legalName: ENTITY_CONFIG.legalName,
    url: SITE_URL,
    telephone: ENTITY_CONFIG.telephone,
    email: ENTITY_CONFIG.email,
    priceRange: ENTITY_CONFIG.priceRange,
    currenciesAccepted: ENTITY_CONFIG.currenciesAccepted,
    paymentAccepted: ENTITY_CONFIG.paymentAccepted,
    address: ENTITY_CONFIG.address,
    geo: ENTITY_CONFIG.geo,
    areaServed: ENTITY_CONFIG.areaServed,
    image: ENTITY_CONFIG.ogImage,
    logo: ENTITY_CONFIG.logo,
    openingHours: ENTITY_CONFIG.openingHours,
    parentOrganization: {
      '@id': `${SITE_URL}/#organization`
    }
  };
}

export function buildWebApplicationSchema(pageDescription?: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${SITE_URL}/#app`,
    name: 'eDrops — 20L Water Jar Delivery App',
    operatingSystem: 'All (Web, Android, iOS, PWA)',
    applicationCategory: 'LifestyleApplication',
    applicationSubCategory: 'Food & Drink Delivery',
    description: pageDescription || ENTITY_CONFIG.description,
    url: APP_URL,
    author: {
      '@id': `${SITE_URL}/#organization`
    },
    publisher: {
      '@id': `${SITE_URL}/#organization`
    },
    featureList: [
      'Order 20L water jars online',
      'Recurring subscription deliveries',
      'Prepaid wallet top-up via UPI and cards',
      'Doorstep jar swap — full jar in, empty jar out',
      'Pause, skip, or reschedule deliveries',
      'Live order tracking',
      'Bulk ordering for offices and businesses'
    ]
  };
}

export function buildBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: getCanonicalUrl(item.url)
    }))
  };
}

export function buildFaqSchema(
  faqItems: Array<{ question: string; answer: string }>,
  canonicalUrl?: string
) {
  if (!faqItems || faqItems.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${getCanonicalUrl(canonicalUrl)}#faq`,
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer
      }
    }))
  };
}

export function buildHowToSchema(
  title: string,
  description: string,
  steps: Array<{ name: string; text: string; url?: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': `${SITE_URL}/how-it-works/#howto`,
    name: title,
    description: description,
    image: `${SITE_URL}/hero-delivery.jpg`,
    totalTime: 'PT5M',
    step: steps.map((s, idx) => ({
      '@type': 'HowToStep',
      position: idx + 1,
      name: s.name,
      text: s.text,
      url: s.url ? getCanonicalUrl(s.url) : `${SITE_URL}/how-it-works/`
    }))
  };
}

export function buildBlogPostingSchema(post: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  category?: string;
  image?: string;
  authorName?: string;
}) {
  const postUrl = getCanonicalUrl(post.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${postUrl}#article`,
    isPartOf: {
      '@type': 'Blog',
      '@id': `${SITE_URL}/blog/#blog`,
      name: 'eDrops Blog',
      publisher: {
        '@id': `${SITE_URL}/#organization`
      }
    },
    headline: post.title,
    description: post.description,
    url: postUrl,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': postUrl
    },
    datePublished: post.datePublished,
    dateModified: post.dateModified || post.datePublished,
    articleSection: post.category || 'Water Delivery',
    image: post.image ? (post.image.startsWith('http') ? post.image : `${SITE_URL}${post.image}`) : `${SITE_URL}/og-image.jpg`,
    inLanguage: 'en-IN',
    author: {
      '@type': 'Organization',
      name: post.authorName || 'eDrops Team',
      url: SITE_URL
    },
    publisher: {
      '@id': `${SITE_URL}/#organization`
    }
  };
}

export function buildServiceSchema(service: {
  name: string;
  description: string;
  url: string;
  serviceType?: string;
}) {
  const serviceUrl = getCanonicalUrl(service.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${serviceUrl}#service`,
    name: service.name,
    serviceType: service.serviceType || '20L Water Jar Delivery',
    description: service.description,
    url: serviceUrl,
    provider: {
      '@id': `${SITE_URL}/#organization`
    },
    areaServed: ENTITY_CONFIG.areaServed
  };
}
