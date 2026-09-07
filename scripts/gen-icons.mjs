#!/usr/bin/env node
// Generate browser, PWA, and social icons from the current logo source.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const iconsDir = join(root, "public", "icons");
const logoImage = join(iconsDir, "out-of-sight-logo.jpg");
const homeBackgroundImage = join(
  root,
  "public",
  "images",
  "home-map-background.png",
);

const outputs = [
  { file: "out-of-sight-favicon-16.png", size: 16 },
  { file: "out-of-sight-favicon-32.png", size: 32 },
  { file: "out-of-sight-favicon-96.png", size: 96 },
  { file: "out-of-sight-apple-touch-icon.png", size: 180 },
  { file: "out-of-sight-icon-192.png", size: 192 },
  { file: "out-of-sight-icon-512.png", size: 512 },
  { file: "out-of-sight-maskable-192.png", size: 192 },
  { file: "out-of-sight-maskable-512.png", size: 512 },
  { file: "favicon-16.png", size: 16 },
  { file: "favicon-32.png", size: 32 },
  { file: "favicon-96.png", size: 96 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-192.png", size: 192 },
  { file: "icon-maskable-512.png", size: 512 },
];

const ogOutputs = ["out-of-sight-og-image.png", "og-image.png"];

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ].filter(Boolean);

  const chrome = candidates.find((candidate) => existsSync(candidate));
  if (!chrome) {
    throw new Error(
      "Could not find Chrome/Chromium. Set CHROME_PATH to regenerate icons.",
    );
  }
  return chrome;
}

function renderIconHtml({ size }) {
  const logoUrl = pathToFileURL(logoImage).href;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=${size}, initial-scale=1">
    <style>
      html,
      body {
        width: ${size}px;
        height: ${size}px;
        margin: 0;
        overflow: hidden;
        background: #000000;
      }

      img {
        display: block;
        width: ${size}px;
        height: ${size}px;
        object-fit: cover;
      }
    </style>
  </head>
  <body>
    <img src="${logoUrl}" alt="">
  </body>
</html>`;
}

function renderOgHtml() {
  const homeBackgroundUrl = pathToFileURL(homeBackgroundImage).href;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=1200, initial-scale=1">
    <style>
      html,
      body {
        width: 1200px;
        height: 630px;
        margin: 0;
        overflow: hidden;
        background: #000000;
        color: #ffffff;
        font-family: Inter, Arial, sans-serif;
      }

      body {
        display: grid;
        grid-template-columns: 520px 1fr;
        align-items: center;
        gap: 56px;
        box-sizing: border-box;
        padding: 72px 82px;
        background:
          linear-gradient(rgba(0, 0, 0, .20), rgba(0, 0, 0, .45)),
          url("${homeBackgroundUrl}") center top / cover no-repeat;
      }

      .mark {
        display: block;
        width: 390px;
        height: 230px;
        justify-self: center;
      }

      h1 {
        margin: 0;
        font-size: 74px;
        line-height: .94;
        font-weight: 900;
        letter-spacing: 0;
      }

      p {
        margin: 28px 0 0;
        max-width: 500px;
        color: #f6c431;
        font-size: 34px;
        line-height: 1.18;
        font-weight: 800;
        letter-spacing: 0;
      }
    </style>
  </head>
  <body>
    <svg class="mark" viewBox="0 0 290 170" aria-hidden="true">
      <path fill="#fff" d="M0 85C48 5 88 0 145 0s97 5 145 85c-48 80-88 85-145 85S48 165 0 85Z"/>
      <circle cx="145" cy="85" r="55" fill="#f6c431"/>
      <circle cx="145" cy="85" r="23" fill="#000"/>
    </svg>
    <main>
      <h1>Out Of Sight</h1>
      <p>Track law enforcement aircrafts across all 50 states.</p>
    </main>
  </body>
</html>`;
}

