/// <reference types="vite/client" />

type GameInstall = {
  path: string;
  executable: string;
  source: "Steam" | "GOG" | "Epic Games" | "Manual";
};

interface Window {
  cyberrp?: {
    getVersion: () => Promise<string>;
    detectGame: () => Promise<GameInstall[]>;
    selectGame: () => Promise<GameInstall | null>;
  };
}
