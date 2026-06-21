import { useState, useEffect } from "react";

// ── FIREBASE ─────────────────────────────────────────────────────────────────
// NOTE: Install firebase: npm install firebase
// Add to your index.html or use Firebase compat CDN
// This uses firebase compat SDK via window globals

declare var firebase: any;

const FB_CONFIG = {
  apiKey: "AIzaSyC395w416jKhqehyQuJppQx4zZiHAqVtu4",
  authDomain: "pickleball-super-league-2.firebaseapp.com",
  databaseURL: "https://pickleball-super-league-2-default-rtdb.firebaseio.com",
  projectId: "pickleball-super-league-2",
  storageBucket: "pickleball-super-league-2.firebasestorage.app",
  messagingSenderId: "374040828267",
  appId: "1:374040828267:web:e1e68f6dc24a86cc94d42e",
};

// ── TYPES ─────────────────────────────────────────────────────────────────────
interface Team {
  id: string;
  name: string;
  color: string;
}

interface Match {
  id: string;
  slot: string;
  label: string;
  a: string;
  b: string;
  court: string;
  ko?: boolean;
}

interface GameScore {
  a: number;
  b: number;
}

interface GamePlayers {
  a: { "1": string; "2": string };
  b: { "1": string; "2": string };
}

interface StandingRow {
  id: string;
  name: string;
  color: string;
  mp: number;
  w: number;
  l: number;
  pts: number;
  npr: number;
}

type Role = "admin" | "ref1" | "ref2" | "ref3" | "spectator";

// ── DATA ──────────────────────────────────────────────────────────────────────
const TEAMS: Team[] = [
  { id: "SS", name: "Serve Strikers",   color: "#E91E6E" },
  { id: "DD", name: "Dink Dragons",     color: "#1565C0" },
  { id: "RR", name: "Rally Racers",     color: "#888888" },
  { id: "KK", name: "Kitchen Kings",    color: "#00897B" },
  { id: "PP", name: "Paddle Panthers",  color: "#7B1FA2" },
  { id: "CC", name: "Court Commanders", color: "#C62828" },
];

const GAME_TYPES = [
  "C Group", "Women's Doubles", "A Group",
  "Mixed Doubles", "C Group", "B Group",
];

const WIN_PTS = 15;

// Pre-loaded standings after all matches till 2PM
const BASELINE: Record<string, StandingRow> = {
  KK: { id: "KK", name: "Kitchen Kings", color: "#00897B", mp: 3, w: 3, l: 0, pts: 3, npr: 17 },
  CC: { id: "CC", name: "Court Commanders", color: "#C62828", mp: 3, w: 2, l: 1, pts: 2, npr: 29 },
  DD: { id: "DD", name: "Dink Dragons", color: "#1565C0", mp: 4, w: 2, l: 2, pts: 2, npr: 14 },
  SS: { id: "SS", name: "Serve Strikers", color: "#E91E6E", mp: 3, w: 1, l: 2, pts: 1, npr: 3 },
  PP: { id: "PP", name: "Paddle Panthers", color: "#7B1FA2", mp: 3, w: 1, l: 2, pts: 1, npr: -28 },
  RR: { id: "RR", name: "Rally Racers", color: "#888888", mp: 4, w: 1, l: 3, pts: 1, npr: -35 },
};

const MATCHES: Match[] = [
  { id:"m6",  slot:"2:00 PM – 4:00 PM",  label:"Match 6",     a:"PP", b:"KK", court:"Court 2" },
  { id:"m7",  slot:"2:00 PM – 4:00 PM",  label:"Match 7",     a:"CC", b:"SS", court:"Court 1" },
  { id:"m8",  slot:"2:00 PM – 4:00 PM",  label:"Match 8",     a:"RR", b:"DD", court:"Court 4" },
  { id:"m9",  slot:"4:00 PM – 6:00 PM",  label:"Match 9",     a:"PP", b:"SS", court:"Court 4" },
  { id:"m10", slot:"4:00 PM – 6:00 PM",  label:"Match 10",    a:"CC", b:"KK", court:"Court 1" },
  { id:"sf1", slot:"6:00 PM – 8:00 PM",  label:"Semi Final 1",a:"TBD",b:"TBD",court:"Court 1", ko:true },
  { id:"sf2", slot:"6:00 PM – 8:00 PM",  label:"Semi Final 2",a:"TBD",b:"TBD",court:"Court 4", ko:true },
  { id:"fin", slot:"Final",              label:"Grand Final", a:"TBD",b:"TBD",court:"Court 1", ko:true },
];

