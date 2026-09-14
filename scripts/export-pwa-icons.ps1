$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$sourcePath = Join-Path $PSScriptRoot '../public/assets/brand/zouzou-app-icon.png'
$outputPath = Join-Path $PSScriptRoot '../public/assets/pwa'
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
$sourceImage = [System.Drawing.Image]::FromFile((Resolve-Path $sourcePath))
try {
  foreach ($entry in @(@('icon-192.png',192),@('icon-512.png',512),@('maskable-512.png',512),@('apple-touch-icon.png',180),@('favicon-32.png',32))) {
    $size = [int]$entry[1]
    $bitmap = [System.Drawing.Bitmap]::new($size,$size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::FromArgb(114,196,246))
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.DrawImage($sourceImage,0,0,$size,$size)
      $bitmap.Save((Join-Path $outputPath $entry[0]),[System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
  }
} finally { $sourceImage.Dispose() }
