function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Building {
  x: number;
  width: number;
  height: number;
}

/** Deterministic skyline silhouette from the cosmetic seed — no external art needed. */
export function Skyline({ seed, className }: { seed: string; className?: string }) {
  const rng = mulberry32(hashSeed(seed));
  const gradientId = `sky-${hashSeed(seed)}`;
  const slots = [
    { x: 8, width: 22 },
    { x: 34, width: 30 },
    { x: 68, width: 20 },
    { x: 92, width: 16 },
  ];
  const buildings: Building[] = slots.map((slot, i) => ({
    ...slot,
    height: 20 + rng() * 18 + (i === 1 ? 8 : 0),
  }));

  return (
    <svg viewBox="0 0 120 70" className={className} preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cdd9cf" />
          <stop offset="100%" stopColor="#93a99c" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="120" height="70" fill={`url(#${gradientId})`} />
      {buildings.map((b, bi) => {
        const top = 70 - b.height;
        const cols = Math.max(2, Math.floor(b.width / 6));
        const rows = Math.max(2, Math.floor(b.height / 7));
        const windows = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (rng() < 0.35) continue;
            windows.push(
              <rect
                key={`${bi}-${r}-${c}`}
                x={b.x + 2.5 + c * 5.2}
                y={top + 3 + r * 6.2}
                width={2.4}
                height={3}
                fill="#e9d9a3"
                opacity={0.85}
              />,
            );
          }
        }
        return (
          <g key={bi}>
            <rect x={b.x} y={top} width={b.width} height={b.height} fill="#16241f" />
            {windows}
          </g>
        );
      })}
    </svg>
  );
}
