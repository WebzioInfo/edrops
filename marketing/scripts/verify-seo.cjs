const fs = require('fs');
const path = require('path');

const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const SITEMAP_PATH = path.resolve(__dirname, '..', 'public', 'sitemap.xml');

const BANNED_TERMS = [
  'software',
  'saas',
  'platform',
  'operating system',
  'analytics',
  'dashboard',
  'management',
  'erp',
  'staff',
  'branch',
  'route',
  'dispatch',
  'reconciliation',
  'invoice',
  'recharge revenue',
  'low-balance',
  'retention',
  'water business',
  'water delivery business',
  'distributors',
  'water plants',
  'agencies',
  'subscription software',
  'subscription platform',
  'subscription management'
];

function getAllHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllHtmlFiles(fullPath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const allHtmlFiles = getAllHtmlFiles(DIST_DIR);
console.log(`Total HTML files found in dist: ${allHtmlFiles.length}`);

// Identify indexable vs noindex pages
const indexablePages = [];
const noindexPages = [];

for (const file of allHtmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const isNoindex = /<meta[^>]*robots[^>]*noindex/i.test(content);
  const relPath = path.relative(DIST_DIR, file).replace(/\\/g, '/');
  if (isNoindex) {
    noindexPages.push({ relPath, file, content });
  } else {
    indexablePages.push({ relPath, file, content });
  }
}

console.log(`Indexable pages: ${indexablePages.length}`);
console.log(`Noindex/Redirect pages: ${noindexPages.length}`);

// 1. Grep banned terms in indexable pages
console.log('\n========================================');
console.log('1. BANNED TERMS AUDIT ON INDEXABLE PAGES');
console.log('========================================');

let totalBannedHits = 0;
for (const term of BANNED_TERMS) {
  let hits = [];
  const regex = new RegExp(`\\b${term}\\b`, 'gi');
  for (const page of indexablePages) {
    // If the term is "software", check if it only appears in Task 7 FAQ question/answer
    if (term === 'software') {
      const sanitized = page.content.replace(/Is eDrops a software or subscription service\?/gi, '')
                                    .replace(/eDrops is a delivery app for purified 20L water jars/gi, '');
      if (regex.test(sanitized)) {
        hits.push(page.relPath);
      }
    } else {
      if (regex.test(page.content)) {
        hits.push(page.relPath);
      }
    }
  }
  if (hits.length > 0) {
    console.log(`[FAIL] Term "${term}": found in ${hits.join(', ')}`);
    totalBannedHits += hits.length;
  } else {
    console.log(`[PASS] Term "${term}": 0 hits${term === 'software' ? ' (excluding mandatory Task 7 FAQ negative clarification)' : ''}`);
  }
}

console.log(`Total banned term violations on indexable pages: ${totalBannedHits}`);

// 2. Titles & Descriptions check
console.log('\n========================================');
console.log('2. TITLES & DESCRIPTIONS VALIDATION');
console.log('========================================');

const titles = new Map();
const descriptions = new Map();
let metaErrors = 0;

for (const page of indexablePages) {
  const titleMatch = page.content.match(/<title>([^<]*)<\/title>/i);
  const descMatch = page.content.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) ||
                    page.content.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
  
  const title = titleMatch ? titleMatch[1] : '';
  const desc = descMatch ? descMatch[1] : '';

  console.log(`\nPage: /${page.relPath.replace('/index.html', '').replace('index.html', '')}`);
  console.log(`  Title (${title.length} chars): "${title}"`);
  console.log(`  Desc  (${desc.length} chars): "${desc}"`);

  if (!title) {
    console.error(`  [ERROR] Missing title in ${page.relPath}`);
    metaErrors++;
  } else if (title.length > 60) {
    console.error(`  [WARN/ERROR] Title exceeds 60 chars (${title.length}): "${title}"`);
    metaErrors++;
  }

  if (!desc) {
    console.error(`  [ERROR] Missing description in ${page.relPath}`);
    metaErrors++;
  } else if (desc.length > 155) {
    console.error(`  [WARN/ERROR] Description exceeds 155 chars (${desc.length}): "${desc}"`);
    metaErrors++;
  }

  // Check for banned words in titles and descriptions: software, platform, SaaS, subscription
  const forbiddenMetaWords = ['software', 'platform', 'saas', 'subscription'];
  for (const word of forbiddenMetaWords) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(title)) {
      console.error(`  [ERROR] Forbidden word "${word}" found in title: "${title}"`);
      metaErrors++;
    }
    if (new RegExp(`\\b${word}\\b`, 'i').test(desc)) {
      console.error(`  [ERROR] Forbidden word "${word}" found in description: "${desc}"`);
      metaErrors++;
    }
  }

  // Check duplicates
  if (titles.has(title)) {
    console.error(`  [ERROR] Duplicate title found: "${title}" also in ${titles.get(title)}`);
    metaErrors++;
  } else {
    titles.set(title, page.relPath);
  }

  if (descriptions.has(desc)) {
    console.error(`  [ERROR] Duplicate description found: "${desc}" also in ${descriptions.get(desc)}`);
    metaErrors++;
  } else {
    descriptions.set(desc, page.relPath);
  }
}

