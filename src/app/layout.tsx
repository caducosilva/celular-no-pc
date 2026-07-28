import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { BRAND } from "@/lib/brand";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${BRAND.appName} · ${BRAND.name}`,
  description: BRAND.tagline,
  authors: [{ name: BRAND.name, url: BRAND.github }],
};

/**
 * Aplica o tema salvo ANTES da primeira pintura.
 *
 * Sem isso a pagina aparece clara por um instante e depois pisca pro
 * escuro, porque o React so roda depois que o HTML ja foi desenhado.
 * Sem nada salvo, nao mexemos em nada e o CSS segue o tema do sistema.
 */
const SCRIPT_TEMA = `
(function () {
  try {
    var t = localStorage.getItem("tema");
    if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: o script acima escreve data-theme no <html>
    // antes do React hidratar, entao o HTML do servidor (sem o atributo) e o
    // do cliente divergem de proposito. O aviso so vale para este elemento.
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
