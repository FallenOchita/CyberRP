import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("cyberrp", {
  getVersion: (): Promise<string> => ipcRenderer.invoke("cyberrp:get-version")
});
