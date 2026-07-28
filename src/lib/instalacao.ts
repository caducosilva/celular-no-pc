/**
 * Comando de instalacao certo pra cada sistema.
 *
 * A interface antes sugeria `winget` pra todo mundo, o que nao ajuda em
 * nada quem esta no Linux ou no macOS. O /api/status ja devolve a
 * plataforma, entao da pra mostrar o comando que a pessoa realmente pode
 * copiar e colar.
 */

type Ferramenta = "adb" | "scrcpy";

const COMANDOS: Record<"win32" | "darwin" | "linux", Record<Ferramenta, string>> = {
  win32: {
    adb: "winget install Google.PlatformTools",
    scrcpy: "winget install Genymobile.scrcpy",
  },
  darwin: {
    adb: "brew install --cask android-platform-tools",
    scrcpy: "brew install scrcpy",
  },
  linux: {
    adb: "sudo apt install android-tools-adb",
    scrcpy: "sudo apt install scrcpy",
  },
};

export function comandoInstalar(plataforma: string | undefined, ferramenta: Ferramenta): string {
  const alvo = plataforma === "win32" ? "win32" : plataforma === "darwin" ? "darwin" : "linux";
  return COMANDOS[alvo][ferramenta];
}
