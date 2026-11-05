# 🚀 Como rodar o laboratório localmente

Este repositório contém as aplicações do workshop **"Do conhecimento à ação"**. Como o laboratório é composto por containers Docker, você pode rodá-lo inteiramente na sua máquina para estudos ou para testar as vulnerabilidades.

> ⚠️ **AVISO DE SEGURANÇA:** As aplicações contêm falhas **deliberadas** (SQL Injection, Command Injection). **NUNCA** exponha essas portas para a internet aberta. Rode este laboratório em uma rede isolada, em uma VM de testes (VirtualBox, WSL2) ou na sua máquina local com cautela.

---

## 🛠️ Pré-requisitos

Você vai precisar de:
- [Git](https://git-scm.com/)
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

*Nota: No Windows e Mac, o Docker Desktop já vem com o Compose. No Linux, certifique-se de instalar o plugin do compose.*

---

## 📦 Passo a passo

### 1. Clone o repositório

```bash
git clone https://github.com/manfrx/workshop-cyber.git
cd workshop-cyber
```

### 2. Configure as variáveis de ambiente (Flags)

O laboratório precisa de variáveis de ambiente para funcionar. Entre na pasta `infra` e crie o seu arquivo `.env`:

```bash
cd infra
cp .env.example .env
```

Abra o arquivo `.env` no seu editor de texto favorito. Para testar localmente, você pode definir qualquer valor de flag (ex: `FLAG{teste_local}`), pois o foco do teste é explorar a falha técnica.

```env
# Exemplo de infra/.env para testes locais
C1_PORT=3000
C1_DB_HOST=db
C1_DB_PORT=3306
C1_DB_NAME=medclinic
C1_DB_USER=appuser
C1_DB_PASSWORD=senha_do_banco
C1_APP_SECRET=uma_chave_aleatoria
C1_FLAG=FLAG{minha_flag_sqli}

C2_PORT=3001
C2_APP_SECRET=outra_chave_aleatoria
C2_FLAG=FLAG{minha_flag_cmdi}

C3_PORT=3002
C3_WEBMAIL_SECRET=mais_uma_chave
```

> Dica: os valores acima são os mesmos do `infra/.env.example`. Se você não alterar nada, o laboratório sobe com as flags de exemplo — o suficiente para capturar a flag **dentro do próprio laboratório**, já que o `secrets.flag` e o `/root/flag.txt` recebem exatamente o valor que você definir aqui.

### 3. Suba os containers

Ainda dentro da pasta `infra`, execute:

```bash
docker compose up -d --build
```

Aguarde alguns minutos. Na primeira execução, o banco de dados MySQL vai criar as tabelas e popular os dados fictícios (1000 pacientes).

### 4. Ajuste o Firewall (Apenas para usuários Linux)

A plataforma de placar (porta 3005) roda usando `network_mode: host`. Por padrão, o firewall do Linux (iptables/ufw) bloqueia conexões de entrada nessa porta. Se você estiver no Linux e não conseguir acessá-la, libere a porta:

```bash
sudo iptables -I INPUT -p tcp --dport 3005 -j ACCEPT
```

(Usuários de macOS e Windows com Docker Desktop podem ignorar este passo).

---

## 🌐 Acessando o Laboratório

Com os containers rodando, acesse:

| Serviço | URL | Credenciais |
|---------|-----|-------------|
| Cenário 1 · MedClinic (SQLi) | http://localhost:3000 | `user` / `user123` |
| Cenário 2 · Meridian (CMDi) | http://localhost:3001 | `investidor` / `Invest@2024` |
| Cenário 3 · Webmail (Phishing) | http://localhost:3002 | (depende do instrutor) |
| Plataforma de Placar | http://localhost:3005 | `admin` / a senha que você definiu em `ADMIN_PASS` no `.env` |
| Deck de Apresentação | Abra `deck/index.html` no navegador | - |

> O painel do instrutor fica em `http://localhost:3005/admin` e usa a chave `ADMIN_KEY` do seu `.env`.

### 🎯 Próximos passos: como capturar as flags?

Para entender como explorar as falhas e chegar até as flags (ou descobrir o que você mesmo inseriu no `.env`), leia o [Guia do Participante](docs/participant-guide.md).

---

## 🛑 Parando o laboratório

Para derrubar tudo e limpar os containers (incluindo o banco de dados):

```bash
docker compose down -v
```

---

## ☁️ Rodando na nuvem (OCI)

O laboratório também é provisionado na OCI com `infra/oci/` — uma VM de gerenciamento (Linux, com Docker, nginx e Guacamole) e VMs Windows de participante com a simulação de tela cheia embarcada. Veja [`infra/oci/README.md`](infra/oci/README.md).
