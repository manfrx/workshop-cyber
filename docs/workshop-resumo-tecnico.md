<!-- Documento original do workshop. As flags foram substituidas pelos
     marcadores __C1_FLAG__ / __C2_FLAG__ (preenchidos por infra/.env). -->

# Workshop de Conscientização em Segurança — Resumo Técnico

> **Para que serve este documento:** base técnica de referência para montar a
> apresentação. Ambiente **de treinamento, deliberadamente vulnerável**, rodado
> em infraestrutura isolada. **Público: gestores (sem conhecimento técnico)** —
> a linguagem da apresentação deve priorizar impacto de negócio, risco e exemplos
> concretos, deixando o detalhe técnico como apoio.

---

## 1. Visão geral

Laboratório **hands-on** com **3 cenários** que mostram, na prática, como falhas
comuns viram incidentes reais. A ideia é o gestor **viver o ataque do lado de quem
explora** (de forma guiada e segura) para entender por que certas decisões de
segurança importam.

Empresa-cenário fictícia: **Meridian Capital** (gestora de investimentos).
Domínio corporativo legítimo usado no material: `meridiancapital.example`.

| # | Tema | Vulnerabilidade | O que o participante faz |
|---|------|-----------------|--------------------------|
| 1 | Portal de clínica (MedClinic) | **SQL Injection** | Vaza prontuário de ~1000 pacientes por um campo de busca |
| 2 | Portal do investidor (Meridian) | **Command Injection (root)** | Transforma um "backup" em controle total do servidor |
| 3 | Caixa de e-mail + simulação | **Phishing / engenharia social** | Classifica e-mails e "cai" numa isca que bloqueia a tela |

**Plataforma do workshop**: cada participante cria sua conta, resolve a quest de
phishing (webmail), submete as **flags** dos Cenários 1 e 2 e acompanha o **placar
ao vivo**.

---

## 2. Estrutura didática sugerida (por cenário)

Use esta sequência em cada cenário na apresentação:

1. **Intro / contexto** — que sistema é, o que ele faz no dia a dia.
2. **Como funciona a falha** — a ideia por trás, em linguagem simples.
3. **Impactos** — o que a empresa perde (dados, dinheiro, reputação, LGPD).
4. **Código vulnerável** — mostrar o "porquê" técnico (1 slide, opcional p/ gestores).
5. **Exploração** — o passo a passo do ataque.
6. **Hands-on** — o que o participante faz no lab.
7. **Recap / PoC** — o resultado (a prova visual do estrago).
8. **Remediação** — como se protege (o que o gestor deve cobrar da TI).

---

## 3. Marca e identidade visual

- **Tema visual**: "cyber" escuro — fundo quase preto, neon ciano/violeta, fonte
  monoespaçada nos títulos/terminais. Clima de "centro de operações de segurança".
- **Plataforma**: webmail estilo Outlook/corporativo para a quest; placar com
  barras de progresso; painel do instrutor separado.
- **Empresa-cenário**: Meridian Capital (gestora), com áreas realistas (RH,
  Controladoria, Compliance, Research, Benefícios, Facilities).
- **Tom para gestores**: cada cenário fecha com uma "mensagem para o gestor" —
  uma frase de impacto que traduz o técnico em risco de negócio.

---

## 4. Infraestrutura e acesso

### 4.1 Topologia
- **Nuvem**: Oracle Cloud (OCI), região São Paulo (`sa-saopaulo-1`).
- **1 VM de gerenciamento** (Linux x86) roda **todos os serviços em containers
  Docker**: plataforma, os 3 cenários, Apache **Guacamole** (acesso RDP via
  navegador) e **nginx** (TLS).
- **20 VMs de participante** (Windows Server 2022) em **sub-rede privada**, usadas
  no Cenário 3 (cada uma roda a simulação de tela de bloqueio). Acesso só via
  Guacamole (navegador) — não ficam expostas à internet.
- Rede: VCN própria, sub-rede pública (gerência) + privada (VMs), NAT para saída.

### 4.2 URLs (acesso)
Servidas pela VM de gerência, HTTPS com certificado self-signed (o navegador
mostra aviso de "não seguro" — é esperado no lab).

