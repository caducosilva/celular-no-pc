import { execFile, spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { Device, MdnsService, MirrorOptions } from "@/lib/types";

export type { Device, DeviceState, MdnsService, MirrorOptions } from "@/lib/types";

const execFileAsync = promisify(execFile);

/* ------------------------------------------------------------------ *
 * Localizacao dos binarios
 *
 * O adb que vem empacotado junto do scrcpy no Windows costuma falhar com
 * "CreateProcessW() error 5 / Could not start adb server". Por isso ele
 * fica sempre por ultimo na lista, e exportamos a variavel de ambiente
 * ADB apontando pro adb escolhido quando lancamos o scrcpy.
 * ------------------------------------------------------------------ */

const HOME = homedir();
const LOCALAPPDATA = process.env.LOCALAPPDATA ?? path.join(HOME, "AppData", "Local");
const WINGET = path.join(LOCALAPPDATA, "Microsoft", "WinGet", "Packages");

const SCRCPY_WINGET_DIR = path.join(
  WINGET,
  "Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe",
);

const ADB_CANDIDATES = [
  path.join(HOME, "Android", "Sdk", "platform-tools", "adb.exe"),
  path.join(LOCALAPPDATA, "Android", "Sdk", "platform-tools", "adb.exe"),
  path.join(
    WINGET,
    "Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe",
    "platform-tools",
    "adb.exe",
  ),
  path.join(HOME, "platform-tools", "adb.exe"),
  // ultimo recurso: o adb empacotado com o scrcpy
  path.join(SCRCPY_WINGET_DIR, "scrcpy-win64-v4.0", "adb.exe"),
  // unix
  path.join(HOME, "Android", "Sdk", "platform-tools", "adb"),
  "/usr/local/bin/adb",
  "/usr/bin/adb",
  "/opt/homebrew/bin/adb",
];

const SCRCPY_CANDIDATES = [
  path.join(SCRCPY_WINGET_DIR, "scrcpy-win64-v4.0", "scrcpy.exe"),
  path.join(process.env.ProgramFiles ?? "C:\\Program Files", "scrcpy", "scrcpy.exe"),
  "/usr/local/bin/scrcpy",
  "/usr/bin/scrcpy",
  "/opt/homebrew/bin/scrcpy",
];

/** Resolve um binario pela lista de candidatos, com glob leve de versao. */
function resolveBinary(candidates: string[], nameOnPath: string): string | null {
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  // qualquer versao do scrcpy dentro da pasta do WinGet (scrcpy-win64-vX.Y)
  if (platform() === "win32" && existsSync(SCRCPY_WINGET_DIR)) {
    const exe = nameOnPath === "scrcpy" ? "scrcpy.exe" : "adb.exe";
    try {
      for (const dir of readdirSync(SCRCPY_WINGET_DIR)) {
        const full = path.join(SCRCPY_WINGET_DIR, dir, exe);
        if (existsSync(full)) return full;
      }
    } catch {
      /* pasta some entre o existsSync e o readdir: ignora */
    }
  }
  return null;
}

let cachedAdb: string | null | undefined;
let cachedScrcpy: string | null | undefined;

export function adbPath(): string | null {
  if (cachedAdb === undefined) cachedAdb = resolveBinary(ADB_CANDIDATES, "adb");
  return cachedAdb;
}

export function scrcpyPath(): string | null {
  if (cachedScrcpy === undefined) cachedScrcpy = resolveBinary(SCRCPY_CANDIDATES, "scrcpy");
  return cachedScrcpy;
}

export class AdbNotFoundError extends Error {
  constructor() {
    super("adb nao encontrado. Instale com: winget install Google.PlatformTools");
    this.name = "AdbNotFoundError";
  }
}

/* ------------------------------------------------------------------ *
 * Execucao
 * ------------------------------------------------------------------ */

export async function adb(args: string[], timeoutMs = 15_000): Promise<string> {
  const bin = adbPath();
  if (!bin) throw new AdbNotFoundError();
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    });
    return `${stdout}${stderr}`;
  } catch (err) {
    // o adb usa exit code != 0 pra coisas normais (ex: connect falhou).
    // Devolvemos a saida pro chamador decidir em vez de estourar.
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return `${e.stdout ?? ""}${e.stderr ?? ""}${e.stdout || e.stderr ? "" : (e.message ?? "")}`;
  }
}

