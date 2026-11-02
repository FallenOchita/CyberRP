import { contextBridge, ipcRenderer } from "electron";

export type GameInstall = {
  path: string;
  executable: string;
  source: "Steam" | "GOG" | "Epic Games" | "Manual";
};

contextBridge.exposeInMainWorld("cyberrp", {
  getVersion: (): Promise<string> => ipcRenderer.invoke("cyberrp:get-version"),
  detectGame: (): Promise<GameInstall[]> => ipcRenderer.invoke("cyberrp:detect-game"),
  selectGame: (): Promise<GameInstall | null> => ipcRenderer.invoke("cyberrp:select-game")
});
