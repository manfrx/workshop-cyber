# Do Conhecimento à Ação

Workshop hands-on de conscientização em segurança para líderes. Em vez de assistir a uma palestra sobre ataques, cada participante **executa o ataque** em um ambiente isolado e descobre, na prática, como decisões técnicas viram decisões de negócio.

> ⚠️ **Ambiente deliberadamente vulnerável.**
> Este repositório contém aplicações **intencionalmente inseguras**, criadas apenas para treinamento em ambiente isolado.
> **Não** execute em redes de produção. **Não** aplique estas técnicas em sistemas reais sem autorização.
> Uso indevido é crime previsto na **Lei 12.737/2012** (invasão de dispositivo informático).

---

## O que tem aqui

| Cenário | Sistema | Falha | O que o participante faz |
|---------|---------|-------|--------------------------|
| 01 | MedClinic · Portal do Paciente | SQL Injection | Vaza o prontuário de ~1000 pacientes por um campo de busca |
| 02 | Meridian Capital · Portal do Investidor | Command Injection | Transforma um “backup” em controle total do servidor |
| 03 | Caixa de e-mail fictícia | Phishing | Separa golpe de e-mail legítimo e cai (ou não) numa isca |

Tudo é fictício — empresas, pacientes, clientes, domínios. Os domínios nos e-mails de phishing usam o TLD reservado `.example`, conforme a RFC 2606.

---

## Estrutura do repositório

```text
cyber-workshop/
├── README.md                    # este arquivo
├── LICENSE                      # MIT + cláusula de uso ético
├── .gitignore
├── docs/
│   ├── participant-guide.pdf    # guia do participante
│   └── instructor-notes.md      # notas do instrutor (sem flags)
├── deck/
│   └── index.html               # apresentação (abre no navegador)
├── scenario-1-sqli/
│   ├── app/                     # portal MedClinic
│   └── seed/
│       └── schema.sql           # schema + dados fictícios
├── scenario-2-cmdi/
│   ├── app/                     # portal Meridian
│   └── Dockerfile
├── phishing/
│   └── webmail/                 # caixa de e-mail fictícia
├── simulation/
│   └── simulacao-tela-cheia.ps1 # tela cheia de “sistema comprometido”
└── infra/
    ├── docker-compose.yml
    └── .env.example             # placeholders — nunca valores reais
```

---

## Pré-requisitos

- **Docker** e **Docker Compose** (recomendado para o lab inteiro)
- **Node.js 20+** ou **Python 3.11+** (caso rode os apps fora do Docker)
- **MySQL 8** (ou usar o container do `docker-compose`)
- **PowerShell 7+** no Windows, apenas para o script de simulação

---

## Como subir o laboratório

### 1. Clone e configure o ambiente

```bash
git clone <url-do-repo>
cd cyber-workshop
cp infra/.env.example infra/.env
# edite infra/.env e defina as senhas/flags locais
```

As flags não estão no repositório. Elas são injetadas via variáveis de ambiente no momento do deploy e sobrescrevem os valores fictícios do seed.

| Variável | Onde entra |
|----------|------------|
| `C1_FLAG` | `secrets.flag` no MySQL (via marcador `__C1_FLAG__` no seed) |
| `C2_FLAG` | `/root/flag.txt` no container Meridian (via `ARG C2_FLAG` no build) |
| `C1_DB_PASSWORD` | MySQL do Cenário 1 |

O deck (`deck/index.html`) usa os mesmos marcadores nos slides de Recap. Substitua-os na máquina de apresentação:

```bash
sed -i "s|__C1_FLAG__|$C1_FLAG|g; s|__C2_FLAG__|$C2_FLAG|g" deck/index.html
```

> **Estado dos cenários:** o Cenário 2 (`scenario-2-cmdi/`) está completo e
> verificado. No Cenário 1, o **seed** está completo (1000 pacientes, 4103
> exames, 2 usuários), mas o **código do portal** ainda não foi sincronizado
> neste repositório — ver `scenario-1-sqli/app/README.md`.


### 2. Suba os cenários com Docker Compose

```bash
cd infra
docker compose up -d --build
docker compose ps
```

Serviços esperados:

| Serviço | Porta | URL local |
|---------|-------|-----------|
| MedClinic (Cenário 1) | 3000 | http://localhost:3000/ |
| Meridian (Cenário 2) | 3001 | http://localhost:3001/ |
| Webmail (Cenário 3) | 3002 | http://localhost:3002/ |
| MySQL (Cenário 1) | 3306 | — (interno) |

### 3. Verifique a saúde dos serviços

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002/
```

Os três devem responder 200.

## Como rodar cada parte

### Deck de apresentação

Abra `deck/index.html` direto no navegador. Navegação por setas, `F` para fullscreen, `N` para notas do instrutor.

### Simulação de tela cheia (opcional)

No Windows, em um terminal PowerShell:

```powershell
.\simulation\simulacao-tela-cheia.ps1
```

O script sobe um servidor HTTP na porta 10000. Ao receber `GET /hack`, abre uma tela cheia de “sistema comprometido”. Não criptografa nada, não acessa arquivos — apenas exibe a tela.

```bash
# Disparar de outra máquina ou celular:
curl http://<IP-da-máquina>:10000/hack
```

### Rodando um cenário isolado (sem Docker)

Cenário 1 (SQLi):

```bash
cd scenario-1-sqli
npm install        # ou: pip install -r requirements.txt
npm start          # ou: python app.py
```

Cenário 2 (CMDi):

```bash
cd scenario-2-cmdi
docker build -t meridian .
docker run -p 3001:3001 meridian
```

## Credenciais de demonstração

| Cenário | Usuário | Senha |
|---------|---------|-------|
| MedClinic | `user` | `user123` |
| Meridian | `investidor` | `Invest@2024` |

Essas credenciais são apenas para o lab. Nunca reutilize em sistemas reais.

## Para instrutores

Consulte `docs/instructor-notes.md` para:

- Checklist de preparação do ambiente
- Cronograma sugerido (meio período / dia inteiro)
- Dicas de condução por cenário
- Como resetar o lab entre sessões

As flags e o gabarito ficam em um repositório privado separado — nunca neste.

## Como contribuir

Pull requests são bem-vindos para:

- Correções no deck e no guia do participante
- Novos cenários (com a mesma estrutura de isolamento)
- Tradução para outros idiomas

Antes de abrir PR, leia o `LICENSE` — ele contém uma cláusula de uso ético que você precisa aceitar.

## Licença

MIT com cláusula de uso ético. Veja `LICENSE`.

## Créditos

Identidade visual e conteúdo por Root (persona do workshop). Cenários inspirados em falhas reais documentadas pela OWASP, adaptados para o público executivo.
