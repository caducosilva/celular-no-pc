import { BRAND } from "@/lib/brand";

/**
 * Marca da caducosilva no cabecalho.
 *
 * Substitui o antigo selo flutuante: um badge fixo por cima do conteudo
 * atrapalha em tela pequena e briga com a ideia de interface limpa.
 * Aqui ele e so mais um elemento no fluxo da pagina.
 */
export default function BrandMark() {
  return (
    <a
      className="inline-flex items-center gap-2 text-[var(--texto-suave)] transition-colors hover:text-[var(--texto)]"
      href={BRAND.github}
      target="_blank"
      rel="noreferrer noopener"
      title={`${BRAND.name} — ${BRAND.contact}`}
    >
      <span
        aria-hidden
        className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-[var(--borda)] bg-[var(--superficie-2)] text-[0.8rem] font-bold text-[var(--texto)]"
      >
        c
      </span>
      <span className="text-sm font-medium">{BRAND.name}</span>
    </a>
  );
}
