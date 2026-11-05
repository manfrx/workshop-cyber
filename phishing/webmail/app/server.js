/*
 * Meridian Mail - Webmail de TREINAMENTO (quest de phishing)
 * ==========================================================
 * App de conscientização: o participante lê a caixa de entrada e classifica
 * cada e-mail como "Legítimo" ou "Phishing", recebendo feedback com os
 * sinais de alerta. Um dos e-mails (a "isca") tem um link de download que,
 * no workshop, leva à página de simulação. Nada aqui é malicioso.
 *
 * Branding neutro ("Meridian Mail") de propósito, para não imitar a marca
 * de nenhum provedor real.
 */

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const PHISHING_URL = process.env.PHISHING_URL || 'http://127.0.0.1:3003/documento';

const ME = { name: 'Carlos Mendes', addr: 'carlos.mendes@meridiancapital.example' };

// ------------------------------------------------------------------
// Caixa de entrada (dados estáticos). category: 'legit' | 'phishing'
// ------------------------------------------------------------------
const EMAILS = [
  {
    id: 1, fromName: 'Recursos Humanos', fromAddr: 'rh@meridiancapital.example',
    date: '09:12', subject: 'Campanha de vacinação da gripe — agende seu horário',
    preview: 'A clínica parceira estará no escritório na próxima semana...',
    body: `<p>Olá, time!</p>
      <p>Na próxima semana (3 a 7/11) teremos a <b>campanha de vacinação da gripe</b> aqui no escritório, sem custo para colaboradores.</p>
      <p>Para se organizar, agende seu horário pela intranet: <a href="https://intranet.meridiancapital.example/vacinacao">intranet.meridiancapital.example/vacinacao</a></p>
      <p>Qualquer dúvida, é só responder este e-mail.</p>
      <p>Abraços,<br>Equipe de RH</p>`,
    category: 'legit',
    flags: [
      'Remetente no domínio oficial da empresa (@meridiancapital.example).',
      'Link aponta para a intranet oficial (mesmo domínio).',
      'Sem urgência artificial, sem pedir senha ou dados sensíveis.',
    ],
    verdict: 'Comunicado interno legítimo: domínio correto, link interno e nenhum pedido suspeito.',
  },
  {
    id: 2, fromName: 'Suporte de TI', fromAddr: 'suporte@meridian-ti.example',
    date: '08:47', subject: '[AÇÃO NECESSÁRIA] Sua senha expira em 24 horas',
    preview: 'Detectamos que sua senha corporativa expira em breve...',
    body: `<p>Prezado usuário,</p>
      <p>Detectamos que sua senha corporativa <b>expira em 24 horas</b>. Para evitar o <b>bloqueio imediato</b> da sua conta, confirme suas credenciais agora:</p>
      <p><a href="http://meridian-ti.example/portal/login">&#9658; Manter minha senha ativa</a></p>
      <p>Caso não confirme, o acesso ao e-mail e aos sistemas será suspenso.</p>
      <p>Atenciosamente,<br>Equipe de Suporte de TI</p>`,
    category: 'phishing',
    flags: [
      'Domínio do remetente é "meridian-ti.example" — NÃO é o domínio oficial (@meridiancapital.example).',
      'Urgência e ameaça ("expira em 24h", "bloqueio imediato") para forçar ação por impulso.',
      'Link leva a um site externo que pede login/senha — clássico roubo de credenciais.',
      'Saudação genérica ("Prezado usuário"), sem seu nome.',
    ],
    verdict: 'Phishing de roubo de credenciais. TI de verdade não pede sua senha por link externo com ameaça de bloqueio.',
  },
  {
    id: 3, fromName: 'Juliana Alves', fromAddr: 'juliana.alves@meridiancapital.example',
    date: 'Ontem', subject: 'Convite: Reunião trimestral de resultados — 05/11',
    preview: 'Pessoal, segue o convite para nossa reunião trimestral...',
    body: `<p>Oi Carlos,</p>
      <p>Segue o convite para a <b>reunião trimestral de resultados</b>, dia 05/11 às 14h, na sala Ipanema (e por vídeo).</p>
      <p>Vou compartilhar a apresentação até quarta. Se tiver algum número que queira destacar da sua área, me avisa até terça.</p>
      <p>Abraço,<br>Juliana Alves · Controladoria</p>`,
    category: 'legit',
    flags: [
      'Remetente conhecido, no domínio oficial da empresa.',
      'Contexto esperado e específico (reunião, data, sala, pessoas reais).',
      'Não pede credenciais, não tem link suspeito nem urgência artificial.',
    ],
    verdict: 'E-mail legítimo de uma colega: contexto natural de trabalho, domínio correto, nada sensível.',
  },
  {
    id: 4, fromName: 'Cobrança Eletrônica', fromAddr: 'cobranca@nf-eletronica.example',
    date: 'Ontem', subject: 'Nota Fiscal em atraso — regularize para evitar protesto',
    preview: 'Consta em nosso sistema um débito pendente em seu CNPJ...',
    body: `<p>Prezado cliente,</p>
      <p>Consta um <b>débito em atraso</b> vinculado ao seu cadastro. Para evitar <b>protesto em cartório</b> e negativação, baixe o boleto atualizado em anexo e efetue o pagamento hoje.</p>
      <p>&#128206; <a href="http://nf-eletronica.example/boleto/download?id=99183">Boleto_Atualizado.zip</a></p>
      <p>Setor de Cobrança</p>`,
    category: 'phishing',
    flags: [
      'Remetente externo e desconhecido, domínio genérico ("nf-eletronica.example").',
      'Ameaça financeira com urgência (protesto, negativação, "pague hoje").',
      'Anexo compactado (.zip) — formato comum para esconder malware.',
      'Não cita dados reais do seu cadastro; é genérico e disparado em massa.',
    ],
    verdict: 'Golpe de boleto/cobrança falsa. Anexo .zip + urgência financeira = clássico vetor de malware.',
  },
  {
    id: 5, isLure: true, fromName: 'Documentos Compartilhados', fromAddr: 'no-reply@docs-share.example',
    date: '07:58', subject: 'Carlos, um documento foi compartilhado com você: "Contrato_Confidencial.pdf"',
    preview: 'Um arquivo foi compartilhado com você e expira em 2 horas...',
    body: `<p>Olá, Carlos,</p>
      <p>Um documento <b>confidencial</b> foi compartilhado com você por <b>Diretoria Financeira</b>:</p>
      <div style="border:1px solid #d9dce3;border-radius:10px;padding:16px;margin:14px 0;max-width:420px;background:#fafbfd">
        <div style="font-weight:700;color:#c0392b">&#128196; Contrato_Confidencial.pdf</div>
        <div style="color:#6b7280;font-size:13px;margin:4px 0 12px">PDF · 2,4 MB · expira em 2 horas</div>
        <a href="__PHISHING_URL__" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;font-weight:700;text-decoration:none">Baixar documento</a>
      </div>
      <p style="color:#6b7280;font-size:13px">Se o botão não funcionar, acesse: <a href="__PHISHING_URL__">__PHISHING_URL__</a></p>`,
    category: 'phishing',
    flags: [
      'Domínio de "compartilhamento" falso: "docs-share.example" não é um serviço oficial.',
      'Urgência artificial ("expira em 2 horas") para você clicar sem pensar.',
      'Remetente não esperado (no-reply) e documento "confidencial" genérico como isca.',
      'O botão baixa um arquivo — é exatamente aqui que um ataque real começa.',
    ],
    verdict: 'ESTA é a isca. Um link de "documento compartilhado" que baixa um arquivo. No mundo real, um clique aqui pode iniciar um ransomware.',
  },
  {
    id: 6, fromName: 'Meridian Research', fromAddr: 'research@meridiancapital.example',
    date: 'Seg', subject: 'Carta semanal do gestor — visão de mercado',
    preview: 'Nesta edição: juros, câmbio e o que esperar do próximo Copom...',
    body: `<p>Bom dia,</p>
      <p>Na carta desta semana, nossa mesa comenta o cenário de juros, o câmbio e as expectativas para o próximo Copom.</p>
      <p>Leia a íntegra na área de research: <a href="https://meridiancapital.example/research/semanal">meridiancapital.example/research/semanal</a></p>
      <p>Bons investimentos,<br>Meridian Research</p>`,
    category: 'legit',
    flags: [
      'Domínio oficial da empresa, conteúdo informativo esperado (newsletter interna).',
      'Link para a área de research no próprio domínio.',
      'Não pede login, não tem anexo, não cria urgência.',
    ],
    verdict: 'Newsletter interna legítima: informativa, domínio correto, nenhuma ação sensível solicitada.',
  },
];

