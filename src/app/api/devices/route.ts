import { NextResponse } from "next/server";

import { AdbNotFoundError, listDevicesDeduped, mdnsServices } from "@/lib/adb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [devices, services] = await Promise.all([listDevicesDeduped(), mdnsServices()]);
    return NextResponse.json({ devices, services });
  } catch (err) {
    if (err instanceof AdbNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao listar dispositivos." },
      { status: 500 },
    );
  }
}
