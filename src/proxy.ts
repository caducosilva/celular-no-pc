import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/* ------------------------------------------------------------------ *
 * Trava de seguranca.
 *
 * Este app executa binarios locais (adb e scrcpy), entao quem alcanca a
 * pagina consegue parear um aparelho e abrir espelhamentos nesta maquina.
 * Os scripts do package.json ja sobem o servidor preso em 127.0.0.1, mas
 * isso sozinho nao basta:
 *
 * - alguem pode subir com `-H 0.0.0.0` sem perceber, e a interface fica
 *   aberta pra rede Wi-Fi inteira;
 * - um site qualquer que voce visite pode fazer requisicoes pra
 *   http://localhost:3000 do seu navegador (DNS rebinding / CSRF). O
 *   preflight barra `application/json`, mas um POST simples passaria.
 *
 * Entao aqui a gente exige que o Host seja loopback e que qualquer Origin
 * enviada tambem seja loopback.
 * ------------------------------------------------------------------ */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function hostnameOf(value: string): string {
  // tira a porta, preservando o formato IPv6 entre colchetes
  const semPorta = value.startsWith("[")
    ? value.slice(0, value.indexOf("]") + 1)
    : value.split(":")[0];
  return semPorta.toLowerCase();
}

function negar(motivo: string) {
  return new NextResponse(`${motivo}\n\nEste painel so aceita acesso local (localhost).`, {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  if (!host || !LOOPBACK_HOSTS.has(hostnameOf(host))) {
    return negar(`Acesso bloqueado para o host "${host ?? "desconhecido"}".`);
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (!LOOPBACK_HOSTS.has(new URL(origin).hostname.toLowerCase())) {
        return negar(`Requisicao bloqueada: origem externa "${origin}".`);
      }
    } catch {
      return negar("Requisicao bloqueada: cabecalho Origin invalido.");
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
