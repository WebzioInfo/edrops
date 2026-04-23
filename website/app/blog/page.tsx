import Link from 'next/link';

const POSTS = [
  {
    slug: 'benefits-of-purified-water',
    title: '5 Benefits of Drinking Purified Packaged Water',
    excerpt: 'Discover why switching to certified packaged drinking water can improve your health and lifestyle.',
    date: 'April 12, 2026',
    image: '/blog/water-benefits.jpg',
  },
  {
    slug: 'understanding-tds-levels',
    title: 'Understanding TDS Levels in Your Drinking Water',
    excerpt: 'What is TDS and how does it affect the quality and taste of the water you drink every day?',
    date: 'April 10, 2026',
    image: '/blog/tds-levels.jpg',
  },
  {
    slug: 'sustainable-water-habits',
    title: 'Sustainable Water Habits for a Greener Kerala',
    excerpt: 'How E-Drops is helping reduce plastic waste through jar recycling and efficient logistics.',
    date: 'April 05, 2026',
    image: '/blog/sustainability.jpg',
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="py-24 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">The Hydration Blog</h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Insights, health tips, and news from the world of pure water.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
          {POSTS.map((post) => (
            <Link 
              key={post.slug} 
              href={`/blog/${post.slug}`}
              className="group flex flex-col no-underline"
            >
              <div className="aspect-[16/9] relative bg-slate-200 dark:bg-slate-800 rounded-3xl mb-6 overflow-hidden clay-card p-0 border-none shadow-md group-hover:shadow-xl transition-all">
                 <div className="absolute inset-0 bg-blue-600/5 group-hover:bg-blue-600/0 transition-colors" />
                 <div className="absolute inset-0 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors font-bold tracking-tighter text-4xl opacity-10">
                   E-DROPS
                 </div>
              </div>
              <div className="space-y-3">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{post.date}</span>
                <h2 className="text-2xl font-bold group-hover:text-blue-600 transition-colors leading-tight">
                  {post.title}
                </h2>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                  {post.excerpt}
                </p>
                <div className="pt-2 text-sm font-bold flex items-center gap-2">
                  Read Article
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <section className="py-24 bg-blue-600 text-white text-center">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold mb-4">Subscribe to our Newsletter</h2>
          <p className="text-blue-100 mb-8 max-w-lg mx-auto">
            Stay updated with the latest health tips and exclusive offers from E-Drops.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input 
              type="email" 
              placeholder="Enter your email" 
              className="flex-1 px-6 py-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder:text-blue-200 focus:outline-none focus:ring-2 focus:ring-white"
            />
            <button className="clay-btn bg-white text-blue-600 h-14 px-8 font-bold">
              Join Now
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
