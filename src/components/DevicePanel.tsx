"use client";

import { useState } from "react";

import StatusPill from "@/components/StatusPill";
import type { Device } from "@/lib/types";

const ROTULO_ESTADO: Record<Device["state"], string> = {
  device: "pronto",
  unauthorized: "não autorizado",
  offline: "offline",
  connecting: "conectando",
};

export default function DevicePanel({
  devices,
  onRefresh,
}: {
  devices: Device[];
  onRefresh: () => void;
}) {
  const [ocupado, setOcupado] = useState<"connect" | "disconnect" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function conectar() {
    setOcupado("connect");
    setErro(null);
    try {
      const resposta = await fetch("/api/connect", { method: "POST" });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.error ?? "Não consegui conectar.");
      onRefresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui conectar.");
    } finally {
      setOcupado(null);
    }
  }

  async function desconectar() {
    setOcupado("disconnect");
    setErro(null);
    try {
      await fetch("/api/connect", { method: "DELETE" });
      onRefresh();
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="card p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="card-titulo">Dispositivos</h2>
        <StatusPill tone={devices.some((d) => d.state === "device") ? "ok" : "idle"}>
          {devices.length === 0
            ? "nenhum"
            : `${devices.length} ${devices.length === 1 ? "aparelho" : "aparelhos"}`}
        </StatusPill>
      </header>

      {devices.length === 0 ? (
        <p className="mb-4 rounded-lg border border-dashed border-[var(--borda-forte)] px-4 py-6 text-center text-sm text-[var(--texto-fraco)]">
          Nenhum celular. Conecte o cabo com depuração USB, ou use Wi-Fi (Procurar na rede / QR) se
          não tiver cabo.
        </p>
      ) : (
        <ul className="mb-4 space-y-2">
          {devices.map((device) => (
            <li
              key={device.serial}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--borda)] bg-[var(--superficie-2)] px-3 py-2.5"
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{device.model ?? "Android"}</span>
                <span className="truncate text-xs text-[var(--texto-fraco)]">{device.serial}</span>
              </span>
              <span className="flex flex-none items-center gap-2">
                {device.wireless ? (
                  <span className="pill">Wi-Fi</span>
                ) : (
                  <span className="pill">USB</span>
                )}
                <StatusPill tone={device.state === "device" ? "ok" : "bad"}>
                  {ROTULO_ESTADO[device.state]}
                </StatusPill>
              </span>
            </li>
          ))}
        </ul>
      )}

      {erro && <p className="aviso aviso-erro mb-4">{erro}</p>}

      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={conectar} disabled={ocupado !== null}>
          {ocupado === "connect" ? "Procurando..." : "Procurar na rede"}
        </button>
        <button
          className="btn btn-danger"
          onClick={desconectar}
          disabled={ocupado !== null || devices.length === 0}
        >
          Desconectar
        </button>
      </div>
    </section>
  );
}
