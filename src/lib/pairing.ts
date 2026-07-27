import { randomBytes } from "node:crypto";
import QRCode from "qrcode";

import {
  adb,
  connectViaMdns,
  firstReadyDevice,
  mdnsServices,
  PAIRING_SERVICE,
} from "@/lib/adb";
import type { PairingSession } from "@/lib/types";

export type { PairingPhase, PairingSession } from "@/lib/types";

/* ------------------------------------------------------------------ *
 * Pareamento por QR code
 *
 * O Android le um QR no formato `WIFI:T:ADB;S:<nome>;P:<senha>;;`.
 * Depois de ler, o aparelho anuncia um servico mDNS `_adb-tls-pairing._tcp`
 * cujo nome de instancia e exatamente o <nome> do QR — e ai basta rodar
 * `adb pair <ip:porta> <senha>`. E o mesmo fluxo do Android Studio.
 * ------------------------------------------------------------------ */

interface InternalSession extends PairingSession {
  name: string;
  password: string;
  cancelled: boolean;
}

const TIMEOUT_MS = 3 * 60 * 1000;
const POLL_MS = 1500;

// sobrevive ao hot reload do `next dev`
const store = globalThis as unknown as { __pairing?: InternalSession | null };

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function randomToken(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function publicView(session: InternalSession): PairingSession {
  // a senha do QR nunca sai do servidor
  const { name: _name, password: _password, cancelled: _cancelled, ...view } = session;
  void _name;
  void _password;
  void _cancelled;
  return view;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function startPairing(): Promise<PairingSession> {
  const name = `ADB_caducosilva_${randomToken(6)}`;
  const password = randomToken(12);
  const payload = `WIFI:T:ADB;S:${name};P:${password};;`;

  const qrDataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
    color: { dark: "#03010A", light: "#E8EAF6" },
  });

  const now = Date.now();
  const session: InternalSession = {
    id: randomToken(10),
    name,
    password,
    cancelled: false,
    qrDataUrl,
    phase: "waiting",
    message: "Escaneie o QR code com o celular.",
    startedAt: now,
    expiresAt: now + TIMEOUT_MS,
    serial: null,
  };

  store.__pairing = session;
  void watchPairing(session);

  return publicView(session);
}

async function watchPairing(session: InternalSession): Promise<void> {
  while (Date.now() < session.expiresAt) {
    if (session.cancelled) return;

    let endpoint: string | null = null;
    try {
      const services = await mdnsServices();
      endpoint =
        services.find(
          (s) => s.instance === session.name && s.type.startsWith(PAIRING_SERVICE.split(".")[0]),
        )?.endpoint ?? null;
    } catch (err) {
      session.phase = "error";
      session.message = err instanceof Error ? err.message : "Falha ao consultar o adb.";
      return;
    }

    if (endpoint) {
      session.phase = "pairing";
      session.message = `Celular encontrado em ${endpoint}. Pareando...`;

      const out = await adb(["pair", endpoint, session.password], 30_000);

      if (/Successfully paired/i.test(out)) {
        session.message = "Pareado! Conectando...";
        const serial = await connectAfterPairing();

        if (serial) {
          session.phase = "connected";
          session.message = "Celular conectado.";
          session.serial = serial;
        } else {
          session.phase = "error";
          session.message = "Pareou, mas nao consegui conectar. Tente novamente.";
        }
        return;
      }

      // pareamento pode falhar se o codigo expirar; volta a esperar
      session.phase = "waiting";
      session.message = "Nao consegui parear nesse QR. Gere um novo e tente de novo.";
    }

    await sleep(POLL_MS);
  }

  if (!session.cancelled && session.phase !== "connected") {
    session.phase = "timeout";
    session.message = "O QR code expirou. Gere um novo.";
  }
}

async function connectAfterPairing(): Promise<string | null> {
  for (let attempt = 0; attempt < 12; attempt++) {
    await connectViaMdns();
    const device = await firstReadyDevice();
    if (device) return device.serial;
    await sleep(POLL_MS);
  }
  return null;
}

export function getPairing(): PairingSession | null {
  const session = store.__pairing;
  return session ? publicView(session) : null;
}

export function cancelPairing(): void {
  const session = store.__pairing;
  if (!session) return;
  session.cancelled = true;
  session.phase = "cancelled";
  session.message = "Pareamento cancelado.";
}
