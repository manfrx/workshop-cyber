/*
 * Plataforma do Workshop (AMBIENTE DE TREINAMENTO)
 * ================================================
 * - Auto-cadastro + login (cada manager tem sua conta).
 * - Webmail com a quest de phishing (classificar e-mails).
 *   Sem feedback de acerto/erro ao jogador; após confirmar o veredito, o
 *   e-mail sai da caixa de entrada.
 * - Submissão das flags dos Cenários 1 e 2.
 * - Placar (dashboard) com a pontuação de todos: acerto +10, erro -5, flag +100.
 * - A caixa de entrada (Cenário 3) começa BLOQUEADA e invisível; o instrutor
 *   libera em /admin (login admin/senha) quando a turma chegar nesse cenário.
 *   O painel também dispara /hack e /voltar em todas as VMs (porta SIM_PORT).
 *
 * UI própria com tema "cyber" escuro (neon ciano/violeta, fonte mono).
 */
const express = require('express');
const session = require('express-session');
const db = require('./db');
const EMAILS = require('./emails');

const app = express();
const PORT = process.env.PORT || 3000;
const PHISHING_URL = process.env.PHISHING_URL || 'http://localhost:3003/documento';
const ADMIN_KEY = process.env.ADMIN_KEY || 'instrutor';
// Autenticação do painel do instrutor (login HTTP Basic).
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Cyber@2022';
// VMs de participante p/ disparar a simulação (/hack e /voltar) na porta SIM_PORT.
const SIM_PORT = process.env.SIM_PORT || '10000';
const PARTICIPANT_IPS = (process.env.PARTICIPANT_IPS || '')
  .split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'workshop',
  resave: false, saveUninitialized: false,
}));

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'colega';
const initials = (n) => String(n||'').split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase() || '?';

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  const u = db.getUser(req.session.user);
  if (!u) { req.session.destroy(()=>{}); return res.redirect('/login'); }
  req.me = u; next();
}
// Cenário 3 ainda não liberado: a caixa de entrada não existe para o participante.
function requireMail(req, res, next) {
  if (db.isMailUnlocked()) return next();
  if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'Cenário ainda não liberado.' });
  res.redirect('/flags');
}
const home = () => db.isMailUnlocked() ? '/mail' : '/flags';

/* ============================ tema (compartilhado) ============================ */
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">`;

const THEME_CSS = `
  :root{
    --bg:#05070d;--panel:rgba(12,18,30,.72);--panel2:rgba(255,255,255,.025);
    --line:rgba(0,229,255,.14);--line2:rgba(148,163,184,.11);
    --text:#e6edf7;--soft:#b4c0d3;--muted:#7a879e;
    --cyan:#00e5ff;--green:#22ff9a;--red:#ff3d71;--amber:#ffb020;--violet:#8b5cf6;
    --mono:'JetBrains Mono',ui-monospace,Consolas,monospace;--sans:'Inter',system-ui,'Segoe UI',sans-serif;
  }
  *{box-sizing:border-box}
  html,body{margin:0;color:var(--text);font-family:var(--sans);-webkit-font-smoothing:antialiased}
  body{min-height:100vh;background:
    radial-gradient(1100px 600px at 8% -12%,rgba(0,229,255,.11),transparent 60%),
    radial-gradient(900px 520px at 108% 4%,rgba(139,92,246,.14),transparent 60%),var(--bg)}
  body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
    background-image:linear-gradient(rgba(0,229,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,.045) 1px,transparent 1px);
    background-size:44px 44px;-webkit-mask-image:radial-gradient(ellipse at 50% 30%,#000 20%,transparent 75%);mask-image:radial-gradient(ellipse at 50% 30%,#000 20%,transparent 75%)}
  a{color:var(--cyan);text-decoration:none}
  ::selection{background:rgba(0,229,255,.3)}
  ::-webkit-scrollbar{width:9px;height:9px} ::-webkit-scrollbar-thumb{background:rgba(148,163,184,.18);border-radius:9px}
  ::-webkit-scrollbar-track{background:transparent}
  @keyframes pulse{50%{opacity:.3}}
  @keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

  .topbar{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:14px;height:60px;padding:0 22px;
    background:rgba(5,7,13,.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
  .brand{display:flex;align-items:center;gap:11px;font-family:var(--mono);font-weight:700;letter-spacing:.1em;font-size:13.5px;color:var(--text);white-space:nowrap}
  .brand .mk{width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--cyan);border-radius:9px;color:var(--cyan);font-size:15px;
    box-shadow:0 0 18px rgba(0,229,255,.35),inset 0 0 12px rgba(0,229,255,.15)}
  .brand b{color:var(--cyan)}
  .nav{display:flex;gap:4px;margin-left:14px}
  .nav a{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);
    padding:8px 12px;border-radius:9px;border:1px solid transparent;transition:.2s}
  .nav a:hover{color:var(--text);background:rgba(255,255,255,.035)}
  .nav a.on{color:var(--cyan);border-color:var(--line);background:rgba(0,229,255,.07);box-shadow:inset 0 0 14px rgba(0,229,255,.06)}
  .usr{margin-left:auto;display:flex;align-items:center;gap:14px}
  .usr .st{font-family:var(--mono);font-size:11px;color:var(--green);display:flex;align-items:center;gap:7px;letter-spacing:.06em}
  .usr .st i{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 10px var(--green);animation:pulse 2s infinite}
  .usr .nm{font-size:13px;color:var(--soft);max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ava{width:34px;height:34px;flex:none;border-radius:10px;display:grid;place-items:center;font-weight:800;font-size:12.5px;color:#03121a;
    background:linear-gradient(135deg,var(--cyan),var(--violet))}
  .out{font-family:var(--mono);font-size:11.5px;color:var(--muted);letter-spacing:.06em;padding:7px 10px;border:1px solid var(--line2);border-radius:8px;transition:.2s}
  .out:hover{color:var(--red);border-color:rgba(255,61,113,.4)}
  @media(max-width:820px){.nav a .t,.usr .st,.usr .nm,.brand .bt{display:none} .topbar{padding:0 14px;gap:8px} .nav{margin-left:4px}}

  .kicker{font-family:var(--mono);font-size:11.5px;letter-spacing:.14em;color:var(--cyan);text-transform:uppercase;margin-bottom:8px}
  .glass{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:18px;
    backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 24px 70px rgba(0,0,0,.45)}
`;

function topbar(me, active) {
  const lk = (href, key, ic, t) => `<a href="${href}" class="${active===key?'on':''}"><span>${ic}</span><span class="t">${t}</span></a>`;
  return `<header class="topbar">
    <a class="brand" href="/"><span class="mk">◈</span><span class="bt">SEC<b>//</b>OPS ARENA</span></a>
    ${me ? `<nav class="nav">${db.isMailUnlocked() ? lk('/mail','mail','✉','Inbox') : ''}${lk('/flags','flags','⚑','Flags')}${lk('/dashboard','dash','▲','Placar')}</nav>
    <div class="usr"><span class="st"><i></i>ONLINE</span><span class="nm">${esc(me.name)}</span>
      <div class="ava" title="${esc(me.name)}">${esc(initials(me.name))}</div><a class="out" href="/logout">SAIR</a></div>` : ''}
  </header>`;
}

