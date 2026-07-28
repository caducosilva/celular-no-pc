#!/usr/bin/env node
/* ------------------------------------------------------------------ *
 * Parear Celular . criado por caducosilva . contato: abobicarlo@gmail.com
 *
 * Pareia por QR code sem abrir o painel. O QR e desenhado direto no
 * terminal, nada de Python nem de abrir visualizador de imagem.
 * ------------------------------------------------------------------ */

import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import {
  adb,
  adbBin,
  cabecalho,
  conectarPorMdns,
  cor,
  esperar,
  garantirMdns,
  primeiroDispositivo,
  servicosMdns,
} from "./lib-adb.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(RAIZ, "package.json"));

const TIMEOUT_MS = 3 * 60 * 1000;
const POLL_MS = 1500;
const ALFABETO = "abcdefghijkmnpqrstuvwxyz23456789";

function token(tamanho) {
  const bytes = randomBytes(tamanho);
  let saida = "";
  for (let i = 0; i < tamanho; i++) saida += ALFABETO[bytes[i] % ALFABETO.length];
  return saida;
}

async function principal() {
  cabecalho("Parear Celular");

  if (!adbBin()) {
    console.log(cor.vermelho("ERRO: nao achei o adb."));
    console.log("  Instale com:  sudo apt install android-tools-adb");
    console.log(cor.fraco("  De preferencia use as Platform Tools oficiais: elas tem mDNS."));
    process.exitCode = 1;
    return;
  }

  // Ja esta conectado? Entao nao precisa parear de novo.
  const jaTem = await primeiroDispositivo();
  if (jaTem) {
    console.log(cor.verde(`O celular JA esta pareado e conectado: ${jaTem.serial}`));
    console.log("Nao precisa parear. Use o atalho 2 pra abrir o espelhamento.");
    return;
  }

  const saude = await garantirMdns();
  if (!saude.ok) {
    console.log(cor.vermelho("ERRO: este adb nao tem descoberta mDNS."));
    console.log("Sem mDNS o pareamento por QR nao funciona, o celular fica esperando pra sempre.");
    console.log("Instale as Platform Tools oficiais do Android e rode de novo:");
    console.log(cor.fraco("  https://developer.android.com/tools/releases/platform-tools"));
    process.exitCode = 1;
    return;
  }
  console.log(cor.fraco(`mDNS: ${saude.daemon}`));

  // O Android le `WIFI:T:ADB;S:<nome>;P:<senha>;;` e passa a anunciar um
  // servico mDNS cujo nome de instancia e exatamente esse <nome>.
  const nome = `ADB_caducosilva_${token(6)}`;
  const senha = token(12);
  const QRCode = require("qrcode");
  const desenho = await QRCode.toString(`WIFI:T:ADB;S:${nome};P:${senha};;`, {
    type: "terminal",
    small: true,
    errorCorrectionLevel: "M",
  });

  console.log("");
  console.log(cor.amarelo("No celular abra:"));
  console.log("  Config > Opcoes do desenvolvedor > Depuracao sem fio");
  console.log("  > Parear dispositivo com codigo QR");
  console.log("");
  console.log(desenho);
  console.log(cor.amarelo("Aponte a camera pro QR acima. Eu pareio sozinho."));
  console.log(cor.fraco("(ate 3 minutos de espera, Ctrl+C pra cancelar)"));
  console.log("");

  const limite = Date.now() + TIMEOUT_MS;
  let tentativas = 0;

  while (Date.now() < limite) {
    const endpoint = (await servicosMdns()).find(
      (s) => s.instancia === nome && s.tipo.startsWith("_adb-tls-pairing"),
    )?.endpoint;

    if (endpoint) {
      console.log(cor.fraco(`QR lido pelo celular (${endpoint}). Pareando...`));
      tentativas++;
      const saida = await adb(["pair", endpoint, senha], 30000);

      if (/Successfully paired/i.test(saida)) {
        console.log(cor.verde("Pareado! Conectando..."));
        for (let i = 0; i < 12; i++) {
          await conectarPorMdns();
          const aparelho = await primeiroDispositivo();
          if (aparelho) {
            console.log("");
            console.log(cor.verde(`PRONTO! ${aparelho.modelo ?? "Android"}, ${aparelho.serial}`));
            console.log("Use o atalho 2 pra abrir o espelhamento.");
            return;
          }
          await esperar(POLL_MS);
        }
        console.log(cor.vermelho("Pareou, mas nao conectou. Rode este atalho de novo."));
        process.exitCode = 1;
        return;
      }

      if (tentativas >= 3) {
        console.log(cor.vermelho("O pareamento foi recusado 3 vezes."));
        console.log("Cancele no aparelho e rode este atalho de novo pra gerar um QR novo.");
        process.exitCode = 1;
        return;
      }
      console.log(cor.amarelo(`Nao pareou (tentativa ${tentativas} de 3). Tentando de novo...`));
    }

    await esperar(POLL_MS);
  }

  console.log("");
  console.log(cor.vermelho("Nao pareou dentro do tempo."));
  console.log("Checklist:");
  console.log("  - PC e celular na MESMA rede Wi-Fi (rede de convidado nao funciona)");
  console.log("  - Depuracao sem fio LIGADA no celular");
  console.log("  - Isolamento de clientes / AP isolation desligado no roteador");
  process.exitCode = 1;
}

principal().catch((erro) => {
  console.log(cor.vermelho(`ERRO inesperado: ${erro?.message ?? erro}`));
  process.exitCode = 1;
});
