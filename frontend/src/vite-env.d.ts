/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BIOMETRICS_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
