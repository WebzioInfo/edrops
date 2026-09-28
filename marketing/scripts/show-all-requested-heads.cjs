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
  console.log('----------------------------------------------------------------');
  console.log(`HEAD AUDIT: ${t.name}`);
  console.log('----------------------------------------------------------------');
  const fullPath = path.resolve(__dirname, '..', t.file);
  const html = fs.readFileSync(fullPath, 'utf8');
  
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || 'None';
  const desc = (html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) || [])[1] || 'None';
  const canonical = (html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i) || [])[1] || 'None';
  const robots = (html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i) || [])[1] || 'None';

  console.log(`Title: ${title}`);
  console.log(`Description: ${desc}`);
  console.log(`Canonical: ${canonical}`);
  console.log(`Robots: ${robots}`);

  console.log('JSON-LD Schemas:');
  const ldMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  ldMatches.forEach((m, idx) => {
    try {
      const obj = JSON.parse(m[1]);
      let extra = '';
      if (obj['@type'] === 'BreadcrumbList' && obj.itemListElement) {
        extra = ` -> Items: ${obj.itemListElement.map(b => b.name).join(' > ')}`;
      } else if (obj['@type'] === 'FAQPage' && obj.mainEntity) {
        extra = ` -> ${obj.mainEntity.length} Questions (First: "${obj.mainEntity[0].name}")`;
      } else if (obj['@type'] === 'WebApplication' && obj.featureList) {
        extra = ` -> Features: ${obj.featureList.slice(0, 2).join('; ')}...`;
      }
      console.log(`  [${idx + 1}] @type="${obj['@type']}" id="${obj['@id'] || 'N/A'}"${extra}`);
    } catch (e) {
      console.log(`  [${idx + 1}] Parse error`);
    }
  });
  console.log('');
}
