"use client";

import { useCallback, useEffect, useState } from "react";

import BrandMark from "@/components/BrandMark";
import DevicePanel from "@/components/DevicePanel";
import MirrorPanel from "@/components/MirrorPanel";
import PairPanel from "@/components/PairPanel";
import StatusPill from "@/components/StatusPill";
import ThemeToggle from "@/components/ThemeToggle";
import { BRAND } from "@/lib/brand";
import { comandoInstalar } from "@/lib/instalacao";
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

  // USB (cabo) tem prioridade; Wi-Fi so se nao houver USB pronto
  const conectado =
    devices.find((device) => device.state === "device" && !device.wireless) ??
    devices.find((device) => device.state === "device") ??
    null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <BrandMark />
        <ThemeToggle />
      </div>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{BRAND.appName}</h1>
        <p className="mt-2 max-w-prose text-[var(--texto-suave)]">{BRAND.tagline}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          <StatusPill tone={status?.adb.found ? "ok" : status ? "bad" : "idle"}>
            {status?.adb.found ? "adb pronto" : status ? "adb não encontrado" : "verificando"}
          </StatusPill>
          <StatusPill
            tone={
              !status ? "idle" : !status.scrcpy.found ? "bad" : status.scrcpy.tooOld ? "warn" : "ok"
            }
          >
            {!status
              ? "verificando"
              : !status.scrcpy.found
                ? "scrcpy não encontrado"
                : status.scrcpy.tooOld
                  ? `scrcpy ${status.scrcpy.version} desatualizado`
                  : "scrcpy pronto"}
          </StatusPill>
          <StatusPill tone={conectado ? "ok" : "idle"}>
            {conectado
              ? `${conectado.wireless ? "Wi-Fi" : "USB"}: ${conectado.model ?? "celular"}`
              : "sem celular"}
          </StatusPill>
        </div>
      </header>

      {status && !status.adb.found && (
        <p className="aviso aviso-erro mb-6">
          Não achei o <strong>adb</strong> neste computador. Instale e recarregue a página:{" "}
          <code>{comandoInstalar(status.platform, "adb")}</code>
        </p>
      )}

      {status?.scrcpy.found && status.scrcpy.tooOld && (
        <p className="aviso aviso-erro mb-6">
          <strong>scrcpy {status.scrcpy.version} é antigo demais.</strong> Essa versão não fala com
          Android recente e falha com <code>Could not retrieve device information</code>. Instale a
          2.0 ou mais nova: <code>{comandoInstalar(status.platform, "scrcpy")}</code>
        </p>
      )}

      {status?.adb.found && !status.mdns.ok && (
        <p className="aviso aviso-erro mb-6">
          <strong>Descoberta mDNS indisponível.</strong> Sem ela o pareamento por QR code não
          funciona: o celular fica esperando para sempre. {status.mdns.detail}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          <DevicePanel devices={devices} onRefresh={carregarDevices} />
          <PairPanel onPaired={carregarDevices} />
        </div>
        <MirrorPanel
          device={conectado}
          scrcpyOk={Boolean(status?.scrcpy.found)}
          plataforma={status?.platform}
        />
      </div>

      <footer className="mt-10 border-t border-[var(--borda)] pt-5 text-sm text-[var(--texto-fraco)]">
        <p>
          Criado por{" "}
          <a
            className="text-[var(--texto-suave)] underline underline-offset-2 hover:text-[var(--texto)]"
            href={BRAND.github}
            target="_blank"
            rel="noreferrer noopener"
          >
            {BRAND.name}
          </a>{" "}
          · {BRAND.contact}
        </p>
        <p className="mt-1 break-all">
          Curtiu? Doações via PIX (chave aleatória): {BRAND.pixKey}
        </p>
      </footer>
    </main>
  );
}
