/*
 * MedClinic - Portal do Paciente (AMBIENTE DE TREINAMENTO)
 * ========================================================
 * ATENÇÃO: contém vulnerabilidades de SQL Injection PROPOSITAIS,
 * para fins didáticos em workshop de segurança. Não usar em produção.
 *
 * Fluxo: o usuário loga como paciente (conta 'user' = Ana, id 1) e cai
 * num portal com os SEUS dados. Há uma busca "nos meus exames" que é
 * filtrada por patient_id = <você>. Essa busca é injetável:
 *
 *   Pontos vulneráveis (de propósito):
 *     1) /login   -> query de autenticação concatenada (bypass de login)
 *     2) /search  -> busca de exames concatenada. O filtro por paciente
 *                    pode ser quebrado para ler os exames de TODOS os
 *                    pacientes, e a flag via UNION.
 */

const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'medclinic-workshop', resave: false, saveUninitialized: true }));

let pool;
async function initDb() {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'appuser',
    password: process.env.DB_PASSWORD || 'app_pw_change_me',
    database: process.env.DB_NAME || 'medclinic',
    charset: 'utf8mb4',     // evita mojibake nos acentos ao gravar/ler
    dateStrings: true,      // datas como 'YYYY-MM-DD' (não objeto Date feio)
    waitForConnections: true,
    connectionLimit: 10,
    multipleStatements: false,
  });
}

/* ================================================================== */
/*  SEEDER: gera ~1000 pacientes e seus exames na 1ª inicialização    */
/* ================================================================== */
const FIRST = ['Lucas','Maria','João','Ana','Pedro','Beatriz','Gabriel','Juliana','Rafael','Carla',
  'Bruno','Fernanda','Thiago','Patrícia','Felipe','Camila','Diego','Larissa','Rodrigo','Aline',
  'Gustavo','Mariana','Marcelo','Letícia','André','Vanessa','Vinícius','Renata','Leonardo','Priscila',
  'Eduardo','Débora','Matheus','Sabrina','Ricardo','Bianca','Daniel','Tatiane','Fábio','Natália',
  'Henrique','Isabela','Caio','Amanda','Otávio','Jéssica','Murilo','Carolina','Igor','Simone'];
const LAST = ['Silva','Santos','Oliveira','Souza','Rodrigues','Ferreira','Alves','Pereira','Lima','Gomes',
  'Costa','Ribeiro','Martins','Carvalho','Almeida','Lopes','Soares','Fernandes','Vieira','Barbosa',
  'Rocha','Dias','Nunes','Moreira','Nascimento','Araújo','Cardoso','Castro','Correia','Teixeira',
  'Pinto','Moraes','Cavalcanti','Monteiro','Freitas','Nakamura','Antunes','Ferraz','Macedo','Pires'];
const CITIES = ['São Paulo/SP','Campinas/SP','Rio de Janeiro/RJ','Belo Horizonte/MG','Curitiba/PR',
  'Porto Alegre/RS','Salvador/BA','Recife/PE','Fortaleza/CE','Brasília/DF'];
const INS = ['SaúdePlena','VidaMais','BemEstar Saúde','Unimed','Amil','Prevent','SulAmérica'];
const DOCTORS = ['Dr. Marcelo Antunes','Dra. Renata Dias','Dr. Paulo Nakamura','Dra. Camila Ferraz',
  'Dr. Rafael Macedo','Dra. Beatriz Pires','Dr. Henrique Moraes'];
