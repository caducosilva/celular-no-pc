"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import StatusPill from "@/components/StatusPill";
import type { PairingSession } from "@/lib/types";

const PASSOS = [
  "Config > Opções do desenvolvedor > Depuração sem fio",
  "Toque em Parear dispositivo com código QR",
  "Aponte a câmera para o código abaixo",
];

function restante(expiresAt: number): string {
  const segundos = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
  const minutos = Math.floor(segundos / 60);
  return `${minutos}:${String(segundos % 60).padStart(2, "0")}`;
}

export default function PairPanel({ onPaired }: { onPaired: () => void }) {
  const [session, setSession] = useState<PairingSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, forceTick] = useState(0);
  const jaAvisou = useRef(false);

  const iniciar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    jaAvisou.current = false;
    try {
      const resposta = await fetch("/api/pair", { method: "POST" });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.error ?? "Falha ao gerar o QR code.");
      setSession(dados.session);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao gerar o QR code.");
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelar = useCallback(async () => {
    await fetch("/api/pair", { method: "DELETE" });
    setSession(null);
  }, []);

  // acompanha o pareamento enquanto ele estiver em andamento
  useEffect(() => {
    if (!session) return;
    if (session.phase !== "waiting" && session.phase !== "pairing") return;

    const timer = window.setInterval(async () => {
      forceTick((n) => n + 1); // atualiza o contador regressivo
      const resposta = await fetch("/api/pair");
      const dados = await resposta.json();
      if (dados.session) setSession(dados.session);
    }, 1200);

    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (session?.phase === "connected" && !jaAvisou.current) {
      jaAvisou.current = true;
      onPaired();
    }
  }, [session?.phase, onPaired]);

  const emAndamento = session?.phase === "waiting" || session?.phase === "pairing";

  return (
    <section className="panel p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2
          className="text-lg font-bold tracking-wide"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Parear por QR code
        </h2>
        {session && (
          <StatusPill
            tone={
              session.phase === "connected"
                ? "ok"
                : session.phase === "pairing"
                  ? "warn"
                  : session.phase === "waiting"
                    ? "idle"
                    : "bad"
            }
          >
            {session.phase === "waiting" && `aguardando · ${restante(session.expiresAt)}`}
            {session.phase === "pairing" && "pareando"}
            {session.phase === "connected" && "pareado"}
            {session.phase === "timeout" && "expirou"}
            {session.phase === "error" && "erro"}
            {session.phase === "cancelled" && "cancelado"}
          </StatusPill>
        )}
      </header>

      <ol className="mb-5 space-y-2 text-sm text-[var(--moonlight)]">
        {PASSOS.map((passo, indice) => (
          <li key={passo} className="flex gap-3">
            <span
              className="mt-[1px] flex h-5 w-5 flex-none items-center justify-center rounded-full border border-[var(--void)] text-[0.65rem] font-bold text-[var(--starlight)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {indice + 1}
            </span>
            <span>{passo}</span>
          </li>
        ))}
      </ol>

      {session && emAndamento && (
        <div className="mb-5 flex flex-col items-center gap-3">
          <div className="rounded-2xl border border-[var(--void)] bg-[var(--starlight)] p-3 shadow-[0_0_50px_-12px_var(--glow-purple)]">
            <Image
              src={session.qrDataUrl}
              alt="QR code de pareamento da depuração sem fio"
              width={220}
              height={220}
              unoptimized
              className="h-[220px] w-[220px]"
            />
          </div>
          <p className="text-center text-sm text-[var(--moonlight)]">{session.message}</p>
        </div>
      )}

      {session && !emAndamento && (
        <p
          className="mb-5 rounded-lg border border-[var(--void)] bg-[var(--nebula-1)] px-4 py-3 text-sm"
          style={{
            color: session.phase === "connected" ? "var(--star-blue)" : "var(--moonlight)",
          }}
        >
          {session.message}
        </p>
      )}

      {erro && (
        <p className="mb-5 rounded-lg border border-[color-mix(in_srgb,var(--dragon-red)_55%,transparent)] bg-[color-mix(in_srgb,var(--dragon-red)_16%,transparent)] px-4 py-3 text-sm">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary" onClick={iniciar} disabled={loading || emAndamento}>
          {loading ? "Gerando..." : session ? "Gerar novo QR code" : "Gerar QR code"}
        </button>
        {emAndamento && (
          <button className="btn" onClick={cancelar}>
            Cancelar
          </button>
        )}
      </div>
    </section>
  );
}
