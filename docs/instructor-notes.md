# Notas do Instrutor

Este documento **não contém flags**. O gabarito fica em repositório privado separado.

---

## 0. Injetar as flags da edição

As flags **não estão neste repositório**. Elas vêm do ambiente (`infra/.env`)
e são aplicadas em dois pontos:

| Onde | Marcador | Quem substitui |
|------|----------|----------------|
| `scenario-1-sqli/seed/schema.sql` | `__C1_FLAG__` | `infra/docker-compose.yml` (serviço `db`) a partir de `$C1_FLAG` |
| `scenario-2-cmdi/Dockerfile` | `ARG C2_FLAG` | `docker compose build` a partir de `$C2_FLAG` |
| `deck/index.html` (slides de Recap) | `__C1_FLAG__` / `__C2_FLAG__` | manual, antes de apresentar |

Procedimento para a edição:

```bash
cd infra
cp .env.example .env
# edite .env e defina C1_FLAG=..., C2_FLAG=..., C1_DB_PASSWORD=...
docker compose up -d --build
```

Para o deck, substitua os marcadores pelos valores da edição antes de projetar:

```bash
sed -i "s|__C1_FLAG__|$C1_FLAG|g; s|__C2_FLAG__|$C2_FLAG|g" deck/index.html
```

> Os slides "C1 · Recap" e "C2 · Recap" são os que revelam a resposta.
> Mantenha o deck com os valores reais apenas na máquina de apresentação —
> o arquivo do repositório deve ir para o git **sem** as flags.

---

## 1. Checklist de preparação (T-24h)

- [ ] VMs da OCI ligadas e com IP público anotado
- [ ] `infra/.env` preenchido com as flags da edição atual
- [ ] `docker compose up -d --build` rodando em todas as VMs
- [ ] `curl` retornando `200` nos três endpoints (3000, 3001, 3002)
- [ ] Deck aberto em `deck/index.html` em um navegador de teste
- [ ] Script `simulacao-tela-cheia.ps1` testado em máquina isolada
- [ ] Plataforma de placar acessível e testada
- [ ] `docs/participant-guide.pdf` impresso ou enviado aos participantes
- [ ] Security List da OCI liberando 3000, 3001, 3002 (e 10000 se usar a simulação)
- [ ] Firewall interno das VMs (`iptables`/`firewalld`) revisado

---

## 2. Cronograma sugerido (meio período · 4h)

| Tempo | Bloco | Slides |
|-------|-------|--------|
| 0:00–0:15 | Abertura + manchete da Binance | Capa, Manchete |
| 0:15–0:30 | Objetivo, formato, placar e regras | 3 slides |
| 0:30–1:10 | Cenário 1 (SQL Injection) — teoria + hands-on | 6 slides |
| 1:10–1:20 | Recap Cenário 1 + remediação | 2 slides |
| 1:20–1:30 | Coffee break curto | 1 slide |
| 1:30–2:10 | Cenário 2 (Command Injection) — teoria + hands-on | 6 slides |
| 2:10–2:20 | Recap Cenário 2 + remediação | 2 slides |
| 2:20–2:30 | Coffee break | 1 slide |
| 2:30–3:10 | Cenário 3 (Phishing) + simulação de ransomware | 7 slides |
| 3:10–3:30 | Liderando na crise + placar final | 3 slides |
| 3:30–3:45 | Mensagens-chave + encerramento | 2 slides |

Para dia inteiro, dobre o tempo de hands-on e acrescente uma rodada de discussão em grupo após cada recap.

---

## 3. Condução por cenário

### Cenário 1 — SQL Injection

- **Objetivo pedagógico:** mostrar que um campo de busca “inofensivo” pode vazar dados sensíveis de saúde.
- **Ponto de virada:** quando o contador no topo da tela salta para ~1000 pacientes.
- **Dica de condução:** peça a um participante para ler em voz alta o nome de um paciente fictício. O desconforto é didático.
- **Onde os participantes travam:** não percebem que precisam contar as colunas antes do `UNION`. Lembre do `ORDER BY`.
- **Fechamento:** “Quem aqui já usou um portal assim? Esse campo de busca existe no nosso dia a dia?”

### Cenário 2 — Command Injection

- **Objetivo pedagógico:** mostrar que uma funcionalidade legítima (backup) pode virar controle total do servidor.
- **Ponto de virada:** quando `uid=0(root)` aparece na tela.
- **Dica de condução:** antes de mostrar o payload, pergunte “o que esse botão faz por baixo?”. Deixe a turma formular hipóteses.
- **Onde os participantes travam:** esquecem que `;` separa comandos. Reforce que `|` e `&&` também funcionam.
- **Fechamento:** “Quantas funcionalidades assim existem hoje na nossa empresa?”

### Cenário 3 — Phishing

- **Objetivo pedagógico:** mostrar que phishing moderno não tem erro de português — usa psicologia e domínios sósia.
- **Ponto de virada:** quando alguém cai na isca e a tela de ransomware abre.
- **Dica de condução:** libere o Cenário 3 no painel do instrutor **apenas** no momento do hands-on. Antes, deixe a turma discutir os 4 sinais.
- **Onde os participantes travam:** focam no tom urgente e ignoram o domínio. Reforce: “o que decide é o domínio, não o tom.”
- **Fechamento:** “Qual é o nosso canal para reportar um e-mail suspeito? Se ninguém souber, esse é o primeiro ponto de ação.”

---

## 4. Como resetar o lab entre sessões

```bash
cd infra
docker compose down -v        # remove containers e volumes
docker compose up -d --build  # sobe limpo
```

O `down -v` apaga o banco e força o seed a rodar de novo. Isso regenera as flags se elas forem seedadas via env no docker-compose.

Se as flags forem fixas por edição, elas não mudam — e o `answers.local.md` continua válido.

---

## 5. Problemas comuns

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| `curl` retorna 000 ou timeout | Firewall da OCI ou interno | Liberar a porta na Security List e no `iptables` |
| Cenário 1 mostra erro de conexão com MySQL | Container do banco não subiu | `docker compose logs db` |
| Script PowerShell abre e fecha | Bloqueio de AV | Adicionar exclusão ou renomear o script (já feito) |
| Participante acessa via `https://` e recebe erro | Lab usa HTTP puro | Orientar a usar `http://` |
| Placar não atualiza | Cache do navegador | `Ctrl+Shift+R` |

---

## 6. Materiais para levar

- Deck em pen drive (backup)
- PDF do guia do participante impresso
- Lista de participantes para o placar
- Adesivos da coruja Root (brinde de encerramento)
- Checklist impresso desta página

---

## 7. Após o workshop

- Coletar feedback (NPS + uma frase sobre o momento mais impactante)
- Atualizar `deck/index.html` com correções
- Registrar as flags usadas na edição em `answers.local.md` (nunca commitar)
- Se rodou em empresa-cliente, gerar relatório curto com os pontos de ação levantados pela turma
