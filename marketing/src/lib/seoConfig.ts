/**
 * eDrops Centralized SEO, Entity & Schema Architecture Configuration
 * High-authority Knowledge Graph declarations, canonical domain rules,
 * Google Sitelinks navigation map, and Schema.org JSON-LD builders.
 */

export const CANONICAL_DOMAIN = 'edrops.in';
export const SITE_URL = 'https://edrops.in';
export const APP_URL = 'https://app.edrops.in';

export const ENTITY_CONFIG = {
  brandName: 'eDrops',
  brandNameFull: 'eDrops™',
  legalName: 'eDrops Technologies Private Limited',
  alternateNames: [
    'eDrops Water',
    'eDrops App',
    'eDrops 20L Water Jar Software',
    'eDrops Technologies',
    'Edrops'
  ],
  disambiguatingDescription:
    'eDrops is an Indian water distribution software platform and operating system for 20-litre packaged drinking water jar deliveries, recurring customer subscriptions, prepaid digital wallets, and route dispatch logistics.',
  slogan: 'The Operating System for Modern 20L Water Delivery Businesses',
  description:
    'eDrops is the dedicated water jar delivery & subscription software. Automate prepaid digital wallets, recurring deliveries, route dispatch, and customer accounts in one unified platform.',
  url: SITE_URL,
  appUrl: APP_URL,
  logo: `${SITE_URL}/logo.png`,
  logoIcon: `${SITE_URL}/icon-512.png`,
  ogImage: `${SITE_URL}/og-image.jpg`,
  foundingDate: '2024',
  telephone: '+91-7907805620',
  telephoneFormatted: '+91 7907805620',
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
  areaServed: [
    { '@type': 'Country', name: 'India' },
    { '@type': 'State', name: 'Kerala' },
    { '@type': 'City', name: 'Kondotty' },
    { '@type': 'City', name: 'Malappuram' },
    { '@type': 'City', name: 'Kozhikode' },
    { '@type': 'City', name: 'Kochi' },
    { '@type': 'City', name: 'Bangalore' }
  ],
  currenciesAccepted: 'INR',
  paymentAccepted: 'UPI, Credit Card, Debit Card, Net Banking, Wallet',
  priceRange: '₹₹',
  sameAs: [
    'https://twitter.com/edrops_in',
    'https://www.linkedin.com/company/edrops-in',
    'https://github.com/WebzioInfo/edrops'
  ],
  openingHours: 'Mo-Sa 07:00-20:00'
};