| Recurso | URL | Credencial |
|---|---|---|
| **Plataforma do workshop** | `https://<IP-GERENCIA>/` | cada participante cria a conta |
| **Painel do instrutor** | `https://<IP-GERENCIA>/admin` | login `admin` / `Cyber@2022` |
| **Placar / dashboard** | `https://<IP-GERENCIA>/dashboard` | — |
| **Guacamole (RDP no navegador)** | `https://<IP-GERENCIA>/guacamole/` | `guacadmin` / *(senha gerada)* |
| **Cenário 1 — SQL Injection** | `https://<IP-GERENCIA>:3000/` | demo `user` / `user123` |
| **Cenário 2 — Command Injection** | `https://<IP-GERENCIA>:3001/` | `investidor` / `Invest@2024` |
| **Cenário 3 — isca (documento)** | `http://<IP-GERENCIA>/documento` | — (abre dentro da VM) |
| **Acesso às VMs (Windows)** | via Guacamole → conexões VM-01…VM-20 | `aluno` / `Workshop@2024` |

> **Nota:** a isca do Cenário 3 fica em **HTTP** de propósito, para a página
> conseguir acionar o serviço de bloqueio local da VM sem ser bloqueada pelo
> navegador (regra de "mixed content").

### 4.3 Painel do instrutor (/admin)
- **Liberar/bloquear o Cenário 3** para a turma (a caixa de entrada só aparece
  quando liberada).
- **Infectar todas as VMs** em **cascata** (1 VM a cada 5s) e **reverter** (imediato).
- **Auto-surto**: se qualquer VM for infectada (ex.: alguém clicar na isca), as
  demais são infectadas automaticamente, também 5s a 5s.
- **Status ao vivo** das VMs: 🔴 infectada · 🟢 normal · ⚫ offline (atualiza sozinho).
- **Limpar dashboard** (zera a turma para recomeçar).

---

## 5. Pontuação (placar)

- **Quest de phishing**: acerto **+10**, erro **−5** (por e-mail classificado).
- **Flags (Cenários 1 e 2)**: modelo de **decaimento** — quem resolve antes
  pontua mais. Começa em **100** e cai **10** a cada novo solver, com **piso 50**
  (100 → 90 → 80 → 70 → 60 → 50 → 50 …). Incentiva agilidade sem zerar quem chega depois.
- Placar ao vivo mostra: pontos de phishing, pontos de flags, progresso de e-mails
  classificados (x/10) e total.

---

## 6. Cenário 1 — SQL Injection (MedClinic · Portal do Paciente)

### Intro / contexto
Portal onde o paciente faz login e vê **os próprios dados**: perfil, convênio,
consultas, receitas e exames. Há uma busca **"nos meus exames"**.

### Como funciona a falha
A busca monta a consulta ao banco **juntando o que o usuário digita** diretamente
no comando SQL. Isso permite "quebrar" a lógica da consulta e fazer o banco
devolver coisas que não deveria.

### Impactos (mensagem para o gestor)
Um **paciente comum**, logado na própria conta, consegue ler o **prontuário de
~1000 pacientes** — nomes, CPF, e-mail, telefone, diagnósticos, sorologias
(inclusive HIV). É **vazamento de dado sensível de saúde** → LGPD, dano de
reputação, risco jurídico. Tudo por **um campo de busca**.

### Código vulnerável (essência)
A consulta filtra por `patient_id` e insere o termo buscado sem **parametrização**.
O filtro "só os meus exames" existe apenas na query — e a query pode ser subvertida.

### Exploração (roteiro do lab)
1. **Comportamento normal**: busca legítima (ex.: `colesterol`) mostra só os exames
   da própria paciente.
2. **Quebrar o filtro** (vazar tudo): no campo de busca, `' OR 1=1 #`.
   Passam a aparecer exames de centenas de pacientes. *(o `#` comenta o resto; o
   `OR 1=1` torna a condição sempre verdadeira)*.
3. **Descobrir nº de colunas** (p/ UNION): `' ORDER BY 5 #` funciona, `' ORDER BY 6 #`
   dá erro → são **5 colunas**.
