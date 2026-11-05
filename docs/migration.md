# Relatório de migração — do projeto original ao `workshop-cyber`

Documento gerado por diff real (sha256 por arquivo) entre:

- **Projeto original** — o repositório canônico do autor, em `~/Workshop Cyber` na VM de controle
  (`147.15.122.14`), mais os 3 arquivos soltos que existiam na raiz do workspace
  (`Do conhecimento à ação.html`, `Guia-do-participante-Do-conhecimento-a-acao.pdf`, `simulacao-ataque.ps1`).
- **Projeto novo** — este repositório (`workshop-cyber`), 8 commits sobre o ponto de partida.

| | |
|---|---|
| Arquivos no original | 45 |
| Arquivos no novo | 53 |
| Idênticos (mesmo caminho) | 2 |
| Movidos sem alteração de conteúdo | 14 |
| Movidos **e** modificados | 8 |
| Modificados no mesmo caminho | 3 |
| Novos | 31 |
| Removidos de vez | 0 (tudo migrado ou substituído) |

---

## 1. Mapa de renomeações

### 1.1 Estrutura de diretórios

| Original | Novo | Motivo |
|---|---|---|
| `challenge1-sqli/` | `scenario-1-sqli/` | nomenclatura por cenário, alinhada ao README |
| `challenge2-cmdi/` | `scenario-2-cmdi/` | idem |
| `challenge3-phishing/` | `phishing/` | idem |
| `platform/` | `platform/` | mantido |
| `scripts/simulacao.ps1` | `simulation/simulacao-tela-cheia.ps1` | renomeado para evitar falso positivo de AV/EDR |
| `infra-oci/` | `infra/oci/` | reagrupado sob `infra/` |
| — | `infra/docker-compose.yml` | **novo**: stack unificada do lab inteiro |
| — | `infra/.env.example` | **novo**: configuração da stack unificada |
| — | `deck/` | **novo**: o deck não existia no repo canônico |
| — | `docs/` | **novo**: documentação do workshop |
| — | `scenario-1-sqli/seed/` | **novo**: o seed saiu de `db/` |
| — | `scenario-1-sqli/app/README.md` | **novo**: contrato do app e do cenário |

### 1.2 Arquivos movidos sem alteração de conteúdo (14)

```
infra-oci/cloud-init/participant-windows.ps1  ->  infra/oci/cloud-init/participant-windows.ps1
infra-oci/down.sh                            ->  infra/oci/down.sh
infra-oci/guacamole/docker-compose.yml       ->  infra/oci/guacamole/docker-compose.yml
infra-oci/lib.sh                             ->  infra/oci/lib.sh
infra-oci/nginx/docker-compose.yml           ->  infra/oci/nginx/docker-compose.yml
infra-oci/nginx/nginx.conf                   ->  infra/oci/nginx/nginx.conf
infra-oci/up-tls.sh                          ->  infra/oci/up-tls.sh
challenge3-phishing/control/app/package.json ->  phishing/control/app/package.json
challenge3-phishing/control/app/public/bloqueio.js -> phishing/control/app/public/bloqueio.js
challenge3-phishing/control/app/server.js    ->  phishing/control/app/server.js
challenge3-phishing/webmail/app/package.json ->  phishing/webmail/app/package.json
challenge1-sqli/app/package.json             ->  scenario-1-sqli/app/package.json
challenge2-cmdi/app/package.json             ->  scenario-2-cmdi/app/package.json
challenge2-cmdi/app/server.js                ->  scenario-2-cmdi/app/server.js
```

### 1.3 Arquivos movidos **e** modificados (8)

