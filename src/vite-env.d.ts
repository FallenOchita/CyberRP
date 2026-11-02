/// <reference types="vite/client" />

type GameInstall = {
  path: string;
  executable: string;
  source: "Steam" | "GOG" | "Epic Games" | "Manual";
  launcherExecutable?: string;
};
type LaunchResult = { ok: boolean; message: string };

interface Window {
  cyberrp?: {
    getVersion: () => Promise<string>;
    detectGame: () => Promise<GameInstall[]>;
    getSelectedGame: () => Promise<GameInstall | null>;
    setSelectedGame: (install: GameInstall | null) => Promise<GameInstall | null>;
    selectGame: () => Promise<GameInstall | null>;
    launchGame: () => Promise<LaunchResult>;
  };
}
