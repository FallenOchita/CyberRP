import { useEffect, useState } from "react";
import {
  Activity, ChevronRight, Compass, Gamepad2, Globe2,
  Heart, History, RefreshCw, Search, Settings, ShieldCheck, Wifi
} from "lucide-react";
import { fetchDirectoryServers, type DirectoryServer } from "./lib/directory-client";

type Server = {
  id: string;
  name: string;
  description: string;
  region: string;
  mode: string;
  players: number;
  capacity: number;
  status: "online" | "offline" | "maintenance";
  address?: string;
  port?: number;
  gameVersion?: string;
  featured?: boolean;
  rules: string[];
};

const demoServers: Server[] = [
  {
    id: "night-city-life",
    name: "Night City Life RP",
    description: "Story-driven city roleplay with player-run businesses and community events.",
    region: "North America",
    mode: "Serious RP",
    players: 42,
    capacity: 64,
    status: "online",
    featured: true,
    rules: ["Stay in character in public roleplay spaces.", "Respect other players and community staff.", "Do not use exploits, cheats, or disruptive behavior.", "Follow staff instructions and the community reporting process."]
  },
  {
    id: "afterlife",
    name: "The Afterlife | Roleplay",
    description: "Build a name in Night City. Whitelisted stories and character-focused sessions.",
    region: "North America",
    mode: "Whitelist",
    players: 18,
    capacity: 48,
    status: "online",
    rules: ["Character-driven roleplay is expected during sessions.", "Keep out-of-character chat in designated channels.", "Respect whitelist decisions and staff rulings."]
  },
  {
    id: "badlands",
    name: "Badlands Stories",
    description: "A slower-paced community focused on nomads, exploration, and emergent stories.",
    region: "Europe",
    mode: "Semi-serious",
    players: 0,
    capacity: 32,
    status: "maintenance",
    rules: ["Nomad and exploration stories should respect other players.", "Use community channels for out-of-character coordination.", "Report concerns to moderators rather than escalating disputes."]
  }
];

type Page = "discover" | "recent" | "favorites" | "settings" | "owner";

