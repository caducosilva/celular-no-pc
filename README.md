# Celular no PC

Painel local para **parear por QR code, conectar e espelhar um celular Android no
computador — sem cabo**. Um front-end em Next.js + TypeScript por cima do `adb` e
do `scrcpy`, feito para quem cansou de decorar `adb pair 192.168.0.x:41234`.

> Roda inteiramente na sua máquina. Nada sai para a internet: o servidor só
> executa `adb` e `scrcpy` localmente.

---

## Por que existe

A depuração sem fio do Android é ótima, mas o fluxo manual é chato e cheio de
armadilhas:

- a **porta de pareamento e a porta de conexão são diferentes**, e as duas mudam
  toda vez que você liga a depuração sem fio;
- o `adb pair` exige um `IP:PORTA` completo — digitar só a porta devolve um
  críptico `protocol fault (couldn't read status message)`;
- no Windows, o `scrcpy` instalado via WinGet costuma morrer com
  `CreateProcessW() error 5 / Could not start adb server`, porque tenta usar o
  `adb.exe` empacotado junto dele.

Este projeto resolve os três: descobre os endpoints por **mDNS**, faz o
pareamento por **QR code** (o mesmo protocolo que o Android Studio usa) e força
o `scrcpy` a usar um `adb` que funciona, via variável de ambiente `ADB`.

## Recursos

- **Pareamento por QR code** — o app gera o QR, você aponta a câmera, ele detecta
  o aparelho na rede e pareia sozinho. Sem digitar código de 6 dígitos.
- **Descoberta automática por mDNS** — nunca mais anote `ip:porta`.
- **Reconexão em um clique** para aparelhos já pareados.
- **Espelhamento configurável** — resolução, bitrate, FPS, desligar a tela do
  celular, manter acordado, sem áudio, sempre no topo, somente visualizar.
- **Detecção dos binários** — encontra `adb` e `scrcpy` em vários caminhos comuns
  (Android SDK, WinGet, Homebrew, `/usr/bin`) e avisa se faltar algum.
- **Launcher de dois cliques** — no Windows e no Linux. Acha uma porta livre,
  abre o painel no navegador padrão e desliga tudo quando a janela fecha, sem
  digitar comando nenhum.
- **Interface clean, com tema claro e escuro** — segue o tema do sistema e
  respeita a troca manual, que fica salva no navegador.

## Como funciona o pareamento por QR

O Android lê um QR code com o payload `WIFI:T:ADB;S:<nome>;P:<senha>;;`. Depois
de ler, o aparelho anuncia na rede local um serviço mDNS `_adb-tls-pairing._tcp`
cujo nome de instância é exatamente o `<nome>` do QR. O servidor observa o
`adb mdns services`, acha esse endpoint e roda `adb pair <ip:porta> <senha>`.
Feito o pareamento, ele descobre o `_adb-tls-connect._tcp` e conecta.

A senha do QR é gerada aleatoriamente a cada sessão e **nunca é enviada ao
navegador** — só a imagem do QR sai do servidor.

## Começo rápido (dois cliques)