/**
 * Normalizes any incoming pathname or URL to the canonical URL format.
 * Prevents 301/308 redirect hops by enforcing:
 * - https://edrops.in protocol and canonical domain
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
    name: 'Features & Capabilities',
    url: `${SITE_URL}/features/`,
    description:
      'Automated water jar delivery scheduling, prepaid wallets, route dispatch, and customer management.'
  },
  {
    name: 'Pricing & Plans',
    url: `${SITE_URL}/pricing/`,
    description:
      'Transparent pricing for 20L water delivery businesses and plants with flexible volume scaling.'
  },
  {
    name: 'How It Works',
    url: `${SITE_URL}/how-it-works/`,
    description:
      'Learn how eDrops automates recurring subscriptions, doorstep jar drops, and prepaid balances.'
  },
  {
    name: 'Industry Solutions',
    url: `${SITE_URL}/industries/`,
    description:
      'Tailored software solutions for water manufacturing plants, distributors, and delivery agencies.'
  },
  {
    name: 'Knowledge Hub & Blog',
    url: `${SITE_URL}/blog/`,
    description:
      'Actionable guides on scaling water delivery operations, customer retention, and prepaid cash flow.'
  },
  {
    name: 'About eDrops',
    url: `${SITE_URL}/about/`,
    description:
      'The story and mission behind eDrops: transforming 20L packaged drinking water distribution.'
  },
  {
    name: 'Contact & Support',
    url: `${SITE_URL}/contact/`,
    description:
      'Get in touch with sales, customer support, or schedule an onboarding demo.'
  },
  {
    name: 'FAQ',
    url: `${SITE_URL}/faq/`,
    description:
      'Frequently asked questions regarding water jar delivery subscriptions and prepaid balances.'
  }
];

// ==========================================
// REUSABLE SCHEMA.ORG BUILDERS
// ==========================================

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'Corporation'],
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
      },
      {
        '@type': 'ContactPoint',
        telephone: ENTITY_CONFIG.telephone,
        contactType: 'sales',
        email: ENTITY_CONFIG.email,
        areaServed: 'IN',
        availableLanguage: ['English', 'Hindi']
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
    alternateName: 'eDrops Official Website',
    description: ENTITY_CONFIG.slogan,
    publisher: {
      '@id': `${SITE_URL}/#organization`
    },
    inLanguage: 'en-IN',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  };
}

export function buildSiteNavigationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${SITE_URL}/#sitenavigation`,
    name: 'eDrops Core Navigation',
    description: 'Main navigation routes and expanded sitelinks for eDrops platform',
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
    '@type': ['LocalBusiness', 'ProfessionalService'],
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

export function buildSoftwareApplicationSchema(pageDescription?: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}/#software`,
    name: `${ENTITY_CONFIG.brandName} — 20L Water Jar Delivery & Subscription Software`,
    operatingSystem: 'All (Web, Android, iOS, PWA)',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Logistics, Supply Chain & Subscription Management',
    description: pageDescription || ENTITY_CONFIG.description,
    url: SITE_URL,
    author: {
      '@id': `${SITE_URL}/#organization`
    },
    publisher: {
      '@id': `${SITE_URL}/#organization`
    },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: '0',
      highPrice: '4999',
      offerCount: '3',
      offers: [
        {
          '@type': 'Offer',
          name: 'Starter Plan',
          price: '0',
          priceCurrency: 'INR',
          availability: 'https://schema.org/InStock',
          description: 'Free starter tier for local water jar routes and growing distributors'
        },
        {
          '@type': 'Offer',
          name: 'Pro Route Plan',
          price: '999',
          priceCurrency: 'INR',
          availability: 'https://schema.org/InStock',
          description: 'Full dispatch automation, unlimited jar subscriptions, and driver app access'
        },
        {
          '@type': 'Offer',
          name: 'Enterprise Plant Plan',
          price: '4999',
          priceCurrency: 'INR',
          availability: 'https://schema.org/InStock',
          description: 'Multi-branch water plants, distributor network hierarchy, and custom ERP integration'
        }
      ]
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      ratingCount: '128',
      reviewCount: '128',
      bestRating: '5',
      worstRating: '1'
    },
    featureList: [
      'Prepaid Jar Wallet Engine',
      'Recurring Water Subscription Schedules',
      'Real-Time Driver Route Dispatch',
      'Doorstep Bottle Swap & Reconciliation',
      'Customer Self-Service Web Portal & PWA',
      'Automated Low-Balance Recharge Reminders',
      'Commercial Bulk Delivery Management',
      'Water Plant Multi-Distributor Hierarchy'
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
      name: 'eDrops Water Delivery & Logistics Blog',
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
    articleSection: post.category || 'Water Delivery Logistics',
    image: post.image ? (post.image.startsWith('http') ? post.image : `${SITE_URL}${post.image}`) : `${SITE_URL}/og-image.jpg`,
    inLanguage: 'en-IN',
    author: {
      '@type': 'Organization',
      name: post.authorName || 'eDrops Editorial Team',
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
    serviceType: service.serviceType || 'Water Jar Delivery Management Software',
    description: service.description,
    url: serviceUrl,
    provider: {
      '@id': `${SITE_URL}/#organization`
    },
    areaServed: ENTITY_CONFIG.areaServed,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'eDrops Subscription & Dispatch Services',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: service.name
          }
        }
      ]
    }
  };
}
