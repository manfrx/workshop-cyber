<#
  Simulacao de tela cheia - Treinamento de Conscientizacao em Seguranca.
  NAO criptografa nada. NAO acessa arquivos. Apenas exibe uma tela de "sistema comprometido".
  Escuta HTTP na porta 10000. Ao receber GET /hack, exibe tela cheia.
  Identidade visual do workshop "Do conhecimento a acao":
    fundo escuro, acento acido, ambar para alertas, tipografia display + mono, ondas e a coruja Root.

  Fechar a tela: ESC.  Encerrar o script: Ctrl+C no console.

  Uso:
    powershell -ExecutionPolicy Bypass -File .\simulacao-tela-cheia.ps1
    powershell -ExecutionPolicy Bypass -File .\simulacao-tela-cheia.ps1 -ImagePath C:\demo\hacked.png
    powershell -ExecutionPolicy Bypass -File .\simulacao-tela-cheia.ps1 -Agora      (abre a tela na hora)
  Disparo (de outra maquina ou do celular):
    http://<IP-da-maquina>:10000/hack

  Pre-visualizar sem abrir a tela cheia (gera um PNG do frame final):
    powershell -ExecutionPolicy Bypass -File .\simulacao-tela-cheia.ps1 -PreviewPath C:\demo\preview.png
#>
param(
    [int]$Port = 10000,
    [string]$TriggerPath = "/hack",
    [string]$ReturnPath = "/voltar",
    [string]$ImagePath = "",
    [string]$PreviewPath = "",
    [double]$PreviewTime = 10.5
)

Add-Type -AssemblyName System.Windows.Forms, System.Drawing

if (-not ('AtkForm' -as [type])) {
    Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @"
using System;
using System.Windows.Forms;

public class AtkForm : Form
{
    public AtkForm()
    {
        this.DoubleBuffered = true;
        this.SetStyle(ControlStyles.AllPaintingInWmPaint |
                      ControlStyles.OptimizedDoubleBuffer |
                      ControlStyles.UserPaint |
                      ControlStyles.ResizeRedraw, true);
    }

    public void Ping() { }
}
"@
}

$script:DesignW = 1920.0
$script:DesignH = 1080.0

# =====================================================================
#  Identidade visual
# =====================================================================
function Initialize-Assets {
    $script:C = @{
        Ink   = [System.Drawing.Color]::FromArgb(255, 10, 10, 11)    # #0A0A0B
        Ink2  = [System.Drawing.Color]::FromArgb(255, 22, 24, 28)    # #16181C
        Line  = [System.Drawing.Color]::FromArgb(255, 42, 46, 53)    # #2A2E35
        Bone  = [System.Drawing.Color]::FromArgb(255, 237, 230, 214) # #EDE6D6
        Body  = [System.Drawing.Color]::FromArgb(255, 201, 195, 181) # #C9C3B5
        Mute  = [System.Drawing.Color]::FromArgb(255, 140, 143, 150) # #8C8F96
        Acid  = [System.Drawing.Color]::FromArgb(255, 182, 255, 59)  # #B6FF3B
        Amber = [System.Drawing.Color]::FromArgb(255, 255, 176, 32)  # #FFB020
    }

    $script:RenderScale = 1.0
    $script:Brushes = @{}
    $script:Pens = @{}
    $script:Fonts = @{}
    $script:TrackCache = @{}
    $script:MeasureCache = @{}
    $script:Fmt = [System.Drawing.StringFormat]::GenericTypographic

    $families = @((New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name })

    $display = @('Chakra Petch', 'Bahnschrift SemiBold SemiCondensed', 'Bahnschrift SemiCondensed',
                 'Bahnschrift', 'Segoe UI Semibold', 'Segoe UI', 'Arial')
    $script:DisplayFamily = 'Arial'
    foreach ($f in $display) { if ($families -contains $f) { $script:DisplayFamily = $f; break } }
    if ($script:DisplayFamily -eq 'Chakra Petch') {
        $script:DisplayStyle = [System.Drawing.FontStyle]::Bold
    } else {
        $script:DisplayStyle = [System.Drawing.FontStyle]::Regular
    }

    $mono = @('JetBrains Mono', 'Cascadia Mono', 'Cascadia Code', 'Consolas', 'Courier New')
    $script:MonoFamily = 'Courier New'
    foreach ($f in $mono) { if ($families -contains $f) { $script:MonoFamily = $f; break } }

    # imagem opcional (modo -ImagePath)
    $script:AttackImage = $null
    if ($ImagePath -and (Test-Path -LiteralPath $ImagePath)) {
        try { $script:AttackImage = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $ImagePath).Path) } catch { }
    }

    # linhas do terminal da simulacao
    $envHost = if ($env:COMPUTERNAME) { $env:COMPUTERNAME } else { 'HOST' }
    $envUser = if ($env:USERNAME) { $env:USERNAME } else { 'usuario' }
    $line2 = "Host: $envHost · Usuário: $envUser"
    if ($line2.Length -gt 62) { $line2 = $line2.Substring(0, 61) + '.' }

    $script:TerminalLines = @(
        @{ Segs = @(@{ T = '[+]'; C = 'Acid' }, @{ T = ' Sessão estabelecida com 203.0.113.66:443'; C = 'Body' }) },
        @{ Segs = @(@{ T = '[+]'; C = 'Acid' }, @{ T = ' ' + $line2; C = 'Body' }) },
        @{ Segs = @(@{ T = '[+]'; C = 'Acid' }, @{ T = ' Credenciais corporativas capturadas'; C = 'Body' }) },
        @{ Segs = @(@{ T = '[+]'; C = 'Acid' }, @{ T = ' Escalando privilégios ......... SUCESSO'; C = 'Body' }) },
        @{ Segs = @(@{ T = '[+]'; C = 'Acid' }, @{ T = ' Acessando caixa de e-mail corporativa'; C = 'Body' }) },
        @{ Segs = @(@{ T = '[+]'; C = 'Acid' }, @{ T = ' Exfiltrando Documentos\Financeiro\*.xlsx'; C = 'Body' }) },
        @{ Segs = @(@{ T = '[!]'; C = 'Amber' }, @{ T = ' 12.847 arquivos criptografados'; C = 'Bone' }) },
        @{ Segs = @(@{ T = '>> '; C = 'Acid' }, @{ T = 'Nenhum backup foi preservado.'; C = 'Acid' }) }
    )
    foreach ($ln in $script:TerminalLines) {
        $n = 0
        foreach ($s in $ln.Segs) { $n += $s.T.Length }
        $ln.Chars = $n
    }

    # ritmo da digitacao do terminal (segundos / caracteres por segundo)
    $script:TermStart = 1.2
    $script:TermGap = 1.0
    $script:TermCps = 42.0
    $script:TermEnd = 0.0
    for ($i = 0; $i -lt $script:TerminalLines.Count; $i++) {
        $lineEnd = $script:TermStart + $i * $script:TermGap + ($script:TerminalLines[$i].Chars / $script:TermCps)
        if ($lineEnd -gt $script:TermEnd) { $script:TermEnd = $lineEnd }
    }

    $script:OwlOpen  = New-OwlBitmap 940 1.0
    $script:OwlBlink = New-OwlBitmap 940 0.05
    $script:OwlOpen1  = New-OwlBitmap 470 1.0
    $script:OwlBlink1 = New-OwlBitmap 470 0.05
    $script:Icon     = New-IconBitmap 152
    $script:GlowSet  = @()
    for ($gi = 0; $gi -lt 6; $gi++) { $script:GlowSet += ,(New-GlowBitmap (600 + 12 * $gi)) }

    # camadas estaticas pre-renderizadas (menos texto por frame)
    $hostTag = $envHost
    if ($hostTag.Length -gt 18) { $hostTag = $hostTag.Substring(0, 18) }
    $script:HeaderLayer = New-LayerBitmap 620 60 1 {
        param($lg)
        Draw-Bitmap $lg $script:Icon 0 0 52 52 1
        Draw-Tracked $lg ('WORKSTATION · ' + $hostTag) (Get-MonoFont 20 $false) $script:C.Mute 72 14 4 1
    }

    $script:ChipLayer = New-LayerBitmap 340 46 1 {
        param($lg)
        Draw-Chip $lg 'CRIPTOGRAFADO · AES-256' 340 0 46 $script:C.Acid $script:C.Acid 1 2 18
    }

    $script:EyeLayer = New-TextLayer '// SISTEMA COMPROMETIDO' (Get-MonoFont 26 $false) $script:C.Acid 3
    $script:OwlLabelLayer = New-TextLayer 'root@localhost' (Get-MonoFont 18 $false) $script:C.Mute 4

    $script:SideLayer = New-LayerBitmap 562 216 1 {
        param($lg)
        Draw-Card $lg 0 0 562 216 $script:C.Ink2 $script:C.Line 1 2
        $lg.FillRectangle((Get-Brush $script:C.Amber), [single]2, [single]2, [single]6, [single]212)
        Draw-Tracked $lg '// PRAZO DE RESGATE' (Get-MonoFont 20 $false) $script:C.Amber 40 24 2 1
        Draw-Text $lg '72 horas.' (Get-DisplayFont 34) $script:C.Bone 40 56 1
        Draw-Wrapped $lg 'Depois disso a chave de descriptografia é destruída permanentemente.' (Get-MonoFont 20 $false) $script:C.Body 40 112 480 30 1
    }

    $script:CardLayer = New-LayerBitmap 1040 396 1 {
        param($lg)
        Draw-Card $lg 0 0 1040 396 $script:C.Ink2 $script:C.Line 1 2
        $lg.DrawLine((Get-Pen $script:C.Line 2), [single]0, [single]54, [single]1040, [single]54)
        Draw-Text $lg 'root@localhost — sessão 0x7f3a' (Get-MonoFont 20 $false) $script:C.Mute 32 16 1
    }
}

