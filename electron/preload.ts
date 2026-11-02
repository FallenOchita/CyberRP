import { contextBridge, ipcRenderer } from "electron";

export type GameInstall = {
  path: string;
  executable: string;
  source: "Steam" | "GOG" | "Epic Games" | "Manual";
  launcherExecutable?: string;
};
export type LaunchResult = { ok: boolean; message: string };

contextBridge.exposeInMainWorld("cyberrp", {
  getVersion: (): Promise<string> => ipcRenderer.invoke("cyberrp:get-version"),
  detectGame: (): Promise<GameInstall[]> => ipcRenderer.invoke("cyberrp:detect-game"),
  getSelectedGame: (): Promise<GameInstall | null> => ipcRenderer.invoke("cyberrp:get-selected-game"),
  setSelectedGame: (install: GameInstall | null): Promise<GameInstall | null> =>
    ipcRenderer.invoke("cyberrp:set-selected-game", install),
  selectGame: (): Promise<GameInstall | null> => ipcRenderer.invoke("cyberrp:select-game"),
  launchGame: (): Promise<LaunchResult> => ipcRenderer.invoke("cyberrp:launch-game")
});
