/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_ATLAS_API_URL?: string;
  readonly VITE_ATLAS_CONTRACT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
