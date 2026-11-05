/*
 * Meridian Control - Servidor de controle do Cenario 3 (TREINAMENTO de phishing)
 * ==============================================================================
 * Esta e a peca de orquestracao de uma SIMULACAO DE CONSCIENTIZACAO. NAO ha
 * nada malicioso aqui. Em concreto:
 *
 *   - A "pagina de phishing" (/documento) e uma isca que baixa um arquivo
 *     INERTE (vazio) e abre uma conexao SSE com este servidor. O download so
 *     serve para mostrar ao participante "eu cliquei e algo baixou".
 *
 *   - A "tela de bloqueio" NAO e ransomware. E um <div> em tela cheia (um prop
 *     visual, como um slide) injetado no navegador. Nao criptografa arquivos,
 *     nao persiste, nao se auto-propaga, nao trava o teclado nem a maquina.
 *     O participante sempre pode fechar a aba ou sair do fullscreen (Esc).
 *     A tela carrega uma marca d'agua permanente de "SIMULACAO DE TREINAMENTO".
 *
 *   - Orquestracao CENTRAL, nao propagacao. As telas aparecem porque ESTE
 *     servidor empurra um sinal (SSE) para cada navegador conectado, com um
 *     intervalo de 5s. O instrutor tem disparo manual e um kill-switch que
 *     reverte tudo instantaneamente (vira a tela de debrief educativo).
 *
 * Uso previsto: lab isolado, gestores da propria empresa, com consentimento.
 */

const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;
// Alvo do GET disparado pela isca 5s DEPOIS do download (ex.: serviço de bloqueio
// rodando na própria VM da vítima, em 127.0.0.1). Vazio = não dispara nada.
const HACK_URL = process.env.HACK_URL || 'http://127.0.0.1:10000/hack';
const HACK_DELAY_MS = Number(process.env.HACK_DELAY_MS || 5000);

app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'public')));

// ------------------------------------------------------------------
// Estado central (em memoria). Um "cliente" = um navegador que abriu a
// isca (/documento) e esta conectado via SSE.
// ------------------------------------------------------------------
/** @type {Map<string, {id:string, label:string, ip:string, ua:string, connectedAt:number, clickedAt:number, locked:boolean, res:import('express').Response}>} */
const clients = new Map();
let armed = false; // true enquanto uma sequencia de bloqueio esta ativa

function publicClient(c) {
  return {
    id: c.id, label: c.label, ip: c.ip, ua: c.ua,
    connectedAt: c.connectedAt, clickedAt: c.clickedAt, locked: c.locked,
  };
}

function sendTo(c, event, data) {
  try {
    c.res.write(`event: ${event}\n`);
    c.res.write(`data: ${JSON.stringify(data || {})}\n\n`);
  } catch (_) { /* conexao ja fechada */ }
}

