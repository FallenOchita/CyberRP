import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";

const isDevelopment = !app.isPackaged;

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: "#0b0c10",
    title: "CyberRP",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (isDevelopment) {
    void window.loadURL("http://127.0.0.1:5173");
  } else {
    void window.loadFile(join(app.getAppPath(), "dist", "index.html"));
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
}

ipcMain.handle("cyberrp:get-version", () => app.getVersion());

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