/* ============================ estilo (auth/flags/placar) ============================ */
const BASE_CSS = `
  main{position:relative;z-index:1}
  .center{max-width:440px;margin:9vh auto;padding:0 18px;animation:rise .5s ease both}
  .wrap{max-width:1040px;margin:34px auto 60px;padding:0 18px;animation:rise .45s ease both}
  .card{padding:30px}
  .card.flush{padding:0;overflow:hidden}
  .card::before{content:'';position:absolute;top:-1px;left:24px;right:24px;height:1px;background:linear-gradient(90deg,transparent,var(--cyan),transparent);opacity:.7}
  h1{font-size:26px;margin:0 0 6px;font-weight:800;letter-spacing:-.02em}
  .sub{color:var(--muted);font-size:14px;margin:0 0 20px;line-height:1.55}
  label{display:block;font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--soft);margin:16px 0 7px}
  input{width:100%;padding:12px 14px;background:rgba(2,6,14,.6);border:1px solid var(--line2);border-radius:11px;font-size:15px;color:var(--text);
    outline:none;font-family:inherit;transition:.2s}
  input::placeholder{color:#4b566b}
  input:focus{border-color:var(--cyan);box-shadow:0 0 0 3px rgba(0,229,255,.14),0 0 22px rgba(0,229,255,.12)}
  input.mono{font-family:var(--mono);letter-spacing:.03em}
  .btn{margin-top:22px;width:100%;padding:13px 18px;border:0;border-radius:11px;cursor:pointer;font-family:var(--mono);font-size:13px;font-weight:700;
    letter-spacing:.1em;text-transform:uppercase;color:#03121a;background:linear-gradient(135deg,var(--cyan),#5b8cff);
    box-shadow:0 8px 28px rgba(0,229,255,.25);transition:transform .15s,box-shadow .2s}
  .btn:hover{transform:translateY(-1px);box-shadow:0 10px 34px rgba(0,229,255,.38)}
  .msg{padding:12px 14px;border-radius:11px;font-size:14px;margin-bottom:6px;display:flex;gap:10px;align-items:center}
  .msg.err{background:rgba(255,61,113,.08);color:#ff7d9f;border:1px solid rgba(255,61,113,.3)}
  .msg.ok{background:rgba(34,255,154,.07);color:var(--green);border:1px solid rgba(34,255,154,.28)}
  .muted{color:var(--muted);font-size:13.5px}
  .alt{margin:20px 0 0;text-align:center}
  .term{font-family:var(--mono);font-size:12px;color:var(--muted);margin-bottom:22px;line-height:1.7}
  .term .g{color:var(--green)} .term .c{color:var(--cyan)}

  /* flags */
  .fform{display:flex;gap:12px;align-items:flex-end;margin-top:4px}
  .fform .btn{width:auto;margin:0;white-space:nowrap}
  .chal{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:26px}
  .ch{padding:18px;border-radius:14px;border:1px solid var(--line2);background:var(--panel2);display:flex;align-items:center;gap:14px}
  .ch .ic{width:42px;height:42px;border-radius:11px;display:grid;place-items:center;font-size:18px;flex:none;
    border:1px solid var(--line2);color:var(--muted);background:rgba(255,255,255,.02)}
  .ch .tt{font-weight:600;font-size:14.5px} .ch .pt{font-family:var(--mono);font-size:12px;color:var(--muted);margin-top:3px}
  .ch .tag{margin-left:auto;font-family:var(--mono);font-size:11px;letter-spacing:.08em;padding:5px 10px;border-radius:999px;border:1px solid var(--line2);color:var(--muted)}
  .ch.ok{border-color:rgba(34,255,154,.3);background:rgba(34,255,154,.045)}
  .ch.ok .ic{color:var(--green);border-color:rgba(34,255,154,.35);box-shadow:0 0 18px rgba(34,255,154,.18)}
  .ch.ok .tag{color:var(--green);border-color:rgba(34,255,154,.35)}
  @media(max-width:560px){.fform{flex-direction:column;align-items:stretch}}

  /* placar */
  .phead{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:22px;flex-wrap:wrap}
  .phead .sub{margin:0}
  .live{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:11.5px;letter-spacing:.12em;color:var(--red);
    padding:7px 12px;border:1px solid rgba(255,61,113,.35);border-radius:999px;background:rgba(255,61,113,.06)}
  .live i{width:8px;height:8px;border-radius:50%;background:var(--red);box-shadow:0 0 10px var(--red);animation:pulse 1.4s infinite}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}
  @media(max-width:820px){.stats{grid-template-columns:repeat(2,1fr)}}
  .stat{padding:18px 20px;border-radius:16px}
  .stat .k{font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;color:var(--muted);text-transform:uppercase}
  .stat .v{font-size:30px;font-weight:800;margin-top:6px;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .stat .v small{font-size:14px;color:var(--muted);font-weight:600}
  .stat.hl .v{color:var(--cyan);text-shadow:0 0 22px rgba(0,229,255,.45)}
  .podium{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:18px;align-items:end}
  .podium:empty{display:none}
  @media(max-width:700px){.podium{grid-template-columns:1fr}.pd{order:0!important;min-height:0!important}}
  .pd{padding:20px;border-radius:16px;text-align:center;min-height:170px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px}
  .pd .ava{width:48px;height:48px;border-radius:14px;font-size:16px;margin-bottom:6px}
  .pd .medal{font-family:var(--mono);font-size:11px;letter-spacing:.14em}
  .pd .nm{font-weight:700;font-size:15px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pd .sc{font-family:var(--mono);font-size:22px;font-weight:700}
  .pd.p1{order:2;min-height:210px;border-color:rgba(255,176,32,.45);box-shadow:0 0 40px rgba(255,176,32,.12),0 24px 70px rgba(0,0,0,.45)}
  .pd.p1 .medal,.pd.p1 .sc{color:var(--amber)} .pd.p1 .ava{background:linear-gradient(135deg,#ffd166,var(--amber))}
  .pd.p2{order:1} .pd.p2 .medal,.pd.p2 .sc{color:#cbd5e1} .pd.p2 .ava{background:linear-gradient(135deg,#e2e8f0,#94a3b8)}
  .pd.p3{order:3} .pd.p3 .medal,.pd.p3 .sc{color:#f59e7b} .pd.p3 .ava{background:linear-gradient(135deg,#fdba74,#c2410c)}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th{text-align:left;padding:14px 18px;font-family:var(--mono);color:var(--muted);font-size:10.5px;font-weight:500;text-transform:uppercase;
    letter-spacing:.14em;border-bottom:1px solid var(--line2);background:rgba(255,255,255,.015)}
  td{padding:13px 18px;border-top:1px solid var(--line2);font-variant-numeric:tabular-nums}
  tbody tr{transition:background .2s} tbody tr:hover{background:rgba(0,229,255,.03)}
  td.r,th.r{text-align:right}
  tr.me td{background:rgba(0,229,255,.06)} tr.me td:first-child{box-shadow:inset 3px 0 0 var(--cyan)}
  .rk{font-family:var(--mono);font-weight:700;color:var(--muted)}
  .who{display:flex;align-items:center;gap:12px}
  .who .ava{width:30px;height:30px;border-radius:9px;font-size:11px}
  .who .you{font-family:var(--mono);font-size:10px;letter-spacing:.1em;color:var(--cyan);border:1px solid var(--line);padding:2px 7px;border-radius:999px}
  .bar{display:inline-flex;align-items:center;gap:10px;font-family:var(--mono);font-size:12.5px;color:var(--soft)}
  .bar .tr{width:70px;height:5px;border-radius:9px;background:rgba(148,163,184,.14);overflow:hidden}
  .bar .tr i{display:block;height:100%;background:linear-gradient(90deg,var(--cyan),var(--violet));border-radius:9px}
  .tot{font-family:var(--mono);font-weight:700;font-size:15px;color:var(--text)}
  .tot.neg{color:var(--red)}
  @media(max-width:640px){.hide-sm{display:none} td,th{padding:12px 12px}}

  /* aviso de cenário liberado */
  .unlock{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:50;display:flex;align-items:center;gap:14px;padding:14px 16px 14px 20px;
    border-radius:14px;border:1px solid var(--cyan);background:rgba(5,12,22,.92);box-shadow:0 0 40px rgba(0,229,255,.3),0 20px 60px rgba(0,0,0,.6);
    animation:rise .4s ease both;max-width:calc(100% - 32px)}
  .unlock .t{font-family:var(--mono);font-size:12.5px;letter-spacing:.06em} .unlock .t b{color:var(--cyan)}
  .unlock a{font-family:var(--mono);font-size:12px;font-weight:700;letter-spacing:.08em;color:#03121a;background:linear-gradient(135deg,var(--cyan),#5b8cff);
    padding:9px 14px;border-radius:10px;white-space:nowrap}

  /* admin */
  .sw{display:flex;align-items:center;gap:16px;padding:18px;border-radius:14px;border:1px solid var(--line2);background:var(--panel2);margin-top:6px}
  .sw .st{font-family:var(--mono);font-size:12px;letter-spacing:.1em;padding:6px 12px;border-radius:999px;border:1px solid}
  .sw .st.on{color:var(--green);border-color:rgba(34,255,154,.4)} .sw .st.off{color:var(--amber);border-color:rgba(255,176,32,.4)}
  .sw form{margin-left:auto} .sw .btn{margin:0;width:auto}
  .btn.danger{background:linear-gradient(135deg,var(--red),#ff7a59);color:#fff;box-shadow:0 8px 28px rgba(255,61,113,.25)}
`;

