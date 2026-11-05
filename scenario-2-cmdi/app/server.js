/*
 * Meridian Capital - Portal do Investidor (AMBIENTE DE TREINAMENTO)
 * ================================================================
 * ATENÇÃO: contém vulnerabilidade de COMMAND INJECTION PROPOSITAL,
 * para fins didáticos em workshop de segurança. Não usar em produção.
 *
 * Fluxo: landing pública -> login no portal do investidor -> carteira
 * completa (patrimônio, posições, alocação) -> "Backup/Exportar carteira".
 *
 * Ponto vulnerável (de propósito):
 *   /api/export -> o 'destino' do backup é concatenado direto no shell:
 *                    exec(`tar ... ; echo Destino: ${destino}`)
 *   A aplicação roda como root -> a injeção herda privilégios de root.
 *   Flag em /root/flag.txt.
 */

const express = require('express');
const session = require('express-session');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: 'meridian-workshop', resave: false, saveUninitialized: true }));

const USERS = { investidor: 'Invest@2024' };          // login NÃO é o foco da vuln
const INVESTOR = 'Carlos Mendes';
const DATA_DIR = path.join(__dirname, 'data');

/* --------------------------- carteira (dados) --------------------------- */
const SALDO = 79730.00;                                 // saldo em conta
const POSICOES = [
  { ativo:'PETR4',  nome:'Petrobras PN',         tipo:'Ação',       qtd:2000,  pm:28.40,     atual:38.72 },
  { ativo:'VALE3',  nome:'Vale ON',              tipo:'Ação',       qtd:1500,  pm:61.20,     atual:58.90 },
  { ativo:'ITUB4',  nome:'Itaú Unibanco PN',     tipo:'Ação',       qtd:3000,  pm:24.10,     atual:33.45 },
  { ativo:'BBAS3',  nome:'Banco do Brasil ON',   tipo:'Ação',       qtd:2500,  pm:45.00,     atual:52.80 },
  { ativo:'WEGE3',  nome:'WEG ON',               tipo:'Ação',       qtd:1200,  pm:36.50,     atual:41.20 },
  { ativo:'HGLG11', nome:'CSHG Logística FII',   tipo:'FII',        qtd:400,   pm:158.00,    atual:162.30 },
  { ativo:'MXRF11', nome:'Maxi Renda FII',       tipo:'FII',        qtd:5000,  pm:9.80,      atual:10.15 },
  { ativo:'KNRI11', nome:'Kinea Renda Imob. FII',tipo:'FII',        qtd:300,   pm:142.00,    atual:139.50 },
  { ativo:'TD-SELIC', nome:'Tesouro Selic 2029', tipo:'Renda Fixa', qtd:1,     pm:200000.00, atual:210000.00 },
  { ativo:'CDB-110', nome:'CDB 110% CDI',        tipo:'Renda Fixa', qtd:1,     pm:150000.00, atual:158300.00 },
  { ativo:'MER-MM',  nome:'Meridian FIC Multimercado', tipo:'Fundo',qtd:1,     pm:90000.00,  atual:112400.00 },
  { ativo:'BTC',    nome:'Bitcoin',              tipo:'Cripto',     qtd:0.35,  pm:210000.00, atual:340000.00 },
];
const TRANSACOES = [
  ['2026-10-22','Compra','ITUB4','+500 cotas','R$ 16.725,00'],
  ['2026-10-18','Provento','HGLG11','Rendimento','R$ 520,00'],
  ['2026-10-10','Venda','VALE3','-300 cotas','R$ 17.670,00'],
  ['2026-10-05','Aplicação','CDB 110% CDI','Aporte','R$ 50.000,00'],
  ['2026-09-30','Provento','MXRF11','Rendimento','R$ 475,00'],
  ['2026-09-21','Compra','BTC','+0,05 BTC','R$ 17.000,00'],
];

