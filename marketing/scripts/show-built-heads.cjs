const fs = require('fs');
const path = require('path');

const targets = [
  { name: 'Homepage (/)', file: 'dist/index.html' },
  { name: 'How It Works (/how-it-works/)', file: 'dist/how-it-works/index.html' },
  { name: 'Bulk Orders (/bulk-orders/)', file: 'dist/bulk-orders/index.html' },
  { name: 'FAQ (/faq/)', file: 'dist/faq/index.html' },
  { name: 'About (/about/)', file: 'dist/about/index.html' },
  { name: 'Blog Post (/blog/how-to-order-water-jars-online/)', file: 'dist/blog/how-to-order-water-jars-online/index.html' }
];

for (const t of targets) {
  console.log('================================================================');
  console.log(`BUILT <head> AUDIT FOR: ${t.name}`);
  console.log('================================================================');
  const fullPath = path.resolve(__dirname, '..', t.file);
  const html = fs.readFileSync(fullPath, 'utf8');
  
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || 'None';
  const desc = (html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) || [])[1] || 'None';
  const canonical = (html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i) || [])[1] || 'None';
  const robots = (html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i) || [])[1] || 'None';
  const ogTitle = (html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i) || [])[1] || 'None';
  const ogDesc = (html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) || [])[1] || 'None';
  const twTitle = (html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']*)["']/i) || [])[1] || 'None';
  const twDesc = (html.match(/<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']*)["']/i) || [])[1] || 'None';

  console.log(`Title: ${title}`);
  console.log(`Description: ${desc}`);
  console.log(`Canonical: ${canonical}`);
  console.log(`Robots: ${robots}`);
  console.log(`OG Title: ${ogTitle}`);
  console.log(`OG Description: ${ogDesc}`);
  console.log(`Twitter Title: ${twTitle}`);
  console.log(`Twitter Description: ${twDesc}`);

  console.log('\nJSON-LD Schemas:');
  const ldMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  ldMatches.forEach((m, idx) => {
    try {
      const obj = JSON.parse(m[1]);
      console.log(`\n  Schema [${idx + 1}]: @type="${obj['@type']}" id="${obj['@id'] || 'N/A'}"`);
      if (obj.description) {
        console.log(`    Description: "${obj.description}"`);
      }
      if (obj.disambiguatingDescription) {
        console.log(`    DisambiguatingDescription: "${obj.disambiguatingDescription}"`);
      }
      if (obj.itemListElement && obj['@type'] === 'BreadcrumbList') {
        console.log(`    Breadcrumbs (${obj.itemListElement.length}): ${obj.itemListElement.map(b => `${b.position}. ${b.name} (${b.item})`).join(' -> ')}`);
      }
      if (obj.featureList) {
        console.log(`    Features (${obj.featureList.length}):`);
        obj.featureList.forEach(f => console.log(`      - ${f}`));
      }
      if (obj['@type'] === 'FAQPage' && obj.mainEntity) {
        console.log(`    FAQ Items (${obj.mainEntity.length}):`);
        obj.mainEntity.forEach(q => console.log(`      Q: ${q.name}`));
      }
    } catch (e) {
      console.log(`  Schema [${idx + 1}]: Parse error`);
    }
  });
  console.log('\n');
}

console.log('================================================================');
console.log('BUILT HEADER NAV HTML AUDIT');
console.log('================================================================');
const navPages = [
  { name: 'Homepage Nav (dist/index.html)', file: 'dist/index.html' },
  { name: 'Sub-page Nav (dist/how-it-works/index.html)', file: 'dist/how-it-works/index.html' }
];

for (const np of navPages) {
  const fullPath = path.resolve(__dirname, '..', np.file);
  const html = fs.readFileSync(fullPath, 'utf8');
  const navMatch = html.match(/<header id="nav-island"[\s\S]*?<\/header>/i);
  console.log(`\n--- ${np.name} ---`);
  if (navMatch) {
    console.log(navMatch[0].trim());
  } else {
    console.log('[ERROR] <header id="nav-island"> not found!');
  }
}