// Para quem já está logado: avisa ao vivo quando o instrutor libera (ou bloqueia) o Cenário 3.
function unlockWatcher() {
  return `<script>(function(){
    const START = ${db.isMailUnlocked()};
    async function chk(){
      try{
        const j = await (await fetch('/api/status')).json();
        if(j.mailUnlocked === START) return;
        clearInterval(t);
        if(!j.mailUnlocked || location.pathname === '/dashboard') return location.reload();
        const d = document.createElement('div'); d.className = 'unlock';
        d.innerHTML = '<span class="t">🔓 <b>CENÁRIO 3</b> LIBERADO — nova mensagem na sua caixa de entrada</span><a href="/mail">ABRIR INBOX ›</a>';
        document.body.appendChild(d);
      }catch(e){}
    }
    const t = setInterval(chk, 4000);
  })();</script>`;
}

function page(title, body, me, active) {
  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · SecOps Arena</title>${FONTS}
<style>${THEME_CSS}${BASE_CSS}</style></head><body>${topbar(me, active)}<main>${body}</main>${me ? unlockWatcher() : ''}</body></html>`;
}

/* ============================ auth ============================ */
app.get('/', (req, res) => res.redirect(req.session.user ? home() : '/login'));

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect(home());
  const m = req.query.err ? `<div class="msg err">⚠ ${esc(req.query.err)}</div>` : '';
  res.send(page('Entrar', `<div class="center"><div class="glass card">
    <div class="kicker">// acesso restrito</div>
    <h1>Bem-vindo, operador</h1>
    <div class="term"><span class="g">$</span> connect <span class="c">secops-arena</span> --auth<br>&gt; aguardando credenciais_</div>
    ${m}
    <form method="POST" action="/login">
      <label>Usuário</label><input name="username" autocomplete="off" required placeholder="ana.silva">
      <label>Senha</label><input type="password" name="password" required placeholder="••••••••">
      <button class="btn">Entrar ›</button>
    </form>
    <p class="muted alt">Ainda não tem conta? <a href="/register">Criar conta</a></p>
  </div></div>`));
});
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const u = db.verifyUser(username, password);
  if (!u) return res.redirect('/login?err=' + encodeURIComponent('Usuário ou senha inválidos.'));
  req.session.user = u.username;
  res.redirect(home());
});

app.get('/register', (req, res) => {
  if (req.session.user) return res.redirect(home());
  const m = req.query.err ? `<div class="msg err">⚠ ${esc(req.query.err)}</div>` : '';
  res.send(page('Criar conta', `<div class="center"><div class="glass card">
    <div class="kicker">// novo operador</div>
    <h1>Criar conta</h1><p class="sub">Cada participante cria sua própria conta para entrar no placar.</p>${m}
    <form method="POST" action="/register">
      <label>Seu nome (aparece no placar)</label><input name="name" autocomplete="off" required maxlength="40" placeholder="Ana Silva">
      <label>Usuário (login)</label><input name="username" autocomplete="off" required placeholder="ana.silva">
      <label>Senha</label><input type="password" name="password" required placeholder="••••••••">
      <button class="btn">Criar conta e entrar ›</button>
    </form>
    <p class="muted alt">Já tem conta? <a href="/login">Entrar</a></p>
  </div></div>`));
});
app.post('/register', (req, res) => {
  const { name, username, password } = req.body;
  const r = db.createUser(username, name, password);
  if (r.error) return res.redirect('/register?err=' + encodeURIComponent(r.error));
  req.session.user = r.user.username;
  res.redirect(home());
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

/* ============================ webmail ============================ */
app.get('/mail', requireAuth, requireMail, (req, res) => {
  const name = req.me.name;
  const done = new Set(db.getClassifiedIds(req.me.username));
  const remaining = EMAILS.filter(e => !done.has(e.id)).map(e => ({
    id: e.id, fromName: e.fromName, fromAddr: e.fromAddr, date: e.date,
    subject: e.subject.replace(/__NAME__/g, firstName(name)),
    preview: e.preview,
    body: e.body.replace(/__NAME__/g, firstName(name)).replace(/__PHISHING_URL__/g, PHISHING_URL),
  }));
  const dataJson = JSON.stringify(remaining).replace(/</g, '\\u003c');
  res.send(mailPage(req.me, dataJson, EMAILS.length));
});

app.post('/api/verdict', requireAuth, requireMail, (req, res) => {
  const emailId = Number(req.body && req.body.emailId);
  const guess = req.body && req.body.guess;
  const email = EMAILS.find(e => e.id === emailId);
  if (!email || !['phishing', 'legit'].includes(guess))
    return res.status(400).json({ error: 'Requisição inválida.' });
  const r = db.recordVerdict(req.me.username, emailId, guess, email.category);
  // Resposta NÃO revela se acertou (sem feedback ao jogador).
  res.json({ ok: true, already: !!r.already });
});

function mailPage(me, dataJson, total) {
  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Inbox · SecOps Arena</title>${FONTS}
<style>${THEME_CSS}
  body{height:100vh;overflow:hidden}
  .app{position:relative;z-index:1;display:grid;grid-template-rows:60px 1fr;height:100vh}
  .main{display:grid;grid-template-columns:250px 390px 1fr;gap:14px;padding:14px;min-height:0}
  .pane{background:var(--panel);border:1px solid var(--line2);border-radius:16px;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
    min-height:0;display:flex;flex-direction:column;overflow:hidden}

  .rail{padding:16px 12px;gap:4px;overflow:auto}
  .mission{padding:16px;border-radius:13px;border:1px solid var(--line);background:linear-gradient(160deg,rgba(0,229,255,.08),rgba(139,92,246,.06));margin-bottom:16px}
  .mission .t{font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;color:var(--cyan)}
  .mission .d{font-size:13px;color:var(--soft);margin:8px 0 14px;line-height:1.5}
  .mission .pr{display:flex;justify-content:space-between;font-family:var(--mono);font-size:11.5px;color:var(--muted);margin-bottom:7px}
  .mission .pr b{color:var(--text)}
  .track{height:6px;border-radius:9px;background:rgba(148,163,184,.14);overflow:hidden}
  .track i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--cyan),var(--violet));box-shadow:0 0 12px rgba(0,229,255,.6);transition:width .5s}
  .grp{font-family:var(--mono);color:var(--muted);font-size:10.5px;letter-spacing:.14em;margin:8px 10px 6px}
  .fold{display:flex;align-items:center;justify-content:space-between;padding:9px 11px;border-radius:10px;cursor:pointer;color:var(--soft);font-size:13.5px;
    border:1px solid transparent;transition:.15s}
  .fold:hover{background:rgba(255,255,255,.035);color:var(--text)}
  .fold.active{background:rgba(0,229,255,.07);border-color:var(--line);color:var(--cyan)}
  .fold .n{display:flex;align-items:center;gap:11px} .fold .n span{width:16px;text-align:center;opacity:.85}
  .fold .c{font-family:var(--mono);font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(0,229,255,.14);color:var(--cyan)}
  .fold .c:empty{display:none}

  .lhd{padding:16px 16px 12px;border-bottom:1px solid var(--line2)}
  .lhd .row{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .lhd h2{margin:0;font-size:17px;font-weight:700;letter-spacing:-.01em}
  .lhd .cnt{font-family:var(--mono);font-size:11px;color:var(--muted)}
  .search{position:relative}
  .search input{width:100%;height:38px;background:rgba(2,6,14,.6);border:1px solid var(--line2);border-radius:10px;padding:0 12px 0 34px;font-size:13.5px;
    color:var(--text);outline:none;font-family:inherit;transition:.2s}
  .search input:focus{border-color:var(--cyan);box-shadow:0 0 0 3px rgba(0,229,255,.12)}
  .search::before{content:'⌕';position:absolute;left:12px;top:50%;transform:translateY(-52%);color:var(--muted);font-size:16px}
  .items{overflow:auto;flex:1;padding:8px}
  .item{position:relative;padding:12px 14px 12px 16px;border-radius:12px;cursor:pointer;display:grid;gap:4px;border:1px solid transparent;
    margin-bottom:4px;transition:background .15s,border-color .15s;animation:rise .3s ease both}
  .item:hover{background:rgba(255,255,255,.03)}
  .item.sel{background:rgba(0,229,255,.07);border-color:var(--line)}
  .item.sel::before{content:'';position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:3px;background:var(--cyan);box-shadow:0 0 10px var(--cyan)}
  .item .l1{display:flex;align-items:center;gap:10px}
  .item .av{width:26px;height:26px;flex:none;border-radius:8px;display:grid;place-items:center;font-size:10.5px;font-weight:800;color:#05070d}
  .item .from{font-weight:700;font-size:14px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .item .date{font-family:var(--mono);color:var(--muted);font-size:11px;white-space:nowrap}
  .item .subj{font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-left:36px}
  .item .prev{font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-left:36px}
  .item .dot{width:7px;height:7px;border-radius:50%;background:var(--cyan);box-shadow:0 0 8px var(--cyan);flex:none}

  .read{position:relative}
  .rscroll{overflow:auto;flex:1;min-height:0}
  .empty{margin:auto;color:var(--muted);text-align:center;padding:40px;max-width:380px;font-size:14px;line-height:1.55}
  .empty .big{width:72px;height:72px;margin:0 auto 18px;display:grid;place-items:center;font-size:30px;border-radius:20px;border:1px solid var(--line);
    background:rgba(0,229,255,.05);color:var(--cyan);box-shadow:0 0 40px rgba(0,229,255,.12)}
  .empty b{color:var(--text);font-size:15px}
  .rtools{display:flex;align-items:center;gap:6px;padding:12px 22px;border-bottom:1px solid var(--line2)}
  .rtools .b{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:9px;cursor:pointer;font-size:12.5px;color:var(--soft);
    border:1px solid var(--line2);background:rgba(255,255,255,.02);transition:.15s}
  .rtools .b:hover{color:var(--text);border-color:rgba(148,163,184,.3)}
  .rtools .back{display:none}
  .rhd{padding:24px 28px 8px}
  .rhd h1{font-size:22px;margin:0 0 18px;font-weight:700;letter-spacing:-.015em;line-height:1.3}
  .rfrom{display:flex;align-items:center;gap:13px;padding:14px;border:1px solid var(--line2);border-radius:13px;background:rgba(2,6,14,.35)}
  .rfrom .av{width:42px;height:42px;flex:none;border-radius:12px;display:grid;place-items:center;font-weight:800;color:#05070d}
  .rfrom .nm{font-weight:700} .rfrom .ad{font-family:var(--mono);color:var(--muted);font-size:12px;margin-top:3px;word-break:break-all}
  .rfrom .dt{margin-left:auto;font-family:var(--mono);color:var(--muted);font-size:11.5px;white-space:nowrap}
  .rbody{padding:18px 28px 30px;font-size:15px;line-height:1.7;max-width:800px;color:#cfd8e6}
  .rbody a{color:var(--cyan);word-break:break-all}
  .rbody div[style]{background:rgba(255,255,255,.03)!important;border-color:var(--line2)!important}
  .verdict{display:flex;align-items:center;gap:12px;padding:14px 22px;border-top:1px solid var(--line);background:rgba(5,7,13,.6);flex-wrap:wrap}
  .verdict .q{font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;color:var(--muted);margin-right:auto}
  .verdict .q b{color:var(--cyan);font-weight:500}
  .vb{display:inline-flex;align-items:center;gap:9px;padding:11px 18px;border-radius:11px;cursor:pointer;font-family:var(--mono);font-size:12.5px;
    font-weight:700;letter-spacing:.08em;text-transform:uppercase;border:1px solid;background:transparent;transition:.18s}
  .vb.ph{color:var(--red);border-color:rgba(255,61,113,.45);background:rgba(255,61,113,.07)}
  .vb.ph:hover{background:rgba(255,61,113,.16);box-shadow:0 0 24px rgba(255,61,113,.3)}
  .vb.lg{color:var(--green);border-color:rgba(34,255,154,.4);background:rgba(34,255,154,.06)}
  .vb.lg:hover{background:rgba(34,255,154,.14);box-shadow:0 0 24px rgba(34,255,154,.25)}

  .toast{position:fixed;bottom:24px;left:50%;transform:translate(-50%,10px);background:rgba(12,18,30,.95);color:var(--text);padding:12px 18px;
    border:1px solid var(--line);border-radius:12px;font-size:13.5px;opacity:0;transition:.25s;z-index:60;box-shadow:0 14px 40px rgba(0,0,0,.5);pointer-events:none}
  .toast.on{opacity:1;transform:translate(-50%,0)}
  .modal{position:fixed;inset:0;background:rgba(2,4,9,.7);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:none;place-items:center;z-index:70}
  .modal.on{display:grid}
  .mbox{padding:26px;max-width:440px;width:92%;animation:rise .25s ease both}
  .mbox .kicker{margin-bottom:10px}
  .mbox h3{margin:0 0 10px;font-size:19px} .mbox p{color:var(--soft);font-size:14px;line-height:1.6;margin:0 0 22px}
  .mbox .acts{display:flex;justify-content:flex-end;gap:10px}
  .mbox .bt{padding:10px 18px;border-radius:10px;border:1px solid var(--line2);background:transparent;color:var(--soft);font-family:var(--mono);
    font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;cursor:pointer}
  .mbox .bt:hover{color:var(--text)}
  .mbox .bt.prim{color:#03121a;background:linear-gradient(135deg,var(--cyan),#5b8cff);border-color:transparent}
  .mbox .bt.prim.ph{background:linear-gradient(135deg,var(--red),#ff7a59);color:#fff}
  .mbox .bt.prim.lg{background:linear-gradient(135deg,var(--green),#00c2a8)}

  @media(max-width:1180px){.main{grid-template-columns:340px 1fr}.rail{display:none}}
  @media(max-width:760px){
    .main{grid-template-columns:1fr;padding:10px}
    .main.reading .listpane{display:none} .main:not(.reading) .read{display:none}
    .rtools .back{display:inline-flex} .rhd,.rbody{padding-left:18px;padding-right:18px}
  }
</style></head>
<body>
<div class="app">
  ${topbar(me, 'mail')}
  <div class="main" id="main">
    <aside class="pane rail">
      <div class="mission">
        <div class="t">◆ MISSÃO ATIVA</div>
        <div class="d">Analise cada e-mail e decida: <b>phishing</b> ou <b>legítimo</b>. O veredito é final.</div>
        <div class="pr"><span>PROGRESSO</span><span><b id="done">0</b>/${total}</span></div>
        <div class="track"><i id="bar"></i></div>
      </div>
      <div class="grp">PASTAS</div>
      <div class="fold active" data-f="inbox"><div class="n"><span>✉</span>Caixa de entrada</div><div class="c" id="c-inbox"></div></div>
      <div class="fold" data-f="sent"><div class="n"><span>➚</span>Enviados</div></div>
      <div class="fold" data-f="drafts"><div class="n"><span>✎</span>Rascunhos</div></div>
      <div class="fold" data-f="archive"><div class="n"><span>▣</span>Arquivo</div></div>
      <div class="fold" data-f="junk"><div class="n"><span>⊘</span>Lixo eletrônico</div></div>
      <div class="fold" data-f="deleted"><div class="n"><span>⌫</span>Excluídos</div></div>
    </aside>

    <section class="pane listpane">
      <div class="lhd">
        <div class="row"><h2 id="folderName">Caixa de entrada</h2><span class="cnt" id="cnt"></span></div>
        <div class="search"><input id="q" placeholder="Buscar remetente, assunto..." autocomplete="off"></div>
      </div>
      <div class="items" id="items"></div>
    </section>

    <section class="pane read" id="read"></section>
  </div>
</div>

<div class="toast" id="toast"></div>
<div class="modal" id="modal"><div class="glass mbox">
  <div class="kicker">// confirmar veredito</div>
  <h3 id="mTitle">Confirmar</h3><p id="mText"></p>
  <div class="acts"><button class="bt" onclick="closeModal()">Cancelar</button>
  <button class="bt prim" id="mOk">Confirmar</button></div>
</div></div>

<script>
let EMAILS = JSON.parse(${JSON.stringify(dataJson)});
const TOTAL = ${total};
let selId = null, curFolder = 'inbox', pending = null, query = '';
const $ = id => document.getElementById(id);
function esc(s){return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function initials(n){return String(n).split(/\\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();}
function avBg(s){let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))%360;return 'linear-gradient(135deg,hsl('+h+' 85% 66%),hsl('+((h+50)%360)+' 80% 58%))';}

function updateProgress(){
  const d = TOTAL - EMAILS.length;
  $('done').textContent = d; $('bar').style.width = (TOTAL ? d/TOTAL*100 : 0) + '%';
}
function emptyReading(){
  $('main').classList.remove('reading');
  $('read').innerHTML = '<div class="empty"><div class="big">⌖</div><b>Nenhum e-mail selecionado</b>'+
    '<div style="margin-top:8px">Selecione uma mensagem e investigue: remetente, domínio, links e tom de urgência.</div></div>';
}
function renderList(){
  const n = EMAILS.length;
  $('c-inbox').textContent = n||'';
  updateProgress();
  if(curFolder!=='inbox'){
    $('cnt').textContent = '';
    $('items').innerHTML = '<div class="empty"><div class="big">∅</div>Nada para mostrar aqui.</div>';
    return;
  }
  if(!n){
    $('cnt').textContent = '';
    $('items').innerHTML = '<div class="empty"><div class="big">✓</div><b>Caixa de entrada zerada!</b>'+
      '<div style="margin-top:8px">Você avaliou todos os e-mails. Confira o <a href="/dashboard">placar</a>.</div></div>';
    return;
  }
  const q = query.toLowerCase();
  const list = q ? EMAILS.filter(e=>(e.fromName+' '+e.fromAddr+' '+e.subject+' '+e.preview).toLowerCase().includes(q)) : EMAILS;
  $('cnt').textContent = list.length + (list.length===1?' MENSAGEM':' MENSAGENS');
  if(!list.length){ $('items').innerHTML = '<div class="empty">Nenhum resultado para "<b>'+esc(query)+'</b>".</div>'; return; }
  $('items').innerHTML = list.map((e,i)=>\`<div class="item \${e.id===selId?'sel':''}" style="animation-delay:\${i*30}ms" onclick="openMail(\${e.id})">
    <div class="l1"><div class="av" style="background:\${avBg(e.fromName)}">\${esc(initials(e.fromName))}</div>
      <div class="from">\${esc(e.fromName)}</div><div class="date">\${esc(e.date)}</div><span class="dot"></span></div>
    <div class="subj">\${esc(e.subject)}</div><div class="prev">\${esc(e.preview)}</div></div>\`).join('');
}
function openMail(id){
  selId = id; const e = EMAILS.find(x=>x.id===id); if(!e) return;
  $('main').classList.add('reading');
  $('read').innerHTML = \`
    <div class="rtools">
      <span class="b back" onclick="selId=null;emptyReading();renderList()">‹ Voltar</span>
      <span class="b" onclick="toast('Responder está desabilitado no treinamento.')">↩ Responder</span>
      <span class="b" onclick="toast('Encaminhar está desabilitado no treinamento.')">↪ Encaminhar</span>
    </div>
    <div class="rscroll">
      <div class="rhd"><h1>\${esc(e.subject)}</h1>
        <div class="rfrom"><div class="av" style="background:\${avBg(e.fromName)}">\${esc(initials(e.fromName))}</div>
          <div style="min-width:0"><div class="nm">\${esc(e.fromName)}</div><div class="ad">&lt;\${esc(e.fromAddr)}&gt;</div></div>
          <div class="dt">\${esc(e.date)}</div></div></div>
      <div class="rbody">\${e.body}</div>
    </div>
    <div class="verdict">
      <span class="q">&gt; QUAL O SEU <b>VEREDITO</b>?</span>
      <button class="vb ph" onclick="askVerdict(\${id},'phishing')">⚠ Phishing</button>
      <button class="vb lg" onclick="askVerdict(\${id},'legit')">✓ Legítimo</button>
    </div>\`;
  renderList();
}
function askVerdict(id, guess){
  pending = { id, guess };
  const isPh = guess==='phishing';
  $('mTitle').textContent = isPh ? 'Reportar como phishing?' : 'Marcar como legítimo?';
  $('mText').innerHTML = 'Você vai classificar este e-mail como <b>'+(isPh?'PHISHING':'LEGÍTIMO')+'</b>.<br>A decisão é <b>final</b> e o e-mail sairá da caixa de entrada.';
  $('mOk').className = 'bt prim ' + (isPh ? 'ph' : 'lg');
  $('modal').classList.add('on');
}
function closeModal(){ $('modal').classList.remove('on'); pending = null; }
$('modal').onclick = e => { if(e.target.id==='modal') closeModal(); };
document.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });
$('mOk').onclick = async function(){
  if(!pending) return;
  const { id, guess } = pending; $('modal').classList.remove('on');
  try{
    const r = await fetch('/api/verdict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({emailId:id,guess})});
    const j = await r.json();
    if(j.error){ toast(j.error); return; }
    EMAILS = EMAILS.filter(e=>e.id!==id);     // some da caixa, sem revelar acerto/erro
    selId = null; emptyReading(); renderList();
    toast('Veredito registrado. Acompanhe sua pontuação no placar.');
  }catch(err){ toast('Erro ao registrar. Tente novamente.'); }
  pending = null;
};
let tmr; function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(tmr); tmr=setTimeout(()=>t.classList.remove('on'),3200); }

$('q').oninput = e => { query = e.target.value.trim(); renderList(); };
document.querySelectorAll('.fold').forEach(f=>f.onclick=()=>{
  document.querySelectorAll('.fold').forEach(x=>x.classList.remove('active'));
  f.classList.add('active'); curFolder = f.dataset.f;
  $('folderName').textContent = f.querySelector('.n').lastChild.textContent.trim();
  selId=null; emptyReading(); renderList();
});

renderList(); emptyReading();
</script>
</body></html>`;
}

