#!/usr/bin/env node
/* ------------------------------------------------------------------ *
 * Celular no PC . criado por caducosilva . contato: abobicarlo@gmail.com
 *
 * Nucleo do launcher, igual no Windows e no Linux. Ele:
 *   1. instala as dependencias na primeira vez;
 *   2. acha uma porta livre (nunca fica presa na 3000 ocupada);
 *   3. sobe o painel preso em 127.0.0.1;
 *   4. abre o navegador padrao do usuario;
 *   5. derruba tudo quando esta janela fecha, liberando a porta.
 *
 * O passo 5 e o motivo deste arquivo existir: o servidor roda como FILHO
 * deste processo, no mesmo primeiro plano. Fechar a janela manda SIGHUP
 * (ou fecha o console no Windows) e a limpeza abaixo mata o grupo inteiro.
 * ------------------------------------------------------------------ */

import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const EH_WINDOWS = process.platform === "win32";

const PORTA_PREFERIDA = 3000;
const ULTIMA_PORTA = 3020;
const SEGUNDOS_PRA_SUBIR = 90;

const cor = {
  ciano: (t) => `\x1b[36m${t}\x1b[0m`,
  verde: (t) => `\x1b[32m${t}\x1b[0m`,
  amarelo: (t) => `\x1b[33m${t}\x1b[0m`,
  vermelho: (t) => `\x1b[31m${t}\x1b[0m`,
  fraco: (t) => `\x1b[90m${t}\x1b[0m`,
};

/* ---------------------------------------------------------------- *
 * Porta livre
 * ---------------------------------------------------------------- */

function portaEstaLivre(porta) {
  return new Promise((resolve) => {
    const teste = net.createServer();
    teste.once("error", () => resolve(false));
    teste.once("listening", () => teste.close(() => resolve(true)));
    teste.listen(porta, "127.0.0.1");
  });
}

/**
 * Procura um painel DESTE projeto ja no ar.
 *
 * Existe porque o `next dev` se recusa a subir uma segunda vez na mesma
 * pasta ("Another next dev server is already running"), mesmo em outra
 * porta. Entao, se ja tem painel rodando, a gente so abre o navegador
 * nele em vez de falhar.
 *
 * O /api/status serve de assinatura: confirma que quem atende a porta e
 * este app, e nao outra coisa qualquer do usuario.
 */
async function acharPainelNoAr() {
  for (let porta = PORTA_PREFERIDA; porta <= ULTIMA_PORTA; porta++) {
    if (await portaEstaLivre(porta)) continue; // ninguem escutando
    try {
      const resposta = await fetch(`http://127.0.0.1:${porta}/api/status`, {
        signal: AbortSignal.timeout(1500),
      });
      if (!resposta.ok) continue;
      const corpo = await resposta.json();
      if (corpo && typeof corpo === "object" && "adb" in corpo && "platform" in corpo) {
        return porta;
      }
    } catch {
      // porta ocupada por outra coisa, segue procurando
    }
  }
  return null;
}

async function acharPorta() {
  for (let porta = PORTA_PREFERIDA; porta <= ULTIMA_PORTA; porta++) {
    if (await portaEstaLivre(porta)) return porta;
  }
  // Faixa toda ocupada: pede uma efemera pro proprio sistema.
  return new Promise((resolve, reject) => {
    const teste = net.createServer();
    teste.once("error", reject);
    teste.listen(0, "127.0.0.1", () => {
      const { port } = teste.address();
      teste.close(() => resolve(port));
    });
  });
}

/* ---------------------------------------------------------------- *
 * Navegador padrao
 * ---------------------------------------------------------------- */

