[CmdletBinding()]
param(
  [double]$ArtworkScale = 0.78
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $repoRoot "public\icons\out-of-sight-logo.jpg"

if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw "Missing launcher icon source: $sourcePath"
}

function Save-Png(
  [System.Drawing.Bitmap]$Bitmap,
  [string]$Path
) {
  $directory = Split-Path -Parent $Path
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  $temporaryPath = "$Path.tmp"
  $stream = [System.IO.File]::Open(
    $temporaryPath,
    [System.IO.FileMode]::Create,
    [System.IO.FileAccess]::Write
  )
  try {
    $Bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $stream.Dispose()
  }
  Move-Item -LiteralPath $temporaryPath -Destination $Path -Force
}

function New-LauncherIcon(
  [System.Drawing.Image]$Source,
  [int]$Size,
  [string]$Path,
  [bool]$TransparentBackground = $false
) {
  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size,
    ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      if ($TransparentBackground) {
        $graphics.Clear([System.Drawing.Color]::Transparent)
      }
      else {
        $graphics.Clear([System.Drawing.Color]::Black)
      }

      $artworkSize = [int][Math]::Round($Size * $ArtworkScale)
      $offset = [int][Math]::Round(($Size - $artworkSize) / 2)
      $graphics.DrawImage($Source, $offset, $offset, $artworkSize, $artworkSize)
    }
    finally {
      $graphics.Dispose()
    }

    Save-Png $bitmap $Path
    Write-Host "wrote $($Path.Substring($repoRoot.Length + 1))"
  }
  finally {
    $bitmap.Dispose()
  }
}

$source = [System.Drawing.Image]::FromFile($sourcePath)
try {
  New-LauncherIcon $source 512 (Join-Path $repoRoot "play-store-assets\out-of-sight-app-icon-512.png")
  New-LauncherIcon $source 192 (Join-Path $repoRoot "public\icons\out-of-sight-maskable-192.png")
  New-LauncherIcon $source 512 (Join-Path $repoRoot "public\icons\out-of-sight-maskable-512.png")

  $legacySizes = @{
    "mdpi" = 48
    "hdpi" = 72
    "xhdpi" = 96
    "xxhdpi" = 144
    "xxxhdpi" = 192
  }
  $twaMaskableSizes = @{
    "mdpi" = 82
    "hdpi" = 123
    "xhdpi" = 164
    "xxhdpi" = 246
    "xxxhdpi" = 328
  }
  $foregroundSizes = @{
    "mdpi" = 108
    "hdpi" = 162
    "xhdpi" = 216
    "xxhdpi" = 324
    "xxxhdpi" = 432
  }

  foreach ($density in $legacySizes.Keys) {
    $size = $legacySizes[$density]
    New-LauncherIcon $source $size (Join-Path $repoRoot "android\app\src\main\res\mipmap-$density\ic_launcher.png")
    New-LauncherIcon $source $size (Join-Path $repoRoot "mobile\android\app\src\main\res\mipmap-$density\ic_launcher.png")
    New-LauncherIcon $source $size (Join-Path $repoRoot "mobile\android\app\src\main\res\mipmap-$density\ic_launcher_round.png")
  }

  foreach ($density in $twaMaskableSizes.Keys) {
    New-LauncherIcon $source $twaMaskableSizes[$density] (Join-Path $repoRoot "android\app\src\main\res\mipmap-$density\ic_maskable.png")
  }

  foreach ($density in $foregroundSizes.Keys) {
    New-LauncherIcon $source $foregroundSizes[$density] (Join-Path $repoRoot "mobile\android\app\src\main\res\mipmap-$density\ic_launcher_foreground.png") $true
  }
}
finally {
  $source.Dispose()
}
