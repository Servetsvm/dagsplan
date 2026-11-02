# Draws the app icons (icons/icon-192.png, icons/icon-512.png): a clock on teal with an orange "now" dot.
# powershell -ExecutionPolicy Bypass -File tools\icons.ps1
Add-Type -AssemblyName System.Drawing
$dir = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force $dir | Out-Null
foreach ($s in 192, 512) {
  $b = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($b)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::FromArgb(15, 118, 110))
  $u = $s / 100.0
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $g.FillEllipse($white, 20 * $u, 20 * $u, 60 * $u, 60 * $u)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(15, 118, 110)), (6 * $u)
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
  $g.DrawLine($pen, 50 * $u, 50 * $u, 50 * $u, 30 * $u)
  $g.DrawLine($pen, 50 * $u, 50 * $u, 64 * $u, 58 * $u)
  $orange = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(249, 115, 22))
  $g.FillEllipse($orange, 66 * $u, 18 * $u, 16 * $u, 16 * $u)
  $g.FillEllipse($orange, 46 * $u, 46 * $u, 8 * $u, 8 * $u)
  $b.Save((Join-Path $dir "icon-$s.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $b.Dispose()
}
