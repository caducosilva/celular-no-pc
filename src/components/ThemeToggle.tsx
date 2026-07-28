"use client";

import { useSyncExternalStore } from "react";

type Tema = "light" | "dark";

const EVENTO_TEMA = "tema:mudou";

/** Le o tema que esta valendo agora, ja considerando o padrao do sistema. */
function lerTema(): Tema {
  const escolhido = document.documentElement.dataset.theme;
  if (escolhido === "light" || escolhido === "dark") return escolhido;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * O tema mora fora do React (num atributo do <html> e no localStorage),
 * entao a gente assina as duas fontes que podem muda-lo: a preferencia do
 * sistema e o nosso proprio botao.
 */
function assinar(aoMudar: () => void) {
  const consulta = window.matchMedia("(prefers-color-scheme: dark)");
  consulta.addEventListener("change", aoMudar);
  window.addEventListener(EVENTO_TEMA, aoMudar);
  return () => {
    consulta.removeEventListener("change", aoMudar);
    window.removeEventListener(EVENTO_TEMA, aoMudar);
  };
}

// No servidor nao da pra saber a preferencia; o React usa este valor so
// durante a hidratacao e corrige sozinho logo depois.
const temaNoServidor = (): Tema => "light";

export default function ThemeToggle() {
  const tema = useSyncExternalStore(assinar, lerTema, temaNoServidor);
  const escuro = tema === "dark";

  function alternar() {
    const novo: Tema = escuro ? "light" : "dark";
    document.documentElement.dataset.theme = novo;
    try {
      localStorage.setItem("tema", novo);
    } catch {
      /* modo anonimo ou storage bloqueado: vale so nesta aba */
    }
    window.dispatchEvent(new Event(EVENTO_TEMA));
  }

  return (
    <button
      type="button"
      className="tema-btn"
      onClick={alternar}
      aria-label={escuro ? "Usar tema claro" : "Usar tema escuro"}
      title={escuro ? "Usar tema claro" : "Usar tema escuro"}
    >
      {escuro ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.1 5.1l1.4 1.4M17.5 17.5l1.4 1.4M18.9 5.1l-1.4 1.4M6.5 17.5l-1.4 1.4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
