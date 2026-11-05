# Portal MedClinic — código-fonte ausente neste repositório

O código do portal MedClinic **não pôde ser recuperado** do laboratório em
produção e ainda precisa ser sincronizado aqui.

## O que já está pronto

- `../seed/schema.sql` — schema e seed **completos e verificados**
  (1000 pacientes, 4103 exames, 2 usuários, 1 segredo), extraídos do
  MySQL 8.0.46 do laboratório (`database medclinic`, usuário `appuser`).
- `../Dockerfile` — imagem Node 20, espera `app/server.js` na raiz.

## Por que o código não veio junto

O app roda em um container separado da imagem oficial, em outra rede Docker
(`172.18.0.0/16`, contra `172.19.0.0/16` do Cenário 2). Não há:

- socket do Docker no container,
- namespace de PID/montagem do host,
- permissão `FILE` no MySQL (`LOAD_FILE()` retorna vazio),
- diretório de arquivos estáticos servido pelo Express.

## Como preencher

1. Copie o código do portal a partir da VM de gerenciamento do workshop
   (`/opt/workshop`, populado pelo `up.sh`):

   ```bash
   scp -r <usuario>@<vm-mgmt>:/opt/workshop/scenario-1-sqli/app ./app/
   ```

2. Confirme que `app/package.json` define `npm start` (ou `node server.js`)
   e que o app lê `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`,
   `DB_PASSWORD` e `FLAG` do ambiente.

3. Suba e valide:

   ```bash
   cd infra && docker compose up -d --build
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
   ```

## Contrato observado no laboratório

Para validar a implementação, o app precisa respeitar:

| Rota | Método | Comportamento |
|------|--------|----------------|
| `/login` | GET/POST | Formulário `username` + `password`; sessão via cookie |
| `/dashboard` | GET | Painel do paciente logado |
| `/search?q=` | GET | Busca por exame — **aqui mora a SQLi** |
| `/logout` | GET | Encerra a sessão |

Login do participante: `user` / `user123` · conta admin: `admin` / `S3nh4Admin!2024`

A consulta vulnerável (simplificada, conforme o slide "C1 · Código vulnerável"):

```js
sql = "SELECT data, exame, resultado FROM exames " +
      "WHERE paciente_id = " + usuario.id +
      " AND exame LIKE '%" + busca + "%'"   // <- entrada colada no comando
db.query(sql)
```

A busca precisa devolver **5 colunas** (`Paciente | Data | Categoria | Exame | Resultado`)
para que o `UNION SELECT` de 5 colunas funcione, e a tabela `secrets`
(nome `workshop_flag`) precisa existir no banco.
