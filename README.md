# celular-no-pc

Aplicação web e utilitário para espelhamento e controle de dispositivos celulares no computador.

---

## O problema

1. **O que é:** O **celular-no-pc** é um painel web interativo desenvolvido em Next.js para gerenciamento e controle de smartphones.
2. **Qual necessidade ataca:** Facilita a visualização da tela e arquivos do celular na tela do computador.
3. **Por que existe:** Soluções comerciais de espelhamento exigem assinaturas caras ou possuem lag excessivo.
4. **Qual o objetivo:** Prover uma interface gratuita e fluida para controlar o celular pelo PC.

---

## Recursos

- ✅ **Conexão Rápida:** Conecta o computador ao celular pela rede local ou USB.
- ✅ **Interface Web Otimizada:** Painel construído em Next.js e TypeScript.
- ✅ **Controle por Teclado e Mouse:** Interaja com apps do celular diretamente no PC.

---

## Instalação

### Pré-requisitos
- Node.js v18.0.0 ou superior

### Instalação
```bash
git clone https://github.com/caducosilva/celular-no-pc.git
cd celular-no-pc
npm install
```

---

## Como usar

Execute o servidor de desenvolvimento:
```bash
npm run dev
```
Abra o navegador em `http://localhost:3000`.

---

## Configuração

| Variável | Descrição | Padrão |
|---|---|---|
| `PORT` | Porta de execução do servidor Next.js | `3000` |

---

## Detalhes técnicos relevantes

- **Framework:** Next.js 15 (App Router) + TypeScript.

---

## Testes

Executar verificações de lint e construção:
```bash
npm run build
```

---

## Problemas comuns

| Mensagem de erro | Causa provável | Solução |
|---|---|---|
| `Device not found` | Dispositivo não conectado ou depuração USB desativada | Ative a Depuração USB nas Opções de Desenvolvedor do Android |

---

## Apoie o projeto

Se este projeto te ajudou, considere fazer uma doação via PIX:

```
f74458dc-2a36-49bd-9250-1cef4365ebb8
```

---

## Licença

[MIT](LICENSE) — Carlos Eduardo
