import { BRAND } from "@/lib/brand";

/** Monograma "C" em orbita — assinatura visual da marca caducosilva. */
function OrbitMonogram({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="seal-stellar" x1="0" y1="0" x2="48" y2="48">
          <stop offset="0%" stopColor="#1E90FF" />
          <stop offset="100%" stopColor="#B24BF3" />
        </linearGradient>
      </defs>

      <g className="brand-seal-orbit">
        <ellipse
          cx="24"
          cy="24"
          rx="21"
          ry="9"
          transform="rotate(-28 24 24)"
          stroke="url(#seal-stellar)"
          strokeWidth="1.5"
          opacity="0.75"
        />
        <circle cx="42" cy="15" r="2.4" fill="#B24BF3" />
      </g>

      <text
        x="24"
        y="31"
        textAnchor="middle"
        fontFamily="var(--font-display), sans-serif"
        fontSize="22"
        fontWeight="900"
        fill="url(#seal-stellar)"
      >
        C
      </text>
    </svg>
  );
}

/** Selo fixo no canto inferior direito. Obrigatorio em toda interface da marca. */
export default function BrandSeal() {
  return (
    <a
      className="brand-seal"
      href={BRAND.github}
      target="_blank"
      rel="noreferrer noopener"
      title={`${BRAND.name} — ${BRAND.contact}`}
    >
      <OrbitMonogram />
      <span className="flex flex-col leading-tight">
        <span
          className="gradient-text text-[0.78rem] font-black tracking-[0.16em]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {BRAND.wordmark}
        </span>
        <span className="seal-contact text-[0.62rem] text-[var(--moonlight)]">
          {BRAND.contact}
        </span>
      </span>
    </a>
  );
}
