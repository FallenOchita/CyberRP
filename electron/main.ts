import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { detectGameInstallations, validateGameFolder, type GameInstall } from "./game-detector";

const isDevelopment = !app.isPackaged;
const settingsPath = () => join(app.getPath("userData"), "settings.json");
type LocalSettings = { selectedGame: GameInstall | null };

async function readSettings(): Promise<LocalSettings> {
  try {
    const saved = JSON.parse(await readFile(settingsPath(), "utf8")) as Partial<LocalSettings>;
    return { selectedGame: saved.selectedGame ?? null };
  } catch {
    return { selectedGame: null };
  }
}

async function saveSelectedGame(selectedGame: GameInstall | null): Promise<void> {
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(settingsPath(), JSON.stringify({ selectedGame }, null, 2), "utf8");
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1080, minHeight: 680,
    backgroundColor: "#0b0c10", title: "CyberRP",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  if (isDevelopment) void window.loadURL("http://127.0.0.1:5173");
  else void window.loadFile(join(app.getAppPath(), "dist", "index.html"));
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
}

ipcMain.handle("cyberrp:get-version", () => app.getVersion());
ipcMain.handle("cyberrp:detect-game", () => detectGameInstallations());
ipcMain.handle("cyberrp:get-selected-game", async () => {
  const saved = (await readSettings()).selectedGame;
  if (!saved) return null;
  const verified = await validateGameFolder(saved.path);
  if (!verified) { await saveSelectedGame(null); return null; }
  return { ...verified, source: saved.source };
});
ipcMain.handle("cyberrp:set-selected-game", async (_event, install: GameInstall | null) => {
  if (!install) { await saveSelectedGame(null); return null; }
  const verified = await validateGameFolder(install.path);
  if (!verified) throw new Error("The selected folder is not a valid Cyberpunk 2077 installation.");
  const selected = { ...verified, source: install.source };
  await saveSelectedGame(selected);
  return selected;
});
ipcMain.handle("cyberrp:select-game", async () => {
  const selection = await dialog.showOpenDialog({
    title: "Select your Cyberpunk 2077 installation folder",
    properties: ["openDirectory"]
  });
  if (selection.canceled || selection.filePaths.length === 0) return null;
  const install = await validateGameFolder(selection.filePaths[0]);
  if (install) await saveSelectedGame(install);
  return install;
});
ipcMain.handle("cyberrp:launch-game", async () => {
  const saved = (await readSettings()).selectedGame;
  if (!saved) return { ok: false, message: "Select your game installation first." };
  const verified = await validateGameFolder(saved.path);
  if (!verified) {
    await saveSelectedGame(null);
    return { ok: false, message: "The saved game folder is no longer valid. Locate it again in Settings." };
  }

  // Hand Steam installs to Steam's registered Cyberpunk 2077 launch route.
  if (saved.source === "Steam" && process.platform === "win32") {
    await shell.openExternal("steam://run/1091500");
    return { ok: true, message: "Opening Cyberpunk 2077 through Steam." };
  }

  // Prefer CD PROJEKT RED's pre-launcher when present; otherwise use the verified game binary.
  const executable = verified.launcherExecutable ?? verified.executable;
  try {
    await access(executable);
    const child = spawn(executable, [], {
      cwd: verified.path, detached: true, stdio: "ignore", shell: false
    });
    child.once("error", () => undefined);
    child.unref();
    return {
      ok: true,
      message: verified.launcherExecutable
        ? "Opening Cyberpunk 2077 through REDprelauncher."
        : "Opening Cyberpunk 2077 directly."
    };
  } catch {
    return { ok: false, message: "Cyberpunk 2077 could not be started. Check the installation and try again." };
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