function embeddedLogoSvg() {
  const encoded = readFileSync(logoImage).toString("base64");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-label="Out Of Sight logo">
  <image href="data:image/jpeg;base64,${encoded}" width="1024" height="1024" preserveAspectRatio="xMidYMid slice"/>
</svg>
`;
}

function pinnedTabSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Out Of Sight logo">
  <path fill="#000000" d="M512 326c-176 0-300 82-384 186 84 104 208 186 384 186s300-82 384-186c-84-104-208-186-384-186Zm0 312c-116 0-215-43-295-126 80-83 179-126 295-126s215 43 295 126c-80 83-179 126-295 126Z"/>
  <circle cx="512" cy="512" r="118" fill="#000000"/>
</svg>
`;
}

function powershellGenerator() {
  const psOutputs = outputs
    .map(({ file, size }) => `  @{ File = '${file}'; Size = ${size} }`)
    .join("\n");

  return `
param([string]$Root)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$iconsDir = Join-Path $Root 'public\\icons'
$logoPath = Join-Path $iconsDir 'out-of-sight-logo.jpg'
$homeBackgroundPath = [System.IO.Path]::Combine(
  $Root,
  'public',
  'images',
  'home-map-background.png'
)
$outputs = @(
${psOutputs}
)
$ogOutputs = @(
${ogOutputs.map((file) => `  '${file}'`).join("\n")}
)

function Set-Quality($Graphics) {
  $Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
}

function Save-Png([System.Drawing.Bitmap]$Bitmap, [string]$Path) {
  $tmpPath = "$Path.tmp"
  if (Test-Path -LiteralPath $tmpPath) {
    Remove-Item -LiteralPath $tmpPath -Force
  }
  $stream = [System.IO.File]::Open(
    $tmpPath,
    [System.IO.FileMode]::Create,
    [System.IO.FileAccess]::Write
  )
  try {
    $Bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $stream.Dispose()
  }
  Move-Item -LiteralPath $tmpPath -Destination $Path -Force
}

function New-Icon([System.Drawing.Image]$Source, [string]$File, [int]$Size) {
  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      Set-Quality $graphics
      $graphics.Clear([System.Drawing.Color]::Black)
      $graphics.DrawImage($Source, 0, 0, $Size, $Size)
    } finally {
      $graphics.Dispose()
    }

    Save-Png $bitmap (Join-Path $iconsDir $File)
    Write-Host "wrote public/icons/$File"
  } finally {
    $bitmap.Dispose()
  }
}

function New-OgImage() {
  $background = [System.Drawing.Image]::FromFile($homeBackgroundPath)
  $bitmap = New-Object System.Drawing.Bitmap 1200, 630
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $gold = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(246, 196, 49))
    $black = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::Black)
    $titleFont = New-Object System.Drawing.Font 'Arial', 74, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $bodyFont = New-Object System.Drawing.Font 'Arial', 31, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    try {
      Set-Quality $graphics
      $graphics.Clear([System.Drawing.Color]::Black)
      $sourceHeight = [Math]::Min(
        $background.Height,
        [int][Math]::Round($background.Width * 630 / 1200)
      )
      $destinationRect = New-Object System.Drawing.Rectangle 0, 0, 1200, 630
      $sourceRect = New-Object System.Drawing.Rectangle 0, 0, $background.Width, $sourceHeight
      $graphics.DrawImage(
        $background,
        $destinationRect,
        $sourceRect,
        [System.Drawing.GraphicsUnit]::Pixel
      )
      $overlayBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.Point 0, 0),
        (New-Object System.Drawing.Point 0, 630),
        [System.Drawing.Color]::FromArgb(51, 0, 0, 0),
        [System.Drawing.Color]::FromArgb(115, 0, 0, 0)
      )
      try {
        $graphics.FillRectangle($overlayBrush, 0, 0, 1200, 630)
      } finally {
        $overlayBrush.Dispose()
      }
      $eyePath = New-Object System.Drawing.Drawing2D.GraphicsPath
      try {
        $eyePath.AddBezier(172, 315, 220, 235, 260, 230, 317, 230)
        $eyePath.AddBezier(317, 230, 374, 230, 414, 235, 462, 315)
        $eyePath.AddBezier(462, 315, 414, 395, 374, 400, 317, 400)
        $eyePath.AddBezier(317, 400, 260, 400, 220, 395, 172, 315)
        $eyePath.CloseFigure()
        $graphics.FillPath($white, $eyePath)
      } finally {
        $eyePath.Dispose()
      }
      $graphics.FillEllipse($gold, 262, 260, 110, 110)
      $graphics.FillEllipse($black, 294, 292, 46, 46)
      $graphics.DrawString('Out Of Sight', $titleFont, $white, 620, 220)
      $graphics.DrawString('Track law enforcement aircrafts', $bodyFont, $gold, 620, 330)
      $graphics.DrawString('across all 50 states.', $bodyFont, $gold, 620, 370)
    } finally {
      $bodyFont.Dispose()
      $titleFont.Dispose()
      $black.Dispose()
      $gold.Dispose()
      $white.Dispose()
      $graphics.Dispose()
    }

    foreach ($file in $ogOutputs) {
      Save-Png $bitmap (Join-Path $iconsDir $file)
      Write-Host "wrote public/icons/$file"
    }
  } finally {
    $bitmap.Dispose()
    $background.Dispose()
  }
}

$source = [System.Drawing.Image]::FromFile($logoPath)
try {
  foreach ($output in $outputs) {
    New-Icon $source $output.File $output.Size
  }
  New-OgImage
} finally {
  $source.Dispose()
}
`;
}

