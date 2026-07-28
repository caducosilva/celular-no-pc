type Tone = "ok" | "warn" | "bad" | "idle";

/** Cor so do pontinho — o texto fica sempre na cor normal, pra manter contraste. */
const COR_DO_PONTO: Record<Tone, string> = {
  ok: "var(--ok)",
  warn: "var(--aviso)",
  bad: "var(--perigo)",
  idle: "var(--texto-fraco)",
};

export default function StatusPill({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <span className="pill">
      <span className="pill-dot" style={{ color: COR_DO_PONTO[tone] }} />
      {children}
    </span>
  );
}
