// Deterministic blocky avatar derived from the player's UUID.

const HUES = [
  "var(--series-tps)",
  "var(--series-players)",
  "var(--series-cpu)",
];

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function PlayerAvatar({
  seed,
  size = 28,
}: {
  seed: string;
  size?: number;
}) {
  const h = hash(seed);
  const color = HUES[h % HUES.length];
  // 4x4 grid mirrored horizontally, so the shape always reads as a face
  const cells: boolean[] = [];
  for (let i = 0; i < 8; i++) cells.push(((h >> i) & 1) === 1);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 4 4"
      className="shrink-0 rounded-md"
      style={{ background: "var(--glass-inset)" }}
      aria-hidden="true"
    >
      {cells.map((on, i) => {
        if (!on) return null;
        const col = i % 2;
        const row = Math.floor(i / 2);
        return (
          <g key={i} fill={color}>
            <rect x={col} y={row} width="1" height="1" />
            <rect x={3 - col} y={row} width="1" height="1" />
          </g>
        );
      })}
    </svg>
  );
}