const ROLE_CONFIG: Record<Role, { label: string; color: string; courts: string[]; canScore: boolean; canReset: boolean }> = {
  admin:     { label: "Admin — Full Access",  color: "#D4AC0D", courts: [],           canScore: true,  canReset: true  },
  ref1:      { label: "Referee 1 — Court 1", color: "#4A9EE0", courts: ["Court 1"],  canScore: true,  canReset: false },
  ref2:      { label: "Referee 2 — Court 2", color: "#00C9B1", courts: ["Court 2"],  canScore: true,  canReset: false },
  ref3:      { label: "Referee 3 — Court 4", color: "#B47FE8", courts: ["Court 4"],  canScore: true,  canReset: false },
  spectator: { label: "Live Spectator View", color: "#888888", courts: [],           canScore: false, canReset: false },
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const tn = (id: string): Team => TEAMS.find(t => t.id === id) || { id: "TBD", name: "TBD", color: "#aaa" };

function getGameScore(scores: any, k: string, g: number): GameScore {
  return scores?.[k]?.[g] || { a: 0, b: 0 };
}
function getGameWinner(scores: any, k: string, g: number): "a" | "b" | null {
  const s = getGameScore(scores, k, g);
  if (s.a >= WIN_PTS && s.a - s.b >= 2) return "a";
  if (s.b >= WIN_PTS && s.b - s.a >= 2) return "b";
  return null;
}
function getMatchWins(scores: any, k: string) {
  let a = 0, b = 0;
  for (let g = 0; g < 6; g++) {
    const w = getGameWinner(scores, k, g);
    if (w === "a") a++; else if (w === "b") b++;
  }
  return { a, b };
}
function isMatchDone(scores: any, k: string) {
  const w = getMatchWins(scores, k);
  return w.a + w.b === 6;
}
function isMatchLive(scores: any, k: string) {
  const sc = scores?.[k];
  if (!sc) return false;
  return Object.values(sc).some((g: any) => g?.a > 0 || g?.b > 0) && !isMatchDone(scores, k);
}
function getPlayerName(players: any, k: string, g: number, side: "a"|"b", n: "1"|"2"): string {
  return players?.[k]?.[g]?.[side]?.[n] || "";
}

function calcStandings(scores: any): StandingRow[] {
  const st: Record<string, StandingRow> = {};
  Object.keys(BASELINE).forEach(id => { st[id] = { ...BASELINE[id] }; });
  MATCHES.filter(m => !m.ko).forEach(m => {
    if (!isMatchDone(scores, m.id)) return;
    const w = getMatchWins(scores, m.id);
    const sa = st[m.a], sb = st[m.b];
    if (!sa || !sb) return;
    sa.mp++; sb.mp++;
    for (let g = 0; g < 6; g++) {
      const sc = getGameScore(scores, m.id, g);
      sa.npr += sc.a - sc.b; sb.npr += sc.b - sc.a;
    }
    if (w.a > w.b) { sa.w++; sa.pts++; sb.l++; }
    else if (w.b > w.a) { sb.w++; sb.pts++; sa.l++; }
  });
  return Object.values(st).sort((a, b) => b.pts - a.pts || b.npr - a.npr);
}

function getTop4(scores: any) {
  return calcStandings(scores).slice(0, 4).map(t => t.id);
}
function getSFTeams(scores: any) {
  const top = getTop4(scores);
  if (top.length < 4) return { sf1: { a: "TBD", b: "TBD" }, sf2: { a: "TBD", b: "TBD" } };
  return { sf1: { a: top[0], b: top[3] }, sf2: { a: top[1], b: top[2] } };
}
function getSFWinner(scores: any, idx: number) {
  const sf = getSFTeams(scores);
  const m = idx === 0 ? sf.sf1 : sf.sf2;
  const k = idx === 0 ? "sf1" : "sf2";
  if (!isMatchDone(scores, k)) return "TBD";
  const w = getMatchWins(scores, k);
  return w.a > w.b ? m.a : m.b;
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const S = {
  app: { fontFamily: "sans-serif", background: "#0f0f13", color: "#f0f0f0", minHeight: "100vh" } as React.CSSProperties,
  hdr: { background: "#1a1a22", padding: "13px", textAlign: "center" as const, borderBottom: "1px solid #2a2a35", position: "sticky" as const, top: 0, zIndex: 10 },
  tabs: { display: "flex", background: "#1a1a22", borderBottom: "1px solid #2a2a35", position: "sticky" as const, top: 57, zIndex: 9 },
  page: { padding: "12px" },
  mcard: (live: boolean, done: boolean) => ({
    background: "#1a1a22", border: `1px solid ${done ? "#166534" : live ? "#4f4fff" : "#2a2a35"}`,
    borderRadius: 10, padding: 11, marginBottom: 8, cursor: "pointer" as const,
  }),
  pill: (st: "live"|"done"|"up") => ({
    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
    background: st==="live" ? "#4f4fff22" : st==="done" ? "#166534" : "#1a1a22",
    color: st==="live" ? "#4f4fff" : st==="done" ? "#bbf7d0" : "#444",
    border: st==="up" ? "1px solid #2a2a35" : "none",
  }),
  grow: (w: "a"|"b"|null) => ({
    background: "#111118", borderRadius: 7, padding: "7px 9px",
    borderLeft: `3px solid ${w==="a" ? "#22c55e" : w==="b" ? "#ef4444" : "#2a2a35"}`,
    marginBottom: 4,
  }),
  scorer: { background: "#111118", borderRadius: 8, padding: 10, marginTop: 8, border: "1px solid #2a2a35" },
  pinput: { width: "100%", background: "#0f0f13", border: "1px solid #2a2a35", borderRadius: 5, padding: "4px 6px", color: "#f0f0f0", fontSize: 11, marginBottom: 3, outline: "none" },
  sbtn: (color: string) => ({ width: 40, height: 40, borderRadius: "50%", border: "none", background: color, fontSize: 22, cursor: "pointer", color: "#0f0f13", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }),
  stbl: { width: "100%", borderCollapse: "collapse" as const, fontSize: 12 },
};

// ── COMPONENTS ────────────────────────────────────────────────────────────────

function ScoreCard({ matchId, gameIdx, teamA, teamB, scores, players, canScore, canReset, onInc, onReset, onSavePlayer }: any) {
  const cur = getGameScore(scores, matchId, gameIdx);
  const gwn = getGameWinner(scores, matchId, gameIdx);
  return (
    <div style={S.scorer}>
      {/* Game tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 8, overflowX: "auto" }}>
        {GAME_TYPES.map((_, i) => {
          const gsc = getGameScore(scores, matchId, i);
          const gw = getGameWinner(scores, matchId, i);
          const col = gw==="a" ? teamA.color : gw==="b" ? teamB.color : "#444";
          return (
            <div key={i} onClick={() => canScore && onInc && null}
              style={{ flexShrink:0, padding:"4px 8px", borderRadius:8, border:`1px solid ${i===gameIdx?"#4f4fff":"#2a2a35"}`,
                background:i===gameIdx?"#4f4fff":"#1a1a22", cursor:"pointer", textAlign:"center", fontSize:10, fontWeight:700,
                color:i===gameIdx?"#fff":"#555", minWidth:36 }}>
              G{i+1}{(gsc.a>0||gsc.b>0) && <div style={{fontSize:9,color:i===gameIdx?"#fff":col}}>{gsc.a}-{gsc.b}</div>}
            </div>
          );
        })}
      </div>
      <div style={{textAlign:"center",fontSize:11,color:"#888",fontWeight:700,marginBottom:8,background:"#1a1a22",borderRadius:5,padding:3}}>
        {GAME_TYPES[gameIdx]}
      </div>
      {/* Player names */}
      <div style={{background:"#0f0f13",borderRadius:7,padding:7,marginBottom:8,border:"1px solid #2a2a35"}}>
        <div style={{fontSize:9,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5}}>Player Names</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
          {[{team:teamA,side:"a"},{team:teamB,side:"b"}].map(({team,side})=>(
            <div key={side} style={{background:"#1a1a22",borderRadius:5,padding:5}}>
              <div style={{fontSize:9,fontWeight:700,color:team.color,textTransform:"uppercase",marginBottom:3}}>{team.name}</div>
              {["1","2"].map(n=>(
                <input key={n} style={S.pinput as any}
                  defaultValue={getPlayerName(players, matchId, gameIdx, side as any, n as any)}
                  placeholder={`Player ${n}`}
                  onBlur={e => canScore && onSavePlayer(matchId, gameIdx, side, n, e.target.value)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* Score buttons */}
      {canScore && (
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {[{team:teamA,side:"a"},{team:teamB,side:"b"}].map(({team,side},si)=>(
            <>
              {si===1 && <span style={{color:"#222",fontSize:20,fontWeight:700,flexShrink:0}}>-</span>}
              <div key={side} style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:team.color,marginBottom:3}}>{team.name}</div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  <button style={{...S.sbtn("#1a1a22"),color:"#f0f0f0",border:"1px solid #2a2a35"}} onClick={()=>onInc(matchId,gameIdx,side,-1)}>-</button>
                  <span style={{fontSize:42,fontWeight:800,minWidth:50,textAlign:"center",lineHeight:1,color:team.color}}>
                    {side==="a"?cur.a:cur.b}
                  </span>
                  <button style={S.sbtn(team.color)} onClick={()=>onInc(matchId,gameIdx,side,1)}>+</button>
                </div>
                <div style={{fontSize:9,color:"#444",marginTop:2}}>First to {WIN_PTS} (win by 2)</div>
              </div>
            </>
          ))}
        </div>
      )}
      {gwn && (
        <div style={{textAlign:"center",marginTop:8}}>
          <span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20,background:"#166534",color:"#bbf7d0"}}>
            {gwn==="a"?teamA.name:teamB.name} wins this game!
          </span>
        </div>
      )}
      <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:10}}>
        {canReset && (
          <button onClick={()=>{ if(window.confirm("Reset match?")) onReset(matchId); }}
            style={{padding:"4px 12px",background:"#2D1010",color:"#ef4444",border:"1px solid #ef444330",borderRadius:7,fontSize:10,fontWeight:700,cursor:"pointer"}}>
            Reset Match
          </button>
        )}
      </div>
    </div>
  );
}

function MatchCard({ m, scores, players, canScore, canReset, role, activeMatch, activeGame, setActiveMatch, setActiveGame, onInc, onReset, onSavePlayer }: any) {
  const sf = getSFTeams(scores);
  let ai = m.a, bi = m.b;
  if (m.id==="sf1") { ai=sf.sf1.a; bi=sf.sf1.b; }
  else if (m.id==="sf2") { ai=sf.sf2.a; bi=sf.sf2.b; }
  else if (m.id==="fin") { ai=getSFWinner(scores,0); bi=getSFWinner(scores,1); }
  const ta = tn(ai), tb = tn(bi);
  const w = getMatchWins(scores, m.id);
  const done = isMatchDone(scores, m.id);
  const live = isMatchLive(scores, m.id);
  const cfg = ROLE_CONFIG[role as Role];
  const editable = cfg.canScore && (cfg.courts.length===0 || cfg.courts.includes(m.court));
  const isActive = activeMatch === m.id;

  const handleClick = () => {
    if (!editable) return;
    if (isActive) setActiveMatch(null);
    else { setActiveMatch(m.id); setActiveGame(0); }
  };

  return (
    <div style={S.mcard(live,done)} onClick={handleClick}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,gap:4,flexWrap:"wrap"}}>
        <span style={{fontSize:10,fontWeight:700,color:"#444",textTransform:"uppercase"}}>{m.label}</span>
        <span style={{fontSize:10,color:"#333"}}>{m.court}</span>
        <span style={S.pill(done?"done":live?"live":"up") as any}>{done?"Done":live?"Live":"Upcoming"}</span>
      </div>
      {/* Teams & score */}
      <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:6,alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{width:9,height:9,borderRadius:"50%",background:ta.color,flexShrink:0,display:"inline-block"}}></span>
          <span style={{fontSize:12,fontWeight:700,color:done&&w.a>w.b?ta.color:"#f0f0f0"}}>{ta.name}</span>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:24,fontWeight:800,lineHeight:1,color:"#f0f0f0"}}>{live||done?`${w.a}-${w.b}`:"-"}</div>
          <div style={{fontSize:9,color:"#444",textTransform:"uppercase",marginTop:1}}>games</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5,flexDirection:"row-reverse"}}>
          <span style={{width:9,height:9,borderRadius:"50%",background:tb.color,flexShrink:0,display:"inline-block"}}></span>
          <span style={{fontSize:12,fontWeight:700,color:done&&w.b>w.a?tb.color:"#f0f0f0"}}>{tb.name}</span>
        </div>
      </div>
      {/* Game rows */}
      {Array.from({length:6}).map((_,g)=>{
        const sc = getGameScore(scores, m.id, g);
        const gw2 = getGameWinner(scores, m.id, g);
        const p1a = getPlayerName(players,m.id,g,"a","1");
        const p2a = getPlayerName(players,m.id,g,"a","2");
        const p1b = getPlayerName(players,m.id,g,"b","1");
        const p2b = getPlayerName(players,m.id,g,"b","2");
        if (!sc.a && !sc.b && !p1a && !p1b) return null;
        const paS = p1a&&p2a?`${p1a} / ${p2a}`:p1a;
        const pbS = p1b&&p2b?`${p1b} / ${p2b}`:p1b;
        return (
          <div key={g} style={S.grow(gw2)}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
              <span style={{fontSize:10,fontWeight:700,color:"#444",textTransform:"uppercase"}}>{GAME_TYPES[g]}</span>
              <span style={{fontSize:12,fontWeight:800,color:gw2==="a"?"#22c55e":gw2==="b"?"#ef4444":"#555"}}>{sc.a} - {sc.b}</span>
            </div>
            {(paS||pbS) && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 24px 1fr",gap:2,marginTop:2}}>
                <div style={{fontSize:10,color:"#666"}}>{paS}</div>
                <div style={{fontSize:9,color:"#333",textAlign:"center"}}>vs</div>
                <div style={{fontSize:10,color:"#666",textAlign:"right"}}>{pbS}</div>
              </div>
            )}
          </div>
        );
      })}
      {done && (
        <div style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20,background:"#166534",color:"#bbf7d0",marginTop:6,display:"inline-block"}}>
          {w.a>w.b?ta.name:tb.name} wins the match!
        </div>
      )}
      {!editable && <div style={{fontSize:10,color:"#2a2a3e",textAlign:"right",marginTop:4}}>🔒 {m.court}</div>}
      {editable && isActive && (
        <ScoreCard
          matchId={m.id} gameIdx={activeGame}
          teamA={ta} teamB={tb}
          scores={scores} players={players}
          canScore={cfg.canScore} canReset={cfg.canReset}
          onInc={onInc} onReset={onReset} onSavePlayer={onSavePlayer}
        />
      )}
      {editable && isActive && (
        <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:8}}>
          {activeGame>0 && <button onClick={e=>{e.stopPropagation();setActiveGame((g:number)=>g-1);}} style={{padding:"5px 14px",borderRadius:8,border:"1px solid #2a2a35",background:"#1a1a22",color:"#f0f0f0",cursor:"pointer",fontSize:11,fontWeight:700}}>← Prev</button>}
          {activeGame<5 && <button onClick={e=>{e.stopPropagation();setActiveGame((g:number)=>g+1);}} style={{padding:"5px 14px",borderRadius:8,border:"none",background:"#4f4fff",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>Next →</button>}
        </div>
      )}
    </div>
  );
}

