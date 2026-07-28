import React from 'react';

export default function HeroShowcase() {
  return (
    <div className="relative w-full flex items-center justify-center lg:justify-end">
      {/* Ambient glow behind bottle */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[500px] rounded-full bg-gradient-to-br from-edrops-sky/20 via-edrops-aqua/10 to-transparent blur-3xl opacity-80" />
      </div>

      {/* The premium water bottle - visual hero */}
      <div className="relative z-10">
        <img
          src="/hero-bottle.png"
          alt="Premium 20L crystal clear water jar — the core of the Edrops delivery platform"
          className="w-[320px] sm:w-[380px] lg:w-[440px] xl:w-[480px] h-auto drop-shadow-2xl animate-float-slow select-none pointer-events-none"
          style={{
            filter: 'drop-shadow(0 30px 60px rgba(45, 121, 168, 0.18)) drop-shadow(0 10px 20px rgba(15, 43, 53, 0.08))',
          }}
          loading="eager"
          decoding="async"
        />
      </div>

      {/* Floating Glass Card 1 — Top Right */}
      <div
        className="absolute top-6 right-0 xl:right-[-20px] z-20 animate-float-slow"
        style={{ animationDelay: '0s' }}
      >
        <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-3 shadow-lg">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-bold text-edrops-ocean leading-tight">24 Deliveries Today</p>
            <p className="text-[11px] text-edrops-slate mt-0.5">All routes on schedule</p>
          </div>
        </div>
      </div>

      {/* Floating Glass Card 2 — Bottom Left */}
      <div
        className="absolute bottom-12 left-0 xl:left-[-30px] z-20 animate-float-delayed"
      >
        <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-3 shadow-lg">
          <div className="w-9 h-9 rounded-xl bg-edrops-primary/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-edrops-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h4l3 8l4-16l3 8h4" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-bold text-edrops-ocean leading-tight">100% Prepaid</p>
            <p className="text-[11px] text-edrops-slate mt-0.5">Zero outstanding invoices</p>
          </div>
        </div>
      </div>

      {/* Floating Glass Card 3 — Mid Right, lower */}
      <div
        className="absolute bottom-32 right-[-10px] xl:right-[-40px] z-20 hidden sm:block"
        style={{ animation: 'float 8s ease-in-out 2s infinite' }}
      >
        <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-3 shadow-lg">
          <div className="w-9 h-9 rounded-xl bg-edrops-secondary/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-edrops-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-bold text-edrops-ocean leading-tight">Wallet Active</p>
            <p className="text-[11px] text-edrops-slate mt-0.5">₹2,400 balance remaining</p>
          </div>
        </div>
      </div>
    </div>
  );
}
