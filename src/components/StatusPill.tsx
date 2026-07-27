type Tone = "ok" | "warn" | "bad" | "idle";

const TONE_COLOR: Record<Tone, string> = {
  ok: "#1e90ff",
  warn: "#b24bf3",
  bad: "#ff4136",
  idle: "#9fa8da",
};

export default function StatusPill({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <span className="pill" style={{ color: TONE_COLOR[tone] }}>
      <span className="pill-dot" />
      <span className="text-[var(--starlight)]">{children}</span>
    </span>
  );
}
