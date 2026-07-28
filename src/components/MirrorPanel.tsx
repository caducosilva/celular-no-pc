"use client";

import { useState } from "react";

import { comandoInstalar } from "@/lib/instalacao";
import type { Device, MirrorOptions } from "@/lib/types";

const RESOLUCOES = [
  { valor: 0, rotulo: "Original" },
  { valor: 1920, rotulo: "1920 px" },
  { valor: 1600, rotulo: "1600 px" },
  { valor: 1280, rotulo: "1280 px" },
  { valor: 1024, rotulo: "1024 px" },
];

const BITRATES = ["4M", "8M", "12M", "16M", "24M"];
const FPS = [0, 30, 60, 120];

const OPCOES: { chave: keyof MirrorOptions; rotulo: string; ajuda: string }[] = [
  {
    chave: "turnScreenOff",
    rotulo: "Desligar a tela do celular",
    ajuda: "economiza bateria enquanto você usa pelo PC",
  },
  {
    chave: "stayAwake",
    rotulo: "Manter o celular acordado",
    ajuda: "impede que a sessão caia por inatividade",
  },
  { chave: "noAudio", rotulo: "Sem áudio", ajuda: "espelha só o vídeo" },
  { chave: "alwaysOnTop", rotulo: "Janela sempre no topo", ajuda: "fica sobre as outras janelas" },
  {
    chave: "viewOnly",
    rotulo: "Somente visualizar",
    ajuda: "desliga o controle por teclado e mouse",
  },
];

export default function MirrorPanel({
  device,
  scrcpyOk,
  plataforma,
}: {
  device: Device | null;
  scrcpyOk: boolean;
  /** vem do /api/status; define o comando de instalacao sugerido */
  plataforma?: string;
}) {
  const [options, setOptions] = useState<MirrorOptions>({
    maxSize: 0,
    bitrate: "8M",
    fps: 0,
    stayAwake: true,
  });
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const alternar = (chave: keyof MirrorOptions) =>
    setOptions((atual) => ({ ...atual, [chave]: !atual[chave] }));

  async function espelhar() {
    setEnviando(true);
    setErro(null);
    setMensagem(null);
    try {
      const resposta = await fetch("/api/mirror", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...options, serial: device?.serial }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.error ?? "Falha ao abrir o espelhamento.");
      setMensagem("Janela de espelhamento aberta.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao abrir o espelhamento.");
    } finally {
      setEnviando(false);
    }
  }

  const bloqueado = !device || !scrcpyOk;

  return (
    <section className="card p-5">
      <h2 className="card-titulo mb-4">Espelhar</h2>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <label className="campo">
          Resolução
          <select
            value={options.maxSize ?? 0}
            onChange={(evento) =>
              setOptions((atual) => ({ ...atual, maxSize: Number(evento.target.value) }))
            }
          >
            {RESOLUCOES.map((item) => (
              <option key={item.valor} value={item.valor}>
                {item.rotulo}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          Bitrate
          <select
            value={options.bitrate}
            onChange={(evento) =>
              setOptions((atual) => ({ ...atual, bitrate: evento.target.value }))
            }
          >
            {BITRATES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          FPS máximo
          <select
            value={options.fps ?? 0}
            onChange={(evento) =>
              setOptions((atual) => ({ ...atual, fps: Number(evento.target.value) }))
            }
          >
            {FPS.map((item) => (
              <option key={item} value={item}>
                {item === 0 ? "Sem limite" : item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-5 space-y-0.5">
        {OPCOES.map((opcao) => (
          <label key={opcao.chave} className="option-row">
            <input
              type="checkbox"
              checked={Boolean(options[opcao.chave])}
              onChange={() => alternar(opcao.chave)}
            />
            <span className="flex flex-col">
              <span className="text-sm leading-snug">{opcao.rotulo}</span>
              <span className="text-xs text-[var(--texto-fraco)]">{opcao.ajuda}</span>
            </span>
          </label>
        ))}
      </div>

      {mensagem && <p className="aviso aviso-ok mb-4">{mensagem}</p>}
      {erro && <p className="aviso aviso-erro mb-4">{erro}</p>}

      <button className="btn btn-primary w-full" onClick={espelhar} disabled={bloqueado || enviando}>
        {enviando ? "Abrindo..." : "Abrir espelhamento"}
      </button>

      {!scrcpyOk && (
        <p className="mt-3 text-center text-xs text-[var(--texto-fraco)]">
          scrcpy não encontrado, instale com <code>{comandoInstalar(plataforma, "scrcpy")}</code>
        </p>
      )}
      {scrcpyOk && !device && (
        <p className="mt-3 text-center text-xs text-[var(--texto-fraco)]">
          Conecte ou pareie um celular primeiro.
        </p>
      )}
    </section>
  );
}
