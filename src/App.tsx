import { useEffect, useState } from "react";
import {
  Activity, ChevronRight, Compass, Gamepad2, Globe2,
  Heart, History, Search, Settings, ShieldCheck, Users, Wifi
} from "lucide-react";

type Server = {
  id: string;
  name: string;
  description: string;
  region: string;
  mode: string;
  players: number;
  capacity: number;
  status: "online" | "maintenance";
  featured?: boolean;
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
    featured: true
  },
  {
    id: "afterlife",
    name: "The Afterlife | Roleplay",
    description: "Build a name in Night City. Whitelisted stories and character-focused sessions.",
    region: "North America",
    mode: "Whitelist",
    players: 18,
    capacity: 48,
    status: "online"
  },
  {
    id: "badlands",
    name: "Badlands Stories",
    description: "A slower-paced community focused on nomads, exploration, and emergent stories.",
    region: "Europe",
    mode: "Semi-serious",
    players: 0,
    capacity: 32,
    status: "maintenance"
  }
];

type Page = "discover" | "recent" | "favorites" | "settings";

export default function App() {
  const [page, setPage] = useState<Page>("discover");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selected, setSelected] = useState<Server | null>(demoServers[0]);
  const [version, setVersion] = useState("Web preview");
  const [gameInstalls, setGameInstalls] = useState<GameInstall[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameInstall | null>(null);
  const [gameMessage, setGameMessage] = useState("Checking for Cyberpunk 2077...");
  const [checkingGame, setCheckingGame] = useState(false);
  const [launchingGame, setLaunchingGame] = useState(false);

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

  const visibleServers = demoServers.filter((server) => {
    const matchesQuery = `${server.name} ${server.description} ${server.region} ${server.mode}`
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
          <button className={page === "favorites" ? "nav-item active" : "nav-item"} onClick={() => setPage("favorites")}><Heart size={18}/> Favorites</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="game-status"><div className={selectedGame ? "status-dot" : "status-dot offline"}/> <span>Cyberpunk 2077</span><small>{selectedGame ? "GAME INSTALLATION FOUND" : "GAME NOT DETECTED"}</small></div>
          <button className={page === "settings" ? "nav-item active" : "nav-item"} onClick={() => setPage("settings")}><Settings size={18}/> Settings</button>
          <div className="profile"><div className="avatar">NC</div><div><strong>Guest Runner</strong><small>LOCAL PROFILE</small></div><ChevronRight size={16}/></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb">NIGHT CITY <ChevronRight size={13}/> <span>{page.toUpperCase()}</span></div><div className="top-actions"><span className="connection"><Wifi size={14}/> DIRECTORY DEMO</span><button className="icon-button" aria-label="Settings" onClick={() => setPage("settings")}><Settings size={18}/></button></div></header>
        {page === "settings" ? (
          <section className="content-area"><div className="eyebrow">PREFERENCES</div><h1>Launcher settings</h1><p className="muted">Your local launcher configuration will live here.</p><div className="settings-card"><div><strong>Application version</strong><p>Current launcher build</p></div><span>{version}</span></div><div className="settings-card"><div><strong>Cyberpunk 2077 installation</strong><p>{gameMessage}</p>{selectedGame && <p className="game-path">{selectedGame.source} · {selectedGame.path}</p>}</div><span className={selectedGame ? "pill" : "pill warning"}>{selectedGame ? "Detected" : "Not found"}</span></div><div className="settings-actions"><button className="filter-button" onClick={scanForGame} disabled={checkingGame}>{checkingGame ? "SCANNING..." : "SCAN AGAIN"}</button><button className="primary-button" onClick={locateGame}>LOCATE GAME FOLDER</button></div><div className="settings-card"><div><strong>Launch integration</strong><p>Steam installations open through Steam. Other installations use REDprelauncher when available, with a validated game executable fallback.</p></div><span className="pill">{selectedGame?.source ?? "Unconfigured"}</span></div><div className="settings-card"><div><strong>Automatic updates</strong><p>Signed update delivery will be enabled in a later milestone.</p></div><span className="pill">Planned</span></div></section>
        ) : (
          <section className="content-area">
            <div className="hero">
              <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> YOUR CITY. YOUR STORY.</div><h1>Find your place<br/>in <em>Night City.</em></h1><p>Discover roleplay communities, meet your crew, and write your own legend.</p><div className="hero-actions"><button className="primary-button" onClick={launchGame} disabled={!selectedGame || launchingGame}><Gamepad2 size={17}/> {launchingGame ? "STARTING..." : "PLAY CYBERPUNK 2077"}</button><button className="filter-button" onClick={() => { setPage("discover"); document.getElementById("server-browser")?.scrollIntoView({ behavior: "smooth" }); }}><Globe2 size={17}/> EXPLORE SERVERS</button></div><small className="connect-note">{gameMessage}</small></div>
              <div className="hero-art"><div className="sun-disc"/><div className="city-grid"/><div className="hero-caption">NIGHT CITY<br/><b>NEVER SLEEPS</b></div></div>
            </div>
            <div className="section-heading" id="server-browser"><div><div className="eyebrow">THE NETWORK</div><h2>{page === "favorites" ? "Your favorites" : page === "recent" ? "Recently played" : "Discover servers"}</h2></div><div className="server-total"><Activity size={15}/> {visibleServers.length} LISTED</div></div>
            <div className="browser-toolbar"><div className="search-box"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search servers, regions, or play styles..." /></div><button className="filter-button"><Users size={16}/> All communities</button></div>
            <div className="server-layout"><div className="server-list">{visibleServers.map((server) => <article className={selected?.id === server.id ? "server-card selected" : "server-card"} key={server.id} onClick={() => setSelected(server)}><div className="server-thumb"><span>NC</span><small>{server.mode.toUpperCase()}</small></div><div className="server-info"><div className="server-title-row"><h3>{server.name}</h3><button className={favorites.includes(server.id) ? "favorite-button saved" : "favorite-button"} aria-label="Toggle favorite" onClick={(event) => { event.stopPropagation(); toggleFavorite(server.id); }}><Heart size={17} fill={favorites.includes(server.id) ? "currentColor" : "none"}/></button></div><p>{server.description}</p><div className="server-meta"><span><span className={server.status === "online" ? "status-dot" : "status-dot offline"}/>{server.status === "online" ? "Online" : "Maintenance"}</span><span>{server.region}</span><span>{server.players}/{server.capacity} players</span></div></div><ChevronRight className="server-arrow" size={18}/></article>)}
              {visibleServers.length === 0 && <div className="empty-state">No servers match this view yet.</div>}
            </div>
            <aside className="detail-panel">{selected ? <><div className="detail-art"><span>CYBERRP COMMUNITY</span><b>{selected.name}</b></div><div className="detail-body"><div className="eyebrow">SERVER OVERVIEW</div><h3>{selected.name}</h3><p>{selected.description}</p><div className="detail-stats"><div><strong>{selected.players}/{selected.capacity}</strong><small>PLAYERS</small></div><div><strong>{selected.region}</strong><small>REGION</small></div></div><div className="detail-rule"><ShieldCheck size={17}/><span>Review community rules before connecting.</span></div><button className="connect-button" disabled><Gamepad2 size={17}/> CONNECTION COMING SOON</button><small className="connect-note">Server listings are illustrative demo data. No live server connection is available yet.</small></div></> : <div className="empty-state">Select a server to see its details.</div>}</aside></div>
          </section>
        )}
        <footer><span>CYBERRP © {new Date().getFullYear()} — COMMUNITY BUILT</span><span>BUILD {version.toUpperCase()}</span></footer>
      </main>
    </div>
  );
}
