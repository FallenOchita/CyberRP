/// <reference types="vite/client" />

interface Window {
  cyberrp?: {
    getVersion: () => Promise<string>;
  };
}
