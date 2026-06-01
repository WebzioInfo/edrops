const fs = require('fs');
const path = require('path');

const pages = [
  'features', 'pricing', 'about', 'how-it-works', 'contact', 'faq', 'industries',
  'industries/water-plants', 'industries/water-agencies', 'industries/water-distributors',
  'industries/subscription-businesses', 'locations', 'docs', 'knowledge-base'
];

const template = (title) => `---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout
  title="${title} | Edrops"
  description="Learn more about ${title} with Edrops."
>
  <nav class="fixed inset-x-0 top-0 z-50 border-b border-white/60 bg-white/72 backdrop-blur-2xl">
    <div class="mx-auto flex h-20 max-w-7xl items-center justify-between px-5">
      <a href="/" class="flex items-center gap-3">
        <span class="flex h-11 w-11 items-center justify-center rounded-2xl water-gradient text-white shadow-lg shadow-edrops-aqua/20">E</span>
        <span class="text-xl font-black tracking-tight text-edrops-ocean">Edrops</span>
      </a>
      <div class="hidden items-center gap-8 text-sm font-black text-edrops-ocean/62 md:flex">
        <a href="/features">Features</a>
        <a href="/pricing">Pricing</a>
        <a href="/industries">Industries</a>
        <a href="/blog">Blog</a>
      </div>
      <a href="http://localhost:5173/login" class="rounded-full sun-gradient px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-300/40">Open app</a>
    </div>
  </nav>

  <main class="pt-32 pb-20 px-5 max-w-7xl mx-auto min-h-screen">
    <h1 class="text-5xl font-black text-edrops-ocean capitalize">${title.replace(/-/g, ' ')}</h1>
    <p class="mt-6 text-lg text-edrops-ocean/68 max-w-2xl">
      This is the highly optimized SEO landing page for ${title.replace(/-/g, ' ')}. Edrops provides the ultimate water jar subscription management platform.
    </p>
  </main>
</BaseLayout>
`;

pages.forEach(page => {
  const isNested = page.includes('/');
  let dir = path.join(__dirname, 'src/pages');
  let filename = page + '.astro';
  
  if (isNested) {
    const parts = page.split('/');
    dir = path.join(__dirname, 'src/pages', parts[0]);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    filename = parts[1] + '.astro';
  }

  const filepath = path.join(dir, isNested ? parts[1] + '.astro' : filename);
  const title = isNested ? page.split('/')[1] : page;
  
  fs.writeFileSync(filepath, template(title));
  console.log('Generated:', filepath);
});