4. **Extrair a flag**: `' AND 1=2 UNION SELECT flag, CURDATE(), 'secret', name, flag FROM secrets #`.
5. **Vazar dados pessoais** (CPF etc.): `' AND 1=2 UNION SELECT name, birthdate, cpf, email, phone FROM patients #`.
6. **Roubar credenciais**: `' AND 1=2 UNION SELECT username, '', password, role, fullname FROM users #`
   → senhas **em texto puro** (ex.: `admin` / `S3nh4Admin!2024`) = escalada para admin.
7. **(Bônus) bypass de login**: usuário `admin'#` + qualquer senha → entra como admin.

> **Gotcha didático (MySQL):** usar `#` como comentário (não `-- `), porque formulários
> HTML descartam o espaço que o `--` exige.

### Recap / PoC
A prova visual: o contador no topo saltando para "milhares de exames · 1000
pacientes", e a tela mostrando CPF/diagnósticos de gente que não é o usuário.

### Remediação (o que cobrar da TI)
- **Queries parametrizadas** (prepared statements) — nunca concatenar entrada no SQL.
- **Autorização no servidor** — não confiar que o filtro na query protege o dado.
- **Senhas com hash forte** (nunca texto puro).
- **Flag do cenário:** `__C1_FLAG__`

---

## 7. Cenário 2 — Command Injection (Meridian Capital · Portal do Investidor)

### Intro / contexto
Portal do investidor com a carteira completa (patrimônio, posições, alocação,
transações). Tem a função **"Backup da carteira"**, que exporta um arquivo para
um **destino** informado pelo usuário.

### Como funciona a falha
O "destino" digitado é **colado diretamente num comando do sistema operacional**.
Quem digita no campo consegue **executar comandos no servidor**. E o serviço roda
como **root** (superusuário) → controle total.

### Impactos (mensagem para o gestor)
Uma funcionalidade **legítima e útil** ("exportar backup da minha carteira") vira
**execução remota de comandos como root**. O atacante lê qualquer arquivo (inclusive
a base de carteiras de todos os clientes), cria usuários, instala backdoor e
**pivota para a rede interna**. É o pior caso: comprometimento total do servidor.

### Código vulnerável (essência)
O backup monta algo como `tar ... ; exportar para <destino>` e **concatena o
destino no shell**. Qualquer separador de comando (`;`, `|`, `&&`) injeta um comando novo.

### Exploração (roteiro do lab)
1. **Comportamento normal**: backup com destino padrão (`s3://meridian-backups/carteira`)
   — repare que o destino digitado **aparece colado no comando** exibido.
2. **Confirmar injeção + privilégio**: destino `x; id` → saída inclui
   `uid=0(root)` = rodando como **root**.
3. **Capturar a flag** (arquivo só-root): `x; cat /root/flag.txt`.
4. **Mostrar o poder do RCE**: `x; ls -la /root`, `x; cat /etc/passwd`,
   `x; uname -a; hostname; ps aux`, ler a própria base de carteiras.

### Recap / PoC
A prova: a função de "backup" devolvendo `uid=0(root)` e o conteúdo de `/root` /
dados de clientes na tela. "Um campo de texto virou o servidor inteiro."

### Remediação (o que cobrar da TI)
- **Nunca** concatenar entrada do usuário em comandos de shell.
- Usar APIs que **separam comando e argumentos** (sem shell).
- **Allow-list** de formato para a entrada (destino só no padrão esperado).
- **Privilégio mínimo** — o serviço nunca deve rodar como root.
- **Flag do cenário:** `__C2_FLAG__`

---

## 8. Cenário 3 — Phishing e engenharia social

### Intro / contexto
Cada participante recebe uma **caixa de entrada** (webmail) com **10 e-mails**: uns
legítimos, uns de phishing. O participante classifica cada um como **phishing** ou
**legítimo**. Um dos e-mails é a **isca** que, ao ser aberta/baixada dentro da VM
Windows, dispara uma **simulação de ransomware** (tela de bloqueio em tela cheia —
nada é realmente criptografado).

### Como funciona a falha
Phishing não ataca a tecnologia, ataca a **pessoa**. Os golpes reais usam gatilhos
psicológicos e pistas que dá pra treinar o olho a perceber.

