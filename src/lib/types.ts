/**
 * Tipos compartilhados entre servidor e cliente.
 * Fica separado de `lib/adb.ts` porque aquele modulo importa `node:child_process`
 * e nao pode ser puxado por um Client Component.
 */

export type DeviceState = "device" | "unauthorized" | "offline" | "connecting";

export interface Device {
  serial: string;
  state: DeviceState;
  model: string | null;
  /** true quando o serial e um endpoint ip:porta ou um servico mDNS */
  wireless: boolean;
}

export interface MdnsService {
  instance: string;
  type: string;
  endpoint: string;
}

export interface MirrorOptions {
  /** limite de resolucao do lado maior, em px. 0 = original */
  maxSize?: number;
  /** bitrate de video, ex "8M" */
  bitrate?: string;
  fps?: number;
  /** desliga a tela do celular enquanto espelha */
  turnScreenOff?: boolean;
  /** mantem o celular acordado */
  stayAwake?: boolean;
  /** espelha sem audio */
  noAudio?: boolean;
  /** janela sempre no topo */
  alwaysOnTop?: boolean;
  /** somente visualizar, sem controlar */
  viewOnly?: boolean;
  /**
   * Corta o video no centro pra proporcao exata (ex: "9:16").
   * Celulares modernos (19.5:9 etc.) nao sao 9:16; sem o crop o OBS
   * captura a proporcao nativa e o enquadramento fica errado.
   */
  cropAspect?: "9:16";
  /** crop ja resolvido pro scrcpy: width:height:x:y */
  crop?: string;
  /** largura da janela na tela (px). Padrao 9:16 cabe no monitor (~506). */
  windowWidth?: number;
  /** altura da janela na tela (px). Padrao 9:16 cabe no monitor (~900). */
  windowHeight?: number;
  /** janela sem barra de titulo (cuidado: sem ela fica dificil arrastar/fechar) */
  borderless?: boolean;
}

export type PairingPhase =
  | "waiting"
  | "pairing"
  | "connected"
  | "error"
  | "timeout"
  | "cancelled";

export interface PairingSession {
  id: string;
  qrDataUrl: string;
  phase: PairingPhase;
  message: string;
  startedAt: number;
  expiresAt: number;
  serial: string | null;
}

export interface ToolStatus {
  adb: { found: boolean; path: string | null; version: string | null };
  scrcpy: {
    found: boolean;
    path: string | null;
    version: string | null;
    /** true quando a versao e antiga demais pra falar com Android recente */
    tooOld: boolean;
  };
  /** saude da descoberta mDNS, sem ela o pareamento por QR nao funciona */
  mdns: { ok: boolean; daemon: string | null; restarted: boolean; detail: string };
  platform: string;
}
