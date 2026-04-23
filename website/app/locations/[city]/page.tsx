import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const CITY_DATA: { [key: string]: any } = {
  kochi: {
    name: 'Kochi',
    title: 'Pure Water Delivery in Kochi | E-Drops',
    description: 'Get premium multi-brand water delivered to your doorstep in Kochi. 20L jars, subscriptions, and express delivery.',
    areas: ['Kakkanad', 'Aluva', 'Edappally', 'Vyttila', 'Kalamassery', 'Fort Kochi'],
    vendors: 15,
  },
  trivandrum: {
    name: 'Trivandrum',
    title: 'Seamless Drinking Water Delivery in Trivandrum | E-Drops',
    description: 'Order Bisleri, Aquafina and local premium brands in Trivandrum. Fast delivery and flexible subscription plans.',
    areas: ['Kazhakkoottam', 'Pattom', 'East Fort', 'Vazhuthacaud', 'Medical College'],
    vendors: 12,
  },
  kozikode: {
    name: 'Kozhikode',
    title: 'Reliable Water Delivery Services in Kozhikode | E-Drops',
    description: 'Fresh and pure drinking water at your convenience in Calicut. Subscribe for hassle-free daily delivery.',
    areas: ['Beach Road', 'Mavoor Road', 'Feroke', 'Pantheeramkavu', 'Chevayur'],
    vendors: 8,
  },
};

export async function generateStaticParams() {
  return [
    { city: 'kochi' },
    { city: 'trivandrum' },
    { city: 'kozikode' },
  ];
}

export async function generateMetadata({ params }: { params: { city: string } }): Promise<Metadata> {
  const city = CITY_DATA[params.city];
  if (!city) return {};
  return {
    title: city.title,
    description: city.description,
  };
}

export default function CityPage({ params }: { params: { city: string } }) {
  const city = CITY_DATA[params.city];
  if (!city) notFound();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* City Hero */}
      <section className="py-24 bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-slate-950">
        <div className="container mx-auto px-6">
          <Link href="/locations" className="text-blue-600 font-bold mb-8 inline-flex items-center gap-2 text-sm no-underline hover:underline">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back to Locations
          </Link>
          <div className="max-w-3xl mt-6">
            <h1 className="text-5xl md:text-6xl font-extrabold mb-6 tracking-tight">
              E-Drops <span className="text-blue-600">{city.name}</span>
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
              Reliable, premium, and multi-brand water delivery service across {city.name}. Managed by {city.vendors}+ local distribution hubs.
            </p>
            <div className="flex gap-4">
              <Link href="https://order.edrops.com" className="clay-btn bg-primary text-primary-foreground shadow-lg no-underline font-bold">
                Order in {city.name}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Areas Served */}
      <section className="py-20 border-t border-slate-100 dark:border-slate-800">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold mb-12">Serviceable Areas in {city.name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {city.areas.map((area: string) => (
              <div key={area} className="clay-card py-6 px-8 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="font-semibold text-lg">{area}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Local SEO Text */}
      <section className="py-20 bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl space-y-8">
            <h2 className="text-3xl font-bold">Why choose E-Drops in {city.name}?</h2>
            <div className="grid md:grid-cols-2 gap-10">
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-blue-600">Pure & Certified</h3>
                <p className="text-slate-600 dark:text-slate-400">
                  We only partner with ISI certified and FSSAI approved water plants in {city.name}. Every jar you receive is guaranteed pure.
                </p>
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-blue-600">Smart Logistics</h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Our route-based delivery system in {city.name} ensures that your water arrives on time, every time, even during peak hours.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 text-center">
        <div className="container mx-auto px-6">
          <div className="clay-card bg-blue-600 text-white p-12 md:p-20 max-w-5xl mx-auto overflow-hidden relative">
            <div className="relative z-10 space-y-8">
              <h2 className="text-4xl md:text-5xl font-extrabold">Ready to quench your thirst?</h2>
              <p className="text-xl text-blue-100 max-w-2xl mx-auto">
                Join thousands of happy customers in {city.name} and experience the E-Drops difference today.
              </p>
              <Link href="https://order.edrops.com" className="clay-btn bg-white text-blue-600 shadow-xl no-underline inline-flex h-14 px-10 items-center font-bold text-lg">
                Start My Order Now
              </Link>
            </div>
            {/* Background pattern */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          </div>
        </div>
      </section>
    </div>
  );
}
