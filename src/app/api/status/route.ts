import { NextResponse } from "next/server";

import { adb, adbPath, ensureMdnsReady, SCRCPY_MINIMO, scrcpyPath, scrcpyVersion } from "@/lib/adb";

export const dynamic = "force-dynamic";

export async function GET() {
  const adbBin = adbPath();
  const scrcpyBin = scrcpyPath();

  let adbVersion: string | null = null;
  if (adbBin) {
    const out = await adb(["version"]);
    adbVersion = out.split(/\r?\n/)[0]?.trim() ?? null;
  }

  // Checar aqui, no carregamento do painel, faz o conserto acontecer antes
  // de o usuario escanear qualquer QR — e nao depois de ele ficar preso
  // esperando o pareamento que nunca vem.
  const mdns = adbBin
    ? await ensureMdnsReady()
    : { ok: false, daemon: null, restarted: false, detail: "adb nao encontrado." };

  const versaoScrcpy = await scrcpyVersion();

  return NextResponse.json({
    adb: { found: Boolean(adbBin), path: adbBin, version: adbVersion },
    scrcpy: {
      found: Boolean(scrcpyBin),
      path: scrcpyBin,
      version: versaoScrcpy.texto,
      // so acusamos "velho" quando conseguimos ler a versao
      tooOld: versaoScrcpy.maior !== null && versaoScrcpy.maior < SCRCPY_MINIMO,
    },
    mdns,
    platform: process.platform,
  });
}
