/*
 * bloqueio.js - Cliente de bloqueio (TREINAMENTO)
 * ================================================
 * Script reutilizavel que:
 *   1. Registra este navegador no servidor de controle (via SSE).
 *   2. Escuta o sinal do instrutor e, quando recebe "lock", injeta um OVERLAY
 *      em tela cheia (um <div>) com visual de "aviso de resgate".
 *   3. Ao receber "unlock" (kill-switch), troca o overlay por um painel de
 *      DEBRIEF educativo e, em seguida, o remove.
 *
 * IMPORTANTE - por que isto e seguro:
 *   - E apenas um elemento no DOM. Nao criptografa, nao grava nada, nao
 *     instala e nao sai do navegador. Fechar a aba encerra tudo.
 *   - NAO sequestra o teclado nem bloqueia Esc/Alt-Tab/fechar. O participante
 *     mantem controle total da maquina o tempo todo.
 *   - Uma marca d'agua permanente deixa claro que e uma SIMULACAO. Arte
 *     original: nao reproduz nenhum ransomware real nem logos de terceiros.
 */
(function () {
  'use strict';

  // ID estavel por navegador, para o instrutor reconhecer a mesma VM.
  var id;
  try {
    id = localStorage.getItem('meridian_sim_id');
    if (!id) {
      id = 'vm-' + Math.random().toString(36).slice(2, 8) + '-' + Date.now().toString(36);
      localStorage.setItem('meridian_sim_id', id);
    }
  } catch (_) {
    id = 'vm-' + Math.random().toString(36).slice(2, 10);
  }

  var OVERLAY_ID = 'meridian-sim-overlay';

  function removeOverlay() {
    var el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
  }

  function showLock() {
    if (document.getElementById(OVERLAY_ID)) return;

    var el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.setAttribute('role', 'dialog');
    el.innerHTML =
      '<div class="sim-wm">SIMULA&Ccedil;&Atilde;O DE TREINAMENTO &middot; NENHUM ARQUIVO FOI AFETADO</div>' +
      '<div class="sim-box">' +
        '<div class="sim-lock">&#128274;</div>' +
        '<h1>SEUS ARQUIVOS FORAM BLOQUEADOS</h1>' +
        '<p class="sim-lead">Os documentos deste dispositivo foram tornados inacess&iacute;veis.</p>' +
        '<div class="sim-timer">Tempo restante para recupera&ccedil;&atilde;o: <span id="sim-cd">23:59:58</span></div>' +
        '<p class="sim-sub">Para restaurar o acesso, siga as instru&ccedil;&otilde;es enviadas ao administrador.</p>' +
        '<div class="sim-note">&#9888; Se voc&ecirc; est&aacute; vendo esta tela, voc&ecirc; clicou em um link de phishing.</div>' +
      '</div>';

    var css = document.createElement('style');
    css.setAttribute('data-sim', '1');
    css.textContent =
      '#' + OVERLAY_ID + '{position:fixed;inset:0;z-index:2147483647;background:radial-gradient(circle at 50% 30%,#7f1d1d,#3b0a0a 70%,#1a0404);' +
        'color:#fff;font-family:"Segoe UI",system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;overflow:auto}' +
      '#' + OVERLAY_ID + ' .sim-wm{position:fixed;top:0;left:0;right:0;background:#fde047;color:#422006;font-weight:800;' +
        'font-size:12.5px;letter-spacing:.06em;padding:7px 10px;text-align:center}' +
      '#' + OVERLAY_ID + ' .sim-box{max-width:620px}' +
      '#' + OVERLAY_ID + ' .sim-lock{font-size:72px;line-height:1;filter:drop-shadow(0 4px 12px rgba(0,0,0,.4))}' +
      '#' + OVERLAY_ID + ' h1{font-size:34px;margin:14px 0 8px;letter-spacing:.02em;text-shadow:0 2px 10px rgba(0,0,0,.5)}' +
      '#' + OVERLAY_ID + ' .sim-lead{font-size:17px;color:#fecaca;margin:0 0 18px}' +
      '#' + OVERLAY_ID + ' .sim-timer{display:inline-block;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.2);' +
        'border-radius:10px;padding:12px 20px;font-size:18px;font-weight:700;margin-bottom:16px}' +
      '#' + OVERLAY_ID + ' .sim-timer span{color:#fca5a5;font-variant-numeric:tabular-nums}' +
      '#' + OVERLAY_ID + ' .sim-sub{color:#fca5a5;font-size:14px;max-width:460px;margin:0 auto 18px}' +
      '#' + OVERLAY_ID + ' .sim-note{background:rgba(0,0,0,.3);border-radius:10px;padding:12px 16px;font-size:14px;color:#fde68a}';

    (document.head || document.documentElement).appendChild(css);
    document.body.appendChild(el);

    // Cronometro cosmetico (so visual; nao faz nada ao chegar a zero).
    var total = 24 * 3600 - 2;
    var cd = el.querySelector('#sim-cd');
    el._timer = setInterval(function () {
      total = Math.max(0, total - 1);
      var h = String(Math.floor(total / 3600)).padStart(2, '0');
      var m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
      var s = String(total % 60).padStart(2, '0');
      if (cd) cd.textContent = h + ':' + m + ':' + s;
    }, 1000);

    // Tenta fullscreen para imersao (o usuario sai com Esc a qualquer momento).
    try { if (el.requestFullscreen) el.requestFullscreen().catch(function () {}); } catch (_) {}
  }

  function showDebrief() {
    var el = document.getElementById(OVERLAY_ID);
    if (!el) return;
    if (el._timer) clearInterval(el._timer);
    try { if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); } catch (_) {}

    el.style.background = 'radial-gradient(circle at 50% 30%,#14532d,#052e16 70%,#031b0d)';
    el.innerHTML =
      '<div class="sim-wm" style="background:#86efac;color:#052e16">FIM DA SIMULA&Ccedil;&Atilde;O &middot; DEBRIEF</div>' +
      '<div class="sim-box">' +
        '<div class="sim-lock" style="filter:none">&#9989;</div>' +
        '<h1 style="color:#bbf7d0">ISTO FOI UMA SIMULA&Ccedil;&Atilde;O</h1>' +
        '<p class="sim-lead" style="color:#bbf7d0">Nenhum arquivo foi criptografado, perdido ou alterado. Era um treinamento de phishing.</p>' +
        '<div style="text-align:left;background:rgba(0,0,0,.25);border-radius:12px;padding:16px 20px;font-size:14.5px;line-height:1.6;color:#dcfce7;margin:4px auto 0;max-width:520px">' +
          '<b>O que aconteceu:</b> voc&ecirc; clicou no bot&atilde;o de um e-mail-isca, que levou a um site falso e &quot;baixou&quot; um arquivo. No mundo real, bastaria isso para iniciar um incidente.<br><br>' +
          '<b>Os sinais que passaram batido:</b>' +
          '<ul style="margin:8px 0 0;padding-left:20px">' +
            '<li>Dom&iacute;nio de remetente que imita o oficial, mas n&atilde;o &eacute; ele.</li>' +
            '<li>Urg&ecirc;ncia artificial (&quot;expira em 2 horas&quot;) para voc&ecirc; agir sem pensar.</li>' +
            '<li>Documento &quot;confidencial&quot; inesperado pedindo download.</li>' +
          '</ul><br>' +
          '<b>Na pr&oacute;xima:</b> confira o remetente, passe o mouse sobre os links antes de clicar e, na d&uacute;vida, reporte para a TI.' +
        '</div>' +
      '</div>';

    // Remove o overlay apos o instrutor ter tempo de conduzir o debrief.
    setTimeout(removeOverlay, 60000);
  }

  // --- Conexao com o servidor de controle ---
  function connect() {
    var es = new EventSource('/stream?id=' + encodeURIComponent(id));
    es.addEventListener('lock', showLock);
    es.addEventListener('unlock', showDebrief);
    es.onerror = function () { /* o EventSource reconecta sozinho */ };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect);
  } else {
    connect();
  }
})();
