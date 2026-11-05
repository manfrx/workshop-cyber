# infra-oci — provisionamento do Workshop Cyber na Oracle Cloud

Sobe/derruba todo o ambiente do workshop na OCI com a OCI CLI:

- **1 VM de gerenciamento** (Linux ARM, subnet pública, IP público): Docker com a
  plataforma + Cenários 1/2, **Apache Guacamole** (acesso às VMs pelo navegador)
  e, na versão TLS, **nginx** terminando HTTPS.
- **20 VMs de participante** (**Windows Server 2022**, subnet privada, sem IP
  público): RDP acessível **só via Guacamole** pela rede interna. Cada uma já sobe
  com o **`simulation/simulacao-tela-cheia.ps1`** rodando na porta **10000** (Cenário 3).
- Rede completa: VCN, subnets pública/privada, Internet Gateway, NAT Gateway,
  route tables e security lists.
- Tudo marcado com a tag `workshop=cyber-ctf` — o `down.sh` usa ela para derrubar.

## Duas versões do "up"
| Script | TLS | Quando usar |
|---|---|---|
| `./up.sh` | ❌ HTTP puro (plataforma :3005, Guacamole :8080) | padrão; evita o erro de TLS do seu ambiente |
| `./up-tls.sh` | ✅ HTTPS via nginx (443, redireciona 80→443) | quando quiser TLS |

A versão TLS usa **certificado self-signed por padrão** (não depende de domínio
nem de CA — por isso não repete o erro de emissão). Para Let's Encrypt, preencha
`DOMAIN` e `LE_EMAIL` no `config.env` e aponte o domínio para o IP público da
mgmt **antes** de rodar.

> ⚠️ **Custo:** 21 VMs são recursos **pagos** (fora do Always Free). Estimativa com
> tudo ligado por **6h**: **≈ US$ 32** (o grosso é a licença Windows, ~$0,092/OCPU/h).
> Suba com `up*.sh` pouco antes e derrube com `down.sh` ao terminar.

## Pré-requisitos
- OCI CLI configurada (`oci iam region-subscription list` funcionando).
- `jq`, `python3`, `ssh`, `scp` e (opcional) `rsync`.
  - `sudo apt-get install -y jq python3`

## Uso
```bash
cd infra-oci
nano config.env          # revise contagem, tamanho, RDP_PASS, ADMIN_CIDR…

./up.sh                  # sem TLS   (ou ./up-tls.sh para TLS)
#   --skip-config        # só a infra, sem entrar via SSH

./down.sh                # derruba tudo (pede 'sim'); ./down.sh -y pula
```

Ao final o script imprime o IP público da mgmt e as URLs:
- **Guacamole:** `http(s)://<mgmt>[:8080]/guacamole` (login `guacadmin`/`guacadmin` — **troque!**). Já vêm as 20 conexões RDP (`VM-01 … VM-20`).
- **Plataforma:** `http(s)://<mgmt>[:3005]`
- **SSH mgmt:** `ssh -i ~/.ssh/wkcyber ubuntu@<mgmt>`

## A simulação (Cenário 3)
Cada VM Windows recebe o `simulation/simulacao-tela-cheia.ps1` embarcado (gzip+base64 no
cloud-init, gravado em `C:\workshop\simulacao.ps1`):
- **Firewall local** liberado na porta `SIM_PORT` (10000) via `New-NetFirewallRule`.
- **Tarefa agendada `WorkshopSimulacao`** que sobe o script **no logon** do usuário
  RDP (a tela cheia é WinForms e precisa de sessão interativa), reiniciando sozinha
  se cair.
- Dispare de qualquer lugar que alcance a VM: `http://<ip-da-vm>:10000/hack`
  (bloqueia) e `/voltar` (libera).

> A tarefa é **no logon** (não em sessão 0) de propósito: um app de tela cheia não
> aparece na sessão de serviço. Como os participantes entram via Guacamole (RDP =
> logon do `aluno`), a simulação já estará no ar na sessão deles.

## Arquivos
| Arquivo | Função |
|---|---|
| `config.env` | **Todos** os parâmetros (VMs, shapes, senhas, TLS, porta da sim) |
| `up.sh` / `up-tls.sh` | Provisiona rede + VMs (sem / com TLS) |
| `configure-mgmt.sh` | Envia o código para a mgmt e sobe containers + Guacamole (+ nginx) |
| `down.sh` | Termina instâncias e apaga a rede (por tag) |
| `lib.sh` | Helpers compartilhados |
| `cloud-init/mgmt.yaml` | Bootstrap da mgmt (Linux) |
| `cloud-init/participant-windows.ps1` | Bootstrap das VMs Windows (RDP + simulação) |
| `guacamole/` | Stack do Guacamole + `seed-connections.sh` |
| `nginx/` | Reverse proxy TLS (só no `up-tls.sh`) |
| `.state/` | OCIDs/IPs gerados em runtime (não versionar) |

## Notas / segurança
- Ajuste **`ADMIN_CIDR`** para o seu IP (`x.x.x.x/32`). O default `0.0.0.0/0` é só teste.
- Troque **`RDP_PASS`** (complexidade do Windows) e a senha do **guacadmin**.
- Capacidade/limite x86 em SP pode oscilar; se o launch falhar com *"Out of host
  capacity"*, tente de novo, outra AD ou o shape `VM.Standard.E5.Flex`.
- Se o user-data do Windows passar de ~32 KB (hoje ~12 KB), migre o `simulacao.ps1`
  para Object Storage + download no boot.
