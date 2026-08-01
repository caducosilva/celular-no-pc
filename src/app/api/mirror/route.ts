import { NextResponse } from "next/server";

import {
  AdbNotFoundError,
  firstReadyDevice,
  launchScrcpy,
  ScrcpyNotFoundError,
  type MirrorOptions,
} from "@/lib/adb";

export const dynamic = "force-dynamic";

interface MirrorRequest extends MirrorOptions {
  serial?: string;
}

export async function POST(request: Request) {
  let body: MirrorRequest = {};
  try {
    body = (await request.json()) as MirrorRequest;
  } catch {
    /* corpo vazio e valido: usa o primeiro aparelho pronto */
  }

  try {
    const serial = body.serial ?? (await firstReadyDevice())?.serial;
    if (!serial) {
      return NextResponse.json(
        { error: "Nenhum celular conectado. Conecte ou pareie primeiro." },
        { status: 404 },
      );
    }

    const { serial: _ignored, ...options } = body;
    void _ignored;

    const pid = await launchScrcpy(serial, options);
    return NextResponse.json({ ok: true, serial, pid });
  } catch (err) {
    if (err instanceof ScrcpyNotFoundError || err instanceof AdbNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao abrir o espelhamento." },
      { status: 500 },
    );
  }
}
