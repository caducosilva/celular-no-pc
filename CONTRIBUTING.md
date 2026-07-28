# Celular no PC, notas para agentes

Painel local (Next.js + TypeScript) que pareia por QR code e espelha um Android
via `adb` + `scrcpy`. Roda inteiramente na máquina do usuário.

## Armadilhas de ambiente (leia antes de mexer em adb/scrcpy)

Estas três já quebraram o app de formas silenciosas e difíceis de diagnosticar.
Todas têm proteção no código, **não remova sem entender o porquê.**

### 1. O `adb` da distro não tem mDNS

Existe **um único servidor adb por máquina** (porta 5037) e quem subiu primeiro
manda. O pacote `android-tools-adb` do Debian/Ubuntu/Mint é compilado sem
descoberta mDNS, e o `adb` que vem junto do scrcpy também.

O detalhe cruel: essa build se identifica como `1.0.41`, a **mesma** versão de
protocolo das Platform Tools. Como as versões batem, o cliente novo *não*
reinicia o servidor velho, apenas conversa com um servidor cego, onde
`adb mdns services` responde vazio para sempre.

Sintoma: o celular lê o QR e fica eternamente em *"pareando dispositivo"*.

Proteção: `ensureMdnsReady()` em `src/lib/adb.ts` roda `adb mdns check` e
reinicia o servidor com o adb correto se preciso. É chamada no `/api/status`
(ao abrir o painel) e no início do pareamento.

Por isso a ordem de `ADB_CANDIDATES` importa: **Platform Tools antes de
`/usr/bin`**.

### 2. O `scrcpy` da distro é velho demais

Debian/Ubuntu/Mint empacotam o `scrcpy 1.25`, de 2022. Ele não fala com Android
recente (falha com `Could not retrieve device information`) e nem conhece flags
que o painel usa, como `--no-audio` e `--video-bit-rate`.

Proteção: `scrcpyVersion()` lê a versão e o painel avisa quando é menor que
`SCRCPY_MINIMO`. `SCRCPY_CANDIDATES` olha `~/.local/opt/scrcpy` e `~/.local/bin`
**antes** de `/usr/bin`, para a instalação manual ganhar da versão da distro.

Nunca sugira `apt install scrcpy`, veja `src/lib/instalacao.ts`.

### 3. O serial do adb pode conter espaço

Quando duas instâncias mDNS têm o mesmo nome, o adb desambigua e a linha vira:

```
adb-RQGYA01RTKF-372ZY9 (2)._adb-tls-connect._tcp   device  model:SM_S938B
```

Um `split(/\s+/)` cego lê `(2)._adb-tls-connect._tcp` como estado, não bate com
nenhum estado válido, e a linha é descartada, o painel diz "sem celular" com o
celular conectado.

`listDevices()` ancora no estado e monta o serial com o que vem antes. Mesma
lógica em `scripts/lib-adb.mjs`.

Relacionado: o mesmo aparelho pode aparecer duas vezes (via `ip:porta` e via
nome mDNS), quebrando qualquer `adb` sem `-s`. `dedupeDevices()` junta os dois
pelo `ro.serialno`, e só gasta chamada quando há mais de um aparelho pronto.

## Como rodar

```bash
./scripts/"0 - Abrir Painel.sh"     # Linux e macOS
```

O launcher acha uma porta livre (3000→3020, depois efêmera), sobe o painel,
abre o navegador padrão e **derruba tudo quando a janela fecha**. O servidor
roda como filho em primeiro plano de propósito, é isso que libera a porta.

Não use `nohup ... &`: o processo fica no mesmo grupo do shell e morre junto
com a sessão, deixando a porta presa. Foi o bug original.

O `next dev` recusa uma segunda instância na mesma pasta mesmo em outra porta,
então o launcher detecta um painel já no ar pelo `/api/status` e só abre outra
aba nele.

## Arquitetura

- `src/lib/adb.ts`, localiza binários, executa adb/scrcpy, saúde do mDNS.
  Importa `node:child_process`, então **não pode** ser importado por Client
  Component. Tipos compartilhados ficam em `src/lib/types.ts` por isso.
- `src/lib/pairing.ts`, máquina de estados do pareamento por QR.
- `src/proxy.ts`, trava tudo em loopback (o app executa binários locais).
- `scripts/painel.mjs`, launcher compartilhado por Windows e Linux.
- `scripts/lib-adb.mjs`, o mesmo conhecimento de adb, em JS puro, para os
  atalhos avulsos (que rodam fora do Next).

Os launchers `.bat` e `.sh` são casca fina: fazem só a checagem específica do
sistema e entregam para o script Node. Não duplique lógica neles.

## Convenções

- Interface e comentários em **português**; identificadores em português quando
  o código é novo (`carregarDevices`, `ensureMdnsReady` convive com o legado).
- Comentário explica **por quê**, não o quê, veja os blocos acima.
- Tema: tokens semânticos em `globals.css` (`--bg`, `--texto`, `--acento`...).
  Claro e escuro; nenhum componente sabe qual cor está em uso. Não volte com
  tema espacial, estrelas ou fontes decorativas.
- Antes de entregar: `npm run lint && npm run typecheck && npm run build`.

## Segredos

Nada de token, chave ou senha neste arquivo nem em qualquer arquivo do repo,
ele é versionado e vai para o GitHub. Autenticação de push: chave SSH em
`~/.ssh/id_ed25519` (precisa estar cadastrada em github.com/settings/keys) ou
`gh auth login`, que guarda no keyring do sistema.