const valorPos = (p) => p.qtd * p.atual;
const rentPos  = (p) => (p.atual - p.pm) / p.pm * 100;
const totalInvestido = POSICOES.reduce((s,p)=>s+valorPos(p),0);
const patrimonio = totalInvestido + SALDO;

function money(v){
  const neg = v < 0; v = Math.abs(v);
  const s = v.toFixed(2).split('.');
  s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  return (neg?'-':'') + 'R$ ' + s[0] + ',' + s[1];
}
const pct = (v) => (v>=0?'+':'') + v.toFixed(1).replace('.',',') + '%';
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

// Gera o arquivo "carteira.json" que o backup vai arquivar (dá realismo ao tar)
function writeCarteira(){
  try{
    fs.mkdirSync(DATA_DIR, { recursive:true });
    const data = { investidor:INVESTOR, atualizado_em:new Date().toISOString(),
      patrimonio, saldo:SALDO, posicoes:POSICOES.map(p=>({...p, valor:valorPos(p)})) };
    fs.writeFileSync(path.join(DATA_DIR,'carteira.json'), JSON.stringify(data,null,2));
  }catch(e){ console.error('writeCarteira:', e.message); }
}

/* ----------------------------- estilo ----------------------------- */
const CSS = `
  :root{--ink:#0b1120;--panel:#0f172a;--panel2:#111c32;--line:#1e293b;--gold:#c9a227;
    --gold-d:#9a7b18;--muted:#8891a7;--txt:#e2e8f0;--ok:#34d399;--bad:#f87171;--warn:#fbbf24}
  *{box-sizing:border-box}
  body{margin:0;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:#0b1120;color:var(--txt)}
  a{color:var(--gold);text-decoration:none}
  .gold{color:var(--gold)} .up{color:var(--ok)} .down{color:var(--bad)}
  .brand{display:inline-flex;align-items:center;gap:11px;font-weight:700;letter-spacing:.5px}
  .brand .m{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,var(--gold),var(--gold-d));
    display:grid;place-items:center;color:#0b1120;font-weight:900;font-size:19px}
  .brand small{display:block;font-size:10px;color:var(--muted);font-weight:600;letter-spacing:.14em}
  .topbar{display:flex;align-items:center;gap:14px;padding:13px 26px;background:#0d1526;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:10}
  .spacer{flex:1} .pill{font-size:13px;color:var(--muted)}
  .hero{position:relative;padding:86px 24px 64px;text-align:center;
    background:radial-gradient(1100px 460px at 50% -10%,rgba(201,162,39,.16),transparent),#0b1120;border-bottom:1px solid var(--line)}
  h1.big{font-size:clamp(32px,5vw,52px);margin:22px auto 16px;max-width:780px;line-height:1.12}
  .lead{color:var(--muted);font-size:18px;max-width:600px;margin:0 auto 26px}
  .cta{display:inline-block;padding:13px 26px;border-radius:10px;font-weight:700;background:linear-gradient(135deg,var(--gold),var(--gold-d));color:#0b1120}
  .stats{display:flex;gap:44px;justify-content:center;margin:46px auto 0;flex-wrap:wrap}
  .stat .n{font-size:30px;font-weight:800;color:var(--gold)} .stat .l{color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:.07em}
  .services{max-width:1000px;margin:60px auto;padding:0 24px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
  @media(max-width:820px){.services{grid-template-columns:1fr}}
  .svc{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:22px}
  .svc h3{margin:0 0 8px;font-size:17px} .svc p{margin:0;color:var(--muted);font-size:14px;line-height:1.5}
  .wrap{max-width:1040px;margin:26px auto;padding:0 22px}
  .center{max-width:410px;margin:9vh auto;padding:0 20px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:24px}
  h2{margin:0 0 4px;font-size:19px} .sub{color:var(--muted);font-size:14px}
  .hello{font-size:25px;font-weight:800;letter-spacing:-.02em}
  label{display:block;font-size:13px;font-weight:600;margin:14px 0 7px;color:#cbd5e1}
  input{width:100%;padding:12px 14px;background:#0b1120;border:1px solid var(--line);border-radius:10px;color:var(--txt);font-size:15px;outline:none}
  input:focus{border-color:var(--gold)}
  .btn{padding:12px 20px;border:0;border-radius:10px;cursor:pointer;font-weight:700;background:linear-gradient(135deg,var(--gold),var(--gold-d));color:#0b1120;font-size:15px}
  .btn.full{width:100%;margin-top:18px}
  .row{display:flex;gap:10px;align-items:flex-end}
  .alert{padding:12px 14px;border-radius:10px;font-size:14px;margin-bottom:14px;background:#2a0f12;color:var(--bad);border:1px solid #4c1d1d}
  .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
  @media(max-width:820px){.grid4{grid-template-columns:1fr 1fr}}
  .kpi{background:var(--panel2);border:1px solid var(--line);border-radius:13px;padding:15px 17px}
  .kpi .l{font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em}
  .kpi .v{font-size:20px;font-weight:800;margin-top:6px}
  .sec{margin-top:20px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th{text-align:left;padding:10px 12px;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--line)}
  td{padding:10px 12px;border-top:1px solid #16213a}
  td.r,th.r{text-align:right}
  .alloc{display:flex;flex-direction:column;gap:11px;margin-top:14px}
  .alloc .arow{display:grid;grid-template-columns:120px 1fr 150px;gap:12px;align-items:center;font-size:13px}
  .bar{height:9px;border-radius:99px;background:#16213a;overflow:hidden}
  .bar>i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold-d))}
  pre{margin:16px 0 0;background:#05070d;border:1px solid var(--line);border-radius:10px;padding:16px;
    color:#9fe6b0;font-size:13px;white-space:pre-wrap;word-break:break-word;min-height:22px;font-family:ui-monospace,Menlo,Consolas,monospace}
  pre .cmd{color:#64748b}
  .muted{color:var(--muted);font-size:13px}
  .foot{text-align:center;color:#55607a;font-size:12px;padding:30px}
  code{background:#0b1120;border:1px solid var(--line);padding:2px 6px;border-radius:5px;font-size:13px}
`;