function StandingsTab({ scores }: { scores: any }) {
  const rows = calcStandings(scores);
  return (
    <div style={S.page}>
      <div style={{fontSize:10,color:"#f59e0b",background:"#2a1a00",border:"1px solid #f59e0b33",borderRadius:7,padding:"7px 10px",marginBottom:10}}>
        Pre-loaded: All matches till 2PM · Updates live as remaining matches finish
      </div>
      <table style={S.stbl}>
        <thead>
          <tr>{["#","Team","P","W","L","PTS","NPR"].map(h=>(
            <th key={h} style={{padding:"6px 4px",textAlign:h==="Team"?"left":"center",fontSize:9,fontWeight:700,color:"#444",borderBottom:"1px solid #2a2a35",textTransform:"uppercase"}}>
              {h}
            </th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <>
              <tr key={t.id}>
                <td style={{padding:"7px 4px",textAlign:"center",color:"#444",borderBottom:"1px solid #1a1a22"}}>{i+1}</td>
                <td style={{padding:"7px 4px",borderBottom:"1px solid #1a1a22"}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:t.color,display:"inline-block"}}></span>
                    {t.name}
                    {i<4 && <span style={{fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:3,background:"#7c3aed22",color:"#a78bfa"}}>SF</span>}
                    {i>=4 && <span style={{fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:3,background:"#ef444422",color:"#f87171"}}>OUT</span>}
                  </span>
                </td>
                {[t.mp,t.w,t.l,t.pts].map((v,vi)=>(
                  <td key={vi} style={{padding:"7px 4px",textAlign:"center",color:vi===1?"#22c55e":vi===2?"#ef4444":vi===3?t.color:"#555",fontWeight:vi===3?800:400,fontSize:vi===3?14:12,borderBottom:"1px solid #1a1a22"}}>
                    {v}
                  </td>
                ))}
                <td style={{padding:"7px 4px",textAlign:"center",color:t.npr>=0?"#22c55e":"#ef4444",fontWeight:700,borderBottom:"1px solid #1a1a22"}}>
                  {t.npr>0?`+${Math.round(t.npr)}`:Math.round(t.npr)}
                </td>
              </tr>
              {i===1 && <tr key="sep1"><td colSpan={7}><div style={{textAlign:"center",fontSize:9,padding:"3px 0",borderTop:"1px dashed #D4AC0D40",color:"#D4AC0D"}}>-- Top 4 qualify for Semis --</div></td></tr>}
              {i===3 && <tr key="sep2"><td colSpan={7}><div style={{textAlign:"center",fontSize:9,padding:"3px 0",borderTop:"1px dashed #ef444430",color:"#ef4444"}}>-- Bottom 2 eliminated --</div></td></tr>}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BracketTab({ scores }: { scores: any }) {
  const top4 = getTop4(scores);
  if (top4.length < 4) return <div style={{textAlign:"center",padding:30,color:"#444",fontSize:12}}>Bracket available after league stage</div>;
  const sf = getSFTeams(scores);
  const f0 = getSFWinner(scores, 0), f1 = getSFWinner(scores, 1);
  const fw = getMatchWins(scores, "fin"), fd = isMatchDone(scores, "fin");
  const champ = fd ? (fw.a>fw.b ? tn(f0) : tn(f1)) : null;
  const BCard = ({ ai, bi, k, lbl }: any) => {
    const ta=tn(ai),tb=tn(bi),w=getMatchWins(scores,k),dn=isMatchDone(scores,k);
    return (
      <>
        <div style={{fontSize:10,color:"#444",fontWeight:700,textTransform:"uppercase",margin:"10px 0 5px"}}>{lbl}</div>
        <div style={{background:"#1a1a22",border:`1px solid ${dn?"#166534":"#2a2a35"}`,borderRadius:8,overflow:"hidden",marginBottom:8}}>
          {[{t:ta,w:dn&&w.a>w.b,sc:dn?w.a:"-"},{t:tb,w:dn&&w.b>w.a,sc:dn?w.b:"-"}].map(({t,w:win,sc},i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 10px",borderTop:i>0?"1px solid #2a2a35":"none"}}>
              <span style={{width:9,height:9,borderRadius:"50%",background:t.color,display:"inline-block"}}></span>
              <span style={{flex:1,fontSize:12,color:win?"#22c55e":"#f0f0f0",fontWeight:win?700:400}}>{t.name}</span>
              <span style={{fontSize:14,fontWeight:800,color:"#f0f0f0"}}>{sc}</span>
            </div>
          ))}
        </div>
      </>
    );
  };
  return (
    <div style={S.page}>
      <BCard ai={sf.sf1.a} bi={sf.sf1.b} k="sf1" lbl="Semi Final 1 — Rank 1 vs Rank 4" />
      <BCard ai={sf.sf2.a} bi={sf.sf2.b} k="sf2" lbl="Semi Final 2 — Rank 2 vs Rank 3" />
      <BCard ai={f0} bi={f1} k="fin" lbl="Grand Final" />
      {champ && (
        <div style={{background:"#166534",borderRadius:10,padding:14,textAlign:"center",marginTop:10}}>
          <div style={{fontSize:10,color:"#86efac",textTransform:"uppercase",letterSpacing:"0.06em"}}>🏆 PSL 2026 Champion</div>
          <div style={{fontSize:18,fontWeight:700,color:"#fff",marginTop:5}}>{champ.name}</div>
        </div>
      )}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function PSLApp({ initialRole, hideRoleSelector }: { initialRole?: Role; hideRoleSelector?: boolean } = {}) {
  const [role, setRole] = useState<Role>(initialRole || "admin");
  const [tab, setTab] = useState<"scores"|"standings"|"bracket">("scores");
  const [scores, setScores] = useState<any>({});
  const [players, setPlayers] = useState<any>({});
  const [connected, setConnected] = useState(false);
  const [activeMatch, setActiveMatch] = useState<string|null>(null);
  const [activeGame, setActiveGame] = useState(0);
  const [db, setDb] = useState<any>(null);

  const cfg = ROLE_CONFIG[role];
  const slots = [...new Set(MATCHES.filter(m=>!m.ko).map(m=>m.slot))];

  // Firebase init
  useEffect(() => {
    try {
      let app: any;
      try { app = firebase.app("PSL_REACT"); }
      catch(e) { app = firebase.initializeApp(FB_CONFIG, "PSL_REACT"); }
      const database = firebase.database(app);
      setDb(database);
      database.ref(".info/connected").on("value", (s: any) => setConnected(!!s.val()));
      database.ref("scores").on("value", (s: any) => setScores(s.val() || {}));
      database.ref("players").on("value", (s: any) => setPlayers(s.val() || {}));
    } catch(e) { console.error("Firebase error:", e); }
  }, []);

  const pushScore = (k: string, data: any) => { try { db?.ref(`scores/${k}`).set(data); } catch(e){} };
  const pushPlayer = (k: string, data: any) => { try { db?.ref(`players/${k}`).set(data); } catch(e){} };

  const handleInc = (matchId: string, gameIdx: number, side: string, delta: number) => {
    const newScores = JSON.parse(JSON.stringify(scores));
    if (!newScores[matchId]) newScores[matchId] = {};
    if (!newScores[matchId][gameIdx]) newScores[matchId][gameIdx] = { a: 0, b: 0 };
    const v = (newScores[matchId][gameIdx][side] || 0) + delta;
    newScores[matchId][gameIdx][side] = Math.max(0, v);
    setScores(newScores);
    pushScore(matchId, newScores[matchId]);
  };

  const handleReset = (matchId: string) => {
    const newScores = { ...scores, [matchId]: {} };
    const newPlayers = { ...players, [matchId]: {} };
    setScores(newScores);
    setPlayers(newPlayers);
    setActiveMatch(null);
    pushScore(matchId, {});
    pushPlayer(matchId, {});
  };

  const handleSavePlayer = (matchId: string, gameIdx: number, side: string, n: string, value: string) => {
    const newPlayers = JSON.parse(JSON.stringify(players));
    if (!newPlayers[matchId]) newPlayers[matchId] = {};
    if (!newPlayers[matchId][gameIdx]) newPlayers[matchId][gameIdx] = { a: {}, b: {} };
    if (!newPlayers[matchId][gameIdx][side]) newPlayers[matchId][gameIdx][side] = {};
    newPlayers[matchId][gameIdx][side][n] = value;
    setPlayers(newPlayers);
    pushPlayer(matchId, newPlayers[matchId]);
  };

  return (
    <div style={S.app}>
      {/* Header */}
      <div style={S.hdr}>
        <div style={{fontSize:16,fontWeight:700}}>🏓 Pickleball Super League 2026</div>
        <div style={{fontSize:11,color:connected?"#22c55e":"#f59e0b",marginTop:3,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:connected?"#22c55e":"#f59e0b",display:"inline-block",animation:connected?"pulse 1.5s infinite":"none"}}></span>
          {connected ? "Live · Auto-updating" : "Connecting..."}
        </div>
      </div>

      {/* Role selector — separated groups: Admin | Referees | Spectator */}
      {!hideRoleSelector && (
        <div style={{padding:"8px 10px",background:"#111118",borderBottom:"1px solid #1a1a22"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,justifyContent:"space-between"}}>
          {/* Admin */}
          <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-start"}}>
            <div style={{fontSize:10,color:"#444",fontWeight:700,textTransform:"uppercase"}}>Admin</div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setRole("admin")}
                style={{flexShrink:0,fontSize:11,fontWeight:700,padding:"6px 14px",borderRadius:20,
                  border:`1px solid ${role==="admin"?ROLE_CONFIG.admin.color:"#2a2a35"}`,
                  background:role==="admin"?ROLE_CONFIG.admin.color+"20":"#1a1a22",
                  color:role==="admin"?ROLE_CONFIG.admin.color:"#555",cursor:"pointer"}}>
                👑 Admin
              </button>
            </div>
          </div>

          {/* Referees */}
          <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"center",flex:1}}>
            <div style={{fontSize:10,color:"#444",fontWeight:700,textTransform:"uppercase"}}>Referees</div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setRole("ref1")}
                style={{flexShrink:0,fontSize:11,fontWeight:700,padding:"6px 12px",borderRadius:20,
                  border:`1px solid ${role==="ref1"?ROLE_CONFIG.ref1.color:"#2a2a35"}`,
                  background:role==="ref1"?ROLE_CONFIG.ref1.color+"20":"#1a1a22",
                  color:role==="ref1"?ROLE_CONFIG.ref1.color:"#555",cursor:"pointer"}}>
                🔵 Ref 1
              </button>
              <button onClick={()=>setRole("ref2")}
                style={{flexShrink:0,fontSize:11,fontWeight:700,padding:"6px 12px",borderRadius:20,
                  border:`1px solid ${role==="ref2"?ROLE_CONFIG.ref2.color:"#2a2a35"}`,
                  background:role==="ref2"?ROLE_CONFIG.ref2.color+"20":"#1a1a22",
                  color:role==="ref2"?ROLE_CONFIG.ref2.color:"#555",cursor:"pointer"}}>
                🟢 Ref 2
              </button>
              <button onClick={()=>setRole("ref3")}
                style={{flexShrink:0,fontSize:11,fontWeight:700,padding:"6px 12px",borderRadius:20,
                  border:`1px solid ${role==="ref3"?ROLE_CONFIG.ref3.color:"#2a2a35"}`,
                  background:role==="ref3"?ROLE_CONFIG.ref3.color+"20":"#1a1a22",
                  color:role==="ref3"?ROLE_CONFIG.ref3.color:"#555",cursor:"pointer"}}>
                🟣 Ref 3
              </button>
            </div>
          </div>

          {/* Spectator */}
          <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
            <div style={{fontSize:10,color:"#444",fontWeight:700,textTransform:"uppercase"}}>Spectator</div>
            <div>
              <button onClick={()=>setRole("spectator")}
                style={{flexShrink:0,fontSize:11,fontWeight:700,padding:"6px 14px",borderRadius:20,
                  border:`1px solid ${role==="spectator"?ROLE_CONFIG.spectator.color:"#2a2a35"}`,
                  background:role==="spectator"?ROLE_CONFIG.spectator.color+"20":"#1a1a22",
                  color:role==="spectator"?ROLE_CONFIG.spectator.color:"#555",cursor:"pointer"}}>
                👁️ View
              </button>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Tabs */}
      <div style={S.tabs}>
        {(["scores","standings","bracket"] as const).map(t=>(
          <div key={t} onClick={()=>setTab(t)}
            style={{...S.tabs,flex:1,padding:"10px 4px",textAlign:"center",fontSize:11,fontWeight:700,
              color:tab===t?"#4f4fff":"#555",borderBottom:`2px solid ${tab===t?"#4f4fff":"transparent"}`,cursor:"pointer",
              background:"transparent",display:"block"}}>
            {t==="scores"?"📊 Live Scores":t==="standings"?"🏆 Standings":"🥊 Bracket"}
          </div>
        ))}
      </div>

      {/* Content */}
      {tab === "scores" && (
        <div style={S.page}>
          {/* MD1 summary */}
          <div style={{background:"#1a1a22",border:"1px solid #2a2a35",borderRadius:10,padding:10,marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,color:"#f59e0b",textTransform:"uppercase",marginBottom:7}}>Standings after all matches till 2PM</div>
            {Object.values(BASELINE).sort((a,b)=>b.pts-a.pts||b.npr-a.npr).map((t,i)=>(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:5,padding:"3px 0",fontSize:11,borderBottom:"1px solid #1e1e2e",color:"#888"}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:t.color,flexShrink:0,display:"inline-block"}}></span>
                <b style={{color:t.color}}>{i+1}. {t.name}</b>
                <span style={{marginLeft:5}}>{t.w}W {t.l}L · Pts:{t.pts} · NPR:{t.npr>0?"+":""}{t.npr}</span>
              </div>
            ))}
          </div>
          {slots.map(slot=>(
            <div key={slot}>
              <div style={{fontSize:10,fontWeight:700,color:"#444",textTransform:"uppercase",letterSpacing:"0.07em",margin:"14px 0 6px"}}>{slot}</div>
              {MATCHES.filter(m=>m.slot===slot&&!m.ko).map(m=>(
                <MatchCard key={m.id} m={m} scores={scores} players={players}
                  role={role} canScore={cfg.canScore} canReset={cfg.canReset}
                  activeMatch={activeMatch} activeGame={activeGame}
                  setActiveMatch={setActiveMatch} setActiveGame={setActiveGame}
                  onInc={handleInc} onReset={handleReset} onSavePlayer={handleSavePlayer} />
              ))}
            </div>
          ))}
          <div style={{fontSize:10,fontWeight:700,color:"#444",textTransform:"uppercase",letterSpacing:"0.07em",margin:"14px 0 6px"}}>Knock-outs</div>
          {MATCHES.filter(m=>m.ko).map(m=>(
            <MatchCard key={m.id} m={m} scores={scores} players={players}
              role={role} canScore={cfg.canScore} canReset={cfg.canReset}
              activeMatch={activeMatch} activeGame={activeGame}
              setActiveMatch={setActiveMatch} setActiveGame={setActiveGame}
              onInc={handleInc} onReset={handleReset} onSavePlayer={handleSavePlayer} />
          ))}
        </div>
      )}
      {tab === "standings" && <StandingsTab scores={scores} />}
      {tab === "bracket" && <BracketTab scores={scores} />}
    </div>
  );
}