### As técnicas reais ensinadas (os 5 e-mails de phishing)
| E-mail | Técnica real demonstrada |
|---|---|
| Suporte TI (`@meridian-ti.example`) | **Domínio sósia** + **pressão** (senha expira em 24h / bloqueio) |
| Cobrança (`@nf-eletronica.example`) | **Medo/pressão** (protesto em cartório) + anexo `.zip` |
| Documento compartilhado (`@docs-share.example`) — **isca** | **Escassez/urgência** ("expira em 2 horas") |
| CFO Ricardo Menezes (`@meridiancap`**l**`tal.example`) | **BEC / fraude do CEO**: autoridade + urgência + sigilo + **domínio com letra trocada** (l↔i) |
| Benefícios (`@meridian-beneficios.example`) | **Recompensa/ganho** (PLR liberada 🎉) + prazo + coleta de dados bancários |

Os **5 e-mails legítimos** vêm de `@meridiancapital.example` (RH, Controladoria,
Research, Facilities, Compliance). Um deles (Compliance) é **legítimo mas com prazo**
— ensina que *tom urgente não é, sozinho, sinal de golpe*; o que vale é checar o
**domínio** e o canal.

> **Os 4 sinais de phishing para o gestor levar pra casa:**
> 1. **Domínio trocado/parecido** (letra a mais, letra trocada, domínio externo).
> 2. **Pressão** (ameaça, bloqueio, consequência).
> 3. **Urgência/escassez** (prazo curto, "agora", "expira").
> 4. **Recompensa** (prêmio, dinheiro, benefício liberado).

### Impactos (mensagem para o gestor)
Um clique de um colaborador pode abrir a porta para **roubo de credenciais,
transferência fraudulenta (BEC)** ou **ransomware** — como a tela de bloqueio que
o participante vê na própria VM. A defesa mais barata e eficaz é **gente treinada**.

### Exploração / Hands-on
1. Instrutor **libera o Cenário 3** no painel `/admin`.
2. Participante abre o webmail, **classifica os 10 e-mails** (placar: +10/−5).
3. Ao abrir a **isca** dentro da VM (Guacamole), a VM aciona o serviço local e a
   **tela de bloqueio** aparece (prop visual — nada é criptografado).
4. Instrutor pode **disparar a cascata** manualmente (/admin) para toda a turma e
   acompanhar o **status ao vivo** (quem "caiu").

### Recap / PoC
A tela cheia de "RANSOMWARE ACTIVATED / DATA ENCRYPTED" na máquina do próprio
participante — impacto emocional que fixa a lição. **Reverter** (kill-switch)
libera tudo na hora.

### Remediação (o que cobrar da TI / organização)
- **Treinamento recorrente** e simulações de phishing.
- **MFA** (2º fator) — reduz o estrago do roubo de senha.
- Processos para pagamentos (**confirmação por segundo canal** contra BEC).
- Filtros de e-mail, marcação de **e-mail externo**, EDR/antivírus e backups testados.
- **Como reportar**: canal claro para o colaborador avisar "recebi algo suspeito".

### Pontuação
Esse cenário pontua pela **classificação correta** dos e-mails (+10/−5), não por flag.

---

## 9. Mensagens-chave para fechar a apresentação

1. **Toda funcionalidade é superfície de ataque** — busca, backup, e-mail: o útil
   pode virar brecha.
2. **Segurança é decisão de negócio** — queries parametrizadas, privilégio mínimo,
   MFA e treino não são "coisa de TI", são gestão de risco.
3. **O elo humano é central** — o phishing provou que o clique certo derruba o
   melhor firewall. Treinar pessoas é o melhor retorno.
4. **Defesa em camadas** — nenhuma medida sozinha basta; é a soma que protege.

---

## 10. Apêndice — resumo rápido das flags e credenciais

| Item | Valor |
|---|---|
| Flag Cenário 1 | `__C1_FLAG__` |
| Flag Cenário 2 | `__C2_FLAG__` |
| Login C1 (demo) | `user` / `user123` · (admin vazável: `admin` / `S3nh4Admin!2024`) |
| Login C2 | `investidor` / `Invest@2024` |
| RDP nas VMs | `aluno` / `Workshop@2024` |
| Painel instrutor | `admin` / `Cyber@2022` |
| Quest de phishing | 10 e-mails (5 phishing / 5 legítimos), +10 / −5 |
| Flags (decaimento) | 100 → 90 → … → piso 50 |