/* ============================ flags ============================ */
app.get('/flags', requireAuth, (req, res) => {
  const solved = db.getSolvedFlags(req.me.username);
  const m = req.query.msg ? `<div class="msg ok">✓ ${esc(req.query.msg)}</div>`
    : req.query.err ? `<div class="msg err">⚠ ${esc(req.query.err)}</div>` : '';
  const items = Object.values(db.FLAGS).map(f => {
    const got = solved[f.id];
    const pt = got
      ? `+${got.points} PTS` + (got.rank === 0 ? ' · 1º a resolver 🥇' : '')
      : `vale +${db.nextFlagPoints(f.id)} PTS agora`;
    return `<div class="ch ${got ? 'ok' : ''}"><div class="ic">${got ? '✓' : '⚑'}</div>
      <div><div class="tt">${esc(f.label)}</div><div class="pt">${pt}</div></div>
      <span class="tag">${got ? 'CAPTURADA' : 'PENDENTE'}</span></div>`;
  }).join('');
  res.send(page('Flags', `<div class="wrap">
    <div class="glass card">
      <div class="kicker">// capture the flag</div>
      <h1>Submeter flag</h1>
      <p class="sub">Capturou uma flag nos Cenários 1 ou 2? Cole aqui para pontuar — quem resolve primeiro leva mais: começa em ${db.FLAG_BASE} pts e cai ${db.FLAG_STEP} a cada novo solver (piso ${db.FLAG_FLOOR}).</p>
      ${m}
      <form method="POST" action="/flags" class="fform">
        <div style="flex:1"><label>Flag</label><input class="mono" name="flag" placeholder="FLAG{...}" autocomplete="off" spellcheck="false" required></div>
        <button class="btn">Enviar ›</button>
      </form>
      <div class="chal">${items}</div>
    </div></div>`, req.me, 'flags'));
});
app.post('/flags', requireAuth, (req, res) => {
  const r = db.submitFlag(req.me.username, req.body && req.body.flag);
  if (r.error) return res.redirect('/flags?err=' + encodeURIComponent(r.error));
  if (r.already) return res.redirect('/flags?msg=' + encodeURIComponent('Você já tinha resolvido: ' + r.label));
  const bonus = r.rank === 0 ? ' 🥇 1º a resolver!' : ` (${r.rank + 1}º a resolver)`;
  res.redirect('/flags?msg=' + encodeURIComponent(`Flag aceita! +${r.points} pts · ${r.label}${bonus}`));
});