// catálogo de exames: [categoria, nome, [resultados possíveis], referência]
const EXAMS = [
  ['Hematologia','Hemograma completo',['Hemácias 4,5 mi/mm³','Hemácias 5,1 mi/mm³','Leucócitos 7.200/mm³','Plaquetas 250 mil/mm³'],'Ver valores de referência'],
  ['Bioquímica','Glicemia de jejum',['88 mg/dL','96 mg/dL','104 mg/dL','127 mg/dL','142 mg/dL'],'70–99 mg/dL'],
  ['Bioquímica','Colesterol total',['176 mg/dL','199 mg/dL','214 mg/dL','238 mg/dL'],'< 200 mg/dL'],
  ['Bioquímica','Triglicerídeos',['108 mg/dL','149 mg/dL','187 mg/dL','252 mg/dL'],'< 150 mg/dL'],
  ['Endocrino','TSH',['1,8 µUI/mL','2,6 µUI/mL','4,9 µUI/mL','6,3 µUI/mL'],'0,4–4,0 µUI/mL'],
  ['Bioquímica','Creatinina',['0,7 mg/dL','0,9 mg/dL','1,1 mg/dL','1,4 mg/dL'],'0,6–1,2 mg/dL'],
  ['Hepático','TGP (ALT)',['18 U/L','29 U/L','47 U/L','66 U/L'],'< 41 U/L'],
  ['Vitaminas','Vitamina D (25-OH)',['22 ng/mL','31 ng/mL','44 ng/mL'],'30–100 ng/mL'],
  ['Infectologia','Sorologia HIV',['Não reagente','Não reagente','Reagente'],'Não reagente'],
  ['Infectologia','Hepatite B (HBsAg)',['Não reagente','Reagente'],'Não reagente'],
  ['Imagem','Ultrassom abdominal total',['Sem alterações','Esteatose hepática leve','Cálculo renal à direita'],'Laudo em anexo'],
  ['Imagem','Raio-X de tórax',['Sem alterações','Opacidade em base direita'],'Laudo em anexo'],
  ['Cardiologia','Eletrocardiograma',['Ritmo sinusal normal','Extrassístoles ocasionais'],'Laudo em anexo'],
  ['Ginecologia','Mamografia',['BI-RADS 1','BI-RADS 2','BI-RADS 3'],'Laudo em anexo'],
  ['Oncologia','PSA total',['0,8 ng/mL','1,9 ng/mL','4,7 ng/mL'],'< 4,0 ng/mL'],
];
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const pad = (n, l) => String(n).padStart(l, '0');
function randCpf() {
  return `${pad(Math.floor(Math.random()*1000),3)}.${pad(Math.floor(Math.random()*1000),3)}.${pad(Math.floor(Math.random()*1000),3)}-${pad(Math.floor(Math.random()*100),2)}`;
}
function randDate(startY, endY) {
  const y = startY + Math.floor(Math.random() * (endY - startY + 1));
  const m = 1 + Math.floor(Math.random() * 12);
  const d = 1 + Math.floor(Math.random() * 28);
  return `${y}-${pad(m,2)}-${pad(d,2)}`;
}

async function seedIfNeeded() {
  const [[{ c }]] = await pool.query('SELECT COUNT(*) AS c FROM patients');
  if (c >= 500) { console.log(`Seed já presente (${c} pacientes).`); return; }
  console.log('Gerando base de pacientes (isto roda só uma vez)...');
  const TOTAL = 1000; // inclui o paciente 1 já existente -> gera 999
  const toCreate = TOTAL - c;

  // 1) pacientes, em lotes
  const chunk = 200;
  for (let start = 0; start < toCreate; start += chunk) {
    const rows = [];
    const params = [];
    const n = Math.min(chunk, toCreate - start);
    for (let i = 0; i < n; i++) {
      const g = Math.random() < 0.5 ? 'Masculino' : 'Feminino';
      const name = `${rnd(FIRST)} ${rnd(LAST)} ${rnd(LAST)}`;
      rows.push('(?,?,?,?,?,?,?,?,?,?)');
      params.push(name, randCpf(), randDate(1950, 2005), g, rnd(['A+','A-','B+','O+','O-','AB+']),
        `(11) 9${pad(Math.floor(Math.random()*10000),4)}-${pad(Math.floor(Math.random()*10000),4)}`,
        `${name.split(' ')[0].toLowerCase()}@email.example`, `Rua ${rnd(LAST)}, ${1+Math.floor(Math.random()*900)} - ${rnd(CITIES)}`,
        rnd(INS), `${rnd(['SP','RJ','MG'])}-${pad(Math.floor(Math.random()*10000000),7)}-${Math.floor(Math.random()*10)}`);
    }
    await pool.query(
      `INSERT INTO patients (name,cpf,birthdate,gender,blood_type,phone,email,address,insurance,insurance_id) VALUES ${rows.join(',')}`,
      params);
  }

  // 2) exames para cada paciente gerado (ids > 1)
  const [ids] = await pool.query('SELECT id FROM patients WHERE id > 1');
  let exRows = [], exParams = [];
  const flush = async () => {
    if (!exRows.length) return;
    await pool.query(
      `INSERT INTO exams (patient_id,exam_date,category,name,result,reference,status,doctor) VALUES ${exRows.join(',')}`,
      exParams);
    exRows = []; exParams = [];
  };
  for (const { id } of ids) {
    const k = 2 + Math.floor(Math.random() * 5); // 2 a 6 exames
    for (let j = 0; j < k; j++) {
      const e = rnd(EXAMS);
      exRows.push('(?,?,?,?,?,?,?,?)');
      exParams.push(id, randDate(2025, 2026), e[0], e[1], rnd(e[2]), e[3],
        rnd(['Concluído','Concluído','Concluído','Em análise']), rnd(DOCTORS));
    }
    if (exRows.length >= 500) await flush();
  }
  await flush();
  const [[{ ce }]] = await pool.query('SELECT COUNT(*) AS ce FROM exams');
  console.log(`Seed concluído: ${TOTAL} pacientes, ${ce} exames.`);
}