| Original → Novo | Δ | O que mudou |
|---|---|---|
| `challenge1-sqli/app/server.js` → `scenario-1-sqli/app/server.js` | +1/−1 | e-mail dos pacientes fictícios: `@email.com` → `@email.example` (RFC 2606) |
| `challenge1-sqli/db/init.sql` → `scenario-1-sqli/seed/schema.sql` | +12/−4 | flag literal → marcador `__C1_FLAG__`; banco literal → `__C1_DB_NAME__` |
| `challenge1-sqli/app/Dockerfile` → `scenario-1-sqli/Dockerfile` | +12/−2 | contexto de build passa a ser a raiz do cenário (`COPY app/`) |
| `challenge1-sqli/docker-compose.yml` → `scenario-1-sqli/docker-compose.yml` | +52/−12 | seed por diretório + substituição da flag no init do MySQL; volumes nomeados |
| `challenge2-cmdi/app/Dockerfile` → `scenario-2-cmdi/Dockerfile` | +13/−4 | flag literal → `ARG C2_FLAG` (build arg) |
| `challenge2-cmdi/docker-compose.yml` → `scenario-2-cmdi/docker-compose.yml` | +15/−4 | `build` vira bloco com `args`; `C2_FLAG` do ambiente |
| `challenge3-phishing/webmail/app/server.js` → `phishing/webmail/app/server.js` | +15/−15 | domínios sósia → `.example` (ver §2.1) |
| `challenge3-phishing/webmail/docker-compose.yml` → `phishing/webmail/docker-compose.yml` | +10/−2 | `PHISHING_URL`/`HACK_URL` por ambiente |
| `challenge3-phishing/control/app/Dockerfile` → `phishing/control/Dockerfile` | +11/−3 | idem |
| `challenge3-phishing/control/docker-compose.yml` → `phishing/control/docker-compose.yml` | +14/−5 | idem |
| `platform/app/Dockerfile` → `platform/Dockerfile` | +8/−2 | contexto de build |
| `platform/docker-compose.yml` → `platform/docker-compose.yml` | +21/−8 | `C1_FLAG`/`C2_FLAG` no ambiente; segredos por variável |
| `platform/app/db.js` → `platform/app/db.js` | +12/−4 | **flags hardcoded → `process.env.C1_FLAG` / `C2_FLAG`** |
| `platform/app/emails.js` → `platform/app/emails.js` | +17/−17 | domínios sósia → `.example` |
| `scripts/simulacao.ps1` → `simulation/simulacao-tela-cheia.ps1` | +7/−6 | renomeado + cabeçalho + **substituído pela versão canônica em produção** |
| `infra-oci/cloud-init/mgmt.yaml` → `infra/oci/cloud-init/mgmt.yaml` | +6/−0 | `jq` no pacote; regra `3000:3005` no iptables |
| `infra-oci/configure-mgmt.sh` → `infra/oci/configure-mgmt.sh` | +52/−10 | paths, flags, `.env` por componente, raiz do repo |
| `infra-oci/guacamole/seed-connections.sh` → `infra/oci/guacamole/seed-connections.sh` | +7/−1 | placeholder `CHANGE_ME_*` tratado como "não definido" |
| `infra-oci/up.sh` → `infra/oci/up.sh` | +1/−1 | texto do log do script |
| `infra-oci/config.env` → `infra/oci/config.env.example` | +25/−6 | senhas → placeholders; `SIM_SCRIPT` corrigido; flags novas |
| `infra-oci/README.md` → `infra/oci/README.md` | +2/−2 | caminho do script |
| `WORKSHOP-*.md` → `docs/workshop-*.md` | ~10/12 cada | flags → marcadores; cabeçalho de aviso |
| `README.md` → `README.md` | +236/−61 | reescrito |

---

## 2. Alterações de conteúdo, por motivo

### 2.1 Domínios sósia → TLD reservado `.example` (RFC 2606)

**50 substituições** em `deck/index.html`, `phishing/webmail/app/server.js`, `platform/app/emails.js`,
`docs/workshop-payloads.md` e `docs/workshop-resumo-tecnico.md`:

| Antes | Depois |
|---|---|
| `meridiancapital-ti.com` | `meridian-ti.example` |
| `meridian-docs-share.com` | `docs-share.example` |
| `meridian-beneficios.com` | `meridian-beneficios.example` |
| `nf-eletronica-br.com` | `nf-eletronica.example` |
| `meridiancapital.com.br` | `meridiancapital.example` |
| `meridiancapltal.com.br` (typosquat do CFO) | `meridiancapltal.example` |
| `meridlancapital.com.br` (typosquat da isca) | `meridlancapital.example` |