// 3. H1 Count Check
console.log('\n========================================');
console.log('3. H1 HEADING HIERARCHY CHECK');
console.log('========================================');

let h1Errors = 0;
for (const page of indexablePages) {
  const h1Matches = page.content.match(/<h1[\s>]/gi) || [];
  if (h1Matches.length !== 1) {
    console.error(`[FAIL] /${page.relPath}: Found ${h1Matches.length} <h1> tags (expected 1)`);
    h1Errors++;
  } else {
    console.log(`[PASS] /${page.relPath}: Exactly 1 <h1>`);
  }
}

// 4. JSON-LD Validation
console.log('\n========================================');
console.log('4. JSON-LD STRUCTURED DATA VALIDATION');
console.log('========================================');

let jsonLdErrors = 0;
for (const page of indexablePages) {
  const jsonLdRegex = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(page.content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      // Verify no banned terms in schema descriptions or featureList
      // (ignoring the exact Task 7 FAQ question: "Is eDrops a software or subscription service?")
      const str = JSON.stringify(parsed).replace(/"name":"Is eDrops a software or subscription service\?"/gi, '');
      for (const banned of ['software', 'saas', 'platform', 'subscription-management']) {
        if (new RegExp(`\\b${banned}\\b`, 'i').test(str)) {
          console.error(`[FAIL] ${page.relPath} JSON-LD contains "${banned}"`);
          jsonLdErrors++;
        }
      }
    } catch (e) {
      console.error(`[FAIL] Invalid JSON-LD in ${page.relPath}: ${e.message}`);
      jsonLdErrors++;
    }
  }
}
if (jsonLdErrors === 0) {
  console.log('[PASS] All JSON-LD structured data blocks are valid JSON with 0 banned terms (except required Task 7 FAQ question).');
}

// 5. Sitemap Validation
console.log('\n========================================');
console.log('5. SITEMAP VALIDATION');
console.log('========================================');

const sitemapContent = fs.readFileSync(SITEMAP_PATH, 'utf8');
const locMatches = sitemapContent.match(/<loc>(.*?)<\/loc>/g) || [];
console.log(`Total URLs in sitemap: ${locMatches.length}`);

let sitemapErrors = 0;
for (const locTag of locMatches) {
  const url = locTag.replace(/<\/?loc>/g, '');
  if (!url.startsWith('https://www.edrops.in/')) {
    console.error(`[FAIL] Non-canonical or non-www URL in sitemap: ${url}`);
    sitemapErrors++;
  }
  // Check if sitemap URL points to a noindexed page
  const parsedUrl = new URL(url);
  const localPath = path.join(DIST_DIR, parsedUrl.pathname, 'index.html');
  if (fs.existsSync(localPath)) {
    const pageHtml = fs.readFileSync(localPath, 'utf8');
    if (/<meta[^>]*robots[^>]*noindex/i.test(pageHtml)) {
      console.error(`[FAIL] Noindexed page found in sitemap: ${url}`);
      sitemapErrors++;
    }
  } else {
    console.error(`[FAIL] Sitemap URL file not found in dist: ${localPath}`);
    sitemapErrors++;
  }
}
if (sitemapErrors === 0) {
  console.log('[PASS] All sitemap URLs are indexable www URLs.');
}

// 6. Internal Links Check
console.log('\n========================================');
console.log('6. INTERNAL LINKS INTEGRITY CHECK');
console.log('========================================');

let brokenLinks = 0;
for (const file of allHtmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const hrefMatches = [...html.matchAll(/href=["'](\/[^"'#?]*)/g)].map(m => m[1]);
  for (const href of hrefMatches) {
    if (href.startsWith('//')) continue;
    let target = path.join(DIST_DIR, href);
    if (href.endsWith('/') || !path.extname(href)) {
      target = path.join(target, 'index.html');
    }
    const assetTarget = path.join(DIST_DIR, href);
    if (!fs.existsSync(target) && !fs.existsSync(assetTarget)) {
      console.error(`[FAIL] Broken internal link in ${path.relative(DIST_DIR, file)} -> ${href}`);
      brokenLinks++;
    }
  }
}
if (brokenLinks === 0) {
  console.log('[PASS] 0 broken internal links detected across all pages in dist.');
}

// Summary
console.log('\n========================================');
console.log('VERIFICATION SUMMARY');
console.log('========================================');
console.log(`Banned Term Violations: ${totalBannedHits}`);
console.log(`Metadata / Character Limit Errors: ${metaErrors}`);
console.log(`H1 Errors: ${h1Errors}`);
console.log(`JSON-LD Errors: ${jsonLdErrors}`);
console.log(`Sitemap Errors: ${sitemapErrors}`);
console.log(`Broken Internal Links: ${brokenLinks}`);

if (totalBannedHits + metaErrors + h1Errors + jsonLdErrors + sitemapErrors + brokenLinks === 0) {
  console.log('\n🎉 ALL VERIFICATION CRITERIA PASSED WITH ZERO ERRORS!');
} else {
  console.error('\n❌ ISSUES DETECTED. Please review the output above.');
}
