$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root 'assets'
[System.IO.Directory]::CreateDirectory($assets) | Out-Null
$pngPath = Join-Path $assets 'icon.png'
$icoPath = Join-Path $assets 'icon.ico'
$bitmap = [System.Drawing.Bitmap]::new(256, 256)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$navy = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#102340'))
$white = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#F7F9FE'))
$gold = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#E6C483'))
$font = [System.Drawing.Font]::new('Segoe UI', 29, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$format = [System.Drawing.StringFormat]::new()
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
try {
  $graphics.FillRectangle($navy, 0, 0, 256, 256)
  $graphics.FillRectangle($white, 125, 65, 6, 110)
  $graphics.FillRectangle($white, 55, 77, 147, 5)
  $graphics.FillEllipse($white, 121, 57, 14, 14)
  $graphics.FillRectangle($gold, 76, 83, 3, 47)
  $graphics.FillRectangle($gold, 177, 83, 3, 47)
  $graphics.FillRectangle($gold, 52, 128, 49, 7)
  $graphics.FillRectangle($gold, 155, 128, 49, 7)
  $graphics.FillRectangle($white, 103, 172, 50, 5)
  $graphics.FillRectangle($white, 94, 178, 68, 6)
  $label = [string]::Concat('i', [char]0x0411, [char]0x044E, [char]0x0440, [char]0x043E)
  $rectangle = [System.Drawing.RectangleF]::new(32, 190, 192, 48)
  $graphics.DrawString($label, $font, $white, $rectangle, $format)
  $bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose(); $bitmap.Dispose(); $font.Dispose(); $format.Dispose()
  $white.Dispose(); $gold.Dispose(); $navy.Dispose()
}
$png = [System.IO.File]::ReadAllBytes($pngPath)
$stream = [System.IO.File]::Create($icoPath)
$writer = [System.IO.BinaryWriter]::new($stream)
try {
  $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
  $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
  $writer.Write([uint16]1); $writer.Write([uint16]32)
  $writer.Write([uint32]$png.Length); $writer.Write([uint32]22)
  $writer.Write([byte[]]$png)
} finally { $writer.Dispose() }
Write-Host "Generated $icoPath"