/* ------------------------------------------------------------------ *
 * Dispositivos
 * ------------------------------------------------------------------ */

export async function listDevices(): Promise<Device[]> {
  const out = await adb(["devices", "-l"]);
  const devices: Device[] = [];

  for (const line of out.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("List of devices")) continue;
    if (trimmed.startsWith("*")) continue; // "* daemon started successfully"

    const [serial, state, ...rest] = trimmed.split(/\s+/);
    if (!serial || !state) continue;
    if (!["device", "unauthorized", "offline", "connecting"].includes(state)) continue;

    const model = rest.find((p) => p.startsWith("model:"))?.slice("model:".length) ?? null;

    devices.push({
      serial,
      state: state as Device["state"],
      model: model ? model.replace(/_/g, " ") : null,
      wireless: /:\d+$/.test(serial) || serial.includes("_adb-tls-"),
    });
  }

  return devices;
}

export async function firstReadyDevice(): Promise<Device | null> {
  const devices = await listDevices();
  return devices.find((d) => d.state === "device") ?? null;
}

/* ------------------------------------------------------------------ *
 * mDNS — descoberta na rede local
 * ------------------------------------------------------------------ */

export async function mdnsServices(): Promise<MdnsService[]> {
  const out = await adb(["mdns", "services"]);
  const services: MdnsService[] = [];

  for (const line of out.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    const endpoint = parts.find((p) => /^\d+\.\d+\.\d+\.\d+:\d+$/.test(p));
    const type = parts.find((p) => p.startsWith("_adb-tls-"));
    if (!endpoint || !type || !parts[0]) continue;
    services.push({ instance: parts[0], type, endpoint });
  }

  return services;
}

export const PAIRING_SERVICE = "_adb-tls-pairing._tcp";
export const CONNECT_SERVICE = "_adb-tls-connect._tcp";

/**
 * Conecta no primeiro endpoint de conexao anunciado por mDNS.
 * A porta de conexao muda a cada vez que a depuracao sem fio e religada,
 * por isso nunca guardamos ip:porta fixo.
 */
export async function connectViaMdns(): Promise<{ ok: boolean; endpoint: string | null }> {
  const services = await mdnsServices();
  const connect = services.filter((s) => s.type.startsWith(CONNECT_SERVICE.split(".")[0]));

  for (const service of connect) {
    const out = await adb(["connect", service.endpoint]);
    if (/connected to/i.test(out)) return { ok: true, endpoint: service.endpoint };
  }

  return { ok: false, endpoint: connect[0]?.endpoint ?? null };
}

export async function disconnectAll(): Promise<string> {
  return adb(["disconnect"]);
}

/* ------------------------------------------------------------------ *
 * scrcpy
 * ------------------------------------------------------------------ */

export class ScrcpyNotFoundError extends Error {
  constructor() {
    super("scrcpy nao encontrado. Instale com: winget install Genymobile.scrcpy");
    this.name = "ScrcpyNotFoundError";
  }
}

export function buildScrcpyArgs(serial: string, options: MirrorOptions = {}): string[] {
  const args = ["-s", serial, "--window-title", "Celular no PC - caducosilva"];

  if (options.maxSize && options.maxSize > 0) args.push(`--max-size=${options.maxSize}`);
  if (options.bitrate) args.push(`--video-bit-rate=${options.bitrate}`);
  if (options.fps && options.fps > 0) args.push(`--max-fps=${options.fps}`);
  if (options.turnScreenOff) args.push("--turn-screen-off");
  if (options.stayAwake) args.push("--stay-awake");
  if (options.noAudio) args.push("--no-audio");
  if (options.alwaysOnTop) args.push("--always-on-top");
  if (options.viewOnly) args.push("--no-control");

  return args;
}

/** Sobe o scrcpy desacoplado do servidor: fechar o app nao fecha a janela. */
export function launchScrcpy(serial: string, options: MirrorOptions = {}): number | undefined {
  const bin = scrcpyPath();
  if (!bin) throw new ScrcpyNotFoundError();

  const adbBin = adbPath();
  if (!adbBin) throw new AdbNotFoundError();

  const child = spawn(bin, buildScrcpyArgs(serial, options), {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
    // sem isso o scrcpy tenta usar o adb da propria pasta e morre
    // com CreateProcessW() error 5 no Windows
    env: { ...process.env, ADB: adbBin },
  });

  child.unref();
  return child.pid;
}
