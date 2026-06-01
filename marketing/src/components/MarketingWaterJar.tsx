import { useId, useRef } from 'react';
import type { MouseEvent } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

type MarketingWaterJarProps = {
  balance?: number;
  total?: number;
};

const jarPath =
  'M190 82 C190 58 208 42 232 42 H268 C292 42 310 58 310 82 V111 C310 125 318 139 331 152 C369 190 388 251 378 329 C367 415 333 476 250 476 C167 476 133 415 122 329 C112 251 131 190 169 152 C182 139 190 125 190 111 Z';

export default function MarketingWaterJar({ balance = 30, total = 30 }: MarketingWaterJarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, '');
  const ratio = Math.max(0.04, Math.min(balance / Math.max(total, 1), 1));
  const fillY = 466 - ratio * 326;
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 100, damping: 24 });
  const smoothY = useSpring(mouseY, { stiffness: 100, damping: 24 });
  const rotateX = useTransform(smoothY, [-260, 260], [6, -6]);
  const rotateY = useTransform(smoothX, [-260, 260], [-7, 7]);
  const highlightX = useTransform(smoothX, [-260, 260], [118, 244]);
  const highlightY = useTransform(smoothY, [-260, 260], [108, 232]);

  const onMove = (event: MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set(event.clientX - (rect.left + rect.width / 2));
    mouseY.set(event.clientY - (rect.top + rect.height / 2));
  };

  const waterTop =
    `M105 ${fillY} C154 ${fillY - 16} 197 ${fillY + 18} 250 ${fillY} ` +
    `C302 ${fillY - 18} 344 ${fillY + 14} 395 ${fillY} V520 H105 Z`;

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={() => { mouseX.set(0); mouseY.set(0); }} className="relative mx-auto h-[32rem] w-full max-w-[28rem] perspective-[1200px]">
      <div className="absolute inset-10 rounded-full bg-edrops-aqua/25 blur-[90px]" />
      <motion.svg viewBox="0 0 500 540" className="relative z-10 h-full w-full drop-shadow-[0_34px_62px_rgba(36,83,97,0.24)]" style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}>
        <defs>
          <clipPath id={`${uid}-clip`}><path d={jarPath} /></clipPath>
          <linearGradient id={`${uid}-glass`} x1="120" x2="382" y1="70" y2="490" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" stopOpacity="0.72" />
            <stop offset="0.35" stopColor="#BBDFF2" stopOpacity="0.22" />
            <stop offset="1" stopColor="#245361" stopOpacity="0.12" />
          </linearGradient>
          <linearGradient id={`${uid}-water`} x1="164" x2="345" y1={fillY} y2="486" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7EBFE4" stopOpacity="0.78" />
            <stop offset="0.55" stopColor="#33BFD0" stopOpacity="0.88" />
            <stop offset="1" stopColor="#2D79A8" stopOpacity="0.92" />
          </linearGradient>
          <radialGradient id={`${uid}-shine`} cx="50%" cy="50%" r="60%">
            <stop stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="0.48" stopColor="#FFFFFF" stopOpacity="0.18" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="250" cy="497" rx="108" ry="18" fill="#245361" opacity="0.16" />
        <path d="M202 38 H298 V78 H202 Z" fill="#BBDFF2" opacity="0.48" />
        <rect x="184" y="14" width="132" height="34" rx="13" fill="#245361" />
        <rect x="190" y="19" width="120" height="24" rx="10" fill="#2D79A8" />
        {[0, 1, 2, 3, 4, 5].map((line) => (
          <path key={line} d={`M${202 + line * 17} 20 V42`} stroke="#BBDFF2" strokeOpacity="0.42" strokeWidth="3" strokeLinecap="round" />
        ))}
        <path d={jarPath} fill={`url(#${uid}-glass)`} stroke="#BBDFF2" strokeWidth="7" strokeLinejoin="round" />
        <g clipPath={`url(#${uid}-clip)`}>
          <motion.path d={waterTop} fill={`url(#${uid}-water)`} initial={false} animate={{ d: waterTop }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
          <motion.path d={`M95 ${fillY + 4} C154 ${fillY + 20} 201 ${fillY - 12} 251 ${fillY + 5} C307 ${fillY + 24} 353 ${fillY - 10} 407 ${fillY + 5}`} fill="none" stroke="#FFFFFF" strokeOpacity="0.38" strokeWidth="7" strokeLinecap="round" animate={{ x: [-22, 18, -22] }} transition={{ duration: 5.6, repeat: Infinity, ease: 'easeInOut' }} />
        </g>
        <path d={jarPath} fill="none" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="2" />
        <path d="M154 190 C138 250 144 358 185 428" fill="none" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="12" strokeLinecap="round" />
        <motion.circle cx={highlightX} cy={highlightY} r="112" fill={`url(#${uid}-shine)`} opacity="0.42" />
        <rect x="171" y="246" width="158" height="96" rx="18" fill="#245361" opacity="0.92" />
        <text x="250" y="294" textAnchor="middle" fill="#F69C14" fontSize="32" fontWeight="900" letterSpacing="-1">Edrops</text>
        <text x="250" y="316" textAnchor="middle" fill="#BBDFF2" fontSize="10" fontWeight="800" letterSpacing="3">20L SMART WATER</text>
      </motion.svg>
    </div>
  );
}
