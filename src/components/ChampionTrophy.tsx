"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Inline UEFA-style trophy — big handles, tall bowl, stepped plinth. */
export function Trophy() {
  return (
    <svg width="128" height="176" viewBox="0 0 128 176" fill="none" aria-label="Champions trophy">
      <defs>
        <linearGradient id="cup-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe79c" />
          <stop offset="0.5" stopColor="#ffd25e" />
          <stop offset="1" stopColor="#c8912b" />
        </linearGradient>
      </defs>
      <g stroke="#8a5f18" strokeWidth="1.5">
        {/* handles */}
        <path d="M40 44C18 44 14 74 40 92" fill="none" stroke="url(#cup-gold)" strokeWidth="7" />
        <path d="M88 44C110 44 114 74 88 92" fill="none" stroke="url(#cup-gold)" strokeWidth="7" />
        {/* bowl */}
        <path d="M34 30H94V64C94 92 80 108 64 108C48 108 34 92 34 64V30Z" fill="url(#cup-gold)" />
        {/* rim */}
        <rect x="30" y="24" width="68" height="10" rx="3" fill="url(#cup-gold)" />
        {/* stem */}
        <rect x="58" y="108" width="12" height="20" fill="url(#cup-gold)" />
        {/* base */}
        <rect x="44" y="128" width="40" height="10" rx="2" fill="url(#cup-gold)" />
        <rect x="36" y="138" width="56" height="14" rx="2" fill="url(#cup-gold)" />
        <rect x="30" y="152" width="68" height="14" rx="3" fill="#1b130a" stroke="#8a5f18" />
      </g>
      <ellipse cx="54" cy="52" rx="6" ry="18" fill="#fff3cf" opacity="0.5" />
    </svg>
  );
}

/** The trophy, looping through a gentle lift-and-tilt bob (skips the motion when reduced-motion is set). */
export function TrophyLift({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const lift = reduce
    ? {}
    : {
        animate: { y: [6, -10, 6], rotate: [-1.5, 1.5, -1.5] },
        transition: {
          duration: 3.4,
          repeat: Infinity,
          repeatType: "mirror" as const,
          ease: "easeInOut" as const,
        },
      };

  return (
    <motion.div {...lift} className={`trophy-glow ${className ?? ""}`}>
      <Trophy />
    </motion.div>
  );
}
