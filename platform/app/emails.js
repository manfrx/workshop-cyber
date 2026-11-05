/*
 * Caixa de entrada da quest de phishing (dados estáticos).
 * category: 'legit' | 'phishing'
 * Placeholders substituídos no render: __NAME__ (1º nome do usuário), __PHISHING_URL__
 * Conteúdo de treinamento. Nada aqui é malicioso.
 */
module.exports = [
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
  },
  {
    id: 3, fromName: 'Juliana Alves', fromAddr: 'juliana.alves@meridiancapital.example',
    date: 'Ontem', subject: 'Convite: Reunião trimestral de resultados — 05/11',
    preview: 'Pessoal, segue o convite para nossa reunião trimestral...',
    body: `<p>Oi __NAME__,</p>
      <p>Segue o convite para a <b>reunião trimestral de resultados</b>, dia 05/11 às 14h, na sala Ipanema (e por vídeo).</p>
      <p>Vou compartilhar a apresentação até quarta. Se tiver algum número que queira destacar da sua área, me avisa até terça.</p>
      <p>Abraço,<br>Juliana Alves · Controladoria</p>`,
    category: 'legit',
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
  },
  {
    id: 5, isLure: true, fromName: 'Documentos Compartilhados', fromAddr: 'no-reply@meridlancapital.example',
    date: '07:58', subject: '__NAME__, um documento foi compartilhado com você: "Contrato_Confidencial.pdf"',
    preview: 'Um arquivo foi compartilhado com você e expira em 2 horas...',
    body: `<p>Olá, __NAME__,</p>
      <p>Um documento <b>confidencial</b> foi compartilhado com você por <b>Diretoria Financeira</b>:</p>
      <div style="border:1px solid #d9dce3;border-radius:10px;padding:16px;margin:14px 0;max-width:420px;background:#fafbfd">
        <div style="font-weight:700;color:#dc2626">&#128196; Contrato_Confidencial.pdf</div>
        <div style="color:#6b7280;font-size:13px;margin:4px 0 12px">PDF · 2,4 MB · expira em 2 horas</div>
        <a href="__PHISHING_URL__" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;font-weight:700;text-decoration:none">Baixar documento</a>
      </div>`,
    category: 'phishing',
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
  },
  {
    // Técnica: BEC/fraude do CEO — autoridade + urgência + sigilo + domínio sósia
    // (meridiancapLtal — "l" no lugar do "i").
    id: 7, fromName: 'Ricardo Menezes', fromAddr: 'ricardo.menezes@meridiancapltal.example',
    date: '10:24', subject: 'Pagamento confidencial — preciso de agilidade',
    preview: '__NAME__, estou em reunião e preciso que você resolva algo rápido...',
    body: `<p>__NAME__, tudo bem?</p>
      <p>Estou entrando numa reunião com o board e <b>não posso falar por telefone agora</b>. Preciso que você providencie com <b>urgência</b> uma transferência para fechar uma aquisição ainda hoje — é <b>confidencial</b>, não comente com mais ninguém da equipe.</p>
      <p>Responda por aqui que eu te passo os dados bancários do beneficiário. Conto com a sua agilidade.</p>
      <p>Ricardo Menezes<br>CFO · Meridian Capital</p>`,
    category: 'phishing',
  },
  {
    // Técnica: recompensa/ganho (dinheiro de PLR) + prazo curto + domínio externo
    // parecido + coleta de dados bancários.
    id: 8, fromName: 'Benefícios', fromAddr: 'beneficios@meridian-beneficios.example',
    date: '11:03', subject: 'PLR 2024 liberada 🎉 — confirme seus dados bancários até 18h',
    preview: 'A participação nos lucros deste ano já está disponível...',
    body: `<p>Olá, __NAME__,</p>
      <p>Boa notícia: sua <b>Participação nos Lucros (PLR 2024)</b> foi aprovada e está <b>disponível para saque</b>. Para receber ainda neste ciclo, confirme seus dados bancários <b>até as 18h de hoje</b>:</p>
      <p><a href="http://meridian-beneficios.example/plr/confirmar">&#9658; Confirmar dados e liberar meu PLR</a></p>
      <p>Após o prazo, o valor só entra no próximo lote.</p>
      <p>Equipe de Benefícios</p>`,
    category: 'phishing',
  },
  {
    // Legítimo mundano, domínio real da empresa.
    id: 9, fromName: 'Facilities', fromAddr: 'facilities@meridiancapital.example',
    date: 'Ter', subject: 'Manutenção elétrica no 12º andar — sábado 09/11',
    preview: 'Haverá desligamento programado de energia no andar...',
    body: `<p>Prezados,</p>
      <p>No <b>sábado (09/11)</b>, das 8h às 12h, haverá <b>manutenção elétrica programada</b> no 12º andar. Durante o período, salas e copa ficarão sem energia.</p>
      <p>Recomendamos salvar os trabalhos e desligar os equipamentos na sexta à noite. Dúvidas pela intranet: <a href="https://intranet.meridiancapital.example/facilities">intranet.meridiancapital.example/facilities</a></p>
      <p>Equipe de Facilities</p>`,
    category: 'legit',
  },
  {
    // Legítimo COM prazo/urgência — ensina que tom urgente não basta; o que vale é
    // o domínio real e o acesso por login único corporativo.
    id: 10, fromName: 'Compliance', fromAddr: 'compliance@meridiancapital.example',
    date: 'Qua', subject: 'Treinamento anual de Compliance — conclua até 30/11',
    preview: 'O módulo deste ano já está disponível na plataforma de treinamentos...',
    body: `<p>Olá, __NAME__,</p>
      <p>O <b>treinamento anual obrigatório de Compliance</b> já está disponível. O prazo para conclusão é <b>30/11</b>. Acesse pela plataforma interna de treinamentos (login único corporativo):</p>
      <p><a href="https://treinamentos.meridiancapital.example/compliance">treinamentos.meridiancapital.example/compliance</a></p>
      <p>Leva cerca de 20 minutos. Em caso de dúvida, fale com o seu gestor.</p>
      <p>Área de Compliance</p>`,
    category: 'legit',
  },
];
