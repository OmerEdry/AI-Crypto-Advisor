/// <reference types="vite/client" />

// `vite/client` types env reads through an index signature that resolves to `any`, so without
// this declaration an unchecked value would walk straight into the API client. Optional because
// production supplies none: `/api` is a constant of the rewrite topology, not a per-environment
// value, so only local development overrides it.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