/* ============================ dashboard / placar ============================ */
app.get('/dashboard', requireAuth, (req, res) => {
  const mail = db.isMailUnlocked();   // enquanto bloqueado, o placar não menciona o Cenário 3
  res.send(page('Placar', `<div class="wrap">
    <div class="phead">
      <div><div class="kicker">// live scoreboard</div><h1>Placar do workshop</h1>
        <p class="sub">${mail ? 'Phishing: acerto +10 · erro −5 &nbsp;|&nbsp; ' : ''}Flags: ${db.FLAG_BASE}→${db.FLAG_FLOOR} (quem resolve antes pontua mais)</p></div>
      <div class="live"><i></i>AO VIVO</div>
    </div>
    <div class="stats">
      <div class="glass stat"><div class="k">Operadores</div><div class="v" id="s-n">–</div></div>
      <div class="glass stat"><div class="k">Maior pontuação</div><div class="v" id="s-top">–</div></div>
      <div class="glass stat hl"><div class="k">Sua posição</div><div class="v" id="s-pos">–</div></div>
      <div class="glass stat"><div class="k">Seus pontos</div><div class="v" id="s-me">–</div></div>
    </div>
    <div class="podium" id="podium"></div>
    <div class="glass card flush">
      <table><thead><tr><th>#</th><th>Participante</th>${mail ? '<th class="hide-sm">E-mails</th>' : ''}
        <th class="r hide-sm">Flags</th><th class="r">Total</th></tr></thead>
        <tbody id="rows"><tr><td colspan="5" class="muted">Carregando...</td></tr></tbody></table>
    </div></div>
    <script>
      const ME = ${JSON.stringify(req.me.username)};
      const TOTAL_EMAILS = ${EMAILS.length}, MAIL = ${mail};
      const $ = id => document.getElementById(id);
      function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
      function initials(n){return String(n).split(/\\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();}
      const MEDAL = ['1º LUGAR','2º LUGAR','3º LUGAR'];
      async function load(){
        try{
          const r = await fetch('/api/scores'); const rows = await r.json();
          const myIdx = rows.findIndex(s=>s.username===ME);
          $('s-n').textContent = rows.length;
          $('s-top').textContent = rows.length ? rows[0].total : '–';
          $('s-pos').innerHTML = myIdx>=0 ? (myIdx+1)+'º <small>/ '+rows.length+'</small>' : '–';
          $('s-me').textContent = myIdx>=0 ? rows[myIdx].total : '–';
          $('podium').innerHTML = rows.length>=3 ? rows.slice(0,3).map((s,i)=>
            '<div class="glass pd p'+(i+1)+'"><div class="ava">'+esc(initials(s.name))+'</div>'+
            '<div class="medal">'+MEDAL[i]+'</div><div class="nm">'+esc(s.name)+'</div><div class="sc">'+s.total+'</div></div>').join('') : '';
          $('rows').innerHTML = rows.length ? rows.map((s,i)=>{
            const me = s.username===ME;
            const pct = TOTAL_EMAILS ? Math.round(s.classified/TOTAL_EMAILS*100) : 0;
            return '<tr class="'+(me?'me':'')+'"><td class="rk">'+String(i+1).padStart(2,'0')+'</td>'+
              '<td><div class="who"><div class="ava">'+esc(initials(s.name))+'</div><span>'+esc(s.name)+'</span>'+(me?'<span class="you">VOCÊ</span>':'')+'</div></td>'+
              (MAIL ? '<td class="hide-sm"><span class="bar"><span class="tr"><i style="width:'+pct+'%"></i></span>'+s.classified+'/'+TOTAL_EMAILS+'</span></td>' : '')+
              '<td class="r hide-sm" style="font-family:var(--mono)">'+s.flags+'</td>'+
              '<td class="r"><span class="tot'+(s.total<0?' neg':'')+'">'+s.total+'</span></td></tr>';
          }).join('') : '<tr><td colspan="5" class="muted">Ninguém pontuou ainda.</td></tr>';
        }catch(e){}
      }
      load(); setInterval(load, 3000);
    </script>`, req.me, 'dash'));
});
app.get('/api/scores', requireAuth, (req, res) => res.json(db.getScores()));
app.get('/api/status', requireAuth, (req, res) => res.json({ mailUnlocked: db.isMailUnlocked() }));

