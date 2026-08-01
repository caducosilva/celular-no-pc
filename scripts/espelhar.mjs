#!/usr/bin/env node
/* ------------------------------------------------------------------ *
 * Usar Celular no PC . criado por caducosilva . contato: abobicarlo@gmail.com
 *
 * Conecta num celular ja pareado e abre o espelhamento (scrcpy), sem
 * abrir o painel. Fechar a janela do scrcpy encerra.
 * ------------------------------------------------------------------ */

import {
  abrirScrcpy,
  adbBin,
  argsObsPadrao,
  cabecalho,
  conectarPorMdns,
  cor,
  esperar,
  garantirMdns,
  primeiroDispositivo,
  scrcpyBin,
} from "./lib-adb.mjs";

async function principal() {
  cabecalho("Usar Celular no PC");

  if (!adbBin()) {
    console.log(cor.vermelho("ERRO: nao achei o adb."));
    console.log("  Instale com:  sudo apt install android-tools-adb");
    process.exitCode = 1;
    return;
  }
  if (!scrcpyBin()) {
    console.log(cor.vermelho("ERRO: nao achei o scrcpy."));
    console.log("  Instale com:  sudo apt install scrcpy");
    process.exitCode = 1;
    return;
  }

  let aparelho = await primeiroDispositivo();

  if (!aparelho) {
    console.log(cor.fraco("Procurando o celular na rede..."));
    // A busca depende de mDNS; se o servidor adb em uso nao tiver, a
    // procura falharia em silencio.
    await garantirMdns();

    for (let i = 0; i < 8; i++) {
      await conectarPorMdns();
      aparelho = await primeiroDispositivo();
      if (aparelho) break;
      await esperar(1500);
    }
  }

  if (!aparelho) {
    console.log("");
    console.log(cor.vermelho("Nao achei o celular."));
    console.log("Checklist:");
    console.log("  - Depuracao sem fio LIGADA no celular");
    console.log("  - PC e celular na MESMA rede Wi-Fi");
    console.log("  - Se nunca pareou neste PC (ou trocou de rede), rode o atalho 1 primeiro");
    process.exitCode = 1;
    return;
  }

  console.log(cor.verde(`Conectado: ${aparelho.modelo ?? "Android"}, ${aparelho.serial}`));
  console.log(cor.fraco("Abrindo resolucao nativa do celular... (feche a janela pra encerrar)"));
  console.log("");

  // Nativo; extras da linha de comando vao depois (ex: --turn-screen-off).
  const extras = process.argv.slice(2);
  const base = await argsObsPadrao(aparelho.serial);
  const scrcpy = abrirScrcpy(aparelho.serial, [...base, ...extras]);

  await new Promise((resolve) => {
    scrcpy.on("exit", (codigo) => {
      if (codigo) process.exitCode = codigo;
      resolve();
    });
    scrcpy.on("error", (erro) => {
      console.log(cor.vermelho(`Falha ao abrir o scrcpy: ${erro.message}`));
      process.exitCode = 1;
      resolve();
    });
  });
}

principal().catch((erro) => {
  console.log(cor.vermelho(`ERRO inesperado: ${erro?.message ?? erro}`));
  process.exitCode = 1;
});