function Get-MonoFont {
    param([double]$Size, [bool]$Bold = $false)
    $key = 'm|' + $Size + '|' + $Bold
    if (-not $script:Fonts.ContainsKey($key)) {
        $style = if ($Bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
        $script:Fonts[$key] = [System.Drawing.Font]::new($script:MonoFamily, [single]$Size, $style, [System.Drawing.GraphicsUnit]::Pixel)
    }
    return $script:Fonts[$key]
}

function Get-DisplayFont {
    param([double]$Size)
    $key = 'd|' + $Size
    if (-not $script:Fonts.ContainsKey($key)) {
        $script:Fonts[$key] = [System.Drawing.Font]::new($script:DisplayFamily, [single]$Size, $script:DisplayStyle, [System.Drawing.GraphicsUnit]::Pixel)
    }
    return $script:Fonts[$key]
}

function Get-Brush {
    param([System.Drawing.Color]$Color)
    $key = $Color.ToArgb()
    if (-not $script:Brushes.ContainsKey($key)) {
        $script:Brushes[$key] = [System.Drawing.SolidBrush]::new($Color)
    }
    return $script:Brushes[$key]
}

function Get-Pen {
    param([System.Drawing.Color]$Color, [double]$Width = 2.0)
    $key = $Color.ToArgb().ToString() + '|' + $Width
    if (-not $script:Pens.ContainsKey($key)) {
        $script:Pens[$key] = [System.Drawing.Pen]::new($Color, [single]$Width)
    }
    return $script:Pens[$key]
}

function Alpha {
    param([System.Drawing.Color]$Color, [double]$Amount = 1.0)
    if ($Amount -lt 0) { $Amount = 0 }
    if ($Amount -gt 1) { $Amount = 1 }
    return [System.Drawing.Color]::FromArgb([int][Math]::Round($Color.A * $Amount), $Color.R, $Color.G, $Color.B)
}

# =====================================================================
#  Mini parser de SVG path (M, L, H, V, C, Q, Z) para desenhar a coruja
# =====================================================================
function New-SvgPath {
    param([string]$Data)

    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $inv = [System.Globalization.CultureInfo]::InvariantCulture
    $tokens = [regex]::Matches($Data, '[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:[eE][-+]?\d+)?')
    $i = 0
    $cmd = ''
    $cx = 0.0; $cy = 0.0
    $sx = 0.0; $sy = 0.0

    while ($i -lt $tokens.Count) {
        $tok = $tokens[$i].Value
        if ($tok -match '^[A-Za-z]$') {
            $cmd = $tok
            $i++
            if ($cmd -match '[Zz]') {
                $path.CloseFigure()
                $cx = $sx; $cy = $sy
                continue
            }
            if ($i -ge $tokens.Count) { break }
        }

        $rel = $cmd -cmatch '[a-z]'
        $upper = $cmd.ToUpperInvariant()
        $ox = 0.0; $oy = 0.0
        if ($rel) { $ox = $cx; $oy = $cy }

        if ($upper -eq 'M') {
            $cx = [double]::Parse($tokens[$i].Value, $inv) + $ox
            $cy = [double]::Parse($tokens[$i + 1].Value, $inv) + $oy
            $i += 2
            $path.StartFigure()
            $sx = $cx; $sy = $cy
            if ($rel) { $cmd = 'l' } else { $cmd = 'L' }
        }
        elseif ($upper -eq 'L') {
            $nx = [double]::Parse($tokens[$i].Value, $inv) + $ox
            $ny = [double]::Parse($tokens[$i + 1].Value, $inv) + $oy
            $i += 2
            $path.AddLine([single]$cx, [single]$cy, [single]$nx, [single]$ny)
            $cx = $nx; $cy = $ny
        }
        elseif ($upper -eq 'H') {
            $nx = [double]::Parse($tokens[$i].Value, $inv) + $ox
            $i += 1
            $path.AddLine([single]$cx, [single]$cy, [single]$nx, [single]$cy)
            $cx = $nx
        }
        elseif ($upper -eq 'V') {
            $ny = [double]::Parse($tokens[$i].Value, $inv) + $oy
            $i += 1
            $path.AddLine([single]$cx, [single]$cy, [single]$cx, [single]$ny)
            $cy = $ny
        }
        elseif ($upper -eq 'C') {
            $x1 = [double]::Parse($tokens[$i].Value, $inv) + $ox
            $y1 = [double]::Parse($tokens[$i + 1].Value, $inv) + $oy
            $x2 = [double]::Parse($tokens[$i + 2].Value, $inv) + $ox
            $y2 = [double]::Parse($tokens[$i + 3].Value, $inv) + $oy
            $nx = [double]::Parse($tokens[$i + 4].Value, $inv) + $ox
            $ny = [double]::Parse($tokens[$i + 5].Value, $inv) + $oy
            $i += 6
            $path.AddBezier([single]$cx, [single]$cy, [single]$x1, [single]$y1, [single]$x2, [single]$y2, [single]$nx, [single]$ny)
            $cx = $nx; $cy = $ny
        }
        elseif ($upper -eq 'Q') {
            $qx = [double]::Parse($tokens[$i].Value, $inv) + $ox
            $qy = [double]::Parse($tokens[$i + 1].Value, $inv) + $oy
            $nx = [double]::Parse($tokens[$i + 2].Value, $inv) + $ox
            $ny = [double]::Parse($tokens[$i + 3].Value, $inv) + $oy
            $i += 4
            $c1x = $cx + (2.0 / 3.0) * ($qx - $cx)
            $c1y = $cy + (2.0 / 3.0) * ($qy - $cy)
            $c2x = $nx + (2.0 / 3.0) * ($qx - $nx)
            $c2y = $ny + (2.0 / 3.0) * ($qy - $ny)
            $path.AddBezier([single]$cx, [single]$cy, [single]$c1x, [single]$c1y, [single]$c2x, [single]$c2y, [single]$nx, [single]$ny)
            $cx = $nx; $cy = $ny
        }
        else {
            break
        }
    }

    return $path
}

function Fill-Path {
    param($G, $Path, [System.Drawing.Color]$Color)
    $b = [System.Drawing.SolidBrush]::new($Color)
    $G.FillPath($b, $Path)
    $b.Dispose()
}

function Stroke-Path {
    param($G, $Path, [System.Drawing.Color]$Color, [double]$Width)
    $p = [System.Drawing.Pen]::new($Color, [single]$Width)
    $G.DrawPath($p, $Path)
    $p.Dispose()
}

# =====================================================================
#  Coruja Root (sprite do deck, redesenhado em GDI+)
# =====================================================================
function New-OwlBitmap {
    param([int]$Px = 940, [double]$EyeScale = 1.0)

    $bmp = [System.Drawing.Bitmap]::new($Px, $Px, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.ScaleTransform([single]($Px / 440.0), [single]($Px / 440.0))

    $ink = $script:C.Ink
    $ink2 = $script:C.Ink2
    $line = $script:C.Line
    $bone = $script:C.Bone
    $acid = $script:C.Acid

    $stripe  = New-SvgPath 'M0 300 L440 120 L440 190 L0 370 Z'
    $stripe2 = New-SvgPath 'M0 384 L440 204 L440 214 L0 394 Z'
    $body    = New-SvgPath 'M130 290 L90 440 L350 440 L310 290 L220 322 Z'
    $shadeL  = New-SvgPath 'M130 290 L150 330 L220 322 Z'
    $shadeR  = New-SvgPath 'M310 290 L290 330 L220 322 Z'
    $bodyLn  = New-SvgPath 'M220 322 L220 440'
    $wingL   = New-SvgPath 'M134 298 L56 400 L84 396 L70 432 L108 410 L112 440 L146 336 Z'
    $wingR   = New-SvgPath 'M306 298 L384 400 L356 396 L370 432 L332 410 L328 440 L294 336 Z'
    $head    = New-SvgPath 'M220 126 L282 66 L322 28 L312 128 L340 196 L304 278 L220 306 L136 278 L100 196 L128 128 L118 28 L158 66 Z'
    $face    = New-SvgPath 'M220 146 L290 124 L314 196 L282 258 L220 280 L158 258 L126 196 L150 124 Z'
    $earL    = New-SvgPath 'M128 128 L118 28 L150 92 Z'
    $earR    = New-SvgPath 'M312 128 L322 28 L290 92 Z'
    $beakTop = New-SvgPath 'M220 150 L236 182 L220 174 L204 182 Z'
    $beakLow = New-SvgPath 'M206 222 L234 222 L220 262 Z'
    $eyeL    = New-SvgPath 'M144 172 L204 186 L198 214 L152 206 Z'
    $eyeR    = New-SvgPath 'M296 172 L236 186 L242 214 L288 206 Z'
    $pupilL  = New-SvgPath 'M176 184 L184 186 L182 208 L174 207 Z'
    $pupilR  = New-SvgPath 'M264 184 L256 186 L258 208 L266 207 Z'

    Fill-Path $g $stripe $acid
    Fill-Path $g $stripe2 ([System.Drawing.Color]::FromArgb(128, $acid.R, $acid.G, $acid.B))
    Fill-Path $g $body $ink2
    Fill-Path $g $shadeL $line
    Fill-Path $g $shadeR $line
    Fill-Path $g $wingL $line
    Fill-Path $g $wingR $line
    Stroke-Path $g $bodyLn $acid 4
    Fill-Path $g $head $ink2
    Fill-Path $g $face $line
    Fill-Path $g $earL $line
    Fill-Path $g $earR $line
    Fill-Path $g $beakTop $bone
    Fill-Path $g $beakLow $bone

    $state = $g.Save()
    $g.TranslateTransform([single]0, [single]193)
    $g.ScaleTransform([single]1, [single]$EyeScale)
    $g.TranslateTransform([single]0, [single]-193)
    Fill-Path $g $eyeL $acid
    Fill-Path $g $eyeR $acid
    Fill-Path $g $pupilL $ink
    Fill-Path $g $pupilR $ink
    $g.Restore($state)

    foreach ($p in @($stripe, $stripe2, $body, $shadeL, $shadeR, $bodyLn, $wingL, $wingR, $head, $face, $earL, $earR, $beakTop, $beakLow, $eyeL, $eyeR, $pupilL, $pupilR)) {
        $p.Dispose()
    }

    $g.Dispose()
    return $bmp
}

function New-IconBitmap {
    param([int]$Px = 152)

    $bmp = [System.Drawing.Bitmap]::new($Px, $Px, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.ScaleTransform([single]($Px / 240.0), [single]($Px / 240.0))

    $square = New-SvgPath 'M0 24 L24 0 L240 0 L240 216 L216 240 L0 240 Z'
    $owl    = New-SvgPath 'M120 76 L160 40 L184 20 L178 82 L196 124 L174 176 L120 196 L66 176 L44 124 L62 82 L56 20 L80 40 Z'
    Fill-Path $g $square $script:C.Acid
    Fill-Path $g $owl $script:C.Ink
    $square.Dispose()
    $owl.Dispose()

    $g.Dispose()
    return $bmp
}

function New-GlowBitmap {
    param([int]$Px = 640)

    $bmp = [System.Drawing.Bitmap]::new($Px, $Px, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    $rect = [System.Drawing.Rectangle]::new(0, 0, $Px, $Px)
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddEllipse($rect)
    $brush = [System.Drawing.Drawing2D.PathGradientBrush]::new($path)
    $brush.CenterColor = [System.Drawing.Color]::FromArgb(80, $script:C.Acid.R, $script:C.Acid.G, $script:C.Acid.B)
    $brush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $script:C.Acid.R, $script:C.Acid.G, $script:C.Acid.B))
    $brush.CenterPoint = [System.Drawing.PointF]::new($Px / 2.0, $Px / 2.0)
    $g.FillEllipse($brush, $rect)
    $brush.Dispose()
    $path.Dispose()
    $g.Dispose()
    return $bmp
}

# =====================================================================
#  Utilidades de desenho
# =====================================================================
function Ease-Out {
    param([double]$T)
    if ($T -le 0) { return 0.0 }
    if ($T -ge 1) { return 1.0 }
    return 1.0 - [Math]::Pow(1.0 - $T, 3)
}

function Prog {
    param([double]$T, [double]$Start, [double]$Dur)
    if ($Dur -le 0) { return 1.0 }
    return (Ease-Out (($T - $Start) / $Dur))
}

function Draw-Text {
    param($G, [string]$Text, $Font, [System.Drawing.Color]$Color, [double]$X, [double]$Y, [double]$Alpha = 1.0)
    if ($Alpha -le 0.01 -or [string]::IsNullOrEmpty($Text)) { return }
    $brush = Get-Brush (Alpha $Color $Alpha)
    $G.DrawString($Text, $Font, $brush, [single]$X, [single]$Y, $script:Fmt)
}

function Measure-Text {
    param($G, [string]$Text, $Font)
    if ([string]::IsNullOrEmpty($Text)) { return 0.0 }
    $key = $Font.FontFamily.Name + '|' + $Font.Size + '|' + [int]$Font.Style + '|' + $Text
    if (-not $script:MeasureCache.ContainsKey($key)) {
        $script:MeasureCache[$key] = [double]$G.MeasureString($Text, $Font, [System.Drawing.PointF]::new(0, 0), $script:Fmt).Width
    }
    return $script:MeasureCache[$key]
}

function Get-TrackingInfo {
    param($G, [string]$Text, $Font, [double]$Tracking)

    $key = $Font.FontFamily.Name + '|' + $Font.Size + '|' + $Font.Style + '|' + $Tracking + '|' + $Text
    if (-not $script:TrackCache.ContainsKey($key)) {
        $arr = New-Object 'double[]' $Text.Length
        $x = 0.0
        for ($i = 0; $i -lt $Text.Length; $i++) {
            $arr[$i] = $x
            $ch = [string]$Text[$i]
            $w = [double]$G.MeasureString($ch, $Font, [System.Drawing.PointF]::new(0, 0), $script:Fmt).Width
            if ($ch -eq ' ' -and $w -lt 1.0) { $w = $Font.Size * 0.6 }
            $x += $w + $Tracking
        }
        $script:TrackCache[$key] = @{ Offsets = $arr; Width = [Math]::Max(0.0, $x - $Tracking) }
    }
    return $script:TrackCache[$key]
}

function Draw-Tracked {
    param($G, [string]$Text, $Font, [System.Drawing.Color]$Color, [double]$X, [double]$Y, [double]$Tracking = 0.0, [double]$Alpha = 1.0)
    if ($Alpha -le 0.01 -or [string]::IsNullOrEmpty($Text)) { return }
    $brush = Get-Brush (Alpha $Color $Alpha)
    if ($Tracking -le 0.01) {
        $G.DrawString($Text, $Font, $brush, [single]$X, [single]$Y, $script:Fmt)
        return
    }
    $info = Get-TrackingInfo $G $Text $Font $Tracking
    $offs = $info.Offsets
    for ($i = 0; $i -lt $Text.Length; $i++) {
        if ($Text[$i] -ne ' ') {
            $G.DrawString([string]$Text[$i], $Font, $brush, [single]($X + $offs[$i]), [single]$Y, $script:Fmt)
        }
    }
}

function Measure-Tracked {
    param($G, [string]$Text, $Font, [double]$Tracking = 0.0)
    if ([string]::IsNullOrEmpty($Text)) { return 0.0 }
    if ($Tracking -le 0.01) { return (Measure-Text $G $Text $Font) }
    $info = Get-TrackingInfo $G $Text $Font $Tracking
    return [double]$info.Width
}

function Draw-Wrapped {
    param($G, [string]$Text, $Font, [System.Drawing.Color]$Color, [double]$X, [double]$Y, [double]$MaxWidth, [double]$LineHeight, [double]$Alpha = 1.0)
    $words = $Text.Split(' ')
    $line = ''
    $cy = $Y
    foreach ($word in $words) {
        if ($line -eq '') { $try = $word } else { $try = $line + ' ' + $word }
        if ($line -eq '' -or (Measure-Text $G $try $Font) -le $MaxWidth) {
            $line = $try
        } else {
            Draw-Text $G $line $Font $Color $X $cy $Alpha
            $cy += $LineHeight
            $line = $word
        }
    }
    if ($line -ne '') { Draw-Text $G $line $Font $Color $X $cy $Alpha }
}

function Draw-Bitmap {
    param($G, $Bitmap, [double]$X, [double]$Y, [double]$W, [double]$H, [double]$Alpha = 1.0)
    if ($null -eq $Bitmap -or $Alpha -le 0.01) { return }
    $rect = [System.Drawing.Rectangle]::new([int][Math]::Round($X), [int][Math]::Round($Y), [int][Math]::Round($W), [int][Math]::Round($H))
    if ($Alpha -ge 0.995) {
        $G.DrawImage($Bitmap, $rect)
        return
    }
    $ia = [System.Drawing.Imaging.ImageAttributes]::new()
    $cm = [System.Drawing.Imaging.ColorMatrix]::new()
    $cm.Matrix33 = [single]$Alpha
    $ia.SetColorMatrix($cm)
    $G.DrawImage($Bitmap, $rect, 0, 0, $Bitmap.Width, $Bitmap.Height, [System.Drawing.GraphicsUnit]::Pixel, $ia)
    $ia.Dispose()
}

function New-LayerBitmap {
    param([int]$W, [int]$H, [int]$Scale, [scriptblock]$Draw)
    $bmp = [System.Drawing.Bitmap]::new($W * $Scale, $H * $Scale, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::Default
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::Bilinear
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.ScaleTransform([single]$Scale, [single]$Scale)
    & $Draw $g
    $g.Dispose()
    return $bmp
}

function New-TextLayer {
    param([string]$Text, $Font, [System.Drawing.Color]$Color, [double]$Tracking = 0.0)

    $pad = 12
    $tmp = [System.Drawing.Bitmap]::new(8, 8, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
    $mg = [System.Drawing.Graphics]::FromImage($tmp)
    $w = [int][Math]::Ceiling((Measure-Tracked $mg $Text $Font $Tracking)) + $pad * 2
    $h = [int][Math]::Ceiling($Font.GetHeight($mg)) + $pad * 2
    $mg.Dispose()
    $tmp.Dispose()

    $layer = New-LayerBitmap $w $h 1 {
        param($lg)
        Draw-Tracked $lg $Text $Font $Color $pad $pad $Tracking 1
    }
    return $layer
}

function Draw-Card {
    param($G, [double]$X, [double]$Y, [double]$W, [double]$H, [System.Drawing.Color]$Fill, [System.Drawing.Color]$Border,
          [double]$Alpha = 1.0, [double]$BorderWidth = 2.0)
    if ($Alpha -le 0.01) { return }
    $G.FillRectangle((Get-Brush (Alpha $Fill $Alpha)), [single]$X, [single]$Y, [single]$W, [single]$H)
    $G.DrawRectangle((Get-Pen (Alpha $Border $Alpha) $BorderWidth), [single]$X, [single]$Y, [single]$W, [single]$H)
}

function Draw-Chip {
    param($G, [string]$Text, [double]$Right, [double]$Y, [double]$Height, [System.Drawing.Color]$Border,
          [System.Drawing.Color]$Color, [double]$Alpha = 1.0, [double]$Tracking = 2.0, [double]$FontSize = 20.0)

    if ($Alpha -le 0.01) { return }
    $font = Get-MonoFont $FontSize $false
    $w = (Measure-Tracked $G $Text $font $Tracking) + 40
    $x = $Right - $w
    $G.DrawRectangle((Get-Pen (Alpha $Border $Alpha) 2), [single]$x, [single]$Y, [single]$w, [single]$Height)
    $ty = $Y + ($Height - $FontSize * 1.22) / 2.0
    Draw-Tracked $G $Text $font $Color ($x + 20) $ty $Tracking $Alpha
}

# =====================================================================
#  Fundo: ondas do deck
# =====================================================================
function Draw-Waves {
    param($G, [double]$T)

    $step = 24
    $count = [int](2048 / $step) + 2
    for ($j = 0; $j -lt 8; $j++) {
        $baseY = 606.0 + $j * 38.0
        $amp = 14.0 + $j * 2.5
        $ph = $j * 0.7 + $T * 0.32
        if (($j % 4) -eq 1) {
            $col = [System.Drawing.Color]::FromArgb(24, $script:C.Amber.R, $script:C.Amber.G, $script:C.Amber.B)
        } else {
            $col = [System.Drawing.Color]::FromArgb(20, $script:C.Acid.R, $script:C.Acid.G, $script:C.Acid.B)
        }
        $pen = Get-Pen $col 2
        $pts = New-Object 'System.Drawing.PointF[]' $count
        for ($k = 0; $k -lt $count; $k++) {
            $x = $k * $step
            $y = $baseY + [Math]::Sin($x / 300.0 + $ph) * $amp
            $pts[$k] = [System.Drawing.PointF]::new([single]$x, [single]$y)
        }
        $G.DrawLines($pen, $pts)
    }
}

# =====================================================================
#  Chrome: barra de progresso, cabecalho e rodape
# =====================================================================
function Draw-Progress {
    param($G, [double]$T)

    $G.FillRectangle((Get-Brush (Alpha $script:C.Bone 0.08)), [single]0, [single]0, [single]1920, [single]6)
    $p = Prog $T 0.15 2.3
    if ($p -gt 0) {
        $G.FillRectangle((Get-Brush $script:C.Acid), [single]0, [single]0, [single](1920 * $p), [single]6)
        $glowX = 1920 * $p
        if ($glowX -gt 8 -and $glowX -lt 1912) {
            $G.FillRectangle((Get-Brush (Alpha $script:C.Acid 0.35)), [single]($glowX - 8), [single]0, [single]16, [single]6)
        }
    }
}

function Draw-Header {
    param($G, [double]$T)

    $a = Prog $T 0.05 0.6
    if ($a -le 0.01) { return }
    $dy = (1 - $a) * -10

    Draw-Bitmap $G $script:HeaderLayer 128 (62 + $dy) 620 60 $a

    $ca = Prog $T 0.3 0.6
    Draw-Bitmap $G $script:ChipLayer 1452 (65 + $dy) 340 46 $ca
}

function Draw-TerminalLine {
    param($G, $Line, $Font, [double]$X, [double]$Y, [int]$MaxChars, [double]$Alpha)

    $cx = $X
    $remaining = $MaxChars
    foreach ($seg in $Line.Segs) {
        if ($remaining -le 0) { break }
        $txt = $seg.T
        if ($txt.Length -gt $remaining) { $txt = $txt.Substring(0, $remaining) }
        if ($txt.Length -gt 0) {
            Draw-Text $G $txt $Font $script:C[$seg.C] $cx $Y $Alpha
            $cx += (Measure-Text $G $txt $Font)
            $remaining -= $txt.Length
        }
    }
    return [double]$cx
}

# =====================================================================
#  Tela principal (1920x1080 de design)
# =====================================================================
function Draw-Design {
    param($G, [double]$T)

    $C = $script:C

    Draw-Waves $G $T
    Draw-Progress $G $T

    # ---------- hero ----------
    $pEye = Prog $T 0.28 0.55
    $pTitle = Prog $T 0.36 0.7
    $pRule = Prog $T 0.75 0.65
    $pSub = Prog $T 0.85 0.55

    $eyeY = 158 + (1 - $pEye) * 10
    Draw-Bitmap $G $script:EyeLayer (128 - 12) ($eyeY - 12) $script:EyeLayer.Width $script:EyeLayer.Height $pEye

    $ty = 196.0 + (1 - $pTitle) * 22
    $ta = $pTitle
    $glitchPhase = $T % 6.4
    $jit = 0.0
    if ($glitchPhase -lt 0.16) { $jit = 9.0 * (1 - $glitchPhase / 0.16) }

    $fTitle = Get-DisplayFont 112
    if ($jit -gt 0.5) {
        Draw-Text $G 'RANSOMWARE' $fTitle (Alpha $C.Acid 0.35) (128 + $jit) ($ty - 2) $ta
        Draw-Text $G 'ACTIVATED' $fTitle (Alpha $C.Acid 0.35) (128 + $jit) (306 - 2) $ta
    }
    Draw-Text $G 'RANSOMWARE' $fTitle $C.Bone 128 $ty $ta
    Draw-Text $G 'ACTIVATED' $fTitle $C.Amber 128 (306 + (1 - $pTitle) * 22) $ta

    if ($pRule -gt 0) {
        $G.FillRectangle((Get-Brush (Alpha $C.Acid $pRule)), [single]128, [single]447, [single](560 * $pRule), [single]5)
    }

    Draw-Text $G 'Seus arquivos foram criptografados. A chave expira em 72 horas.' (Get-MonoFont 24 $false) $C.Body 128 (473 + (1 - $pSub) * 10) $pSub

    # ---------- terminal ----------
    $pCard = Prog $T 1.0 0.65
    $cardX = 128.0
    $cardY = 536.0 + (1 - $pCard) * 16
    $cardW = 1040.0
    $cardH = 396.0

    if ($pCard -gt 0.01) {
        Draw-Bitmap $G $script:CardLayer $cardX $cardY $cardW $cardH $pCard

        $recOn = ([int][Math]::Floor($T * 2)) % 2 -eq 0
        $recAlpha = $pCard
        if (-not $recOn) { $recAlpha = $pCard * 0.35 }
        $G.FillRectangle((Get-Brush (Alpha $C.Amber $recAlpha)), [single]($cardX + $cardW - 190), [single]($cardY + 26), [single]9, [single]9)
        $recTxt = 'REC ' + ([TimeSpan]::FromSeconds([Math]::Max(0, $T - 1.0))).ToString('hh\:mm\:ss')
        $fr = Get-MonoFont 18 $false
        $rw = Measure-Text $G $recTxt $fr
        Draw-Text $G $recTxt $fr $C.Amber ($cardX + $cardW - 32 - $rw) ($cardY + 19) $pCard

        # scanline sutil dentro do card
        $scanY = $cardY + 60 + (($T * 55) % ($cardH - 70))
        $state = $G.Save()
        $G.SetClip([System.Drawing.RectangleF]::new([single]$cardX, [single]($cardY + 56), [single]$cardW, [single]($cardH - 58)))
        $G.DrawLine((Get-Pen (Alpha $C.Acid 0.10) 2), [single]$cardX, [single]$scanY, [single]($cardX + $cardW), [single]$scanY)
        $G.Restore($state)

        # linhas digitadas
        $fLine = Get-MonoFont 23 $false
        $lineY = $cardY + 70
        $start = $script:TermStart
        $gap = $script:TermGap
        $cps = $script:TermCps
        $lastEndX = $cardX + 32
        $lastY = $lineY
        $lastDone = $false

        for ($i = 0; $i -lt $script:TerminalLines.Count; $i++) {
            $ln = $script:TerminalLines[$i]
            $ls = $start + $i * $gap
            if ($T -ge $ls) {
                $typed = [int][Math]::Floor(($T - $ls) * $cps)
                if ($typed -gt $ln.Chars) { $typed = $ln.Chars }
                $la = [Math]::Min(1.0, ($T - $ls) / 0.16) * $pCard
                $ex = Draw-TerminalLine $G $ln $fLine ($cardX + 32) $lineY $typed $la
                $lastEndX = $ex
                $lastY = $lineY
                $lastDone = ($typed -ge $ln.Chars)
                if (-not $lastDone) {
                    $blink = ([int][Math]::Floor($T * 3)) % 2 -eq 0
                    if ($blink) {
                        $G.FillRectangle((Get-Brush (Alpha $C.Acid $la)), [single]($ex + 4), [single]($lineY + 3), [single]12, [single]24)
                    }
                }
            }
            $lineY += 34
        }

        if ($lastDone) {
            $blink = ([int][Math]::Floor($T * 2)) % 2 -eq 0
            if ($blink) {
                $G.FillRectangle((Get-Brush (Alpha $C.Acid $pCard)), [single]($lastEndX + 4), [single]($lastY + 3), [single]12, [single]24)
            }
        }
    }

    # ---------- coluna da coruja ----------
    $pOwl = Prog $T 0.5 0.9
    $pSide = Prog $T ($script:TermEnd + 0.2) 0.7

    $owlSize = 470.0
    $owlX = 1276.0
    $owlY = 176.0
    $bob = [Math]::Sin($T * 1.15) * 7

    if ($pOwl -gt 0.01) {
        $pulse = 0.5 + 0.5 * [Math]::Sin($T * 0.9)
        $gi = [int][Math]::Round($pulse * 5)
        $glowSize = 600.0 + 12.0 * $gi
        Draw-Bitmap $G $script:GlowSet[$gi] (1511 - $glowSize / 2) (411 - $glowSize / 2) $glowSize $glowSize $pOwl

        $bt = $T % 3.9
        $blinking = $bt -gt 3.62
        if ($script:RenderScale -ge 1.4) {
            if ($blinking) { $owlBmp = $script:OwlBlink } else { $owlBmp = $script:OwlOpen }
        } else {
            if ($blinking) { $owlBmp = $script:OwlBlink1 } else { $owlBmp = $script:OwlOpen1 }
        }
        Draw-Bitmap $G $owlBmp $owlX ($owlY + $bob + (1 - $pOwl) * 20) $owlSize $owlSize $pOwl

        $fOwl = Get-MonoFont 18 $false
        $ow = $script:OwlLabelLayer.Width - 24
        Draw-Bitmap $G $script:OwlLabelLayer (1511 - $ow / 2 - 12) (654 - 12) $script:OwlLabelLayer.Width $script:OwlLabelLayer.Height $pOwl
    }

    # ---------- card do cenario ----------
    if ($pSide -gt 0.01) {
        $sx = 1230.0
        $sy = 702.0 + (1 - $pSide) * 16
        Draw-Bitmap $G $script:SideLayer $sx $sy 562 216 $pSide
    }

    Draw-Header $G $T
}

# =====================================================================
#  Modo imagem (-ImagePath)
# =====================================================================
function Draw-ImageDesign {
    param($G, [double]$T)

    $C = $script:C
    $img = $script:AttackImage
    $a = Prog $T 0.2 0.9

    Draw-Waves $G $T

    if ($img) {
        $areaX = 0.0; $areaY = 120.0; $areaW = 1920.0; $areaH = 920.0
        $s = [Math]::Min($areaW / $img.Width, $areaH / $img.Height)
        $w = $img.Width * $s
        $h = $img.Height * $s
        $x = $areaX + ($areaW - $w) / 2
        $y = $areaY + ($areaH - $h) / 2
        Draw-Bitmap $G $img $x $y $w $h $a
        $G.DrawRectangle((Get-Pen (Alpha $C.Line $a) 2), [single]$x, [single]$y, [single]$w, [single]$h)
    }

    $G.FillRectangle((Get-Brush (Alpha $C.Ink 0.86)), [single]0, [single]0, [single]1920, [single]130)
    Draw-Progress $G $T
    Draw-Header $G $T
}

function Render-Frame {
    param($G, [double]$T, [int]$ClientW, [int]$ClientH)

    $G.Clear($script:C.Ink)

    if ($ClientW -le 0 -or $ClientH -le 0) { return }
    $scale = [Math]::Min($ClientW / $script:DesignW, $ClientH / $script:DesignH)
    if ($scale -le 0) { return }
    $script:RenderScale = $scale

    $ox = ($ClientW - $script:DesignW * $scale) / 2.0
    $oy = ($ClientH - $script:DesignH * $scale) / 2.0

    $G.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $G.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $G.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::Bilinear
    $G.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $G.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::Default

    $G.TranslateTransform([single]$ox, [single]$oy)
    $G.ScaleTransform([single]$scale, [single]$scale)

    if ($script:AttackImage) {
        Draw-ImageDesign $G $T
    } else {
        Draw-Design $G $T
    }
}

# =====================================================================
#  Preview em PNG (sem abrir a tela cheia)
# =====================================================================
Initialize-Assets

if ($PreviewPath) {
    $dir = Split-Path -Parent $PreviewPath
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $bmp = [System.Drawing.Bitmap]::new(1920, 1080, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    Render-Frame $g $PreviewTime 1920 1080
    $g.Dispose()
    $bmp.Save($PreviewPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "[*] Preview salvo em $PreviewPath" -ForegroundColor Cyan
    return
}

function Dispose-Assets {
    foreach ($b in $script:Brushes.Values) { $b.Dispose() }
    foreach ($p in $script:Pens.Values) { $p.Dispose() }
    foreach ($f in $script:Fonts.Values) { $f.Dispose() }
    foreach ($bm in @($script:OwlOpen, $script:OwlBlink, $script:OwlOpen1, $script:OwlBlink1,
                      $script:Icon,
                      $script:HeaderLayer, $script:SideLayer, $script:CardLayer,
                      $script:ChipLayer, $script:EyeLayer, $script:OwlLabelLayer)) {
        if ($bm) { $bm.Dispose() }
    }
    foreach ($bm in $script:GlowSet) { if ($bm) { $bm.Dispose() } }
    if ($script:AttackImage) { $script:AttackImage.Dispose() }
}

# =====================================================================
#  Tela cheia
# =====================================================================
function Show-Hacked {
    if ($script:AttackForm) { return }   # ja esta na tela (evita empilhar janelas)
    $form = [AtkForm]::new()
    $script:AttackForm = $form

    $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
    $form.WindowState = [System.Windows.Forms.FormWindowState]::Maximized
    $form.TopMost = $true
    $form.BackColor = $script:C.Ink
    $form.KeyPreview = $true
    $form.ShowInTaskbar = $false
    $form.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::None
    $form.Text = 'Sistema'

    # ESC NAO fecha a tela de proposito: a simulacao so e revertida pelo /voltar (painel).

    $form.Add_Paint({
        param($sender, $e)
        $t = 0.0
        if ($script:StartClock) { $t = $script:StartClock.Elapsed.TotalSeconds }
        Render-Frame $e.Graphics $t $sender.ClientSize.Width $sender.ClientSize.Height
    })

    # SEM PaintTimer: o repaint e disparado pelo loop principal (um frame por volta),
    # intercalado com a checagem da porta 10000. Assim o render pesado NAO trava o HTTP
    # (um timer de 33ms inundaria o DoEvents e mataria o listener enquanto a tela estivesse aberta).
    $form.Add_Shown({
        $script:StartClock = [System.Diagnostics.Stopwatch]::StartNew()
        $script:AttackForm.Activate()
        [System.Windows.Forms.Cursor]::Hide()
        [System.Media.SystemSounds]::Hand.Play()
    })

    $form.Add_FormClosed({
        [System.Windows.Forms.Cursor]::Show()
        $script:AttackForm = $null
    })

    $form.Show()   # nao-modal: o loop principal continua atendendo HTTP (/voltar, /status)
}

function Close-Hacked {
    if ($script:AttackForm) { $script:AttackForm.Close() }   # Close dispara o FormClosed (limpeza)
}

# =====================================================================
#  Servidor HTTP de disparo
# =====================================================================
function Send-Response($Stream, [int]$Code, [string]$Body) {
    $status = if ($Code -eq 200) { '200 OK' } else { '404 Not Found' }
    $bytesBody = [System.Text.Encoding]::UTF8.GetBytes($Body)
    $header = "HTTP/1.1 $status`r`nContent-Type: text/html; charset=utf-8`r`nContent-Length: $($bytesBody.Length)`r`nConnection: close`r`n`r`n"
    $bytesHeader = [System.Text.Encoding]::ASCII.GetBytes($header)
    $Stream.Write($bytesHeader, 0, $bytesHeader.Length)
    $Stream.Write($bytesBody, 0, $bytesBody.Length)
    $Stream.Flush()
}

$okPage = @'
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Simulação disparada</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0A0A0B;color:#EDE6D6;
       font-family:'JetBrains Mono',ui-monospace,Consolas,monospace;padding:24px}
  .card{background:#16181C;border:2px solid #2A2E35;border-left:6px solid #B6FF3B;
        padding:40px 44px;max-width:520px;width:100%}
  .eyebrow{color:#B6FF3B;letter-spacing:3px;font-size:13px;margin:0 0 18px}
  h1{font-family:'Chakra Petch',Bahnschrift,'Segoe UI',sans-serif;font-size:38px;line-height:1.05;margin:0 0 16px}
  p{color:#C9C3B5;line-height:1.6;margin:0}
  .foot{margin-top:28px;padding-top:18px;border-top:2px solid #2A2E35;color:#8C8F96;font-size:12px;letter-spacing:2px}
</style></head>
<body><div class="card">
<p class="eyebrow">// SIMULAÇÃO DISPARADA</p>
<h1>Sistema comprometido.</h1>
<p>A tela cheia foi aberta na máquina do participante. Pressione <b style="color:#B6FF3B">ESC</b> para encerrar a demonstração.</p>
<p class="foot">EXERCÍCIO DE CONSCIENTIZAÇÃO · NADA FOI CRIPTOGRAFADO</p>
</div></body></html>
'@

$notFoundPage = '<!doctype html><html><body style="background:#0A0A0B;color:#8C8F96;font-family:Consolas,monospace;padding:40px">404 - not found</body></html>'

# ---------------------------------------------------------------------------
#  Pagina de resposta do /voltar
# ---------------------------------------------------------------------------
$backPage = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Tela liberada</title></head><body style="background:#0A0A0B;color:#B6FF3B;font-family:Consolas,monospace;padding:40px">// TELA LIBERADA - simulacao revertida.</body></html>'

# ---------------------------------------------------------------------------
#  Servidor HTTP (nao-bloqueante): /hack mostra, /voltar fecha, /status consulta.
#  A exibicao e nao-modal, entao o loop segue atendendo requisicoes com a tela aberta.
# ---------------------------------------------------------------------------
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
try { $listener.Start() }
catch {
    Write-Host "[-] Nao foi possivel abrir a porta $Port. Ja existe outro processo usando?" -ForegroundColor Red
    return
}

Write-Host ''
Write-Host "[*] Servidor no ar na porta $Port." -ForegroundColor Cyan
Write-Host "    Disparo: $TriggerPath  |  Voltar: $ReturnPath  |  Status: /status" -ForegroundColor Cyan
Write-Host "    ESC fecha a tela  |  Ctrl+C encerra o servidor" -ForegroundColor DarkGray
Write-Host ''

try {
    while ($true) {
        if ($listener.Pending()) {
            $client = $listener.AcceptTcpClient()
            $client.ReceiveTimeout = 2000
            $action = $null
            try {
                $stream = $client.GetStream()
                $reader = [System.IO.StreamReader]::new($stream)
                $requestLine = $reader.ReadLine()
                while (($h = $reader.ReadLine()) -ne $null -and $h -ne '') { }

                $remote = $client.Client.RemoteEndPoint
                if ($requestLine -match '^GET\s+(\S+)') {
                    $path = $Matches[1].Split('?')[0]
                    if ($path -eq $TriggerPath) {
                        Send-Response $stream 200 $okPage
                        Write-Host "[+] $(Get-Date -Format HH:mm:ss) Disparo recebido de $remote" -ForegroundColor Green
                        $action = 'show'
                    }
                    elseif ($path -eq $ReturnPath) {
                        Send-Response $stream 200 $backPage
                        Write-Host "[+] $(Get-Date -Format HH:mm:ss) Retorno recebido de $remote" -ForegroundColor Green
                        $action = 'close'
                    }
                    elseif ($path -eq '/status') {
                        $locked = if ($null -ne $script:AttackForm) { 'true' } else { 'false' }
                        Send-Response $stream 200 "{""locked"":$locked}"
                    }
                    else {
                        Send-Response $stream 404 $notFoundPage
                    }
                }
            }
            catch {
                Write-Host "[-] Erro na requisicao: $_" -ForegroundColor Yellow
            }
            finally {
                $client.Close()
            }

            if ($action -eq 'show')  { Show-Hacked }
            if ($action -eq 'close') { Close-Hacked }
        }

        if ($script:AttackForm) { try { $script:AttackForm.Invalidate() } catch {} }  # 1 frame da tela cheia por volta
        [System.Windows.Forms.Application]::DoEvents()   # processa esse repaint + input, e RETORNA
        Start-Sleep -Milliseconds 33                      # ~30fps; mantem a porta 10000 responsiva
    }
}
finally {
    Close-Hacked
    [System.Windows.Forms.Application]::DoEvents()
    $listener.Stop()
    Dispose-Assets
    Write-Host '[*] Listener encerrado.' -ForegroundColor Cyan
}