function layout(title, body, opts = {}) {
  return `<!doctype html><html lang="pt-br"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Meridian Capital</title><style>${CSS}</style></head><body>
${opts.topbar ? `<div class="topbar">
  <div class="brand"><span class="m">M</span><div>MERIDIAN <span class="gold">CAPITAL</span><small>PORTAL DO INVESTIDOR</small></div></div>
  <div class="spacer"></div>
  <span class="pill">${opts.user ? '👤 <b>'+esc(INVESTOR)+'</b> · <a href="/logout">sair</a>' : ''}</span>
</div>` : ''}
${body}
<div class="foot">Meridian Capital © 2026 · CNPJ 00.000.000/0001-00 · Ambiente de demonstração</div>
</body></html>`;
}

/* ----------------------------- landing ----------------------------- */
app.get('/', (req, res) => {
  res.send(layout('Gestão de Investimentos', `
  <div class="hero">
    <div class="brand" style="font-size:20px"><span class="m">M</span><div>MERIDIAN <span class="gold">CAPITAL</span><small>WEALTH MANAGEMENT</small></div></div>
    <h1 class="big">Investimentos inteligentes,<br><span class="gold">resultados consistentes</span>.</h1>
    <p class="lead">Gestão patrimonial de alta performance para investidores que exigem excelência.</p>
    <a class="cta" href="/login">Acessar minha carteira →</a>
    <div class="stats">
      <div class="stat"><div class="n">R$ 4,2 bi</div><div class="l">Sob gestão</div></div>
      <div class="stat"><div class="n">+18,6%</div><div class="l">Retorno médio a.a.</div></div>
      <div class="stat"><div class="n">12 anos</div><div class="l">De mercado</div></div>
      <div class="stat"><div class="n">2.400+</div><div class="l">Investidores</div></div>
    </div>
  </div>
  <div class="services">
    <div class="svc"><h3>🏦 Gestão de Carteiras</h3><p>Estratégias personalizadas de alocação, do conservador ao arrojado, com acompanhamento dedicado.</p></div>
    <div class="svc"><h3>📈 Research Proprietário</h3><p>Análise macro e de ativos pela nossa mesa, com dados de mercado em tempo real.</p></div>
    <div class="svc"><h3>🔒 Segurança Institucional</h3><p>Infraestrutura monitorada 24/7. Seus ativos e dados sob proteção.</p></div>
  </div>`));
});