function renderData() {
  const list = EMAILS.map(e => ({
    ...e,
    body: e.body.replace(/__PHISHING_URL__/g, PHISHING_URL),
  }));
  return JSON.stringify(list).replace(/</g, '\\u003c');
}

const PAGE = () => `<!doctype html>
<html lang="pt-br"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Meridian Mail</title>
<style>
  :root{--bg:#f3f4f8;--panel:#fff;--line:#e5e7ef;--ink:#1f2430;--muted:#6b7280;
    --brand:#2563eb;--brand-d:#1e40af;--ok:#16a34a;--bad:#dc2626;--warn:#d97706}
  *{box-sizing:border-box}
  body{margin:0;height:100vh;overflow:hidden;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:var(--ink);background:var(--bg)}
  .app{display:grid;grid-template-rows:auto 1fr;height:100vh}
  .top{display:flex;align-items:center;gap:14px;background:var(--brand);color:#fff;padding:0 18px;height:52px}
  .top .logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:17px}
  .top .logo .ic{width:28px;height:28px;border-radius:7px;background:#fff;color:var(--brand);display:grid;place-items:center;font-size:17px}
  .search{flex:1;max-width:520px}
  .search input{width:100%;padding:8px 13px;border:0;border-radius:7px;font-size:14px;outline:none}
  .top .me{margin-left:auto;display:flex;align-items:center;gap:9px;font-size:14px}
  .top .av{width:30px;height:30px;border-radius:50%;background:#1e3a8a;display:grid;place-items:center;font-weight:700}
  .main{display:grid;grid-template-columns:210px 360px 1fr;min-height:0}
  @media(max-width:1000px){.main{grid-template-columns:0 320px 1fr}}
  .nav{background:#eceef4;border-right:1px solid var(--line);padding:14px 10px;overflow:auto}
  .nav .btn-new{width:100%;background:var(--brand);color:#fff;border:0;border-radius:8px;padding:10px;font-weight:700;cursor:pointer;margin-bottom:12px}
  .nav a{display:flex;justify-content:space-between;padding:8px 11px;border-radius:7px;color:var(--ink);text-decoration:none;font-size:14px;cursor:pointer}
  .nav a.active{background:#dbe3fb;font-weight:700;color:var(--brand-d)}
  .nav a .c{color:var(--muted);font-size:12px}
  .list{background:var(--panel);border-right:1px solid var(--line);overflow:auto}
  .list .hd{padding:13px 16px;font-weight:800;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center}
  .list .hd .score{font-size:12px;color:var(--muted);font-weight:600}
  .item{padding:12px 16px;border-bottom:1px solid #f0f1f5;cursor:pointer;display:grid;gap:3px}
  .item:hover{background:#f7f9ff} .item.sel{background:#eef3ff;box-shadow:inset 3px 0 0 var(--brand)}
  .item .l1{display:flex;justify-content:space-between;gap:8px}
  .item .from{font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .item.unread .from::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--brand);margin-right:7px;vertical-align:middle}
  .item .date{color:var(--muted);font-size:12px;white-space:nowrap}
  .item .subj{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .item .prev{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tag{display:inline-block;font-size:10px;font-weight:800;padding:1px 7px;border-radius:999px;margin-top:3px;text-transform:uppercase;letter-spacing:.04em}
  .tag.ph{background:#fee2e2;color:var(--bad)} .tag.lg{background:#dcfce7;color:var(--ok)}
  .read{background:#fff;overflow:auto;padding:0}
  .read .empty{height:100%;display:grid;place-items:center;color:#9aa1ad;text-align:center;padding:40px}
  .rhd{padding:22px 30px 10px}
  .rhd h1{font-size:21px;margin:0 0 14px}
  .rfrom{display:flex;align-items:center;gap:12px}
  .rfrom .av{width:42px;height:42px;border-radius:50%;background:#dbe3fb;color:var(--brand-d);display:grid;place-items:center;font-weight:800;font-size:17px}
  .rfrom .nm{font-weight:700} .rfrom .ad{color:var(--muted);font-size:13px}
  .rfrom .dt{margin-left:auto;color:var(--muted);font-size:13px}
  .rbody{padding:16px 30px 30px;font-size:15px;line-height:1.6;max-width:760px}
  .rbody a{color:var(--brand)}
  .quiz{position:sticky;bottom:0;background:#fff;border-top:1px solid var(--line);padding:16px 30px;box-shadow:0 -4px 14px rgba(0,0,0,.04)}
  .quiz .q{font-weight:700;margin-bottom:10px}
  .qbtns{display:flex;gap:10px}
  .qbtn{flex:0 0 auto;padding:11px 20px;border-radius:9px;border:2px solid var(--line);background:#fff;font-weight:700;cursor:pointer;font-size:14px}
  .qbtn.ph:hover{border-color:var(--bad);color:var(--bad)} .qbtn.lg:hover{border-color:var(--ok);color:var(--ok)}
  .fb{margin-top:14px;border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.5}
  .fb.right{background:#f0fdf4;border:1px solid #bbf7d0} .fb.wrong{background:#fef2f2;border:1px solid #fecaca}
  .fb .h{font-weight:800;margin-bottom:6px} .fb.right .h{color:var(--ok)} .fb.wrong .h{color:var(--bad)}
  .fb ul{margin:8px 0 0;padding-left:18px} .fb li{margin:3px 0}
  .done{margin:20px 30px;padding:18px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;font-size:15px}
</style></head>
<body>
<div class="app">
  <div class="top">
    <div class="logo"><span class="ic">✉</span> Meridian Mail</div>
    <div class="search"><input placeholder="Pesquisar e-mails..."></div>
    <div class="me"><span>${ME.name}</span><div class="av">CM</div></div>
  </div>
  <div class="main">
    <div class="nav">
      <button class="btn-new">+ Novo e-mail</button>
      <a class="active">Caixa de entrada <span class="c" id="nav-inbox"></span></a>
      <a>Enviados</a><a>Rascunhos</a><a>Itens excluídos</a>
      <a>Lixo eletrônico <span class="c">0</span></a><a>Arquivo morto</a>
    </div>
    <div class="list">
      <div class="hd">Caixa de entrada <span class="score" id="score"></span></div>
      <div id="items"></div>
    </div>
    <div class="read" id="read"><div class="empty">Selecione um e-mail para ler.<br>Classifique cada um como <b>Legítimo</b> ou <b>Phishing</b>.</div></div>
  </div>
</div>
<script>
const EMAILS = JSON.parse(${JSON.stringify(renderData())});
const state = {}; // id -> {guess, correct}
let selId = null;

function initials(name){return name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();}
function esc(s){return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}

function renderList(){
  const box = document.getElementById('items');
  box.innerHTML = EMAILS.map(e=>{
    const st = state[e.id];
    const tag = st ? (e.category==='phishing'?'<span class="tag ph">Phishing</span>':'<span class="tag lg">Legítimo</span>') : '';
    return \`<div class="item \${st?'':'unread'} \${e.id===selId?'sel':''}" onclick="openMail(\${e.id})">
      <div class="l1"><div class="from">\${esc(e.fromName)}</div><div class="date">\${esc(e.date)}</div></div>
      <div class="subj">\${esc(e.subject)}</div>
      <div class="prev">\${esc(e.preview)}</div>\${tag}</div>\`;
  }).join('');
  const done = Object.keys(state).length, hits = Object.values(state).filter(s=>s.correct).length;
  document.getElementById('nav-inbox').textContent = EMAILS.length - done || '';
  document.getElementById('score').textContent = 'Classificados: '+done+'/'+EMAILS.length+' · Acertos: '+hits;
}

function openMail(id){
  selId = id;
  const e = EMAILS.find(x=>x.id===id);
  const st = state[id];
  const fb = st ? renderFb(e, st) : '';
  const quiz = \`<div class="quiz">
      <div class="q">Este e-mail é seguro ou é um golpe?</div>
      <div class="qbtns">
        <button class="qbtn ph" onclick="guess(\${id},'phishing')">🎣 É phishing</button>
        <button class="qbtn lg" onclick="guess(\${id},'legit')">✅ É legítimo</button>
      </div>\${fb}</div>\`;
  document.getElementById('read').innerHTML = \`
    <div class="rhd">
      <h1>\${esc(e.subject)}</h1>
      <div class="rfrom"><div class="av">\${initials(e.fromName)}</div>
        <div><div class="nm">\${esc(e.fromName)}</div><div class="ad">&lt;\${esc(e.fromAddr)}&gt;</div></div>
        <div class="dt">\${esc(e.date)}</div></div>
    </div>
    <div class="rbody">\${e.body}</div>\${quiz}\`;
  renderList();
};

function renderFb(e, st){
  const cls = st.correct?'right':'wrong';
  const head = st.correct ? '✔ Correto!' : '✘ Não era essa a classificação';
  const flags = e.flags.map(f=>'<li>'+esc(f)+'</li>').join('');
  return \`<div class="fb \${cls}"><div class="h">\${head}</div>
    <div>\${esc(e.verdict)}</div>
    <ul>\${flags}</ul></div>\`;
}

function guess(id, g){
  const e = EMAILS.find(x=>x.id===id);
  state[id] = { guess:g, correct: g===e.category };
  openMail(id);
  if(Object.keys(state).length===EMAILS.length) showDone();
}

function showDone(){
  const hits = Object.values(state).filter(s=>s.correct).length;
  const read = document.getElementById('read');
  if(document.getElementById('doneBox')) return;
  const div = document.createElement('div');
  div.id='doneBox'; div.className='done';
  div.innerHTML = '<b>Quest concluída!</b> Você classificou os '+EMAILS.length+' e-mails e acertou '+hits+'. '+
    'Lembre: no mundo real, basta <b>um</b> clique errado em uma isca para iniciar um incidente.';
  read.insertBefore(div, read.firstChild);
}

renderList();
</script>
</body></html>`;

app.get('/', (req, res) => res.type('html').send(PAGE()));
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Meridian Mail rodando em http://localhost:${PORT} (phishing_url=${PHISHING_URL})`));
