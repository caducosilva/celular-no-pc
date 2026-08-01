/* ------------------------------------------------------------------ *
 * Celular no PC . criado por caducosilva . contato: abobicarlo@gmail.com
 *
 * Pedacos de adb compartilhados pelos atalhos avulsos (parear/espelhar).
 * E a mesma logica de src/lib/adb.ts, reescrita aqui em JS puro porque
 * aquele modulo e TypeScript e so roda dentro do Next.
 * ------------------------------------------------------------------ */

import { execFile, spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const HOME = homedir();
const EH_WINDOWS = platform() === "win32";
const LOCALAPPDATA = process.env.LOCALAPPDATA ?? path.join(HOME, "AppData", "Local");
const WINGET = path.join(LOCALAPPDATA, "Microsoft", "WinGet", "Packages");

export const cor = {
  ciano: (t) => `\x1b[36m${t}\x1b[0m`,
  verde: (t) => `\x1b[32m${t}\x1b[0m`,
  amarelo: (t) => `\x1b[33m${t}\x1b[0m`,
  vermelho: (t) => `\x1b[31m${t}\x1b[0m`,
  fraco: (t) => `\x1b[90m${t}\x1b[0m`,
};

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------------- *
 * Binarios
 *
 * O adb das Platform Tools vem antes do da distro de proposito: o
 * pacote `android-tools-adb` do Debian/Ubuntu/Mint costuma vir sem
 * descoberta mDNS, e sem mDNS o pareamento por QR nao funciona.
 * ---------------------------------------------------------------- */

const CANDIDATOS_ADB = [
  path.join(HOME, "Android", "Sdk", "platform-tools", EH_WINDOWS ? "adb.exe" : "adb"),
  path.join(LOCALAPPDATA, "Android", "Sdk", "platform-tools", EH_WINDOWS ? "adb.exe" : "adb"),
  path.join(
    WINGET,
    "Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe",
    "platform-tools",
    "adb.exe",
  ),
  path.join(HOME, "platform-tools", EH_WINDOWS ? "adb.exe" : "adb"),
  "/usr/local/bin/adb",
  "/opt/homebrew/bin/adb",
  "/usr/bin/adb",
];

// Instalacoes manuais vem antes das do sistema: o pacote da distro ainda e
// o scrcpy 1.25, de 2022, que nao fala com Android recente.
const CANDIDATOS_SCRCPY = [
  path.join(HOME, ".local", "opt", "scrcpy", "scrcpy"),
  path.join(HOME, ".local", "bin", "scrcpy"),
  path.join(process.env.ProgramFiles ?? "C:\\Program Files", "scrcpy", "scrcpy.exe"),
  "/opt/scrcpy/scrcpy",
  "/usr/local/bin/scrcpy",
  "/opt/homebrew/bin/scrcpy",
  "/usr/bin/scrcpy",
];

function acharNoWingetScrcpy() {
  const dir = path.join(WINGET, "Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe");
  if (!EH_WINDOWS || !existsSync(dir)) return null;
  try {
    for (const nome of readdirSync(dir)) {
      const full = path.join(dir, nome, "scrcpy.exe");
      if (existsSync(full)) return full;
    }
  } catch {
    /* ignora */
  }
  return null;
}

function resolver(candidatos) {
  return candidatos.find((c) => existsSync(c)) ?? null;
}

export const adbBin = () => resolver(CANDIDATOS_ADB);
export const scrcpyBin = () => resolver(CANDIDATOS_SCRCPY) ?? acharNoWingetScrcpy();

/* ---------------------------------------------------------------- *
 * Execucao
 * ---------------------------------------------------------------- */

/** Roda o adb e devolve a saida. Erro vira texto: o adb usa exit != 0 pra coisa normal. */
export async function adb(args, timeoutMs = 15000) {
  const bin = adbBin();
  if (!bin) throw new Error("adb nao encontrado.");
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
    });
    return `${stdout}${stderr}`;
  } catch (erro) {
    return `${erro.stdout ?? ""}${erro.stderr ?? ""}`;
  }
}

/* ---------------------------------------------------------------- *
 * mDNS
 * ---------------------------------------------------------------- */

async function versaoDaemonMdns() {
  const saida = await adb(["mdns", "check"], 10000);
  const achado = saida.match(/mdns daemon version \[(.+?)\]/i);
  return achado ? achado[1] : null;
}

/**
 * Garante que o servidor adb da porta 5037 enxerga servicos mDNS.
 *
 * So existe UM servidor adb por maquina e quem subiu primeiro manda. Se
 * foi um adb sem mDNS (o da distro, ou o que vem junto do scrcpy), o
 * `adb mdns services` responde vazio pra sempre e o celular fica preso
 * em "pareando dispositivo". Nesse caso a gente reinicia o servidor com
 * o adb certo.
 */
export async function garantirMdns() {
  let daemon = await versaoDaemonMdns();
  if (daemon) return { ok: true, reiniciou: false, daemon };

  console.log(cor.fraco("O servidor adb em uso nao tem mDNS. Reiniciando com o adb correto..."));
  await adb(["kill-server"], 10000);
  await adb(["start-server"], 20000);
  daemon = await versaoDaemonMdns();

  return { ok: Boolean(daemon), reiniciou: true, daemon };
}

