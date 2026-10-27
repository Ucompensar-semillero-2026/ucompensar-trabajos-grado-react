/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  // App registration de Microsoft Entra ID (SPA, sin client secret). Cuando
  // la universidad entregue su propio tenant solo cambian estos dos valores.
  readonly VITE_AZURE_CLIENT_ID?: string
  readonly VITE_AZURE_TENANT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
