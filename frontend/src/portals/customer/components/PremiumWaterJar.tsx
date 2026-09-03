'use client';

import { useId } from 'react';
import { motion } from 'framer-motion';

export interface PremiumWaterJarProps {
  currentBalance: number;
  maxBalance: number;
}

export default function PremiumWaterJar({
  currentBalance,
  maxBalance,
}: PremiumWaterJarProps) {
  const uid = useId().replace(/:/g, '');

  const safeMaxBalance = Math.max(maxBalance || 1, 1);

  const fillRatio = Math.max(
    0,
    Math.min((currentBalance || 0) / safeMaxBalance, 1),
  );

  /*
   * REAL JAR BODY WATER AREA
   *
   * Jar body:
   * Top liquid area:    y = 205
   * Bottom liquid area: y = 458
   */
  const WATER_TOP = 205;
  const WATER_BOTTOM = 458;

  const waterY =
    WATER_BOTTOM - (WATER_BOTTOM - WATER_TOP) * fillRatio;

  /*
   * Main water shape.
   * It extends outside slightly and is clipped by the real jar body.
   */
  const waterPath1 = `
    M 92 ${waterY}
    C 125 ${waterY - 5},
      165 ${waterY + 6},
      220 ${waterY}
    C 270 ${waterY - 7},
      330 ${waterY + 6},
      408 ${waterY}
    L 408 470
    L 92 470
    Z
  `;

  const waterPath2 = `
    M 92 ${waterY}
    C 135 ${waterY + 7},
      175 ${waterY - 6},
      220 ${waterY}
    C 275 ${waterY + 7},
      335 ${waterY - 6},
      408 ${waterY}
    L 408 470
    L 92 470
    Z
  `;

  /*
   * Biodrops-style 20L PET jar body.
   *
   * Shape characteristics:
   * - short narrow neck
   * - broad rounded shoulder
   * - cylindrical body
   * - inward grip ribs
   * - wide heavy rounded base
   */
  const jarBodyPath = `
    M 183 118

    C 183 140 178 151 158 158
    C 133 167 112 178 105 195

    C 98 208 96 220 96 238

    L 96 424

    C 96 442 101 456 114 466
    C 129 480 153 486 181 488

    L 319 488

    C 347 486 371 480 386 466
    C 399 456 404 442 404 424

    L 404 238

    C 404 220 402 208 395 195
    C 388 178 367 167 342 158
    C 322 151 317 140 317 118

    Z
  `;

  /*
   * Outer body edge used for glass shading.
   */
  const leftSidePath = `
    M 105 198
    C 98 225 99 275 101 325
    L 101 423
    C 101 450 113 466 143 477
  `;

  const rightSidePath = `
    M 395 198
    C 402 225 401 275 399 325
    L 399 423
    C 399 450 387 466 357 477
  `;

  return (
    <div className="relative mx-auto flex w-full max-w-[320px] items-center justify-center">
      <motion.div
        className="
          absolute bottom-[4%]
          left-1/2
          h-[8%]
          w-[65%]
          -translate-x-1/2
          rounded-full
          bg-cyan-500/20
          blur-2xl
        "
        animate={{
          scale: [0.95, 1.05, 0.95],
          opacity: [0.3, 0.55, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <svg
        viewBox="0 0 500 520"
        className="relative z-10 h-auto w-full overflow-visible"
        role="img"
        aria-label={`${currentBalance} jars available`}
      >
        <defs>
          {/* =========================
              GLASS BODY CLIP
          ========================== */}
          <clipPath id={`${uid}-body-clip`}>
            <path d={jarBodyPath} />
          </clipPath>

          {/* =========================
              PET BLUE PLASTIC
          ========================== */}
          <linearGradient
            id={`${uid}-pet`}
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <stop
              offset="0%"
              stopColor="#005f72"
              stopOpacity="0.55"
            />

            <stop
              offset="8%"
              stopColor="#41d7e5"
              stopOpacity="0.38"
            />

            <stop
              offset="22%"
              stopColor="#dfffff"
              stopOpacity="0.18"
            />

            <stop
              offset="48%"
              stopColor="#ffffff"
              stopOpacity="0.04"
            />

            <stop
              offset="75%"
              stopColor="#9ffaff"
              stopOpacity="0.12"
            />

            <stop
              offset="92%"
              stopColor="#0093aa"
              stopOpacity="0.45"
            />

            <stop
              offset="100%"
              stopColor="#005f72"
              stopOpacity="0.65"
            />
          </linearGradient>

          {/* =========================
              WATER DEPTH
          ========================== */}
          <linearGradient
            id={`${uid}-water`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#68e9f2"
              stopOpacity="0.45"
            />

            <stop
              offset="18%"
              stopColor="#22cbd9"
              stopOpacity="0.42"
            />

            <stop
              offset="65%"
              stopColor="#08aebf"
              stopOpacity="0.55"
            />

            <stop
              offset="100%"
              stopColor="#007f96"
              stopOpacity="0.7"
            />
          </linearGradient>

          {/* =========================
              NECK GRADIENT
          ========================== */}
          <linearGradient
            id={`${uid}-neck`}
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <stop
              offset="0%"
              stopColor="#087d91"
              stopOpacity="0.75"
            />
            <stop
              offset="30%"
              stopColor="#8ff4f6"
              stopOpacity="0.45"
            />
            <stop
              offset="55%"
              stopColor="#ffffff"
              stopOpacity="0.15"
            />
            <stop
              offset="100%"
              stopColor="#00869c"
              stopOpacity="0.65"
            />
          </linearGradient>

          {/* =========================
              CAP GRADIENT
          ========================== */}
          <linearGradient
            id={`${uid}-cap`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#54cbd2" />
            <stop offset="45%" stopColor="#208f9a" />
            <stop offset="100%" stopColor="#116c78" />
          </linearGradient>

          {/* =========================
              HIGHLIGHT
          ========================== */}
          <linearGradient
            id={`${uid}-shine`}
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <stop
              offset="0%"
              stopColor="#ffffff"
              stopOpacity="0"
            />
            <stop
              offset="50%"
              stopColor="#ffffff"
              stopOpacity="0.7"
            />
            <stop
              offset="100%"
              stopColor="#ffffff"
              stopOpacity="0"
            />
          </linearGradient>

          <filter
            id={`${uid}-blur`}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        {/* =========================
            GROUND SHADOW
        ========================== */}
        <ellipse
          cx="250"
          cy="497"
          rx="150"
          ry="13"
          fill="#002f38"
          opacity="0.18"
        />

        {/* =========================
            DYNAMIC WATER
        ========================== */}
        <g clipPath={`url(#${uid}-body-clip)`}>
          {fillRatio > 0 && (
            <>
              <motion.path
                fill={`url(#${uid}-water)`}
                initial={false}
                animate={{
                  d: [waterPath1, waterPath2, waterPath1],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />

              {/* Water surface */}
              <motion.path
                d={`
                  M 98 ${waterY}
                  C 140 ${waterY - 4},
                    175 ${waterY + 5},
                    220 ${waterY}
                  C 275 ${waterY - 5},
                    340 ${waterY + 5},
                    402 ${waterY}
                `}
                fill="none"
                stroke="#d9ffff"
                strokeWidth="3"
                strokeOpacity="0.65"
                animate={{
                  opacity: [0.35, 0.8, 0.35],
                }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />

              {/* Moving internal reflections */}
              <motion.ellipse
                cx="180"
                cy={Math.min(waterY + 70, 430)}
                rx="30"
                ry="5"
                fill="#ffffff"
                opacity="0.1"
                filter={`url(#${uid}-blur)`}
                animate={{
                  y: [0, -35, 0],
                  opacity: [0.05, 0.16, 0.05],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />

              {/* Bubbles */}
              <motion.circle
                cx="175"
                cy={Math.min(waterY + 100, 440)}
                r="3"
                fill="#ffffff"
                animate={{
                  y: [0, -45],
                  opacity: [0, 0.5, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeIn',
                  delay: 0.5,
                }}
              />

              <motion.circle
                cx="310"
                cy={Math.min(waterY + 145, 450)}
                r="2"
                fill="#ffffff"
                animate={{
                  y: [0, -55],
                  opacity: [0, 0.4, 0],
                }}
                transition={{
                  duration: 3.8,
                  repeat: Infinity,
                  ease: 'easeIn',
                  delay: 1,
                }}
              />
            </>
          )}
        </g>

        {/* =========================
            JAR MAIN PET BODY
        ========================== */}
        <path
          d={jarBodyPath}
          fill={`url(#${uid}-pet)`}
          stroke="#6ae3e9"
          strokeWidth="2.5"
          strokeOpacity="0.65"
        />

        {/* =========================
            NARROW NECK
        ========================== */}
        <path
          d="
            M 183 118
            L 183 78
            C 183 70 190 66 198 66
            L 302 66
            C 310 66 317 70 317 78
            L 317 118
            Z
          "
          fill={`url(#${uid}-neck)`}
          stroke="#69dbe2"
          strokeWidth="2"
        />

        {/* Neck lower ring */}
        <path
          d="
            M 181 108
            C 210 114 290 114 319 108
            L 319 122
            C 288 128 212 128 181 122
            Z
          "
          fill="#1c9fad"
          opacity="0.65"
        />

        {/* =========================
            CAP
        ========================== */}
        <path
          d="
            M 188 34
            C 188 26 194 21 202 21
            L 298 21
            C 306 21 312 26 312 34
            L 312 62
            C 312 68 307 72 301 72
            L 199 72
            C 193 72 188 68 188 62
            Z
          "
          fill={`url(#${uid}-cap)`}
          stroke="#5fd4d9"
          strokeWidth="2"
        />

        {/* Cap top */}
        <path
          d="
            M 196 21
            C 210 16 290 16 304 21
            C 296 27 204 27 196 21
            Z
          "
          fill="#6cdae0"
          opacity="0.9"
        />

        {/* Cap grooves */}
        {[34, 42, 50, 58].map((y) => (
          <path
            key={y}
            d={`M 190 ${y} Q 250 ${y + 4} 310 ${y}`}
            fill="none"
            stroke="#d9ffff"
            strokeWidth="1.4"
            strokeOpacity="0.28"
          />
        ))}

        {/* =========================
            SHOULDER CONTOUR
        ========================== */}
        <path
          d="
            M 183 118
            C 182 141 171 151 150 160
            C 125 170 108 182 102 201
          "
          fill="none"
          stroke="#d8ffff"
          strokeWidth="3"
          strokeOpacity="0.35"
        />

        <path
          d="
            M 317 118
            C 318 141 329 151 350 160
            C 375 170 392 182 398 201
          "
          fill="none"
          stroke="#d8ffff"
          strokeWidth="2.5"
          strokeOpacity="0.25"
        />

        {/* =========================
            REALISTIC BIODROPS STYLE
            THICK GRIP RIBS
        ========================== */}

        {/* Top shoulder/body ring */}
        <path
          d="
            M 101 205
            C 150 216 350 216 399 205
            L 399 220
            C 350 232 150 232 101 220
            Z
          "
          fill="#0d9eb1"
          opacity="0.18"
          stroke="#b5ffff"
          strokeWidth="2"
          strokeOpacity="0.3"
        />

        {/* Rib 1 */}
        <path
          d="
            M 97 260
            C 145 271 355 271 403 260
            L 403 280
            C 355 292 145 292 97 280
            Z
          "
          fill="#078da2"
          opacity="0.22"
          stroke="#baffff"
          strokeWidth="2"
          strokeOpacity="0.35"
        />

        {/* Rib 2 */}
        <path
          d="
            M 97 325
            C 145 336 355 336 403 325
            L 403 346
            C 355 358 145 358 97 346
            Z
          "
          fill="#078da2"
          opacity="0.25"
          stroke="#baffff"
          strokeWidth="2"
          strokeOpacity="0.35"
        />

        {/* Rib 3 */}
        <path
          d="
            M 97 390
            C 145 401 355 401 403 390
            L 403 411
            C 355 423 145 423 97 411
            Z
          "
          fill="#078da2"
          opacity="0.25"
          stroke="#baffff"
          strokeWidth="2"
          strokeOpacity="0.35"
        />

        {/* Bottom heavy base ring */}
        <path
          d="
            M 100 438
            C 145 449 355 449 400 438
            L 400 456
            C 388 477 355 486 318 488
            L 182 488
            C 145 486 112 477 100 456
            Z
          "
          fill="#087f94"
          opacity="0.32"
          stroke="#b9ffff"
          strokeWidth="2"
          strokeOpacity="0.4"
        />

        {/* =========================
            SIDE GRIP INDENTATIONS
        ========================== */}
        {[280, 345, 410].map((y) => (
          <g key={y}>
            <path
              d={`
                M 97 ${y - 12}
                C 112 ${y - 8} 122 ${y - 5} 130 ${y}
                C 122 ${y + 5} 112 ${y + 8} 97 ${y + 12}
              `}
              fill="#007d91"
              opacity="0.25"
            />

            <path
              d={`
                M 403 ${y - 12}
                C 388 ${y - 8} 378 ${y - 5} 370 ${y}
                C 378 ${y + 5} 388 ${y + 8} 403 ${y + 12}
              `}
              fill="#007d91"
              opacity="0.25"
            />
          </g>
        ))}

        {/* =========================
            STRONG PLASTIC HIGHLIGHTS
        ========================== */}

        <path
          d={leftSidePath}
          fill="none"
          stroke="#ffffff"
          strokeWidth="7"
          strokeLinecap="round"
          strokeOpacity="0.32"
        />

        <path
          d="
            M 123 204
            C 118 260 118 370 128 430
          "
          fill="none"
          stroke="#dfffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeOpacity="0.55"
        />

        <path
          d={rightSidePath}
          fill="none"
          stroke="#dfffff"
          strokeWidth="4"
          strokeLinecap="round"
          strokeOpacity="0.2"
        />

        {/* Shoulder white reflection */}
        <path
          d="
            M 140 181
            C 175 161 325 161 360 181
          "
          fill="none"
          stroke={`url(#${uid}-shine)`}
          strokeWidth="8"
          strokeOpacity="0.32"
          strokeLinecap="round"
        />

        {/* Moving vertical glass reflection */}
        <motion.path
          d="
            M 158 188
            C 148 255 148 350 158 430
          "
          fill="none"
          stroke="#ffffff"
          strokeWidth="12"
          strokeLinecap="round"
          animate={{
            opacity: [0.06, 0.25, 0.06],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Bottom reflection */}
        <ellipse
          cx="250"
          cy="467"
          rx="105"
          ry="10"
          fill="#d7ffff"
          opacity="0.16"
        />

        <ellipse
          cx="250"
          cy="478"
          rx="72"
          ry="6"
          fill="#ffffff"
          opacity="0.1"
        />
      </svg>
    </div>
  );
}