/* ============================ instrutor ============================ */
// Painel do instrutor — protegido por login (HTTP Basic: ADMIN_USER/ADMIN_PASS).
function requireAdmin(req, res, next) {
  const m = /^Basic\s+(.+)$/i.exec(req.headers.authorization || '');
  if (m) {
    const [u, ...rest] = Buffer.from(m[1], 'base64').toString('utf8').split(':');
    if (u === ADMIN_USER && rest.join(':') === ADMIN_PASS) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Painel do Instrutor", charset="UTF-8"');
  return res.status(401).send('Autenticação necessária.');
}

// Dispara um GET em cada VM participante (porta da simulação). path = /hack ou /voltar.
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function simOne(ip, path, timeoutMs = 3000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`http://${ip}:${SIM_PORT}${path}`, { signal: ctrl.signal });
    return { ip, ok: r.ok };
  } catch (e) {
    return { ip, ok: false };
  } finally { clearTimeout(t); }
}

// Estado do "surto": latcha quando a cascata começa; zera só no /voltar.
let spreadActive = false;   // há (ou houve) um surto até o próximo reverter
let spreadRunning = false;  // cascata executando agora (evita sobreposição)
const SPREAD_DELAY_MS = 5000;

// Cascata: infecta as VMs ainda NÃO bloqueadas, 5s entre cada.
async function spreadHack(delayMs = SPREAD_DELAY_MS) {
  if (spreadRunning) return;
  spreadRunning = true; spreadActive = true;
  try {
    const st = await simStatus();
    const targets = st.filter((v) => v.state !== 'locked').map((v) => v.ip);
    for (let i = 0; i < targets.length; i++) {
      await simOne(targets[i], '/hack');
      if (i < targets.length - 1) await sleep(delayMs);
    }
  } finally { spreadRunning = false; }
}

