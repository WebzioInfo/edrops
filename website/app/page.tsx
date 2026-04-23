import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-100 dark:bg-slate-950 dark:text-slate-100">
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "name": "E-Drops",
            "image": "https://edrops.com/logo.png",
            "description": "Multi-brand water delivery service in Kerala. Order 20L jars, bottles, and more with smart subscriptions.",
            "url": "https://edrops.com",
            "telephone": "+910000000000",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "E-Drops Hub",
              "addressLocality": "Kochi",
              "addressRegion": "Kerala",
              "postalCode": "682001",
              "addressCountry": "IN"
            },
            "geo": {
              "@type": "GeoCoordinates",
              "latitude": 9.9312,
              "longitude": 76.2673
            },
            "areaServed": ["Kochi", "Trivandrum", "Kozhikode", "Thrissur", "Kerala"],
            "openingHoursSpecification": {
              "@type": "OpeningHoursSpecification",
              "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
              "opens": "06:00",
              "closes": "21:00"
            }
          })
        }}
      />

      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-950/80">
        <div className="container mx-auto flex h-20 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
            </div>
            <span className="text-2xl font-bold tracking-tight">E-Drops</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <Link href="#features" className="hover:text-blue-600 transition-colors">Features</Link>
            <Link href="#subscriptions" className="hover:text-blue-600 transition-colors">Subscriptions</Link>
            <Link href="#brands" className="hover:text-blue-600 transition-colors">Brands</Link>
            <Link href="/locations" className="hover:text-blue-600 transition-colors">Locations</Link>
            <Link href="/blog" className="hover:text-blue-600 transition-colors">Blog</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="https://order.edrops.com/login" className="hidden sm:inline-flex text-sm font-semibold text-muted-foreground hover:text-primary transition-colors px-4 py-2">Login</Link>
            <Link href="https://order.edrops.com" className="clay-btn bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground text-sm font-bold shadow-md hover:scale-[1.02] no-underline">
              Order Now
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-24 md:py-32">
          <div className="container mx-auto px-6 relative z-10">
            <div className="max-w-4xl mx-auto text-center space-y-8">
              <div className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50/50 px-3 py-1 text-sm font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-400">
                <span className="mr-2">✨</span> Now Serving Across Kerala
              </div>
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                Premium Water Delivery, <br />
                <span className="text-blue-600">Purely Integrated.</span>
              </h1>
              <p className="max-w-2xl mx-auto text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
                Experience the convenience of high-quality drinking water delivery with E-Drops. Multi-brand jars, subscription plans, and real-time tracking for Kerala.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
                <Link href="https://order.edrops.com" className="clay-btn shadow-lg no-underline">
                  Order on Web
                </Link>
                <Link href="#features" className="clay-btn bg-card text-foreground shadow-sm no-underline">
                  Explore Features
                </Link>
              </div>
            </div>
          </div>
          
          {/* Abstract Background Elements */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-200/20 rounded-full blur-[120px] -z-10" />
          <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-cyan-200/20 rounded-full blur-[100px] -z-10" />
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-white dark:bg-slate-900/50">
          <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-12">
              <div className="clay-card group space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <h3 className="text-2xl font-bold">Multi-Brand Market</h3>
                <p className="text-muted-foreground leading-relaxed text-lg">
                  Order from 20L jars to 500ml bottles from top brands like Bisleri, Aquafina, and more in one place.
                </p>
              </div>
              <div className="clay-card group space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <h3 className="text-2xl font-bold">Smart Subscriptions</h3>
                <p className="text-muted-foreground leading-relaxed text-lg">
                  Automate your water supply. Choose from Daily, Alternate Days, or Weekly plans that fit your lifestyle.
                </p>
              </div>
              <div className="clay-card group space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <h3 className="text-2xl font-bold">Real-time Tracking</h3>
                <p className="text-muted-foreground leading-relaxed text-lg">
                   Order on web and track your delivery partner in real-time as they navigate to your doorstep.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-16 px-6 border-t border-slate-800">
        <div className="container mx-auto grid md:grid-cols-4 gap-12">
          <div className="space-y-4 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 text-white">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
              </div>
              <span className="text-xl font-bold tracking-tight">E-Drops</span>
            </div>
            <p className="text-sm">Kerala&apos;s leading platform for packaged drinking water logistics and ERP.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-xs">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-blue-400">About Us</Link></li>
              <li><Link href="/locations" className="hover:text-blue-400">Our Locations</Link></li>
              <li><Link href="/blog" className="hover:text-blue-400">Blog</Link></li>
              <li><Link href="#" className="hover:text-blue-400">Become a Distributor</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-xs">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="#" className="hover:text-blue-400">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-blue-400">Terms of Service</Link></li>
              <li><Link href="#" className="hover:text-blue-400">Refund Policy</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-xs">Experience Pure Hydration</h4>
            <p className="text-sm mb-4">No app needed. Order directly from your mobile or desktop browser.</p>
            <Link href="https://order.edrops.com" className="h-12 px-6 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-lg hover:bg-blue-700 transition-colors no-underline">
              Start Ordering Now
            </Link>
          </div>
        </div>
        <div className="container mx-auto mt-16 pt-8 border-t border-slate-800 text-center text-xs">
          © {new Date().getFullYear()} E-Drops. All rights reserved. Made in Kerala.
        </div>
      </footer>
    </div>
  );
}
