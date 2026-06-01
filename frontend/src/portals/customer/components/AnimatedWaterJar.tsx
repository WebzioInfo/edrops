import { useId, useRef } from 'react';
import type { MouseEvent } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export interface AnimatedWaterJarProps {
  currentBalance: number;
  maxBalance: number;
  status?: 'ACTIVE' | 'PAUSED' | 'LOW_BALANCE';
  interactive?: boolean;
  compact?: boolean;
}

const jarPath =
  'M190 82 C190 58 208 42 232 42 H268 C292 42 310 58 310 82 V111 C310 125 318 139 331 152 C369 190 388 251 378 329 C367 415 333 476 250 476 C167 476 133 415 122 329 C112 251 131 190 169 152 C182 139 190 125 190 111 Z';

export default function AnimatedWaterJar({
  currentBalance,
  maxBalance,
  status = 'ACTIVE',
  interactive = true,
  compact = false,
}: AnimatedWaterJarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, '');
  const safeMaxBalance = Math.max(maxBalance, 1);
  const fillRatio = Math.max(0.03, Math.min(currentBalance / safeMaxBalance, 1));
  const fillY = 466 - fillRatio * 326;
  const isPaused = status === 'PAUSED';
  const isLowBalance = status === 'LOW_BALANCE' || fillRatio <= 0.2;

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 110, damping: 22, mass: 0.4 });
  const smoothY = useSpring(mouseY, { stiffness: 110, damping: 22, mass: 0.4 });
  const rotateX = useTransform(smoothY, [-260, 260], [7, -7]);
  const rotateY = useTransform(smoothX, [-260, 260], [-8, 8]);
  const highlightX = useTransform(smoothX, [-260, 260], [120, 245]);
  const highlightY = useTransform(smoothY, [-260, 260], [110, 230]);

  const handleMouseMove = (event: MouseEvent) => {
    if (!interactive || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseX.set(event.clientX - (rect.left + rect.width / 2));
    mouseY.set(event.clientY - (rect.top + rect.height / 2));
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const waterTop =
    `M105 ${fillY} C154 ${fillY - 16} 197 ${fillY + 18} 250 ${fillY} ` +
    `C302 ${fillY - 18} 344 ${fillY + 14} 395 ${fillY} V520 H105 Z`;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative mx-auto flex touch-pan-y items-center justify-center ${compact ? 'h-[26rem] w-full' : 'h-[34rem] w-full'} perspective-[1200px]`}
      aria-label={`${currentBalance} jars remaining from ${maxBalance}`}
    >
      <motion.div
        className="absolute h-[72%] w-[72%] rounded-full blur-[90px]"
        style={{
          background: isLowBalance ? 'rgba(246, 156, 20, 0.28)' : 'rgba(51, 191, 208, 0.28)',
          opacity: isPaused ? 0.38 : 0.82,
        }}
        animate={{ scale: isLowBalance ? [0.95, 1.04, 0.95] : [1, 1.03, 1] }}
        transition={{ duration: isLowBalance ? 2.2 : 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.svg
        viewBox="0 0 500 540"
        className="relative z-10 h-full max-h-[34rem] w-full max-w-[28rem] drop-shadow-[0_34px_62px_rgba(36,83,97,0.24)]"
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        role="img"
      >
        <defs>
          <clipPath id={`${uid}-jar-clip`}>
            <path d={jarPath} />
          </clipPath>

          <linearGradient id={`${uid}-glass`} x1="120" x2="382" y1="70" y2="490" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" stopOpacity="0.7" />
            <stop offset="0.32" stopColor="#BBDFF2" stopOpacity="0.22" />
            <stop offset="0.72" stopColor="#7EBFE4" stopOpacity="0.18" />
            <stop offset="1" stopColor="#245361" stopOpacity="0.12" />
          </linearGradient>

          <linearGradient id={`${uid}-water`} x1="164" x2="345" y1={fillY} y2="486" gradientUnits="userSpaceOnUse">
            <stop stopColor={isLowBalance ? '#F69C14' : '#7EBFE4'} stopOpacity="0.78" />
            <stop offset="0.55" stopColor={isLowBalance ? '#F69C14' : '#33BFD0'} stopOpacity="0.88" />
            <stop offset="1" stopColor="#2D79A8" stopOpacity="0.92" />
          </linearGradient>

          <radialGradient id={`${uid}-shine`} cx="50%" cy="50%" r="60%">
            <stop stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.18" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>

          <filter id={`${uid}-soft-shadow`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#245361" floodOpacity="0.22" />
          </filter>
        </defs>

        <ellipse cx="250" cy="497" rx="108" ry="18" fill="#245361" opacity="0.16" />

        <g filter={`url(#${uid}-soft-shadow)`}>
          <path d="M202 38 H298 V78 H202 Z" fill="#BBDFF2" opacity="0.48" />
          <path d="M199 48 H301" stroke="#245361" strokeOpacity="0.28" strokeWidth="5" strokeLinecap="round" />
          <path d="M198 61 H302" stroke="#FFFFFF" strokeOpacity="0.72" strokeWidth="3" strokeLinecap="round" />
          <path d="M203 75 H297" stroke="#245361" strokeOpacity="0.22" strokeWidth="4" strokeLinecap="round" />

          <g>
            <rect x="184" y="14" width="132" height="34" rx="13" fill="#245361" />
            <rect x="190" y="19" width="120" height="24" rx="10" fill="#2D79A8" />
            {[0, 1, 2, 3, 4, 5].map((line) => (
              <path
                key={line}
                d={`M${202 + line * 17} 20 V42`}
                stroke="#BBDFF2"
                strokeOpacity="0.42"
                strokeWidth="3"
                strokeLinecap="round"
              />
            ))}
            <path d="M204 27 H296" stroke="#FFFFFF" strokeOpacity="0.32" strokeWidth="2" strokeLinecap="round" />
          </g>

          <path d={jarPath} fill={`url(#${uid}-glass)`} stroke="#BBDFF2" strokeWidth="7" strokeLinejoin="round" />

          <g clipPath={`url(#${uid}-jar-clip)`}>
            <motion.path
              d={waterTop}
              fill={`url(#${uid}-water)`}
              initial={false}
              animate={{ d: waterTop }}
              transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.path
              d={`M95 ${fillY + 4} C154 ${fillY + 20} 201 ${fillY - 12} 251 ${fillY + 5} C307 ${fillY + 24} 353 ${fillY - 10} 407 ${fillY + 5}`}
              fill="none"
              stroke="#FFFFFF"
              strokeOpacity="0.38"
              strokeWidth="7"
              strokeLinecap="round"
              animate={{ x: [-22, 18, -22] }}
              transition={{ duration: 5.6, repeat: Infinity, ease: 'easeInOut' }}
            />

            {[170, 224, 278, 332].map((y, index) => (
              <path
                key={y}
                d={`M120 ${y} C168 ${y + 12} 216 ${y - 10} 250 ${y} C292 ${y + 12} 330 ${y - 8} 380 ${y}`}
                fill="none"
                stroke="#FFFFFF"
                strokeOpacity={0.2 - index * 0.025}
                strokeWidth="7"
              />
            ))}
          </g>

          <path d={jarPath} fill="none" stroke="#FFFFFF" strokeOpacity="0.44" strokeWidth="2" />
          <path d="M154 190 C138 250 144 358 185 428" fill="none" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="12" strokeLinecap="round" />
          <path d="M338 176 C374 250 363 379 315 438" fill="none" stroke="#245361" strokeOpacity="0.11" strokeWidth="18" strokeLinecap="round" />

          <motion.circle cx={highlightX} cy={highlightY} r="112" fill={`url(#${uid}-shine)`} opacity="0.42" />

          <g>
            <rect x="171" y="246" width="158" height="96" rx="18" fill="#245361" opacity="0.9" />
            <rect x="181" y="256" width="138" height="76" rx="13" fill="#FFFFFF" opacity="0.08" />
            <text x="250" y="294" textAnchor="middle" fill="#F69C14" fontSize="32" fontWeight="900" letterSpacing="-1">
              Edrops
            </text>
            <text x="250" y="316" textAnchor="middle" fill="#BBDFF2" fontSize="10" fontWeight="800" letterSpacing="3">
              20L SMART WATER
            </text>
          </g>

          <motion.text
            x="250"
            y="407"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="72"
            fontWeight="900"
            opacity="0.9"
            style={{ paintOrder: 'stroke', stroke: 'rgba(36,83,97,0.2)', strokeWidth: 4 }}
            initial={false}
            animate={{ scale: isLowBalance ? [1, 1.04, 1] : 1 }}
            transition={{ duration: 2, repeat: isLowBalance ? Infinity : 0 }}
          >
            {currentBalance}
          </motion.text>
        </g>
      </motion.svg>
    </div>
  );
}
