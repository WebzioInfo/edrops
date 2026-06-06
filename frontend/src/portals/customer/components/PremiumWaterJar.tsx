import { useId } from 'react';
import { motion } from 'framer-motion';

export interface PremiumWaterJarProps {
  currentBalance: number;
  maxBalance: number;
}

export default function PremiumWaterJar({ currentBalance, maxBalance }: PremiumWaterJarProps) {
  const uid = useId().replace(/:/g, '');
  const safeMaxBalance = Math.max(maxBalance, 1);
  const fillRatio = Math.max(0.05, Math.min(currentBalance / safeMaxBalance, 1));
  
  // Height of jar body is roughly from y=120 to y=450 (330px height)
  // When fillRatio is 0, y is near 440. When 1, y is near 120.
  const fillY = 440 - (fillRatio * 320);

  // Jar path: Premium 20L Biodrops style
  // Neck starts at 120, shoulders round out to 50, drops down to 450, rounds to bottom
  const jarOutlinePath = "M190 40 L190 70 C190 90 120 100 120 140 L120 420 C120 440 140 450 190 450 L310 450 C360 450 380 440 380 420 L380 140 C380 100 310 90 310 70 L310 40 Z";

  // Water fill path
  // Smooth sine wave top for water
  const waterTop = `M115 ${fillY} Q 250 ${fillY - 20} 385 ${fillY} L380 435 C380 445 360 450 310 450 L190 450 C140 450 120 445 120 435 Z`;
  const waterTopAnimate = `M115 ${fillY} Q 250 ${fillY + 20} 385 ${fillY} L380 435 C380 445 360 450 310 450 L190 450 C140 450 120 445 120 435 Z`;

  return (
    <div className="relative mx-auto flex items-center justify-center w-full max-w-[280px] aspect-[3/4]">
      {/* Soft glowing backdrop */}
      <motion.div
        className="absolute w-3/4 h-3/4 bg-[#1E88E5]/20 rounded-full blur-[60px]"
        animate={{ scale: [1, 1.05, 1], opacity: [0.6, 0.8, 0.6] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <svg viewBox="0 0 500 500" className="relative z-10 w-full h-full drop-shadow-[0_20px_40px_rgba(30,136,229,0.15)]" role="img">
        <defs>
          <clipPath id={`${uid}-jar-clip`}>
            <path d={jarOutlinePath} />
          </clipPath>

          {/* Jar Glass Reflection Gradient */}
          <linearGradient id={`${uid}-glass-gradient`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="15%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="85%" stopColor="#1E88E5" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#1E88E5" stopOpacity="0.3" />
          </linearGradient>

          {/* Water Gradient */}
          <linearGradient id={`${uid}-water-gradient`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#42A5F5" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#1E88E5" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* Shadow base */}
        <ellipse cx="250" cy="460" rx="140" ry="15" fill="#0F172A" opacity="0.05" />

        {/* The Cap */}
        <path d="M185 20 L315 20 C320 20 325 25 325 30 L325 45 C325 50 320 55 315 55 L185 55 C180 55 175 50 175 45 L175 30 C175 25 180 20 185 20 Z" fill="#1E88E5" />
        <rect x="180" y="25" width="140" height="4" fill="#ffffff" opacity="0.3" rx="2" />
        <rect x="180" y="35" width="140" height="4" fill="#ffffff" opacity="0.3" rx="2" />
        <rect x="180" y="45" width="140" height="4" fill="#ffffff" opacity="0.3" rx="2" />

        {/* Water Level inside Jar */}
        <g clipPath={`url(#${uid}-jar-clip)`}>
          <motion.path
            d={waterTop}
            fill={`url(#${uid}-water-gradient)`}
            initial={false}
            animate={{ d: [waterTop, waterTopAnimate, waterTop] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* White bubbles/reflections in water */}
          <motion.circle cx="200" cy={fillY + 50} r="6" fill="#ffffff" opacity="0.4" animate={{ y: [0, -30], opacity: [0, 0.4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeIn', delay: 0.5 }} />
          <motion.circle cx="300" cy={fillY + 120} r="4" fill="#ffffff" opacity="0.3" animate={{ y: [0, -40], opacity: [0, 0.3, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeIn', delay: 1 }} />
          <motion.circle cx="260" cy={fillY + 80} r="8" fill="#ffffff" opacity="0.2" animate={{ y: [0, -20], opacity: [0, 0.2, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeIn' }} />
        </g>

        {/* Jar Glass Body Outline & Reflection */}
        <path d={jarOutlinePath} fill={`url(#${uid}-glass-gradient)`} stroke="#E2E8F0" strokeWidth="3" strokeOpacity="0.8" strokeLinejoin="round" />
        
        {/* Left sharp highlight */}
        <path d="M135 150 C135 250 135 350 145 420" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" opacity="0.6" />
        
        {/* Right subtle curve highlight */}
        <path d="M365 150 C365 250 365 350 355 420" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.3" />

        {/* Jar structural ribs (Horizontal lines on 20L jars) */}
        <path d="M125 180 Q 250 195 375 180" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.4" strokeLinecap="round" />
        <path d="M125 260 Q 250 275 375 260" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.4" strokeLinecap="round" />
        <path d="M125 340 Q 250 355 375 340" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.4" strokeLinecap="round" />

        {/* Big Percentage Text Overlay */}
        <text x="250" y="300" textAnchor="middle" fill="#0F172A" fontSize="72" fontWeight="800" opacity="0.9" style={{ paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 8 }}>
          {currentBalance}
        </text>
        <text x="250" y="340" textAnchor="middle" fill="#1E88E5" fontSize="20" fontWeight="700" opacity="0.9" style={{ paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 4, letterSpacing: '4px' }}>
          JARS LEFT
        </text>
      </svg>
    </div>
  );
}