/* ----------------------------- login ----------------------------- */
app.get('/login', (req, res) => {
  const err = req.query.err ? `<div class="alert">Credenciais inválidas.</div>` : '';
  res.send(layout('Login', `
  <div class="center"><div class="card">
    <div class="brand" style="margin-bottom:16px"><span class="m">M</span><div>MERIDIAN <span class="gold">CAPITAL</span><small>PORTAL DO INVESTIDOR</small></div></div>
    <h2>Acesse sua carteira</h2><p class="sub">Área exclusiva do investidor.</p>
    ${err}
    <form method="POST" action="/login">
      <label>Usuário</label><input type="text" name="username" autocomplete="off" required>
      <label>Senha</label><input type="password" name="password" required>
      <button class="btn full" type="submit">Entrar</button>
    </form>
    <p class="muted" style="margin-top:16px">Conta de demonstração: <code>investidor</code> / <code>Invest@2024</code></p>
  </div></div>`));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (USERS[username] && USERS[username] === password) { req.session.user = username; return res.redirect('/carteira'); }
  res.redirect('/login?err=1');
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

/* --------------------------- carteira (portal) --------------------------- */
app.get('/carteira', (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const posRows = POSICOES.map(p => {
    const r = rentPos(p), cls = r>=0?'up':'down';
    const q = p.qtd < 1 ? p.qtd.toLocaleString('pt-BR',{minimumFractionDigits:2}) : p.qtd.toLocaleString('pt-BR');
    return `<tr>
      <td><b>${esc(p.ativo)}</b><div class="muted">${esc(p.nome)}</div></td>
      <td>${esc(p.tipo)}</td>
      <td class="r">${q}</td>
      <td class="r">${money(p.pm)}</td>
      <td class="r">${money(p.atual)}</td>
      <td class="r"><b>${money(valorPos(p))}</b></td>
      <td class="r ${cls}">${pct(r)}</td></tr>`;
  }).join('');

  // alocação por tipo
  const porTipo = {};
  POSICOES.forEach(p => { porTipo[p.tipo] = (porTipo[p.tipo]||0) + valorPos(p); });
  const alloc = Object.entries(porTipo).sort((a,b)=>b[1]-a[1]).map(([tipo,val])=>{
    const p = val/totalInvestido*100;
    return `<div class="arow"><div>${esc(tipo)}</div>
      <div class="bar"><i style="width:${p.toFixed(1)}%"></i></div>
      <div class="r">${money(val)} · ${p.toFixed(1).replace('.',',')}%</div></div>`;
  }).join('');

  const txRows = TRANSACOES.map(t => `<tr><td>${t[0].split('-').reverse().join('/')}</td>
    <td>${esc(t[1])}</td><td>${esc(t[2])}</td><td class="muted">${esc(t[3])}</td><td class="r">${esc(t[4])}</td></tr>`).join('');

  const rentTotal = (totalInvestido - POSICOES.reduce((s,p)=>s+p.qtd*p.pm,0)) / POSICOES.reduce((s,p)=>s+p.qtd*p.pm,0) * 100;

  res.send(layout('Minha Carteira', `<div class="wrap">
    <div class="card">
      <div class="hello">Olá, ${esc(INVESTOR.split(' ')[0])} 👋</div>
      <p class="sub">Resumo da sua carteira de investimentos.</p>
      <div class="grid4" style="margin-top:16px">
        <div class="kpi"><div class="l">Patrimônio total</div><div class="v gold">${money(patrimonio)}</div></div>
        <div class="kpi"><div class="l">Investido</div><div class="v">${money(totalInvestido)}</div></div>
        <div class="kpi"><div class="l">Rentabilidade</div><div class="v up">${pct(rentTotal)}</div></div>
        <div class="kpi"><div class="l">Saldo disponível</div><div class="v">${money(SALDO)}</div></div>
      </div>
    </div>

    <div class="sec"><div class="card">
      <h2>Alocação por classe</h2>
      <div class="alloc">${alloc}</div>
    </div></div>

    <div class="sec"><div class="card">
      <h2>Minhas posições</h2>
      <table style="margin-top:12px"><thead><tr>
        <th>Ativo</th><th>Classe</th><th class="r">Qtd.</th><th class="r">Preço médio</th>
        <th class="r">Preço atual</th><th class="r">Valor</th><th class="r">Rent.</th>
      </tr></thead><tbody>${posRows}</tbody></table>
    </div></div>

    <div class="sec"><div class="card">
      <h2>Transações recentes</h2>
      <table style="margin-top:12px"><thead><tr><th>Data</th><th>Tipo</th><th>Ativo</th><th>Detalhe</th><th class="r">Valor</th></tr></thead>
      <tbody>${txRows}</tbody></table>
    </div></div>

    <div class="sec"><div class="card">
      <h2>💾 Backup da carteira</h2>
      <p class="sub">Exporte uma cópia de segurança da sua carteira (arquivo <code>.tar.gz</code>) para um destino externo — bucket S3, servidor SFTP ou pasta de rede.</p>
      <form id="f" class="row" style="margin-top:14px">
        <div style="flex:1"><label>Destino da exportação</label>
          <input id="destino" name="destino" value="s3://meridian-backups/carteira" autocomplete="off"></div>
        <button class="btn" type="submit">Exportar carteira</button>
      </form>
      <pre id="out">Nenhum backup gerado ainda.</pre>
    </div></div>
  </div>

  <script>
    const f=document.getElementById('f'),out=document.getElementById('out');
    const h=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    f.addEventListener('submit',async e=>{
      e.preventDefault();
      const destino=document.getElementById('destino').value;
      out.textContent='Gerando backup da carteira...';
      try{
        const r=await fetch('/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({destino})});
        const j=await r.json();
        out.innerHTML='<span class="cmd">$ '+h(j.cmd||'')+'</span>\\n\\n'+h(j.output||j.error||'(sem saída)');
      }catch(err){out.textContent='Erro na requisição.';}
    });
  </script>`, { topbar: true, user: req.session.user }));
});

// VULNERÁVEL DE PROPÓSITO: 'destino' concatenado direto no shell.
// A app roda como root -> injeção com root. Flag em /root/flag.txt.
// Exploração: destino = x; id    |    x; cat /root/flag.txt
app.post('/api/export', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Não autenticado.' });
  const destino = (req.body && req.body.destino) || '';
  const cmd = `tar -czvf /tmp/carteira_backup.tar.gz -C ${DATA_DIR} . 2>&1; echo Backup gerado. Exportando para destino ${destino}`;
  exec(cmd, { timeout: 12000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
    const output = (stdout || '') + (stderr || '');
    if (err && !output) return res.json({ cmd, error: 'Falha na exportação: ' + err.message });
    res.json({ cmd, output: output || '(sem saída)' });
  });
});

writeCarteira();
app.listen(PORT, () => console.log(`Meridian rodando em http://localhost:${PORT}`));
