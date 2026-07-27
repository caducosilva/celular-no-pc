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
- **Scripts `.bat`** para quem quer só clicar duas vezes, sem abrir o painel.

## Como funciona o pareamento por QR

O Android lê um QR code com o payload `WIFI:T:ADB;S:<nome>;P:<senha>;;`. Depois
de ler, o aparelho anuncia na rede local um serviço mDNS `_adb-tls-pairing._tcp`
cujo nome de instância é exatamente o `<nome>` do QR. O servidor observa o
`adb mdns services`, acha esse endpoint e roda `adb pair <ip:porta> <senha>`.
Feito o pareamento, ele descobre o `_adb-tls-connect._tcp` e conecta.

A senha do QR é gerada aleatoriamente a cada sessão e **nunca é enviada ao
navegador** — só a imagem do QR sai do servidor.

## Requisitos

| Ferramenta | Instalação (Windows) |
| --- | --- |
| Node.js 20.9+ | <https://nodejs.org> |
| `adb` (Platform Tools) | `winget install Google.PlatformTools` |
| `scrcpy` | `winget install Genymobile.scrcpy` |

No celular: **Configurações → Opções do desenvolvedor → Depuração sem fio**
ligada, com o aparelho na mesma rede Wi-Fi do computador (redes de convidado e
roteadores com *AP isolation* não funcionam).

Testado no Windows 11 com um Galaxy S25 Ultra (Android 16). A detecção de
binários tem caminhos para Linux e macOS, mas o alvo principal é o Windows.

## Uso

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

### Scripts sem interface

Quem não quer subir o painel pode usar os dois `.bat` da pasta [`scripts/`](scripts):

- `1 - Parear Celular.bat` — gera o QR, pareia e conecta.
- `2 - Usar Celular no PC.bat` — conecta e abre o espelhamento.

São autocontidos (batch + PowerShell no mesmo arquivo) e não dependem do painel.
O primeiro usa Python com a biblioteca `qrcode` para desenhar o QR; ele instala a
lib sozinho na primeira execução.

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
    types.ts       tipos compartilhados entre cliente e servidor
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