function abrirNavegador(url) {
  const [comando, argumentos] = EH_WINDOWS
    ? ["cmd", ["/c", "start", "", url]]
    : process.platform === "darwin"
      ? ["open", [url]]
      : ["xdg-open", [url]];

  try {
    // Solto de proposito: o navegador nao pode morrer junto com o painel.
    spawn(comando, argumentos, { stdio: "ignore", detached: true }).unref();
    return true;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- *
 * Espera o painel responder
 * ---------------------------------------------------------------- */

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function esperarSubir(url, segundos) {
  for (let tentativa = 0; tentativa < segundos; tentativa++) {
    if (servidor?.exitCode !== null && servidor?.exitCode !== undefined) return false;
    try {
      const resposta = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (resposta.ok) return true;
    } catch {
      // ainda subindo
    }
    await esperar(1000);
  }
  return false;
}

/* ---------------------------------------------------------------- *
 * Limpeza: mata o servidor e libera a porta
 * ---------------------------------------------------------------- */

let servidor = null;
let jaLimpou = false;

function limpar() {
  if (jaLimpou) return;
  jaLimpou = true;
  if (!servidor || servidor.exitCode !== null) return;

  if (EH_WINDOWS) {
    // /T pega os processos filhos que o next dev abre.
    spawnSync("taskkill", ["/pid", String(servidor.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }

  // No Linux/macOS o servidor esta num grupo proprio (detached), entao o
  // PID negativo derruba o next e os workers dele de uma vez.
  try {
    process.kill(-servidor.pid, "SIGTERM");
  } catch {
    try {
      servidor.kill("SIGTERM");
    } catch {
      /* ja morreu */
    }
  }
}

function instalarLimpeza() {
  process.on("exit", limpar);
  for (const sinal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
    process.on(sinal, () => {
      limpar();
      process.exit(0);
    });
  }
  // Fechar a janela do terminal tambem fecha o stdin.
  process.stdin.on("end", () => {
    limpar();
    process.exit(0);
  });
}

/* ---------------------------------------------------------------- *
 * Principal
 * ---------------------------------------------------------------- */

async function principal() {
  console.log("");
  console.log(cor.ciano("Celular no PC . criado por caducosilva . contato: abobicarlo@gmail.com"));
  console.log(cor.fraco("doacoes via PIX: f74458dc-2a36-49bd-9250-1cef4365ebb8"));
  console.log("");

  if (!fs.existsSync(path.join(RAIZ, "package.json"))) {
    console.log(cor.vermelho("ERRO: nao achei a pasta do projeto."));
    console.log("Deixe este arquivo dentro da pasta 'scripts' do projeto.");
    process.exitCode = 1;
    return;
  }

  // 1. dependencias
  if (!fs.existsSync(path.join(RAIZ, "node_modules"))) {
    console.log(cor.amarelo("Primeira execucao: baixando as dependencias."));
    console.log(cor.fraco("Isso demora alguns minutos. Nas proximas vezes abre na hora."));
    console.log("");
    const npm = spawnSync(EH_WINDOWS ? "npm.cmd" : "npm", ["install", "--no-fund", "--no-audit"], {
      cwd: RAIZ,
      stdio: "inherit",
      shell: EH_WINDOWS,
    });
    if (npm.status !== 0) {
      console.log("");
      console.log(cor.vermelho("ERRO: o npm install falhou. Confira sua conexao e tente de novo."));
      process.exitCode = 1;
      return;
    }
    console.log("");
  }

  // 2. ja tem painel no ar? entao so abre o navegador nele
  const portaEmUso = await acharPainelNoAr();
  if (portaEmUso !== null) {
    const urlEmUso = `http://127.0.0.1:${portaEmUso}`;
    console.log(cor.verde(`O painel ja estava aberto em ${urlEmUso}.`));
    if (!abrirNavegador(urlEmUso)) {
      console.log(cor.amarelo(`Abra o endereco na mao: ${urlEmUso}`));
    }
    console.log("");
    console.log(cor.fraco("Quem desliga ele e a janela que o abriu, nao esta."));
    console.log("");
    return;
  }

  // 3. porta livre
  const porta = await acharPorta();
  const url = `http://127.0.0.1:${porta}`;
  if (porta !== PORTA_PREFERIDA) {
    console.log(cor.fraco(`A porta ${PORTA_PREFERIDA} estava ocupada, usando a ${porta}.`));
  }

  // 4. sobe o painel
  console.log(cor.verde("Ligando o painel..."));

  // Chamamos o next por dentro do node: assim funciona igual nos dois
  // sistemas, sem depender de .cmd nem de shell.
  const nextBin = path.join(RAIZ, "node_modules", "next", "dist", "bin", "next");
  servidor = spawn(process.execPath, [nextBin, "dev", "-H", "127.0.0.1", "-p", String(porta)], {
    cwd: RAIZ,
    stdio: ["ignore", "inherit", "inherit"],
    detached: !EH_WINDOWS, // grupo proprio, pra conseguir matar a arvore toda
    env: { ...process.env, PORT: String(porta) },
  });

  instalarLimpeza();

  servidor.on("exit", (codigo) => {
    // Se o servidor cair sozinho, o launcher cai junto (nao deixa porta presa).
    if (!jaLimpou) {
      console.log("");
      console.log(cor.vermelho(`O painel encerrou (codigo ${codigo ?? 0}).`));
      process.exit(codigo ?? 0);
    }
  });

  // 5. espera e abre o navegador
  const subiu = await esperarSubir(url, SEGUNDOS_PRA_SUBIR);
  if (!subiu) {
    console.log("");
    console.log(cor.vermelho("O painel demorou demais pra abrir. Veja as mensagens acima."));
    limpar();
    process.exitCode = 1;
    return;
  }

  const abriu = abrirNavegador(url);
  console.log("");
  console.log(cor.verde(`Pronto! O painel esta em ${url}`));
  if (!abriu) {
    console.log(cor.amarelo("Nao consegui abrir o navegador sozinho. Abra o endereco acima na mao."));
  }
  console.log("");
  console.log(cor.fraco("No celular: Config > Opcoes do desenvolvedor > Depuracao sem fio"));
  console.log(cor.fraco("Celular e PC precisam estar na mesma rede Wi-Fi."));
  console.log("");
  console.log(cor.amarelo("Deixe ESTA janela aberta enquanto estiver usando o painel."));
  console.log(cor.fraco("Fechar a janela (ou Ctrl+C) desliga o painel e libera a porta."));
  console.log("");
}

principal().catch((erro) => {
  console.log("");
  console.log(cor.vermelho(`ERRO inesperado: ${erro?.message ?? erro}`));
  limpar();
  process.exitCode = 1;
});