/* ================================================================== */
/*  UI                                                                */
/* ================================================================== */
function layout(title, body, opts = {}) {
  return `<!doctype html>
<html lang="pt-br"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · MedClinic</title>
<style>
  :root{--bg:#0f172a;--card:#fff;--ink:#0f172a;--muted:#64748b;--brand:#0ea5e9;--brand-d:#0369a1;
    --line:#e2e8f0;--danger:#dc2626;--ok:#16a34a;--warn:#d97706}
  *{box-sizing:border-box}
  body{margin:0;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:var(--ink);
    background:#eef2f7;min-height:100vh}
  a{color:var(--brand-d);text-decoration:none}
  .topbar{background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;
    gap:12px;padding:12px 24px;position:sticky;top:0;z-index:10}
  .logo{display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px;color:var(--brand-d)}
  .logo .dot{width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,var(--brand),var(--brand-d));
    display:grid;place-items:center;color:#fff;font-size:17px}
  .logo small{display:block;font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.04em}
  .spacer{flex:1}
  .pill{font-size:13px;color:var(--muted)}
  .wrap{max-width:1080px;margin:28px auto;padding:0 20px}
  .center{max-width:420px;margin:8vh auto;padding:0 20px}
  .card{background:var(--card);border-radius:16px;padding:24px;box-shadow:0 6px 24px rgba(2,8,23,.07);
    border:1px solid #eef1f6}
  .card.pad0{padding:0;overflow:hidden}
  h1{margin:0 0 4px;font-size:22px}
  h2{margin:0 0 2px;font-size:19px}
  .sub{color:var(--muted);font-size:14px}
  .hello{font-size:26px;font-weight:800;letter-spacing:-.02em;margin:2px 0 2px}
  label{display:block;font-size:13px;font-weight:600;margin:14px 0 6px;color:#334155}
  input[type=text],input[type=password]{width:100%;padding:12px 14px;border:1px solid var(--line);
    border-radius:10px;font-size:15px;outline:none}
  input:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(14,165,233,.15)}
  .btn{margin-top:2px;padding:12px 18px;border:0;border-radius:10px;cursor:pointer;
    background:linear-gradient(135deg,var(--brand),var(--brand-d));color:#fff;font-size:15px;font-weight:600}
  .btn.full{width:100%;margin-top:18px}
  .btn:hover{filter:brightness(1.05)}
  .row{display:flex;gap:10px;align-items:flex-end}
  .alert{padding:12px 14px;border-radius:10px;font-size:14px;margin-bottom:16px}
  .alert.err{background:#fef2f2;color:var(--danger);border:1px solid #fecaca}
  .grid{display:grid;gap:16px}
  .g4{grid-template-columns:repeat(4,1fr)} .g3{grid-template-columns:repeat(3,1fr)} .g2{grid-template-columns:1fr 1fr}
  @media(max-width:860px){.g4{grid-template-columns:1fr 1fr}.g3,.g2{grid-template-columns:1fr}}
  .kpi{background:#fff;border:1px solid #eef1f6;border-radius:14px;padding:16px 18px;box-shadow:0 4px 16px rgba(2,8,23,.05)}
  .kpi .l{font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
  .kpi .v{font-size:19px;font-weight:800;margin-top:6px}
  .kpi .v.sm{font-size:15px;font-weight:700}
  .sec{margin-top:24px}
  .sec h2{display:flex;align-items:center;gap:8px}
  .dl{display:grid;grid-template-columns:repeat(2,1fr);gap:12px 28px;margin-top:6px}
  @media(max-width:860px){.dl{grid-template-columns:1fr}}
  .dl div{font-size:14px} .dl .k{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.03em}
  .dl .d{font-weight:600;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th{background:#f8fafc;text-align:left;padding:11px 14px;color:#475569;font-size:11px;
    text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--line)}
  td{padding:10px 14px;border-top:1px solid #f1f5f9}
  tr:hover td{background:#fafcff}
  .badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700}
  .badge.ok{background:#f0fdf4;color:var(--ok)} .badge.an{background:#fffbeb;color:var(--warn)}
  .muted{color:var(--muted);font-size:13px}
  .searchbox{background:linear-gradient(135deg,#0ea5e9,#0369a1);border-radius:16px;padding:22px 24px;color:#fff}
  .searchbox h2{color:#fff} .searchbox .sub{color:#dbeafe}
  .searchbox input{background:#fff;border:0}
  .searchbox .btn{background:#082f49}
  .scroll{max-height:none;overflow:auto;border-radius:12px;border:1px solid #eef1f6}
  .footer{text-align:center;color:#94a3b8;font-size:12px;margin:26px 0}
  code{background:#f1f5f9;padding:2px 6px;border-radius:5px;font-size:13px}
</style></head>
<body>
${opts.topbar ? `<div class="topbar">
  <div class="logo"><span class="dot">✚</span><div>MedClinic<small>Portal do Paciente</small></div></div>
  <div class="spacer"></div>
  <span class="pill">${opts.user ? '👤 <b>'+opts.user+'</b> · <a href="/logout">sair</a>' : ''}</span>
</div>` : ''}
${body}
<div class="footer">MedClinic © 2026 · Sistema de Gestão Clínica · Ambiente de demonstração</div>
</body></html>`;
}

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const fmtDate = (d) => { if(!d) return '—'; const s=String(d).slice(0,10).split('-'); return s.length===3?`${s[2]}/${s[1]}/${s[0]}`:String(d); };
const fmtDateTime = (d) => { if(!d) return '—'; const t=new Date(d); return isNaN(t)?String(d):t.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); };
const badge = (st) => /anál/i.test(st)?`<span class="badge an">${esc(st)}</span>`:`<span class="badge ok">${esc(st)}</span>`;