1. Baixe o projeto: [Code → Download ZIP](https://github.com/caducosilva/celular-no-pc/archive/refs/heads/main.zip)
   e extraia em qualquer pasta.
2. Abra a pasta `scripts` e dê **dois cliques** no arquivo do seu sistema:
   - **Windows** — `0 - Abrir Painel.bat`
   - **Linux e macOS** — `0 - Abrir Painel.sh` (escolha *Executar no terminal*)
3. Na primeira vez ele baixa as dependências e demora alguns minutos. Nas
   próximas vezes abre na hora.
4. O navegador padrão abre sozinho no painel.
5. No celular: **Configurações → Opções do desenvolvedor → Depuração sem fio**,
   na mesma rede Wi-Fi do PC (rede de convidado / *AP isolation* não funciona).

Pronto. O resto é clicar na interface.

**A janela que abriu o painel é o interruptor dele.** Enquanto ela estiver
aberta o painel funciona; ao fechá-la (ou com `Ctrl+C`) o servidor cai e a porta
é liberada na hora — nada fica preso rodando de fundo.

A porta também é escolhida sozinha: ele tenta a `3000` e, se estiver ocupada,
vai subindo até achar uma livre. Se o painel já estiver no ar, abrir o launcher
de novo só abre outra aba nele em vez de tentar subir um segundo servidor.

> No Linux, se os dois cliques não oferecerem *Executar no terminal*, marque o
> arquivo como executável (`chmod +x "scripts/0 - Abrir Painel.sh"`) ou rode-o
> pelo terminal.

> No Windows, se ele instalar o Node.js e o `npm` ainda não for reconhecido,
> feche a janela e abra o `.bat` de novo. É o Windows atualizando o PATH.

## Requisitos

Se preferir instalar à mão:

| Ferramenta | Windows | Linux (Debian/Ubuntu/Mint) | macOS |
| --- | --- | --- | --- |
| Node.js 20.9+ | <https://nodejs.org> | `sudo apt install nodejs` | `brew install node` |
| `adb` (Platform Tools) | `winget install Google.PlatformTools` | `sudo apt install android-tools-adb` | `brew install --cask android-platform-tools` |
| `scrcpy` | `winget install Genymobile.scrcpy` | `sudo apt install scrcpy` | `brew install scrcpy` |

O `.bat` do Windows ainda instala sozinho o que faltar via `winget`. No Linux e
no macOS o launcher apenas avisa o que está faltando e mostra o comando certo
da sua distro — instalar pacote de sistema sem pedir é chato demais.

Testado no Windows 11 e no Linux Mint, com um Galaxy S25 Ultra (Android 16).

## Uso (via terminal)

```bash
npm install
npm run dev
```

Abra <http://localhost:3000>.

1. **Dispositivos** — clique em *Procurar na rede*. Se o celular já foi pareado
   neste PC, ele conecta direto.
2. **Parear por QR code** — só na primeira vez (ou depois de trocar de rede).
   Gere o QR e escaneie com a opção *Parear dispositivo com código QR*.
3. **Espelhar** — escolha as opções e clique em *Abrir espelhamento*.

### Scripts

A pasta [`scripts/`](scripts) tem os launchers:

- `0 - Abrir Painel.bat` — launcher do Windows. Instala o que falta via `winget`.
- `0 - Abrir Painel.sh` — launcher do Linux e do macOS. Confere o que falta e
  mostra o comando de instalação da sua distro.
- `painel.mjs` — o miolo, compartilhado pelos dois. É ele que acha a porta
  livre, sobe o painel, abre o navegador e derruba tudo quando a janela fecha.
- `1 - Parear Celular.bat` — gera o QR, pareia e conecta sem abrir o painel.
- `2 - Usar Celular no PC.bat` — conecta e abre o espelhamento sem abrir o painel.

Os dois launchers `0` são casca fina: fazem só a checagem específica do sistema
e entregam para o `painel.mjs`, então a lógica não vive duplicada.

Os scripts `1` e `2` são atalhos só de Windows (batch + PowerShell no mesmo
arquivo) e existem para quem não quer abrir o painel. No Linux não há
equivalente porque o painel já faz as duas coisas. O `1` usa Python com a
biblioteca `qrcode` para desenhar o QR; ele instala a lib sozinho na primeira
execução.

## Estrutura

```
src/
  app/
    api/status/    detecção de adb e scrcpy
    api/devices/   lista de aparelhos + serviços mDNS
    api/pair/      inicia, acompanha e cancela o pareamento por QR
    api/connect/   conecta e desconecta
    api/mirror/    abre o scrcpy
  components/      painéis da interface e identidade visual
  lib/
    adb.ts         localiza binários e executa adb/scrcpy
    pairing.ts     máquina de estados do pareamento por QR
    instalacao.ts  comando de instalação certo para cada sistema
    types.ts       tipos compartilhados entre cliente e servidor
scripts/
  painel.mjs       launcher compartilhado (porta livre, navegador, limpeza)
```

## Segurança

O servidor executa binários locais, então quem alcança a página consegue parear
um aparelho e abrir espelhamentos na máquina. Por isso o acesso é travado em
duas camadas:

1. Os scripts `dev` e `start` sobem o servidor preso em `127.0.0.1`, e não em
   todas as interfaces. Abrir pelo IP da rede dá conexão recusada.
2. O [`src/proxy.ts`](src/proxy.ts) rejeita com **403** qualquer requisição cujo
   `Host` não seja loopback, e qualquer `Origin` que não seja loopback. Isso
   cobre o caso de alguém subir o servidor com `-H 0.0.0.0` sem perceber, e
   também bloqueia um site externo tentando falar com `http://localhost:3000`
   pelo seu navegador (DNS rebinding / CSRF).

**Não remova essas travas para acessar de outro computador.** Se precisar disso,
use um túnel SSH em vez de expor a porta.

### Sobre o QR code de pareamento

O QR contém apenas um nome e uma senha aleatórios, gerados na hora. Ele **não**
contém a senha do seu Wi-Fi (apesar do prefixo `WIFI:`, o tipo é `ADB`, não
`WPA`), nem o IP ou o nome da sua máquina.

Ainda assim, trate-o como segredo enquanto a sessão estiver viva: quem estiver na
mesma rede local e tiver essa senha pode parear o próprio computador com o seu
celular. O risco tem prazo curto, porque depende de duas coisas simultâneas: a
tela de pareamento aberta no celular (é ele quem anuncia o serviço) e o QR ainda
válido (a sessão expira em 3 minutos). Fora dessa janela a senha não serve para
nada, e cada sessão gera uma nova.

Nada disso é alcançável de fora da sua rede: o mDNS não atravessa roteador nem
NAT, e os endereços envolvidos são privados.

## Autor

Criado por **caducosilva**.

- GitHub: <https://github.com/caducosilva>
- Contato: abobicarlo@gmail.com

Se este projeto te ajudou, considere uma doação via **PIX** (chave aleatória):

```
f74458dc-2a36-49bd-9250-1cef4365ebb8
```

## Licença

[MIT](LICENSE) © 2026 caducosilva
