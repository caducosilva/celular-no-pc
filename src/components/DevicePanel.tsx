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
    <section className="panel panel-glow p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2
          className="text-lg font-bold tracking-wide"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Dispositivos
        </h2>
        <StatusPill tone={devices.some((d) => d.state === "device") ? "ok" : "idle"}>
          {devices.length === 0
            ? "nenhum"
            : `${devices.length} ${devices.length === 1 ? "aparelho" : "aparelhos"}`}
        </StatusPill>
      </header>

      {devices.length === 0 ? (
        <p className="mb-5 rounded-lg border border-dashed border-[var(--void)] px-4 py-6 text-center text-sm text-[var(--moonlight)]">
          Nenhum celular conectado. Ligue a depuração sem fio e clique em Procurar,
          <br />
          ou pareie por QR code se for a primeira vez neste PC.
        </p>
      ) : (
        <ul className="mb-5 space-y-2">
          {devices.map((device) => (
            <li
              key={device.serial}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--void)] bg-[var(--nebula-1)] px-4 py-3"
            >
              <span className="flex flex-col">
                <span
                  className="text-sm font-semibold"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {device.model ?? "Android"}
                </span>
                <span className="max-w-[42ch] truncate text-xs text-[var(--moonlight)]">
                  {device.serial}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {device.wireless && (
                  <span className="pill text-[var(--moonlight)]">Wi-Fi</span>
                )}
                <StatusPill tone={device.state === "device" ? "ok" : "bad"}>
                  {ROTULO_ESTADO[device.state]}
                </StatusPill>
              </span>
            </li>
          ))}
        </ul>
      )}

      {erro && (
        <p className="mb-4 rounded-lg border border-[color-mix(in_srgb,var(--dragon-red)_55%,transparent)] bg-[color-mix(in_srgb,var(--dragon-red)_16%,transparent)] px-4 py-3 text-sm">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
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
