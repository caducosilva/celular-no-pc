import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // `lib/adb.ts` procura os binarios do adb e do scrcpy no disco, entao o
    // tracing do Turbopack acusa "filesystem operations" e tenta incluir o
    // projeto inteiro na NFT list. Isso e intencional aqui: o app roda local,
    // nunca em build standalone.
    ignoreIssue: [{ path: "**/next.config.ts", title: "Encountered unexpected file in NFT list" }],
  },
};

export default nextConfig;