/* ================================================================== */
/*  ROTAS                                                             */
/* ================================================================== */
app.get('/', (req, res) => res.redirect(req.session.user ? '/dashboard' : '/login'));

app.get('/login', (req, res) => {
  const err = req.query.err ? `<div class="alert err">Usuário ou senha inválidos.</div>` : '';
  res.send(layout('Login', `
  <div class="center">
    <div class="card">
      <div class="logo" style="margin-bottom:18px"><span class="dot">✚</span><div>MedClinic<small>Portal do Paciente</small></div></div>
      <h1>Acesse sua conta</h1>
      <p class="sub">Veja seus exames, consultas e receitas.</p>
      ${err}
      <form method="POST" action="/login">
        <label>Usuário</label>
        <input type="text" name="username" autocomplete="off" required>
        <label>Senha</label>
        <input type="password" name="password" required>
        <button class="btn full" type="submit">Entrar</button>
      </form>
      <p class="muted" style="margin-top:16px">Conta de demonstração: <code>user</code> / <code>user123</code></p>
    </div>
  </div>`));
});

// VULNERÁVEL DE PROPÓSITO: concatenação na query de login (bypass).
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const sql = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  try {
    const [rows] = await pool.query(sql);
    if (rows.length > 0) {
      req.session.user = rows[0].username;
      req.session.fullname = rows[0].fullname;
      req.session.role = rows[0].role;
      req.session.patient_id = rows[0].patient_id || 1;
      return res.redirect('/dashboard');
    }
    return res.redirect('/login?err=1');
  } catch (e) {
    return res.send(layout('Erro', `<div class="center"><div class="card">
      <div class="alert err"><b>Erro de SQL:</b><br>${esc(e.message)}</div>
      <p class="muted">Query executada:</p><code>${esc(sql)}</code>
      <p style="margin-top:18px"><a href="/login">Voltar</a></p></div></div>`));
  }
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