export async function servicosMdns() {
  const saida = await adb(["mdns", "services"]);
  const servicos = [];
  for (const linha of saida.split(/\r?\n/)) {
    const partes = linha.trim().split(/\s+/);
    const endpoint = partes.find((p) => /^\d+\.\d+\.\d+\.\d+:\d+$/.test(p));
    const tipo = partes.find((p) => p.startsWith("_adb-tls-"));
    if (!endpoint || !tipo || !partes[0]) continue;
    servicos.push({ instancia: partes[0], tipo, endpoint });
  }
  return servicos;
}

/* ---------------------------------------------------------------- *
 * Dispositivos
 * ---------------------------------------------------------------- */

const ESTADOS = ["device", "unauthorized", "offline", "connecting"];

function ehWifi(serial) {
  return /:\d+$/.test(serial) || String(serial).includes("_adb-tls-");
}

/** Primeiro aparelho pronto. Prefere USB; Wi-Fi so se nao houver cabo. */
export async function primeiroDispositivo() {
  const saida = await adb(["devices", "-l"]);
  const prontos = [];
  for (const linha of saida.split(/\r?\n/)) {
    const texto = linha.trim();
    if (!texto || texto.startsWith("List of devices") || texto.startsWith("*")) continue;

    // O serial pode ter espaco: quando duas instancias mDNS tem o mesmo
    // nome, o adb desambigua e a linha vira
    //   adb-RQ...-372ZY9 (2)._adb-tls-connect._tcp   device  model:SM_S938B
    // Ancorar no estado evita ler o pedaco errado como serial.
    const partes = texto.split(/\s+/);
    const indice = partes.findIndex((p) => ESTADOS.includes(p));
    if (indice < 1 || partes[indice] !== "device") continue;

    const serial = partes.slice(0, indice).join(" ");
    const modelo = partes.slice(indice + 1).find((p) => p.startsWith("model:"))?.slice(6) ?? null;
    prontos.push({
      serial,
      modelo: modelo ? modelo.replace(/_/g, " ") : null,
      wifi: ehWifi(serial),
    });
  }
  if (prontos.length === 0) return null;

  const usb = prontos.find((d) => !d.wifi);
  if (usb) {
    // Com cabo ativo, corta Wi-Fi/mDNS do mesmo aparelho pra nao competir
    for (const w of prontos.filter((d) => d.wifi)) {
      try {
        await adb(["disconnect", w.serial]);
      } catch {
        /* ignore */
      }
    }
    return { serial: usb.serial, modelo: usb.modelo };
  }

  const escolhido = prontos[0];
  return { serial: escolhido.serial, modelo: escolhido.modelo };
}

/** Conecta no endpoint anunciado por mDNS. A porta muda toda vez, por isso nunca fixamos. */
export async function conectarPorMdns() {
  for (const servico of await servicosMdns()) {
    if (!servico.tipo.startsWith("_adb-tls-connect")) continue;
    const saida = await adb(["connect", servico.endpoint]);
    if (/connected to/i.test(saida)) return servico.endpoint;
  }
  return null;
}

/* ---------------------------------------------------------------- *
 * scrcpy
 * ---------------------------------------------------------------- */

function par(n) {
  return n - (n % 2);
}

/** Crop central width:height:x:y pra proporcao alvo (9:16 no OBS). */
export function cropParaProporcao(width, height, aspectW, aspectH) {
  const alvo = aspectW / aspectH;
  const atual = width / height;
  let cropW = width;
  let cropH = height;
  let x = 0;
  let y = 0;

  if (atual > alvo) {
    cropW = par(Math.round(height * alvo));
    x = par(Math.floor((width - cropW) / 2));
  } else if (atual < alvo) {
    cropH = par(Math.round(width / alvo));
    y = par(Math.floor((height - cropH) / 2));
  }

  return `${cropW}:${cropH}:${x}:${y}`;
}

/** Le wm size do aparelho. Prefere Override size quando existe. */
export async function tamanhoTela(serial) {
  const saida = await adb(["-s", serial, "shell", "wm", "size"]);
  const override = saida.match(/Override size:\s*(\d+)x(\d+)/i);
  const physical = saida.match(/Physical size:\s*(\d+)x(\d+)/i);
  const achado = override ?? physical;
  if (!achado) return null;
  return { width: Number(achado[1]), height: Number(achado[2]) };
}

/**
 * Args padrao: resolucao nativa do celular.
 * Sem crop, sem max-size/fps/bitrate (o aparelho define).
 * --stay-awake evita que a tela apague durante o uso.
 */
export async function argsObsPadrao(_serial) {
  void _serial;
  return ["--stay-awake"];
}

export function abrirScrcpy(serial, argumentosExtras = []) {
  const bin = scrcpyBin();
  if (!bin) throw new Error("scrcpy nao encontrado.");
  return spawn(
    bin,
    ["-s", serial, "--window-title", "Celular no PC - caducosilva", ...argumentosExtras],
    {
      stdio: "inherit",
      // o scrcpy le ADB do ambiente; sem isso ele pode pegar um adb
      // diferente do nosso e brigar pelo servidor da porta 5037
      env: { ...process.env, ADB: adbBin() },
    },
  );
}

export function cabecalho(titulo) {
  console.log("");
  console.log(cor.ciano(`${titulo} . criado por caducosilva . contato: abobicarlo@gmail.com`));
  console.log(cor.fraco("doacoes via PIX: f74458dc-2a36-49bd-9250-1cef4365ebb8"));
  console.log("");
}
