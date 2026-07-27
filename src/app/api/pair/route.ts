import { NextResponse } from "next/server";

import { AdbNotFoundError } from "@/lib/adb";
import { cancelPairing, getPairing, startPairing } from "@/lib/pairing";

export const dynamic = "force-dynamic";

/** Estado da sessao de pareamento em andamento (polling do front). */
export async function GET() {
  const session = getPairing();
  if (!session) return NextResponse.json({ session: null });
  return NextResponse.json({ session });
}

/** Gera um novo QR code e comeca a observar a rede. */
export async function POST() {
  try {
    const session = await startPairing();
    return NextResponse.json({ session });
  } catch (err) {
    if (err instanceof AdbNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao iniciar o pareamento." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  cancelPairing();
  return NextResponse.json({ ok: true });
}