O contraste didático "domínio oficial × domínio sósia" foi preservado — inclusive o "**l** no lugar do **i**"
do CFO, que o deck destaca em negrito. O deck deixou de usar `meridiancapital.com.br`; nos apps, o e-mail
da isca (`meridian-docs-share.com`) era o único que ainda usava TLD real.

### 2.2 Flags fora do código versionado

| Onde | Antes | Depois |
|---|---|---|
| `platform/app/db.js` | flag literal no mapa `FLAGS` | `process.env.C1_FLAG` / `C2_FLAG` |
| `scenario-1-sqli/seed/schema.sql` | `INSERT ... 'FLAG{...}'` | `INSERT ... '__C1_FLAG__'` |
| `scenario-2-cmdi/Dockerfile` | `RUN echo 'FLAG{...}'` | `ARG C2_FLAG` + `RUN echo "$C2_FLAG"` |
| `deck/index.html` (slides de Recap) | flag literal | `FLAG{__C1_FLAG__}` / `FLAG{__C2_FLAG__}` |
| `docs/workshop-*.md` | flag literal | marcadores |

Resultado: **nenhum valor do gabarito** no repositório. A substituição acontece no deploy — o serviço `db`
troca o marcador no seed antes de importar, o `docker compose build` injeta `C2_FLAG` na imagem, e a
plataforma recebe as duas por ambiente.

Única exceção, intencional: `LOCAL_SETUP.md` traz **valores de exemplo** para quem roda o lab local
(`FLAG{teste_local}`, `FLAG{minha_flag_sqli}`, `FLAG{minha_flag_cmdi}`) — não são as flags do gabarito e
existem justamente para o participante poder capturar a própria flag durante o teste.

### 2.3 Credenciais

| Onde | Antes | Depois |
|---|---|---|
| `infra/oci/config.env` | versionado, com senhas reais | `config.env.example` + `config.env` no `.gitignore` |
| `infra/oci/config.env.example` (novo) | — | senhas como `CHANGE_ME_*`; `CHANGE_ME_*` é tratado como "não definido" pelos scripts, então o default documentado continua valendo |
| `infra/.env.example` (novo) | — | placeholders da stack unificada |

Nenhuma chave privada, OCID ou senha real no repositório. Verificado por varredura antes do push.

---

## 3. Correções de comportamento

Cada uma destas foi **descoberta por teste**, não por leitura de código.

| # | Sintoma | Causa | Correção |
|---|---|---|---|
| 1 | `./up.sh` e `./down.sh` → *Permission denied* num clone Linux | commit feito no Windows gravou modo `100644` | `git update-index --chmod=+x` nos 6 scripts |
| 2 | Webmail e Control inacessíveis (`connection refused`) | compose mapeava a porta pública para `3002`/`3003` **no container**, mas os apps escutam em `3000` | portas do container corrigidas para `3000` |
| 3 | `rsync` falhou com código 23; mgmt ficou sem lab | `REPO="$(cd "$HERE/.." && pwd)"` — um nível só, válido no layout antigo (`infra-oci/`) | `"$HERE/../.."`, com guardas que abortam com mensagem clara |
| 4 | `simulacao.ps1` não encontrado no build | `SIM_SCRIPT` apontava `../simulation/` (um nível) | `../../simulation/simulacao-tela-cheia.ps1` |
| 5 | Semente do Guacamole falharia em silêncio | `jq` não estava no cloud-init da mgmt, mas `configure-mgmt.sh` o usa lá | `jq` adicionado aos pacotes |
| 6 | Cenários inalcançáveis de fora | a INPUT da imagem Ubuntu da Oracle rejeita tudo fora de 22/80/443/8080; as regras de 3000-3005 tinham sido feitas à mão e o rebuild as perdeu | regra `3000:3005` no `mgmt.yaml` |
| 7 | `nginx` em crash-loop | ele exige certificado; é a variante `up-tls.sh` | rodado com `ENABLE_TLS=1` (cert self-signed, CN = IP da mgmt) |
| 8 | `docker compose down -v` no cenário 1 apagaria o seed do host | o seed é montado em `/seed` como somente-leitura | o serviço `db` copia para o diretório de init do container e substitui os marcadores ali |

