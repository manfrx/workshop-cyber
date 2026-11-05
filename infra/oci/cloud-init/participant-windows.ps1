<powershell>
# ============================================================================
# Bootstrap da VM de participante (Windows) — executado pelo cloudbase-init.
# Tokens no formato <TOKEN> são substituídos pelo up.sh. NÃO editar à mão.
#   - cria o usuário RDP e habilita o Remote Desktop
#   - grava scripts/simulacao.ps1 em C:\workshop
#   - libera o firewall local na porta da simulação
#   - agenda a simulação para subir no logon do usuário (sessão interativa)
# ============================================================================
$ErrorActionPreference = "SilentlyContinue"
$u    = "__RDP_USER__"
$p    = "__RDP_PASS__"
$port = __SIM_PORT__

# --- usuário RDP ---
$sec = ConvertTo-SecureString $p -AsPlainText -Force
if (Get-LocalUser -Name $u) { Set-LocalUser -Name $u -Password $sec }
else { New-LocalUser -Name $u -Password $sec -PasswordNeverExpires:$true -AccountNeverExpires }
Add-LocalGroupMember -Group "Administrators" -Member $u
Add-LocalGroupMember -Group "Remote Desktop Users" -Member $u

# --- habilita RDP ---
Set-ItemProperty 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name fDenyTSConnections -Value 0
Enable-NetFirewallRule -DisplayGroup "Remote Desktop"

# --- grava o simulacao.ps1 (gzip+base64 embarcado) ---
New-Item -ItemType Directory -Force -Path C:\workshop | Out-Null
$gz = [Convert]::FromBase64String('__SIM_GZ_B64__')
$in  = New-Object System.IO.MemoryStream(,$gz)
$dec = New-Object System.IO.Compression.GzipStream($in, [System.IO.Compression.CompressionMode]::Decompress)
$out = New-Object System.IO.MemoryStream
$dec.CopyTo($out); $dec.Close()
[System.IO.File]::WriteAllBytes("C:\workshop\simulacao.ps1", $out.ToArray())

# --- firewall local para a porta da simulação ---
New-NetFirewallRule -DisplayName "Workshop Simulacao $port" -Direction Inbound `
  -Action Allow -Protocol TCP -LocalPort $port -Profile Any | Out-Null

# --- tarefa: sobe a simulação no logon do usuário RDP (sessão interativa) ---
# A tela cheia (WinForms) só aparece numa sessão interativa; por isso é no logon,
# e não em sessão 0. Reinicia sozinha se cair.
$act  = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File C:\workshop\simulacao.ps1 -Port $port"
$trg  = New-ScheduledTaskTrigger -AtLogOn -User $u
$prin = New-ScheduledTaskPrincipal -UserId $u -LogonType Interactive -RunLevel Highest
$set  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName "WorkshopSimulacao" -Action $act -Trigger $trg `
  -Principal $prin -Settings $set -Force

Set-Content -Path C:\workshop\ready.txt -Value "participant-ready"
</powershell>
