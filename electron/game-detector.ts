import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, normalize } from "node:path";

export type GameInstall = {
  path: string;
  executable: string;
  source: "Steam" | "GOG" | "Epic Games" | "Manual";
};

const executableName = process.platform === "win32"
  ? "Cyberpunk2077.exe"
  : "Cyberpunk2077";

async function executableAt(root: string): Promise<string | null> {
  const normalized = normalize(root.replace(/^"|"$/g, ""));
  const candidates = [
    normalized,
    join(normalized, "bin", "x64", executableName),
    join(normalized, "Cyberpunk 2077", "bin", "x64", executableName)
  ];
  for (const candidate of candidates) {
    const executable = candidate.toLowerCase().endsWith(executableName.toLowerCase())
      ? candidate
      : join(candidate, "bin", "x64", executableName);
    try {
      await access(executable);
      return executable;
    } catch {
      // Continue through known install layouts.
    }
  }
  return null;
}

async function steamLibraries(): Promise<string[]> {
  const home = homedir();
  const roots = process.platform === "win32"
    ? [
        process.env["ProgramFiles(x86)"] ? join(process.env["ProgramFiles(x86)"]!, "Steam") : "",
        process.env.ProgramFiles ? join(process.env.ProgramFiles, "Steam") : "",
        process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Programs", "Steam") : ""
      ]
    : process.platform === "darwin"
      ? [join(home, "Library", "Application Support", "Steam")]
      : [join(home, ".steam", "steam"), join(home, ".local", "share", "Steam")];

  const libraries = new Set(roots.filter(Boolean));
  for (const root of [...libraries]) {
    try {
      const manifest = await readFile(join(root, "steamapps", "libraryfolders.vdf"), "utf8");
      for (const match of manifest.matchAll(/"path"\s+"([^"]+)"/g)) {
        if (match[1]) libraries.add(match[1].replace(/\\\\/g, "\\"));
      }
    } catch {
      // Steam may not be installed at this location.
    }
  }
  return [...libraries];
}

export async function detectGameInstallations(): Promise<GameInstall[]> {
  const candidates: Array<{ path: string; source: GameInstall["source"] }> = [];
  for (const library of await steamLibraries()) {
    candidates.push({ path: join(library, "steamapps", "common", "Cyberpunk 2077"), source: "Steam" });
  }

  if (process.platform === "win32") {
    const roots = [
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
      process.env["ProgramW6432"]
    ].filter((value): value is string => Boolean(value));
    for (const root of roots) {
      candidates.push({ path: join(root, "GOG Galaxy", "Games", "Cyberpunk 2077"), source: "GOG" });
      candidates.push({ path: join(root, "Epic Games", "Cyberpunk2077"), source: "Epic Games" });
      candidates.push({ path: join(root, "Epic Games", "Cyberpunk 2077"), source: "Epic Games" });
    }
    if (process.env["GOG_GAMES"]) {
      candidates.push({ path: join(process.env["GOG_GAMES"], "Cyberpunk 2077"), source: "GOG" });
    }
  }

  const results: GameInstall[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const executable = await executableAt(candidate.path);
    if (!executable) continue;
    const key = executable.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ path: candidate.path, executable, source: candidate.source });
  }
  return results;
}

export async function validateGameFolder(path: string): Promise<GameInstall | null> {
  const executable = await executableAt(path);
  return executable ? { path, executable, source: "Manual" } : null;
}