---

## 4. Conteúdo novo (31 arquivos)

**Documentação**
`README.md` (reescrito) · `LOCAL_SETUP.md` · `LICENSE` (MIT + adendo ético) · `.gitignore` ·
`docs/instructor-notes.md` (sem flags) · `docs/participant-guide.md` (versão Markdown do PDF) ·
`docs/participant-guide.pdf` · `docs/workshop-passo-a-passo.md` · `docs/workshop-payloads.md` ·
`docs/workshop-resumo-tecnico.md`

**Deck**
`deck/index.html` — o deck do workshop (vinha como `Do conhecimento à ação.html`, fora do repo canônico)

**Infra**
`infra/docker-compose.yml` (stack unificada: db, medclinic, meridian, webmail, control, platform) ·
`infra/.env.example` · `scenario-1-sqli/docker-compose.yml` · `scenario-2-cmdi/docker-compose.yml` ·
`phishing/webmail/docker-compose.yml` · `phishing/control/docker-compose.yml` ·
`scenario-1-sqli/Dockerfile` · `scenario-2-cmdi/Dockerfile` · `scenario-2-cmdi/.dockerignore` ·
`phishing/webmail/Dockerfile` · `phishing/control/Dockerfile` · `platform/Dockerfile` ·
`infra/oci/cloud-init/mgmt.yaml` (novo, substitui o inline) · `infra/oci/config.env.example`

---

## 5. O script de simulação — um caso especial

O arquivo `simulacao-ataque.ps1` da raiz original (43.740 bytes) foi **substituído** pela versão
canônica do repositório do autor (44.697 bytes), que é a que está de fato implantada nas VMs.

Motivo: ao recuperar o repositório canônico, a cópia local estava **desatualizada** em relação
ao que roda no laboratório. A versão canônica acrescenta:

- o endpoint `GET /voltar` (reversão da simulação pelo painel do instrutor) — o ESC deixou de fechar a tela;
- a correção de repaint que impede o listener HTTP de morrer enquanto a tela está aberta;
- o guard que evita empilhar janelas.

O cabeçalho foi reescrito ("Simulacao de tela cheia… NAO criptografa nada. NAO acessa arquivos.") e as
referências de uso apontam para o novo nome. Validado nas 9 VMs pelo sha256 do `user_data`:
`8cdc75ef43f74a69…`, 44.697 bytes, **0 ocorrências** de `simulacao-ataque`.

---

## 6. Commits

```
81ed4bb Abre 3000-3005 no firewall da VM de gerenciamento
be28060 Corrige a raiz do repo no configure-mgmt.sh
be4477e Adiciona LOCAL_SETUP.md e marca os scripts como executaveis
ab137df Adiciona jq ao cloud-init da VM de gerenciamento
96ec65f Restaura o provisionamento OCI apos a renomeacao de diretorios
5b7ed01 Corrige o fallback de senha ao copiar o config.env.example
333a558 Migra os dominios sosia dos apps e dos documentos para .example
9836546 Corrige o mapeamento de portas do Cenario 3 e valida a stack do zero
cae9779 Codigo real dos cenarios, plataforma, phishing e provisionamento OCI
5e195aa Estrutura do workshop: repositorio, deck, cenarios e infra
```

---

## 7. Como conferir

```bash
# estrutura
git ls-files

# nenhum valor real de flag
git grep -nE 'FLAG\{[A-Za-z0-9_]{6,}\}' -- . | grep -v '__C[12]_FLAG__' | grep -v PLACEHOLDER

# nenhum domínio sósia real
git grep -nE '\.(com|com\.br|net|org|io)\b' -- deck scenario-1-sqli scenario-2-cmdi phishing platform

# nenhum valor de senha
git grep -nE '(PASSWORD|SECRET|ADMIN_KEY)=[^\s]*' -- . | grep -v CHANGE_ME

# scripts executáveis
git ls-files -s | grep '\.sh$'
```