// ------------------------------------------------------------------
// 1) PAGINA DE PHISHING (a isca). Baixa um arquivo inerte e abre o SSE.
// ------------------------------------------------------------------
app.get('/documento', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="pt-br"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Visualizador de Documentos</title>
<style>
  :root{--bg:#f4f5f8;--panel:#fff;--ink:#1f2430;--muted:#6b7280;--brand:#2563eb;--line:#e5e7ef}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;font-family:'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--ink);
    display:grid;place-items:center;padding:24px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:14px;max-width:520px;width:100%;
    padding:34px;text-align:center;box-shadow:0 10px 40px rgba(15,23,42,.08)}
  .doc{font-size:46px}
  h1{font-size:20px;margin:14px 0 6px}
  .fn{font-weight:700;color:#c0392b}
  p{color:var(--muted);font-size:14px;line-height:1.55}
  .spin{width:30px;height:30px;border:3px solid #dbe3fb;border-top-color:var(--brand);border-radius:50%;
    margin:18px auto;animation:r 1s linear infinite}
  @keyframes r{to{transform:rotate(360deg)}}
  .ok{display:none;margin-top:14px;color:#16a34a;font-weight:600;font-size:14px}
  .hint{margin-top:22px;font-size:12px;color:#9aa1ad}
</style></head>
<body>
  <div class="card">
    <div class="doc">&#128196;</div>
    <h1>Abrindo <span class="fn">Contrato_Confidencial.pdf</span></h1>
    <div class="spin" id="spin"></div>
    <p id="msg">Preparando o download do documento compartilhado&hellip;</p>
    <div class="ok" id="ok">&#10003; Download iniciado. Verifique a pasta de downloads.</div>
    <div class="hint">Meridian Docs Share &middot; visualizador seguro</div>
  </div>

  <!-- Cliente de bloqueio: registra este navegador no servidor de controle
       e fica escutando o sinal (SSE). E um prop visual; nada e instalado. -->
  <script src="/static/bloqueio.js"></script>
  <script>
    var HACK_URL = ${JSON.stringify(HACK_URL)};
    var HACK_DELAY_MS = ${JSON.stringify(HACK_DELAY_MS)};
    // Dispara o "download" do arquivo INERTE (vazio).
    setTimeout(function(){
      var a = document.createElement('a');
      a.href = '/download'; a.download = 'Contrato_Confidencial.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      document.getElementById('spin').style.display = 'none';
      document.getElementById('msg').style.display = 'none';
      document.getElementById('ok').style.display = 'block';

      // ...e, 5s DEPOIS do download, dispara o GET no alvo (serviço local da VM).
      // no-cors: só precisamos emitir o GET; a resposta é opaca de propósito.
      if (HACK_URL) setTimeout(function(){
        fetch(HACK_URL, { mode: 'no-cors', cache: 'no-store' }).catch(function(){});
      }, HACK_DELAY_MS);
    }, 1500);
  </script>
</body></html>`);
});

// Arquivo baixado: INERTE. Um PDF minimo e vazio, so para "algo baixou".
app.get('/download', (req, res) => {
  const inertPdf = '%PDF-1.4\n% Documento de simulacao de treinamento - sem conteudo.\n%%EOF\n';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Contrato_Confidencial.pdf"');
  res.send(Buffer.from(inertPdf, 'utf8'));
});

// ------------------------------------------------------------------
// 2) SSE: cada navegador-isca se conecta aqui e passa a receber sinais.
// ------------------------------------------------------------------
app.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  const id = (req.query.id && String(req.query.id).slice(0, 40)) || crypto.randomUUID();
  const now = Date.now();
  const existing = clients.get(id);
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
  const client = {
    id,
    label: existing ? existing.label : 'VM ' + (clients.size + 1),
    ip,
    ua: (req.headers['user-agent'] || '').slice(0, 120),
    connectedAt: now,
    clickedAt: existing ? existing.clickedAt : now, // momento do clique na isca
    locked: existing ? existing.locked : false,
    res,
  };
  clients.set(id, client);

  sendTo(client, 'hello', { id, armed });
  // Se uma sequencia ja estava ativa, este novo cliente tambem entra travado.
  if (armed) {
    client.locked = true;
    sendTo(client, 'lock', {});
  }

  const ping = setInterval(() => sendTo(client, 'ping', { t: Date.now() }), 25000);
  req.on('close', () => {
    clearInterval(ping);
    const c = clients.get(id);
    if (c && c.res === res) clients.delete(id);
  });
});

// ------------------------------------------------------------------
// 3) PAINEL DO INSTRUTOR: ve conectados, dispara e reverte.
// ------------------------------------------------------------------
app.get('/api/state', (req, res) => {
  res.json({
    armed,
    clients: Array.from(clients.values()).map(publicClient)
      .sort((a, b) => a.clickedAt - b.clickedAt),
  });
});

// Disparo manual: empurra a tela de bloqueio para cada navegador, com 5s
// de intervalo entre um e outro (efeito "cascata" no lab).
app.post('/api/disparar', (req, res) => {
  const raw = req.body && req.body.stepMs;
  const stepMs = Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : 5000;
  armed = true;
  const list = Array.from(clients.values()).filter(c => !c.locked);
  list.forEach((c, i) => {
    setTimeout(() => {
      if (!armed) return;              // kill-switch cancela a cascata
      if (!clients.has(c.id)) return;  // desconectou nesse meio tempo
      c.locked = true;
      sendTo(c, 'lock', {});
    }, i * stepMs);
  });
  res.json({ ok: true, armed, scheduled: list.length, stepMs });
});

// KILL-SWITCH: reverte tudo instantaneamente. Cada navegador troca a tela de
// bloqueio pelo painel de debrief educativo ("isto foi uma simulacao").
app.post('/api/reverter', (req, res) => {
  armed = false;
  for (const c of clients.values()) {
    c.locked = false;
    sendTo(c, 'unlock', {});
  }
  res.json({ ok: true, armed });
});

app.get('/', (req, res) => res.redirect('/documento'));
app.get('/health', (req, res) => res.json({ ok: true, clients: clients.size, armed }));


app.listen(PORT, () => console.log(`Meridian Control rodando em http://localhost:${PORT} (isca: /documento)`));
