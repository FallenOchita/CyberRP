import { useState } from "react";
import { Copy, LogIn, LogOut, MailPlus, RefreshCw, Shield, Users } from "lucide-react";

type Owner = { id: string; email: string; createdAt: string };
type Member = { ownerId: string; email: string; role: "owner" | "admin" | "moderator"; joinedAt: string };
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
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "moderator">("moderator");
  const [createdInvite, setCreatedInvite] = useState<Invitation | null>(null);
  const [notice, setNotice] = useState("Sign in with your CyberRP owner account to manage a community.");
  const [busy, setBusy] = useState(false);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice("Signing in...");
    try {
      const result = await request<Session>("/v1/auth/login", undefined, { email, password }, "POST");
      setSession(result);
      setPassword("");
      setNotice(`Signed in as ${result.owner.email}. Enter a server ID to manage its staff.`);
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
    setCreatedInvite(null);
    setNotice("You are signed out.");
  };

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
            <label>Server ID<input value={serverId} onChange={event => setServerId(event.target.value)} placeholder="Paste the server UUID"/></label>
            <div className="owner-actions">
              <button className="primary-button" onClick={loadMembers} disabled={busy || !serverId.trim()}><RefreshCw size={15}/> LOAD STAFF</button>
              <button className="filter-button" onClick={claimServer} disabled={busy || !serverId.trim()}>CLAIM UNOWNED SERVER</button>
            </div>
            <p className="owner-help">Claim only a server you own or operate. A server can have one owner; staff roles are managed separately.</p>
          </div>
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
