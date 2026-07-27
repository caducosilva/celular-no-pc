import { NextResponse } from "next/server";

import { AdbNotFoundError, connectViaMdns, disconnectAll, firstReadyDevice } from "@/lib/adb";

export const dynamic = "force-dynamic";

/** Reconecta num aparelho ja pareado, descobrindo a porta atual por mDNS. */
export async function POST() {
  try {
    const existing = await firstReadyDevice();
    if (existing) {
      return NextResponse.json({ ok: true, device: existing, alreadyConnected: true });
    }

    const { ok, endpoint } = await connectViaMdns();
    const device = await firstReadyDevice();

    if (!device) {
      return NextResponse.json(
        {
          ok: false,
          endpoint,
          error: endpoint
            ? `Achei o celular em ${endpoint}, mas a conexao foi recusada. Pareie de novo.`
            : "Nenhum celular encontrado na rede. Ligue a depuracao sem fio e confira se os dois estao no mesmo Wi-Fi.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok, endpoint, device, alreadyConnected: false });
  } catch (err) {
    if (err instanceof AdbNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao conectar." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const out = await disconnectAll();
    return NextResponse.json({ ok: true, output: out.trim() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao desconectar." },
      { status: 500 },
    );
  }
}