// Reverte todas de imediato (paralelo) e rearma o gatilho de surto.
async function revertAll() {
  spreadActive = false;
  return Promise.all(PARTICIPANT_IPS.map((ip) => simOne(ip, '/voltar')));
}

// Consulta /status em cada VM: locked = tela de bloqueio ativa (infectada).
async function simStatus() {
  return Promise.all(PARTICIPANT_IPS.map(async (ip, i) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    try {
      const r = await fetch(`http://${ip}:${SIM_PORT}/status`, { signal: ctrl.signal });
      const txt = await r.text();
      return { n: i + 1, ip, state: /"locked"\s*:\s*true/.test(txt) ? 'locked' : 'unlocked' };
    } catch (e) {
      return { n: i + 1, ip, state: 'offline' };
    } finally { clearTimeout(t); }
  }));
}

app.get('/admin', requireAdmin, (req, res) => {
  const on = db.isMailUnlocked();
  const n = db.getScores().length;
  const nv = PARTICIPANT_IPS.length;
  const msg = req.query.msg ? `<div class="msg ok">✓ ${esc(req.query.msg)}</div>` : '';
  res.send(page('Instrutor', `<div class="center" style="max-width:680px"><div class="glass card">
    <style>
      .vmgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:8px;margin-top:8px}
      .vm{border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:9px 10px;background:rgba(255,255,255,.03)}
      .vm.locked{border-color:rgba(239,68,68,.55);background:rgba(239,68,68,.12)}
      .vm.offline{opacity:.5}
      .vm-n{font-weight:800;font-size:13px}.vm-s{font-size:12px;margin-top:2px}
      .vm-ip{font-size:11px;color:#94a3b8;margin-top:1px;font-family:monospace}
    </style>
    <div class="kicker">// painel do instrutor</div>
    <h1>Cenário 3 · Phishing</h1>
    <p class="sub">Enquanto bloqueado, a caixa de entrada não aparece para os participantes e o placar não menciona e-mails.
      Ao liberar, quem estiver logado recebe um aviso na hora.</p>
    ${msg}
    <div class="sw">
      <span class="st ${on ? 'on' : 'off'}">${on ? '● LIBERADO' : '● BLOQUEADO'}</span>
      <form method="POST" action="/admin">
        <input type="hidden" name="unlock" value="${on ? '0' : '1'}">
        <button class="btn ${on ? 'danger' : ''}">${on ? 'Bloquear' : 'Liberar cenário 3 ›'}</button>
      </form>
    </div>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,.1);margin:22px 0">
    <h1 style="font-size:18px">Simulação de ransomware nas VMs</h1>
    <p class="sub">Infectar dispara a tela de bloqueio em <b>cascata</b> (1 VM a cada <b>5s</b>) nas ${nv} VM(s).
      Se <b>qualquer</b> VM for infectada (ex.: clique na isca), as demais são infectadas automaticamente, também 5s a 5s.
      Reverter libera <b>todas na hora</b>.</p>
    <div class="sw">
      <form method="POST" action="/admin/sim" onsubmit="return confirm('Iniciar a cascata de ransomware (5s por VM) nas ${nv} VM(s)?');">
        <input type="hidden" name="action" value="hack">
        <button class="btn danger" ${nv ? '' : 'disabled'}>🔒 Infectar todas (cascata 5s)</button>
      </form>
      <form method="POST" action="/admin/sim">
        <input type="hidden" name="action" value="voltar">
        <button class="btn" ${nv ? '' : 'disabled'}>🔓 Reverter todas (imediato)</button>
      </form>
    </div>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,.1);margin:22px 0">
    <h1 style="font-size:18px">Status das VMs <span id="st-sum" class="muted" style="font-size:13px;font-weight:400"></span></h1>
    <p class="sub">Atualiza sozinho a cada 5s · 🔴 infectada (tela de bloqueio ativa) · 🟢 normal · ⚫ offline.</p>
    <div id="vmgrid" class="vmgrid"><span class="muted">carregando…</span></div>
    <script>
      async function vmLoad(){
        try{
          const d = await (await fetch('/admin/status')).json();
          const m = {locked:['🔴','infectada'], unlocked:['🟢','normal'], offline:['⚫','offline']};
          const inf = d.filter(x=>x.state==='locked').length, off = d.filter(x=>x.state==='offline').length;
          document.getElementById('st-sum').textContent = '· '+inf+' infectada(s) · '+off+' offline · '+d.length+' total';
          document.getElementById('vmgrid').innerHTML = d.map(function(x){
            var e = m[x.state]||['❔','?'];
            return '<div class="vm '+x.state+'"><div class="vm-n">VM-'+String(x.n).padStart(2,'0')+'</div>'+
              '<div class="vm-s">'+e[0]+' '+e[1]+'</div><div class="vm-ip">'+x.ip+'</div></div>';
          }).join('') || '<span class="muted">Nenhuma VM configurada.</span>';
        }catch(e){}
      }
      vmLoad(); setInterval(vmLoad, 5000);
    </script>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,.1);margin:22px 0">
    <h1 style="font-size:18px">Placar</h1>
    <p class="sub">Apaga <b>todos os participantes</b>, veredictos e flags para recomeçar com uma turma nova.
      Não pode ser desfeito. Participantes agora: <b>${n}</b>.</p>
    <form method="POST" action="/admin" onsubmit="return confirm('Apagar TODOS os ${n} participantes e zerar o placar? Esta ação não pode ser desfeita.');">
      <input type="hidden" name="reset" value="1">
      <button class="btn danger" ${n ? '' : 'disabled'}>Limpar dashboard</button>
    </form>
    <p class="muted alt"><a href="/dashboard">Ver placar</a></p>
  </div></div>`, null));
});