app.get('/dashboard', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const pid = req.session.patient_id || 1;
  try {
    const [[p]] = await pool.query('SELECT * FROM patients WHERE id = ?', [pid]);
    const [exams] = await pool.query('SELECT * FROM exams WHERE patient_id = ? ORDER BY exam_date DESC', [pid]);
    const [appts] = await pool.query('SELECT * FROM appointments WHERE patient_id = ? ORDER BY appt_date DESC', [pid]);
    const [rx] = await pool.query('SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY rx_date DESC', [pid]);
    const next = appts.find(a => /agend/i.test(a.status));

    const kpis = `<div class="grid g4">
      <div class="kpi"><div class="l">Próxima consulta</div><div class="v sm">${next?fmtDateTime(next.appt_date):'—'}</div></div>
      <div class="kpi"><div class="l">Exames</div><div class="v">${exams.length}</div></div>
      <div class="kpi"><div class="l">Receitas ativas</div><div class="v">${rx.length}</div></div>
      <div class="kpi"><div class="l">Convênio</div><div class="v sm">${esc(p?.insurance||'—')}</div></div>
    </div>`;

    const search = `<div class="searchbox sec">
      <h2>🔎 Buscar nos meus exames</h2>
      <p class="sub" style="margin:4px 0 14px">Encontre rapidamente um exame pelo nome (ex.: <i>colesterol</i>, <i>hemograma</i>).</p>
      <form method="GET" action="/search" class="row">
        <div style="flex:1"><input type="text" name="q" placeholder="Nome do exame..." autocomplete="off"></div>
        <button class="btn" type="submit">Buscar</button>
      </form>
    </div>`;

    const dados = `<div class="sec"><div class="card">
      <h2>Meus dados</h2>
      <div class="dl" style="margin-top:14px">
        <div><div class="k">Nome</div><div class="d">${esc(p?.name)}</div></div>
        <div><div class="k">CPF</div><div class="d">${esc(p?.cpf)}</div></div>
        <div><div class="k">Nascimento</div><div class="d">${fmtDate(p?.birthdate)}</div></div>
        <div><div class="k">Sexo</div><div class="d">${esc(p?.gender)}</div></div>
        <div><div class="k">Tipo sanguíneo</div><div class="d">${esc(p?.blood_type)}</div></div>
        <div><div class="k">Telefone</div><div class="d">${esc(p?.phone)}</div></div>
        <div><div class="k">E-mail</div><div class="d">${esc(p?.email)}</div></div>
        <div><div class="k">Endereço</div><div class="d">${esc(p?.address)}</div></div>
        <div><div class="k">Convênio</div><div class="d">${esc(p?.insurance)} · ${esc(p?.insurance_id)}</div></div>
      </div>
    </div></div>`;

    const apptRows = appts.map(a => `<tr><td>${fmtDateTime(a.appt_date)}</td><td>${esc(a.specialty)}</td>
      <td>${esc(a.doctor)}</td><td>${badge(a.status)}</td><td class="muted">${esc(a.notes)}</td></tr>`).join('');
    const consultas = `<div class="sec"><div class="card pad0"><div style="padding:18px 24px 8px"><h2>Próximas consultas</h2></div>
      <div class="scroll"><table><thead><tr><th>Data</th><th>Especialidade</th><th>Profissional</th><th>Status</th><th>Observação</th></tr></thead>
      <tbody>${apptRows||'<tr><td colspan="5" class="muted">Sem consultas.</td></tr>'}</tbody></table></div></div></div>`;

    const examRows = exams.map(e => `<tr><td>${fmtDate(e.exam_date)}</td><td>${esc(e.category)}</td>
      <td>${esc(e.name)}</td><td>${esc(e.result)}</td><td class="muted">${esc(e.reference)}</td><td>${badge(e.status)}</td></tr>`).join('');
    const examesT = `<div class="sec"><div class="card pad0"><div style="padding:18px 24px 8px"><h2>Meus exames</h2></div>
      <div class="scroll"><table><thead><tr><th>Data</th><th>Categoria</th><th>Exame</th><th>Resultado</th><th>Referência</th><th>Status</th></tr></thead>
      <tbody>${examRows||'<tr><td colspan="6" class="muted">Sem exames.</td></tr>'}</tbody></table></div></div></div>`;

    const rxRows = rx.map(r => `<tr><td>${fmtDate(r.rx_date)}</td><td>${esc(r.medication)}</td>
      <td>${esc(r.dosage)}</td><td class="muted">${esc(r.instructions)}</td><td>${esc(r.doctor)}</td></tr>`).join('');
    const receitas = `<div class="sec"><div class="card pad0"><div style="padding:18px 24px 8px"><h2>Minhas receitas</h2></div>
      <div class="scroll"><table><thead><tr><th>Data</th><th>Medicamento</th><th>Dosagem</th><th>Instruções</th><th>Prescrito por</th></tr></thead>
      <tbody>${rxRows||'<tr><td colspan="5" class="muted">Sem receitas.</td></tr>'}</tbody></table></div></div></div>`;

    res.send(layout('Painel', `<div class="wrap">
      <div class="card">
        <div class="hello">Olá, ${esc((p?.name||'').split(' ').slice(0,2).join(' '))} 👋</div>
        <p class="sub">Bem-vinda ao seu portal. Aqui estão seus dados de saúde.</p>
        <div style="margin-top:16px">${kpis}</div>
      </div>
      ${search}
      ${dados}
      ${consultas}
      ${examesT}
      ${receitas}
    </div>`, { topbar: true, user: req.session.user }));
  } catch (e) {
    res.send(layout('Erro', `<div class="wrap"><div class="card"><div class="alert err">${esc(e.message)}</div></div></div>`,
      { topbar: true, user: req.session.user }));
  }
});