export default function App() {
  const [page, setPage] = useState<Page>("discover");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selected, setSelected] = useState<Server | null>(demoServers[0]);
  const [servers, setServers] = useState<Server[]>(demoServers);
  const [directoryMode, setDirectoryMode] = useState<"loading" | "live" | "demo">("loading");
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [refreshDirectory, setRefreshDirectory] = useState(0);
  const [rulesServer, setRulesServer] = useState<Server | null>(null);
  const [ruleChecked, setRuleChecked] = useState(false);
  const [acknowledgedRules, setAcknowledgedRules] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("cyberrp-rule-acknowledgements") ?? "[]") as string[]; }
    catch { return []; }
  });
  const [version, setVersion] = useState("Web preview");
  const [gameInstalls, setGameInstalls] = useState<GameInstall[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameInstall | null>(null);
  const [gameMessage, setGameMessage] = useState("Checking for Cyberpunk 2077...");
  const [checkingGame, setCheckingGame] = useState(false);
  const [launchingGame, setLaunchingGame] = useState(false);


  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const result = await fetchDirectoryServers(query, controller.signal);
        if (!active) return;
        const mapped: Server[] = result.servers.map((item: DirectoryServer) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          region: item.tags.find((tag) => /north america|europe|asia|oceania|south america/i.test(tag)) ?? "Region not specified",
          mode: item.tags.find((tag) => /serious|semi-serious|whitelist|casual|roleplay/i.test(tag)) ?? "Community",
          players: item.playerCount,
          capacity: item.maxPlayers,
          status: item.status,
          rules: [],
          address: item.address,
          port: item.port,
          gameVersion: item.gameVersion
        }));
        setServers(mapped);
        setDirectoryMode("live");
        setDirectoryError(null);
        setSelected((current) => mapped.find((item) => item.id === current?.id) ?? mapped[0] ?? null);
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setServers(demoServers);
        setDirectoryMode("demo");
        setDirectoryError(error instanceof Error ? error.message : "Directory unavailable");
        setSelected((current) => demoServers.find((item) => item.id === current?.id) ?? demoServers[0] ?? null);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [query, refreshDirectory]);
  useEffect(() => {
    window.cyberrp?.getVersion().then(setVersion).catch(() => undefined);
    if (!window.cyberrp) {
      setGameMessage("Game detection unavailable in web preview");
      return;
    }
    Promise.all([window.cyberrp.detectGame(), window.cyberrp.getSelectedGame()])
      .then(async ([installs, saved]) => {
        setGameInstalls(installs);
        const chosen = saved ?? installs[0] ?? null;
        setSelectedGame(chosen);
        setGameMessage(chosen ? "Installation ready" : "No installation detected");
        if (!saved && installs[0]) {
          const persisted = await window.cyberrp!.setSelectedGame(installs[0]);
          setSelectedGame(persisted);
        }
      })
      .catch(() => setGameMessage("Game detection unavailable in this build"));
  }, []);

  const visibleServers = servers.filter((server) => {
    const matchesQuery = directoryMode === "live" || `${server.name} ${server.description} ${server.region} ${server.mode}`
      .toLowerCase().includes(query.toLowerCase());
    if (page === "favorites") return matchesQuery && favorites.includes(server.id);
    if (page === "recent") return matchesQuery && server.id === "night-city-life";
    return matchesQuery;
  });


  const scanForGame = async () => {
    if (!window.cyberrp) { setGameMessage("Run the desktop launcher to scan your PC."); return; }
    setCheckingGame(true);
    try {
      const installs = await window.cyberrp.detectGame();
      setGameInstalls(installs);
      const chosen = selectedGame && installs.some((item) => item.path === selectedGame.path)
        ? selectedGame : installs[0] ?? null;
      const saved = await window.cyberrp.setSelectedGame(chosen);
      setSelectedGame(saved);
      setGameMessage(saved ? "Installation ready and saved" : "No installation detected");
    } catch {
      setGameMessage("Could not scan for the game.");
    } finally { setCheckingGame(false); }
  };

  const locateGame = async () => {
    if (!window.cyberrp) { setGameMessage("Folder selection is available in the desktop launcher."); return; }
    try {
      const install = await window.cyberrp.selectGame();
      if (install) {
        const saved = await window.cyberrp.setSelectedGame(install);
        setSelectedGame(saved);
        setGameInstalls((current) => [...current.filter((item) => item.executable !== install.executable), install]);
        setGameMessage("Game folder verified and saved");
      } else {
        setGameMessage("Folder selection cancelled or invalid.");
      }
    } catch { setGameMessage("Could not verify that folder."); }
  };

  const launchGame = async () => {
    if (!window.cyberrp) {
      setGameMessage("Game launching is available in the desktop launcher.");
      return;
    }
    setLaunchingGame(true);
    try {
      const result = await window.cyberrp.launchGame();
      setGameMessage(result.message);
    } catch {
      setGameMessage("Could not start Cyberpunk 2077.");
    } finally {
      setLaunchingGame(false);
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">C</span><div><strong>CYBER<span>RP</span></strong><small>NIGHT CITY NETWORK</small></div></div>
        <div className="nav-label">COMMUNITY</div>
        <nav>
          <button className={page === "discover" ? "nav-item active" : "nav-item"} onClick={() => setPage("discover")}><Compass size={18}/> Discover <span className="nav-count">03</span></button>
          <button className={page === "recent" ? "nav-item active" : "nav-item"} onClick={() => setPage("recent")}><History size={18}/> Recently played</button>
          <button className={page === "favorites" ? "nav-item active" : "nav-item"} onClick={() => setPage("favorites")}><Heart size={18}/> Favorites</button>\n          <button className={page === "owner" ? "nav-item active" : "nav-item"} onClick={() => setPage("owner")}><ShieldCheck size={18}/> Server management</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="game-status"><div className={selectedGame ? "status-dot" : "status-dot offline"}/> <span>Cyberpunk 2077</span><small>{selectedGame ? "GAME INSTALLATION FOUND" : "GAME NOT DETECTED"}</small></div>
          <button className={page === "settings" ? "nav-item active" : "nav-item"} onClick={() => setPage("settings")}><Settings size={18}/> Settings</button>
          <div className="profile"><div className="avatar">NC</div><div><strong>Guest Runner</strong><small>LOCAL PROFILE</small></div><ChevronRight size={16}/></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb">NIGHT CITY <ChevronRight size={13}/> <span>{page.toUpperCase()}</span></div><div className="top-actions"><span className="connection"><Wifi size={14}/> {directoryMode === "live" ? "LIVE DIRECTORY" : directoryMode === "loading" ? "CONNECTING..." : "DEMO DIRECTORY"}</span><button className="icon-button" aria-label="Settings" onClick={() => setPage("settings")}><Settings size={18}/></button></div></header>
        {page === "settings" ? (
          <section className="content-area"><div className="eyebrow">PREFERENCES</div><h1>Launcher settings</h1><p className="muted">Your local launcher configuration will live here.</p><div className="settings-card"><div><strong>Application version</strong><p>Current launcher build</p></div><span>{version}</span></div><div className="settings-card"><div><strong>Cyberpunk 2077 installation</strong><p>{gameMessage}</p><p className="game-path">{gameInstalls.length} installation{gameInstalls.length === 1 ? "" : "s"} detected</p>{selectedGame && <p className="game-path">{selectedGame.source} · {selectedGame.path}</p>}</div><span className={selectedGame ? "pill" : "pill warning"}>{selectedGame ? "Detected" : "Not found"}</span></div><div className="settings-actions"><button className="filter-button" onClick={scanForGame} disabled={checkingGame}>{checkingGame ? "SCANNING..." : "SCAN AGAIN"}</button><button className="primary-button" onClick={locateGame}>LOCATE GAME FOLDER</button></div><div className="settings-card"><div><strong>Launch integration</strong><p>Steam installations open through Steam. Other installations use REDprelauncher when available, with a validated game executable fallback.</p></div><span className="pill">{selectedGame?.source ?? "Unconfigured"}</span></div><div className="settings-card"><div><strong>Automatic updates</strong><p>Signed update delivery will be enabled in a later milestone.</p></div><span className="pill">Planned</span></div></section>
        ) : (
          <section className="content-area">
            <div className="hero">
              <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> YOUR CITY. YOUR STORY.</div><h1>Find your place<br/>in <em>Night City.</em></h1><p>Discover roleplay communities, meet your crew, and write your own legend.</p><div className="hero-actions"><button className="primary-button" onClick={launchGame} disabled={!selectedGame || launchingGame}><Gamepad2 size={17}/> {launchingGame ? "STARTING..." : "PLAY CYBERPUNK 2077"}</button><button className="filter-button" onClick={() => { setPage("discover"); document.getElementById("server-browser")?.scrollIntoView({ behavior: "smooth" }); }}><Globe2 size={17}/> EXPLORE SERVERS</button></div><small className="connect-note">{gameMessage}</small></div>
              <div className="hero-art"><div className="sun-disc"/><div className="city-grid"/><div className="hero-caption">NIGHT CITY<br/><b>NEVER SLEEPS</b></div></div>
            </div>
            <div className="section-heading" id="server-browser"><div><div className="eyebrow">THE NETWORK</div><h2>{page === "favorites" ? "Your favorites" : page === "recent" ? "Recently played" : "Discover servers"}</h2></div><div className="server-total"><Activity size={15}/> {visibleServers.length} LISTED</div></div>
            <div className="browser-toolbar"><div className="search-box"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search servers, regions, or play styles..." /></div><button className="filter-button" onClick={() => setRefreshDirectory((value) => value + 1)} disabled={directoryMode === "loading"}><RefreshCw size={15}/> REFRESH</button></div>
            <div className="server-layout"><div className="server-list">{directoryError && <div className="directory-notice">Directory unavailable — showing sample servers. {directoryError}</div>}{visibleServers.map((server) => <article className={selected?.id === server.id ? "server-card selected" : "server-card"} key={server.id} onClick={() => setSelected(server)}><div className="server-thumb"><span>NC</span><small>{server.mode.toUpperCase()}</small></div><div className="server-info"><div className="server-title-row"><h3>{server.name}</h3><button className={favorites.includes(server.id) ? "favorite-button saved" : "favorite-button"} aria-label="Toggle favorite" onClick={(event) => { event.stopPropagation(); toggleFavorite(server.id); }}><Heart size={17} fill={favorites.includes(server.id) ? "currentColor" : "none"}/></button></div><p>{server.description}</p><div className="server-meta"><span><span className={server.status === "online" ? "status-dot" : "status-dot offline"}/>{server.status === "online" ? "Online" : "Offline"}</span><span>{server.region}</span><span>{server.players}/{server.capacity} players</span></div></div><ChevronRight className="server-arrow" size={18}/></article>)}
              {visibleServers.length === 0 && <div className="empty-state">No servers match this view yet.</div>}
            </div>
            <aside className="detail-panel">{selected ? <><div className="detail-art"><span>CYBERRP COMMUNITY</span><b>{selected.name}</b></div><div className="detail-body"><div className="eyebrow">SERVER OVERVIEW</div><h3>{selected.name}</h3><p>{selected.description}</p>{selected.address && <p className="game-path">{selected.address}:{selected.port} · {selected.gameVersion}</p>}<div className="detail-stats"><div><strong>{selected.players}/{selected.capacity}</strong><small>PLAYERS</small></div><div><strong>{selected.region}</strong><small>REGION</small></div></div><div className="detail-rule"><ShieldCheck size={17}/><span>{acknowledgedRules.includes(selected.id) ? "Community rules acknowledged on this device." : "Review community rules before connecting."}</span></div><button className="filter-button rules-button" onClick={() => { setRulesServer(selected); setRuleChecked(false); }}><ShieldCheck size={15}/>{acknowledgedRules.includes(selected.id) ? "VIEW COMMUNITY RULES" : "REVIEW COMMUNITY RULES"}</button><button className="connect-button" disabled><Gamepad2 size={17}/> CONNECTION COMING SOON</button><small className="connect-note">{directoryMode === "live" ? `${selected.address ?? "Address unavailable"}:${selected.port ?? "—"} · Game ${selected.gameVersion ?? "unspecified"}` : "Sample listing only. Connect the directory API to load real server records."}</small></div></> : <div className="empty-state">Select a server to see its details.</div>}</aside></div>
            {rulesServer && <div className="rules-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRulesServer(null); }}><section className="rules-dialog" role="dialog" aria-modal="true" aria-labelledby="rules-title"><div className="eyebrow">COMMUNITY GUIDELINES</div><h2 id="rules-title">{rulesServer.name}</h2><p className="rules-intro">Read these community rules before joining a server. Your acknowledgement is saved locally on this device.</p>{rulesServer.rules.length > 0 ? <ol className="rules-list">{rulesServer.rules.map((rule, index) => <li key={`${rulesServer.id}-${index}`}>{rule}</li>)}</ol> : <p className="rules-intro">This directory record has not published community rules yet. Contact the server owner for its current guidelines.</p>}<label className="rules-acknowledge"><input type="checkbox" checked={ruleChecked} onChange={(event) => setRuleChecked(event.target.checked)}/><span>I have read and agree to follow these community rules.</span></label><div className="rules-actions"><button className="filter-button" onClick={() => setRulesServer(null)}>CLOSE</button><button className="primary-button" disabled={!ruleChecked} onClick={() => { const next = [...new Set([...acknowledgedRules, rulesServer.id])]; setAcknowledgedRules(next); localStorage.setItem("cyberrp-rule-acknowledgements", JSON.stringify(next)); setRulesServer(null); }}>ACKNOWLEDGE RULES</button></div></section></div>}
          </section>
        )}
        <footer><span>CYBERRP © {new Date().getFullYear()} — COMMUNITY BUILT</span><span>BUILD {version.toUpperCase()}</span></footer>
      </main>
    </div>
  );
}