app.post('/admin', requireAdmin, (req, res) => {
  if (req.body.reset === '1') {
    const n = db.resetDashboard();
    return res.redirect('/admin?msg=' + encodeURIComponent(`Dashboard limpo · ${n} participante(s) removido(s).`));
  }
  db.setMailUnlocked(req.body.unlock === '1');
  res.redirect('/admin');
});

app.post('/admin/sim', requireAdmin, async (req, res) => {
  const action = req.body.action === 'voltar' ? 'voltar' : 'hack';
  if (!PARTICIPANT_IPS.length) {
    return res.redirect('/admin?msg=' + encodeURIComponent('Nenhuma VM configurada (PARTICIPANT_IPS vazio).'));
  }
  if (action === 'voltar') {
    const r = await revertAll();
    const okN = r.filter((x) => x.ok).length;
    return res.redirect('/admin?msg=' + encodeURIComponent(`Reversão imediata: ${okN}/${r.length} VM(s) liberadas.`));
  }
  // cascata assíncrona (5s por VM) — não bloqueia a resposta
  spreadHack(SPREAD_DELAY_MS);
  res.redirect('/admin?msg=' + encodeURIComponent(`Cascata de ransomware iniciada (5s por VM · ${PARTICIPANT_IPS.length} VM(s)). Acompanhe no status abaixo.`));
});

app.get('/admin/status', requireAdmin, async (req, res) => {
  res.json(await simStatus());
});

app.get('/health', (req, res) => res.json({ ok: true }));

// Auto-surto: se qualquer VM aparecer infectada (ex.: clique na isca), espalha
// para as demais em cascata (5s/VM). Não re-dispara enquanto o surto estiver ativo
// (latch zera no /voltar).
if (PARTICIPANT_IPS.length) {
  setInterval(async () => {
    if (spreadActive || spreadRunning) return;
    try {
      const st = await simStatus();
      if (st.some((v) => v.state === 'locked')) spreadHack(SPREAD_DELAY_MS);
    } catch (e) { /* ignora */ }
  }, 5000);
}

app.listen(PORT, () => console.log(`Workshop platform em http://localhost:${PORT} (phishing_url=${PHISHING_URL})`));
