import { BRAND } from "@/lib/brand";
import Starfield from "@/components/Starfield";

/** Estrelas + nebulosas + marca d'agua. Fica sempre atras do conteudo. */
export default function CosmicBackground() {
  return (
    <>
      <Starfield />

      <div
        className="nebula-blob"
        style={{
          top: "-12%",
          left: "-8%",
          width: "46vw",
          height: "46vw",
          background: "radial-gradient(circle, #7b2fbe, transparent 68%)",
        }}
        aria-hidden
      />
      <div
        className="nebula-blob"
        style={{
          bottom: "-18%",
          right: "-10%",
          width: "52vw",
          height: "52vw",
          background: "radial-gradient(circle, #0047ab, transparent 68%)",
          animationDelay: "-13s",
        }}
        aria-hidden
      />

      <div className="brand-watermark" aria-hidden>
        <span>{BRAND.wordmark}</span>
      </div>
    </>
  );
}
