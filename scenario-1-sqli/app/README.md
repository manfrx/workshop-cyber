# Portal MedClinic · Portal do Paciente (Cenário 1 · SQL Injection)

Este é o código **real** do cenário, extraído do laboratório em produção
(`/usr/src/app/server.js` no container MedClinic).

## O que o app faz

Portal do paciente com uma busca "nos meus exames" que é montada por
concatenação de string — a falha didática do Cenário 1.

```js
// server.js (trecho)
const sql = `SELECT p.name AS patient, e.exam_date, e.category, e.name AS exam, e.result
             FROM exams e JOIN patients p ON p.id = e.patient_id
             WHERE e.patient_id = ${pid} AND e.name LIKE '%${q}%'
             ORDER BY e.exam_date DESC`;
```

A entrada do participante (`q`) é colada direto no comando SQL. O login
também é vulnerável, o que dá o bypass `admin'#`.

A consulta devolve **5 colunas** (`Paciente | Data | Categoria | Exame | Resultado`),
por isso o `UNION SELECT` precisa ter exatamente 5 colunas.

## Seeder

Na primeira inicialização o app chama `seedIfNeeded()`, que gera **1000
pacientes** e ~4100 exames (`TOTAL = 1000` no `server.js`). O `seed/schema.sql`
apenas cria o schema e popula:

- paciente de demonstração `id = 1` (Ana Beatriz Souza) + 15 exames
- usuários `user` / `user123` (patient) e `admin` / `S3nh4Admin!2024` (admin)
- a tabela `secrets` com a flag (`workshop_flag`)

## Variáveis de ambiente

| Variável | Padrão | Uso |
|----------|--------|-----|
| `PORT` | `3000` | porta HTTP |
| `DB_HOST` | `localhost` | host do MySQL |
| `DB_USER` | `appuser` | usuário do MySQL |
| `DB_PASSWORD` | `app_pw_change_me` | senha do MySQL |
| `DB_NAME` | `medclinic` | banco de dados |

A flag **não** é lida por este app: ela é gravada pelo `seed/schema.sql`
(marcador `__C1_FLAG__`), que o Compose substitui por `$C1_FLAG`.

## Rotas

| Rota | Método | Comportamento |
|------|--------|----------------|
| `/login` | GET/POST | Formulário `username` + `password`; sessão por cookie |
| `/dashboard` | GET | Painel do paciente logado |
| `/search?q=` | GET | Busca por exame — **aqui mora a SQLi** |
| `/logout` | GET | Encerra a sessão |

## Como subir

```bash
cd infra
docker compose up -d --build medclinic
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login
```

Login do participante: `user` / `user123`.
