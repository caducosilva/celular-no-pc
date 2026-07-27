"use client";

import { useCallback, useEffect, useState } from "react";

import DevicePanel from "@/components/DevicePanel";
import MirrorPanel from "@/components/MirrorPanel";
import PairPanel from "@/components/PairPanel";
import StatusPill from "@/components/StatusPill";
import { BRAND } from "@/lib/brand";
import type { Device, ToolStatus } from "@/lib/types";

export default function Home() {
  const [status, setStatus] = useState<ToolStatus | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);

  const carregarDevices = useCallback(async () => {
    try {
      const resposta = await fetch("/api/devices");
      if (!resposta.ok) return;
      const dados = await resposta.json();
      setDevices(dados.devices ?? []);
    } catch {
      /* servidor caiu ou adb sumiu: mantem o estado anterior */
    }
  }, []);

  useEffect(() => {
    fetch("/api/status")
      .then((resposta) => resposta.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    const primeira = window.setTimeout(carregarDevices, 0);
    const timer = window.setInterval(carregarDevices, 4000);
    return () => {
      window.clearTimeout(primeira);
      window.clearInterval(timer);
    };
  }, [carregarDevices]);

  const conectado = devices.find((device) => device.state === "device") ?? null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-28 pt-12 sm:px-8">
      <header className="mb-10">
        <p className="mb-3 text-xs uppercase tracking-[0.35em] text-[var(--moonlight)]">
          {BRAND.name}
        </p>
        <h1
          className="gradient-text text-4xl font-black leading-tight sm:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {BRAND.appName}
        </h1>
        <p className="mt-3 max-w-xl text-[var(--moonlight)]">{BRAND.tagline}</p>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <StatusPill tone={status?.adb.found ? "ok" : status ? "bad" : "idle"}>
            {status?.adb.found ? "adb pronto" : status ? "adb não encontrado" : "verificando"}
          </StatusPill>
          <StatusPill tone={status?.scrcpy.found ? "ok" : status ? "bad" : "idle"}>
            {status?.scrcpy.found
              ? "scrcpy pronto"
              : status
                ? "scrcpy não encontrado"
                : "verificando"}
          </StatusPill>
          <StatusPill tone={conectado ? "ok" : "idle"}>
            {conectado ? (conectado.model ?? "celular conectado") : "sem celular"}
          </StatusPill>
        </div>
      </header>

      {status && !status.adb.found && (
        <p className="mb-8 rounded-xl border border-[color-mix(in_srgb,var(--dragon-red)_55%,transparent)] bg-[color-mix(in_srgb,var(--dragon-red)_16%,transparent)] px-5 py-4 text-sm">
          Não achei o <strong>adb</strong> neste computador. Instale as Platform Tools e recarregue
          a página: <code className="text-[var(--starlight)]">winget install Google.PlatformTools</code>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <DevicePanel devices={devices} onRefresh={carregarDevices} />
          <PairPanel onPaired={carregarDevices} />
        </div>
        <MirrorPanel device={conectado} scrcpyOk={Boolean(status?.scrcpy.found)} />
      </div>

      <footer className="mt-12 border-t border-[var(--void)] pt-6 text-xs text-[var(--moonlight)]">
        <p>
          Criado por{" "}
          <a
            className="text-[var(--starlight)] underline decoration-[var(--void)] underline-offset-4"
            href={BRAND.github}
            target="_blank"
            rel="noreferrer noopener"
          >
            {BRAND.name}
          </a>{" "}
          · {BRAND.contact}
        </p>
        <p className="mt-1">
          Curtiu? Doações via PIX (chave aleatória):{" "}
          <span className="text-[var(--starlight)]">{BRAND.pixKey}</span>
        </p>
      </footer>
    </main>
  );
}