function generateWithPowerShell(tempDir) {
  const scriptPath = join(tempDir, "gen-icons.ps1");
  writeFileSync(scriptPath, powershellGenerator(), "utf8");
  execFileSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-Root", root],
    { stdio: "inherit" },
  );
}

function screenshot(chrome, htmlPath, outputPath, width, height) {
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--hide-scrollbars",
      "--allow-file-access-from-files",
      "--force-device-scale-factor=1",
      `--window-size=${width},${height}`,
      `--screenshot=${outputPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: "ignore" },
  );
}

function generateWithChrome(tempDir) {
  const chrome = findChrome();

  for (const output of outputs) {
    const htmlPath = join(tempDir, `${output.file}.html`);
    const pngPath = join(iconsDir, output.file);
    writeFileSync(htmlPath, renderIconHtml(output), "utf8");
    screenshot(chrome, htmlPath, pngPath, output.size, output.size);
    console.log(`wrote public/icons/${output.file}`);
  }

  const ogHtmlPath = join(tempDir, "og-image.html");
  writeFileSync(ogHtmlPath, renderOgHtml(), "utf8");
  for (const file of ogOutputs) {
    screenshot(chrome, ogHtmlPath, join(iconsDir, file), 1200, 630);
    console.log(`wrote public/icons/${file}`);
  }
}

function syncSvgShims() {
  const logoSvg = embeddedLogoSvg();
  writeFileSync(join(iconsDir, "out-of-sight-favicon.svg"), logoSvg, "utf8");
  writeFileSync(join(iconsDir, "favicon.svg"), logoSvg, "utf8");
  writeFileSync(join(iconsDir, "washington-eye-logo.svg"), logoSvg, "utf8");
  writeFileSync(join(iconsDir, "safari-pinned-tab.svg"), pinnedTabSvg(), "utf8");
  console.log("synced SVG logo shims");
}

async function main() {
  if (!existsSync(logoImage)) {
    throw new Error(`Missing source logo: ${logoImage}`);
  }

  await mkdir(iconsDir, { recursive: true });
  const tempDir = mkdtempSync(join(tmpdir(), "out-of-sight-icons-"));

  try {
    if (process.platform === "win32") {
      generateWithPowerShell(tempDir);
    } else {
      generateWithChrome(tempDir);
    }
    syncSvgShims();
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