// VULNERÁVEL DE PROPÓSITO: busca de exames concatenada e filtrada por paciente.
// A query "deveria" só retornar os exames do usuário logado:
//   SELECT ... WHERE e.patient_id = <você> AND e.name LIKE '%<q>%'
// Exploração (quebra o filtro de paciente):  %' OR '1'='1
// Extrair a flag (5 colunas, use # p/ comentar):
//   ' UNION SELECT flag,CURDATE(),'secret',name,flag FROM secrets #
app.get('/search', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const pid = req.session.patient_id || 1;
  const q = req.query.q || '';
  // Query numa única linha de propósito: o comentário '#' do MySQL só vale até
  // o fim da linha; em query multi-linha o ORDER BY seguinte sobreviveria e
  // quebraria payloads de UNION/ORDER BY.
  const sql = `SELECT p.name AS patient, e.exam_date, e.category, e.name AS exam, e.result FROM exams e JOIN patients p ON p.id = e.patient_id WHERE e.patient_id = ${pid} AND e.name LIKE '%${q}%' ORDER BY e.exam_date DESC`;
  try {
    const [rows] = await pool.query(sql);
    const total = rows.length;
    const shown = rows.slice(0, 500);
    const uniqPatients = new Set(rows.map(r => r.patient)).size;
    const body = shown.map(r => `<tr><td><b>${esc(r.patient)}</b></td><td>${fmtDate(r.exam_date)}</td>
      <td>${esc(r.category)}</td><td>${esc(r.exam)}</td><td>${esc(r.result)}</td></tr>`).join('');
    const more = total > shown.length ? `<p class="muted" style="margin:12px 0 0">… e mais ${total - shown.length} registros (exibindo os primeiros ${shown.length}).</p>` : '';
    res.send(layout('Resultados', `<div class="wrap">
      <div class="card">
        <h2>Resultados da busca</h2>
        <p class="muted">Termo: <code>${esc(q)}</code> · <b>${total}</b> exame(s) · ${uniqPatients} paciente(s)</p>
        <div class="scroll" style="margin-top:14px"><table>
          <thead><tr><th>Paciente</th><th>Data</th><th>Categoria</th><th>Exame</th><th>Resultado</th></tr></thead>
          <tbody>${body || '<tr><td colspan="5" class="muted">Nenhum exame encontrado.</td></tr>'}</tbody></table></div>
        ${more}
        <p style="margin-top:20px"><a href="/dashboard">← Voltar ao portal</a></p>
      </div></div>`, { topbar: true, user: req.session.user }));
  } catch (e) {
    res.send(layout('Erro', `<div class="wrap"><div class="card">
      <div class="alert err"><b>Erro de SQL:</b><br>${esc(e.message)}</div>
      <p class="muted">Query executada:</p><code>${esc(sql)}</code>
      <p style="margin-top:18px"><a href="/dashboard">← Voltar</a></p></div></div>`,
      { topbar: true, user: req.session.user }));
  }
});

initDb()
  .then(seedIfNeeded)
  .then(() => app.listen(PORT, () => console.log(`MedClinic rodando em http://localhost:${PORT}`)))
  .catch((e) => { console.error('Falha ao iniciar:', e); process.exit(1); });
