import Link from 'next/link';

const CITIES = [
  { name: 'Kochi', slug: 'kochi', image: '/cities/kochi.jpg', areas: 'Ernakulam, Kakkanad, Aluva' },
  { name: 'Trivandrum', slug: 'trivandrum', image: '/cities/trivandrum.jpg', areas: 'Kazhakkoottam, Pattom, East Fort' },
  { name: 'Kozhikode', slug: 'kozikode', image: '/cities/kozikode.jpg', areas: 'Beach Road, Calicut City, Feroke' },
  { name: 'Thrissur', slug: 'thrissur', image: '/cities/thrissur.jpg', areas: 'Round, Guruvayur, Kodungallur' },
  { name: 'Kottayam', slug: 'kottayam', image: '/cities/kottayam.jpg', areas: 'Town, Kumarakom, Pala' },
];

export default function LocationsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="py-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Our Service Locations</h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Providing premium water delivery across major cities and towns in Kerala.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {CITIES.map((city) => (
            <Link 
              key={city.slug} 
              href={`/locations/${city.slug}`}
              className="group clay-card bg-white dark:bg-slate-900 overflow-hidden no-underline hover:-translate-y-1 transition-transform"
            >
              <div className="aspect-video relative bg-slate-200 dark:bg-slate-800 rounded-xl mb-4 overflow-hidden">
                {/* Fallback pattern if image missing */}
                <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
                  <svg width="100%" height="100%">
                    <pattern id="pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                      <circle cx="20" cy="20" r="1" fill="currentColor" />
                    </pattern>
                    <rect width="100%" height="100%" fill="url(#pattern)" />
                  </svg>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-slate-400 group-hover:text-blue-500 transition-colors uppercase tracking-widest">{city.name}</span>
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2 group-hover:text-blue-600 transition-colors">{city.name}</h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                Serviceable areas: {city.areas}
              </p>
              <div className="text-blue-600 font-bold text-sm flex items-center gap-1">
                View service details 
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <footer className="py-20 text-center container mx-auto px-6 border-t border-slate-200 dark:border-slate-800">
        <h2 className="text-3xl font-bold mb-4">Don&apos;t see your city?</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-lg mx-auto">
          We are rapidly expanding. Let us know where you need E-Drops next and we&apos;ll notify you when we launch.
        </p>
        <button className="clay-btn bg-white text-slate-900 shadow-sm border border-slate-200">
           Request a Location
        </button>
      </footer>
    </div>
  );
}
