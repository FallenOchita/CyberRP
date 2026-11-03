import { useEffect, useState } from "react";
import { Copy, LogIn, LogOut, MailPlus, RefreshCw, Shield, Users } from "lucide-react";

type Owner = { id: string; email: string; createdAt: string };
type Member = { ownerId: string; email: string; role: "owner" | "admin" | "moderator"; joinedAt: string };
type OwnedServer = { id: string; name: string; address: string; port: number; playerCount: number; maxPlayers: number; status: "online" | "offline"; lastHeartbeatAt: string };
type HeartbeatRecord = { playerCount: number; receivedAt: string };
type Session = { owner: Owner; token: string; expiresAt: string };
type Invitation = { invitation: { id: string; serverId: string; email: string; role: "admin" | "moderator"; expiresAt: string }; token: string };

const API = (import.meta.env.VITE_CYBERRP_API_URL || "http://127.0.0.1:8787").replace(/\/$/, "");

async function request<T>(path: string, token?: string, body?: unknown, method = "GET"): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export default function OwnerDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [serverId, setServerId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [ownedServers, setOwnedServers] = useState<OwnedServer[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "moderator">("moderator");
  const [createdInvite, setCreatedInvite] = useState<Invitation | null>(null);
  const [notice, setNotice] = useState("Sign in with your CyberRP owner account to manage a community.");
  const [busy, setBusy] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [lastStatusRefresh, setLastStatusRefresh] = useState<string | null>(null);
  const [heartbeatHistory, setHeartbeatHistory] = useState<HeartbeatRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const refreshOwnedServers = async (token: string, quiet = false) => {
    if (!quiet) setRefreshingStatus(true);
    try {
      const owned = await request<{ servers: OwnedServer[] }>("/v1/servers/mine", token);
      setOwnedServers(owned.servers);
      setLastStatusRefresh(new Date().toISOString());
    } catch (error) {
      if (!quiet) setNotice(error instanceof Error ? error.message : "Could not refresh host status.");
    } finally {
      if (!quiet) setRefreshingStatus(false);
    }
  };

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => {
      void refreshOwnedServers(session.token, true);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [session?.token]);

  const loadHeartbeatHistory = async (id = serverId) => {
    if (!session || !id.trim()) return;
    setLoadingHistory(true);
    try {
      const result = await request<{ heartbeats: HeartbeatRecord[] }>(`/v1/servers/${encodeURIComponent(id.trim())}/heartbeats?limit=50`, session.token);
      setHeartbeatHistory(result.heartbeats);
    } catch (error) {
      setHeartbeatHistory([]);
      setNotice(error instanceof Error ? error.message : "Could not load heartbeat history.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice("Signing in...");
    try {
      const result = await request<Session>("/v1/auth/login", undefined, { email, password }, "POST");
      setSession(result);
      setPassword("");
      const owned = await request<{ servers: OwnedServer[] }>("/v1/servers/mine", result.token);
      setOwnedServers(owned.servers);
      setNotice(owned.servers.length
        ? `Signed in. Found ${owned.servers.length} server(s) linked to your account.`
        : "Signed in. No owned servers found yet; you can claim an unowned server using its ID.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Sign-in failed.");
    } finally { setBusy(false); }
  };

  const loadMembers = async () => {
    if (!session || !serverId.trim()) return;
    setBusy(true);
    try {
      const result = await request<{ members: Member[] }>(`/v1/servers/${encodeURIComponent(serverId.trim())}/members`, session.token);
      setMembers(result.members);
      setNotice(`Loaded ${result.members.length} staff account(s).`);
    } catch (error) {
      setMembers([]);
      setNotice(error instanceof Error ? error.message : "Could not load staff.");
    } finally { setBusy(false); }
  };

  const claimServer = async () => {
    if (!session || !serverId.trim()) return;
    setBusy(true);
    try {
      await request(`/v1/servers/${encodeURIComponent(serverId.trim())}/claim`, session.token, {}, "POST");
      setNotice("Server claimed. Loading staff...");
      await loadMembers();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not claim server.");
    } finally { setBusy(false); }
  };

  const sendInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session || !serverId.trim()) return;
    setBusy(true);
    setCreatedInvite(null);
    try {
      const result = await request<Invitation>(`/v1/servers/${encodeURIComponent(serverId.trim())}/invitations`, session.token, { email: inviteEmail, role: inviteRole }, "POST");
      setCreatedInvite(result);
      setInviteEmail("");
      setNotice("Invitation created. Copy and deliver this token through a trusted channel; email delivery is not configured.");
      await loadMembers();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create invitation.");
    } finally { setBusy(false); }
  };

  const removeMember = async (member: Member) => {
    if (!session || !serverId.trim() || member.role === "owner") return;
    setBusy(true);
    try {
      await request(`/v1/servers/${encodeURIComponent(serverId.trim())}/members/${member.ownerId}`, session.token, undefined, "DELETE");
      setMembers(current => current.filter(item => item.ownerId !== member.ownerId));
      setNotice(`${member.email} was removed from this server.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not remove staff member.");
    } finally { setBusy(false); }
  };

  const signOut = async () => {
    if (session) {
      try { await request("/v1/auth/logout", session.token, {}, "POST"); } catch { /* Clear the local session even if the API is offline. */ }
    }
    setSession(null);
    setMembers([]);
    setOwnedServers([]);
    setHeartbeatHistory([]);
    setLastStatusRefresh(null);
    setServerId("");
    setCreatedInvite(null);
    setNotice("You are signed out.");
  };

  const historySeries = [...heartbeatHistory]
    .filter(record => Number.isFinite(record.playerCount) && Number.isFinite(Date.parse(record.receivedAt)))
    .sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt));
  const selectedCapacity = ownedServers.find(server => server.id === serverId)?.maxPlayers ?? 0;
  const peakPlayers = historySeries.reduce((peak, record) => Math.max(peak, record.playerCount), 0);
  const averagePlayers = historySeries.length
    ? Math.round(historySeries.reduce((sum, record) => sum + record.playerCount, 0) / historySeries.length)
    : 0;
  const chartMax = Math.max(selectedCapacity, peakPlayers, 1);
  const chartPoints = historySeries.map((record, index) => {
    const x = historySeries.length === 1 ? 300 : 12 + (index / (historySeries.length - 1)) * 576;
    const y = 124 - (record.playerCount / chartMax) * 108;
    return { x, y, record };
  });
  const chartPolyline = chartPoints.map(point => `${point.x},${point.y}`).join(" ");

  return (
    <section className="content-area owner-dashboard">
      <div className="eyebrow">COMMUNITY CONTROL</div>
      <div className="owner-heading"><div><h1>Server management</h1><p className="muted">Manage ownership, staff access, and community invitations.</p></div>
        {session && <button className="filter-button owner-signout" onClick={signOut}><LogOut size={15}/> SIGN OUT</button>}
      </div>
      <div className="owner-notice">{notice}</div>
      {!session ? (
        <form className="owner-panel owner-login" onSubmit={signIn}>
          <div className="owner-panel-title"><Shield size={18}/><strong>Owner sign in</strong></div>
          <label>Email address<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/></label>
          <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Your account password"/></label>
          <button className="primary-button" type="submit" disabled={busy}><LogIn size={16}/>{busy ? "SIGNING IN..." : "SIGN IN"}</button>
          <p className="owner-help">Owner accounts are created through the secured bootstrap registration process or a staff invitation.</p>
        </form>
      ) : (
        <>
          <div className="owner-panel">
            <div className="owner-panel-title"><Shield size={18}/><strong>Signed in</strong><span className="owner-role">{session.owner.email}</span></div>
            {ownedServers.length > 0 && <div className="owned-server-list">
              <div className="owned-server-heading">YOUR SERVERS <button type="button" className="status-refresh" onClick={() => session && void refreshOwnedServers(session.token)} disabled={refreshingStatus}><RefreshCw size={13}/>{refreshingStatus ? "UPDATING" : "REFRESH STATUS"}</button></div>
              <small className="status-refresh-time">{lastStatusRefresh ? `Directory refreshed ${new Date(lastStatusRefresh).toLocaleTimeString()}` : "Waiting for first status refresh"}</small>
              {ownedServers.map(server => <button type="button" className={serverId === server.id ? "owned-server selected" : "owned-server"} key={server.id} onClick={() => { setServerId(server.id); setMembers([]); setCreatedInvite(null); setHeartbeatHistory([]); void loadHeartbeatHistory(server.id); }}>
                <span><strong>{server.name}</strong><small>{server.address}:{server.port} · {server.playerCount}/{server.maxPlayers} players</small><small className="heartbeat-time">Last heartbeat: {new Date(server.lastHeartbeatAt).toLocaleString()}</small></span>
                <small className={server.status === "online" ? "server-online" : "server-offline"}>{server.status.toUpperCase()}</small>
              </button>)}
            </div>}
            <label>Server ID<input value={serverId} onChange={event => setServerId(event.target.value)} placeholder="Select a server above or paste its UUID"/></label>
            <div className="owner-actions">
              <button className="primary-button" onClick={loadMembers} disabled={busy || !serverId.trim()}><RefreshCw size={15}/> LOAD STAFF</button>
              <button className="filter-button" onClick={claimServer} disabled={busy || !serverId.trim()}>CLAIM UNOWNED SERVER</button>
            </div>
            <p className="owner-help">Claim only a server you own or operate. A server can have one owner; staff roles are managed separately.</p>
          </div>
          {serverId.trim() && <div className="owner-panel">
            <div className="owner-panel-title"><RefreshCw size={18}/><strong>Heartbeat history</strong><span className="owner-count">{heartbeatHistory.length} records</span></div>
            <p className="owner-help">Recent host check-ins and reported player counts. History is retained up to the latest 1,000 records per server.</p>
            <button type="button" className="status-refresh history-refresh" onClick={() => void loadHeartbeatHistory()} disabled={loadingHistory || !session}>{loadingHistory ? "LOADING..." : "REFRESH HISTORY"}</button>
            {historySeries.length === 0 ? <p className="owner-help">No heartbeat history is available yet. A host must send a heartbeat after this feature is deployed.</p> : <>
              <div className="heartbeat-summary">
                <div><strong>{historySeries[historySeries.length - 1].record.playerCount}</strong><small>LATEST REPORTED</small></div>
                <div><strong>{peakPlayers}</strong><small>RECENT PEAK</small></div>
                <div><strong>{averagePlayers}</strong><small>AVERAGE</small></div>
              </div>
              <div className="heartbeat-chart-wrap">
                <div className="heartbeat-chart-heading"><strong>PLAYER COUNT TREND</strong><small>OLDEST → NEWEST · {historySeries.length} SAMPLES</small></div>
                <svg className="heartbeat-chart" viewBox="0 0 600 140" role="img" aria-label="Host-reported player count trend, oldest to newest">
                  <line x1="12" y1="124" x2="588" y2="124" className="heartbeat-chart-axis"/>
                  <line x1="12" y1="70" x2="588" y2="70" className="heartbeat-chart-grid"/>
                  {chartPoints.length > 1 && <polyline points={chartPolyline} className="heartbeat-chart-line"/>}
                  {chartPoints.map((point, index) => <circle key={`${point.record.receivedAt}-${index}`} cx={point.x} cy={point.y} r="3.5" className="heartbeat-chart-point">
                    <title>{`${point.record.playerCount} players · ${new Date(point.record.receivedAt).toLocaleString()}`}</title>
                  </circle>)}
                </svg>
                <div className="heartbeat-chart-labels"><span>{new Date(historySeries[0].record.receivedAt).toLocaleString()}</span><span>{new Date(historySeries[historySeries.length - 1].record.receivedAt).toLocaleString()}</span></div>
              </div>
              <div className="heartbeat-history-list">{[...heartbeatHistory].map((record, index) => <div className="heartbeat-history-row" key={`${record.receivedAt}-${index}`}>
                <span><strong>{record.playerCount}/{selectedCapacity || "—"} players</strong><small>{new Date(record.receivedAt).toLocaleString()}</small></span>
                <small className="server-online">RECEIVED</small>
              </div>)}</div>
            </>}
          </div>}
          {members.length > 0 && <div className="owner-panel">
            <div className="owner-panel-title"><Users size={18}/><strong>Staff members</strong><span className="owner-count">{members.length}</span></div>
            <div className="owner-members">{members.map(member => <div className="owner-member" key={member.ownerId}>
              <div><strong>{member.email}</strong><small>{member.role.toUpperCase()} · Joined {new Date(member.joinedAt).toLocaleDateString()}</small></div>
              {member.role !== "owner" && <button className="text-danger" onClick={() => removeMember(member)} disabled={busy}>REMOVE</button>}
            </div>)}</div>
          </div>}
          <form className="owner-panel" onSubmit={sendInvite}>
            <div className="owner-panel-title"><MailPlus size={18}/><strong>Invite staff</strong></div>
            <label>Staff email<input type="email" required value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="staff@example.com"/></label>
            <label>Role<select value={inviteRole} onChange={event => setInviteRole(event.target.value as "admin" | "moderator")}><option value="moderator">Moderator</option><option value="admin">Administrator (owner only)</option></select></label>
            <button className="primary-button" type="submit" disabled={busy || !serverId.trim()}><MailPlus size={15}/>{busy ? "WORKING..." : "CREATE INVITATION"}</button>
            {createdInvite && <div className="invite-result"><strong>One-time invitation token</strong><code>{createdInvite.token}</code><button className="filter-button" type="button" onClick={() => void navigator.clipboard?.writeText(createdInvite.token)}><Copy size={14}/> COPY TOKEN</button><small>Expires {new Date(createdInvite.invitation.expiresAt).toLocaleString()}. Share securely; this token is shown only once.</small></div>}
          </form>
        </>
      )}
    </section>
  );
}
