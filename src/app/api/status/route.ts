import { NextResponse } from "next/server";

import { adb, adbPath, scrcpyPath } from "@/lib/adb";

export const dynamic = "force-dynamic";

export async function GET() {
  const adbBin = adbPath();
  const scrcpyBin = scrcpyPath();

  let adbVersion: string | null = null;
  if (adbBin) {
    const out = await adb(["version"]);
    adbVersion = out.split(/\r?\n/)[0]?.trim() ?? null;
  }

  return NextResponse.json({
    adb: { found: Boolean(adbBin), path: adbBin, version: adbVersion },
    scrcpy: { found: Boolean(scrcpyBin), path: scrcpyBin },
    platform: process.platform,
  });
}
