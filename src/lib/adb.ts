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
  // Instalacoes manuais vem antes das do sistema de proposito: quem baixou
  // o scrcpy oficial fez isso justamente porque o pacote da distro e velho
  // demais (o Debian/Ubuntu/Mint ainda entrega o 1.25, de 2022).
  path.join(HOME, ".local", "opt", "scrcpy", "scrcpy"),
  path.join(HOME, ".local", "bin", "scrcpy"),
  "/opt/scrcpy/scrcpy",
  "/usr/local/bin/scrcpy",
  "/opt/homebrew/bin/scrcpy",
  "/usr/bin/scrcpy",
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

const ESTADOS: Device["state"][] = ["device", "unauthorized", "offline", "connecting"];

export async function listDevices(): Promise<Device[]> {
  const out = await adb(["devices", "-l"]);
  const devices: Device[] = [];

  for (const line of out.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("List of devices")) continue;
    if (trimmed.startsWith("*")) continue; // "* daemon started successfully"

    // Cuidado: o serial PODE ter espaco. Quando duas instancias mDNS tem o
    // mesmo nome, o adb desambigua com um sufixo e a linha vira
    //   adb-RQ...-372ZY9 (2)._adb-tls-connect._tcp   device  model:SM_S938B
    // Um split cego pegaria "(2)._adb-tls-connect._tcp" como estado e
    // descartaria a linha, o aparelho sumia do painel mesmo conectado.
    // Por isso ancoramos no estado e montamos o serial com o que vem antes.
    const partes = trimmed.split(/\s+/);
    const indiceEstado = partes.findIndex((p) => ESTADOS.includes(p as Device["state"]));
    if (indiceEstado < 1) continue;

    const serial = partes.slice(0, indiceEstado).join(" ");
    const state = partes[indiceEstado] as Device["state"];
    const rest = partes.slice(indiceEstado + 1);

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

/**
 * Junta entradas que sao o mesmo aparelho fisico.
 *
 * Quando a gente roda `adb connect <ip:porta>` e o proprio adb ja tinha
 * conectado sozinho pelo servico mDNS, o mesmo celular aparece duas vezes:
 * uma como `192.168.0.15:44715` e outra como
 * `adb-RQ...-372ZY9._adb-tls-connect._tcp`. Ai o painel diz "2 aparelhos"
 * e qualquer `adb` sem `-s` morre com "more than one device/emulator".
 *
 * O numero de serie de fabrica (`ro.serialno`) e o mesmo nos dois, entao
 * ele serve de chave. So consultamos quando ha mais de um aparelho pronto
 *, no caso normal, de um celular so, nao gastamos chamada nenhuma.
 */
async function dedupeDevices(devices: Device[]): Promise<Device[]> {
  const prontos = devices.filter((d) => d.state === "device");
  if (prontos.length < 2) return devices;

  const vistos = new Map<string, Device>();
  const outros = devices.filter((d) => d.state !== "device");

  for (const device of prontos) {
    const saida = await adb(["-s", device.serial, "shell", "getprop", "ro.serialno"], 5_000);
    const chave = saida.trim() || device.serial;
    const anterior = vistos.get(chave);
    // Preferimos o serial ip:porta: e mais curto e e o que o scrcpy aceita
    // sem drama.
    if (!anterior || (!/:\d+$/.test(anterior.serial) && /:\d+$/.test(device.serial))) {
      vistos.set(chave, device);
    }
  }

  return [...vistos.values(), ...outros];
}

export async function listDevicesDeduped(): Promise<Device[]> {
  return dedupeDevices(await listDevices());
}

export async function firstReadyDevice(): Promise<Device | null> {
  const devices = await listDevicesDeduped();
  return devices.find((d) => d.state === "device") ?? null;
}

/* ------------------------------------------------------------------ *
 * mDNS, descoberta na rede local
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

/* ------------------------------------------------------------------ *
 * Saude do mDNS
 *
 * Aqui mora a armadilha que fazia o celular ficar eternamente em
 * "pareando dispositivo".
 *
 * Existe um servidor adb unico por maquina, na porta 5037, e quem o
 * iniciou primeiro manda. Varias distros (e o proprio scrcpy) trazem um
 * `adb` cuja build vem SEM descoberta mDNS funcional, no Debian/Ubuntu/
 * Mint o pacote `android-tools-adb` e assim.
 *
 * O detalhe cruel: essa build tambem se identifica como "1.0.41", a mesma
 * versao de protocolo do adb das Platform Tools. Como as versoes batem, o
 * cliente novo NAO reinicia o servidor velho (que e o que ele faria numa
 * incompatibilidade de verdade) e passa a conversar com um servidor onde
 * `adb mdns services` responde vazio pra sempre.
 *
 * Resultado: o celular le o QR, anuncia o servico na rede e fica
 * esperando; o PC nunca enxerga o anuncio, nunca roda `adb pair`, e o
 * aparelho trava em "pareando dispositivo" ate o usuario desistir.
 *
 * A checagem abaixo detecta isso e reinicia o servidor com o adb que NOS
 * escolhemos, que e o que tem mDNS.
 * ------------------------------------------------------------------ */

export interface MdnsHealth {
  ok: boolean;
  /** versao do daemon relatada pelo adb, quando disponivel */
  daemon: string | null;
  /** true quando precisamos reiniciar o servidor pra consertar */
  restarted: boolean;
  detail: string;
}

/** `adb mdns check` responde com a versao do daemon quando o mDNS vive. */
async function mdnsDaemonVersion(): Promise<string | null> {
  const out = await adb(["mdns", "check"], 10_000);
  const achado = out.match(/mdns daemon version \[(.+?)\]/i);
  return achado ? achado[1] : null;
}

let saudeEmCache: MdnsHealth | null = null;

/**
 * Garante que o servidor adb em uso enxerga servicos mDNS.
 * O resultado fica em cache porque reiniciar o servidor derruba as
 * conexoes sem fio abertas, nao da pra fazer isso a cada poll.
 */
export async function ensureMdnsReady(forcar = false): Promise<MdnsHealth> {
  if (saudeEmCache?.ok && !forcar) return saudeEmCache;

  if (!adbPath()) {
    saudeEmCache = { ok: false, daemon: null, restarted: false, detail: "adb nao encontrado." };
    return saudeEmCache;
  }

  let daemon = await mdnsDaemonVersion();
  if (daemon) {
    saudeEmCache = { ok: true, daemon, restarted: false, detail: "mDNS funcionando." };
    return saudeEmCache;
  }

  // Servidor sem mDNS: derruba e sobe de novo com o nosso binario.
  await adb(["kill-server"], 10_000);
  await adb(["start-server"], 20_000);
  daemon = await mdnsDaemonVersion();

  saudeEmCache = daemon
    ? {
        ok: true,
        daemon,
        restarted: true,
        detail: "O servidor adb em uso nao tinha mDNS; reiniciei com o adb correto.",
      }
    : {
        ok: false,
        daemon: null,
        restarted: true,
        detail:
          "Este adb nao tem descoberta mDNS. Instale as Platform Tools oficiais do Android " +
          "(o pacote adb da distro costuma vir sem mDNS) e abra o painel de novo.",
      };

  return saudeEmCache;
}

/** Usado quando o usuario manda procurar de novo: refaz a checagem. */
export function limparCacheMdns(): void {
  saudeEmCache = null;
}

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

/**
 * Versao do scrcpy instalado.
 *
 * Importa mais do que parece: o scrcpy empacotado pelo Debian/Ubuntu/Mint
 * costuma ser o 1.25, de 2022, que nao fala com Android recente e falha
 * com um "Could not retrieve device information" que nao explica nada.
 * Da 2.0 em diante funciona.
 */
export const SCRCPY_MINIMO = 2;

export async function scrcpyVersion(): Promise<{ texto: string | null; maior: number | null }> {
  const bin = scrcpyPath();
  if (!bin) return { texto: null, maior: null };

  let saida = "";
  try {
    const { stdout, stderr } = await execFileAsync(bin, ["--version"], {
      timeout: 8_000,
      windowsHide: true,
    });
    saida = `${stdout}${stderr}`;
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    saida = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }

  const achado = saida.match(/scrcpy\s+(\d+)\.(\d+)/i);
  if (!achado) return { texto: null, maior: null };
  return { texto: `${achado[1]}.${achado[2]}`, maior: Number(achado[1]) };
}

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
