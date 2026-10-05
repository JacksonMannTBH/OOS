[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$keystorePath = Join-Path $env:USERPROFILE ".android-signing\out-of-sight-upload.jks"
$keyAlias = "out_of_sight_upload"
$bubblewrapConfigPath = Join-Path $env:USERPROFILE ".bubblewrap\config.json"
$bubblewrapConfig = Get-Content -Raw -LiteralPath $bubblewrapConfigPath | ConvertFrom-Json
$keytoolPath = Join-Path $bubblewrapConfig.jdkPath "bin\keytool.exe"
$jarsignerPath = Join-Path $bubblewrapConfig.jdkPath "bin\jarsigner.exe"
$buildToolsPath = Join-Path $bubblewrapConfig.androidSdkPath "build-tools\36.1.0"
$zipalignPath = Join-Path $buildToolsPath "zipalign.exe"
$apksignerPath = Join-Path $buildToolsPath "apksigner.bat"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Read-SigningPassword([bool]$ConfirmPassword) {
  $form = New-Object System.Windows.Forms.Form
  $form.Text = "Out Of Sight Android signing"
  $form.StartPosition = "CenterScreen"
  $form.ClientSize = New-Object System.Drawing.Size(480, 190)
  $form.FormBorderStyle = "FixedDialog"
  $form.MaximizeBox = $false
  $form.MinimizeBox = $false
  $form.TopMost = $true

  $instructions = New-Object System.Windows.Forms.Label
  $instructions.Location = New-Object System.Drawing.Point(18, 16)
  $instructions.Size = New-Object System.Drawing.Size(440, 38)
  $instructions.Text = if ($ConfirmPassword) {
    "Create a NEW password for the permanent Play Store upload key. Save it in your password manager."
  } else {
    "Enter the existing password for the permanent Play Store upload key."
  }
  $form.Controls.Add($instructions)

  $passwordLabel = New-Object System.Windows.Forms.Label
  $passwordLabel.Location = New-Object System.Drawing.Point(18, 64)
  $passwordLabel.Size = New-Object System.Drawing.Size(110, 22)
  $passwordLabel.Text = "Password"
  $form.Controls.Add($passwordLabel)

  $passwordBox = New-Object System.Windows.Forms.TextBox
  $passwordBox.Location = New-Object System.Drawing.Point(132, 61)
  $passwordBox.Size = New-Object System.Drawing.Size(326, 24)
  $passwordBox.UseSystemPasswordChar = $true
  $form.Controls.Add($passwordBox)

  $confirmBox = $null
  if ($ConfirmPassword) {
    $confirmLabel = New-Object System.Windows.Forms.Label
    $confirmLabel.Location = New-Object System.Drawing.Point(18, 101)
    $confirmLabel.Size = New-Object System.Drawing.Size(110, 22)
    $confirmLabel.Text = "Confirm password"
    $form.Controls.Add($confirmLabel)

    $confirmBox = New-Object System.Windows.Forms.TextBox
    $confirmBox.Location = New-Object System.Drawing.Point(132, 98)
    $confirmBox.Size = New-Object System.Drawing.Size(326, 24)
    $confirmBox.UseSystemPasswordChar = $true
    $form.Controls.Add($confirmBox)
  }

  $okButton = New-Object System.Windows.Forms.Button
  $okButton.Location = New-Object System.Drawing.Point(302, 143)
  $okButton.Size = New-Object System.Drawing.Size(75, 28)
  $okButton.Text = "Build"
  $okButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
  $form.Controls.Add($okButton)
  $form.AcceptButton = $okButton

  $cancelButton = New-Object System.Windows.Forms.Button
  $cancelButton.Location = New-Object System.Drawing.Point(383, 143)
  $cancelButton.Size = New-Object System.Drawing.Size(75, 28)
  $cancelButton.Text = "Cancel"
  $cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
  $form.Controls.Add($cancelButton)
  $form.CancelButton = $cancelButton

  $form.Add_Shown({ $passwordBox.Select() })
  if ($form.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
    throw "Signing was cancelled."
  }

  if ($ConfirmPassword -and $passwordBox.Text -cne $confirmBox.Text) {
    throw "The passwords did not match. No signing key was created."
  }
  if ($passwordBox.Text.Length -lt 12) {
    throw "Use a keystore password at least 12 characters long."
  }

  return $passwordBox.Text
}

if (-not (Test-Path -LiteralPath $keytoolPath)) {
  throw "Bubblewrap's managed JDK was not found at $keytoolPath"
}

if (Test-Path -LiteralPath $keystorePath) {
  $plainPassword = Read-SigningPassword $false
}
else {
  $plainPassword = Read-SigningPassword $true

  New-Item -ItemType Directory -Force -Path (Split-Path $keystorePath) | Out-Null
  & $keytoolPath `
    -genkeypair `
    -keystore $keystorePath `
    -alias $keyAlias `
    -storepass $plainPassword `
    -keypass $plainPassword `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -dname "CN=Jackson Mann, OU=Development, O=Out Of Sight, C=US"

  if ($LASTEXITCODE -ne 0) {
    throw "The Android signing key could not be created."
  }
}

try {
  $env:OOS_ANDROID_STORE_PASSWORD = $plainPassword
  $env:OOS_ANDROID_KEY_PASSWORD = $plainPassword
  $env:JAVA_HOME = $bubblewrapConfig.jdkPath
  $env:ANDROID_HOME = $bubblewrapConfig.androidSdkPath
  Push-Location $PSScriptRoot

  & .\gradlew.bat --no-daemon assembleRelease bundleRelease
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle build failed with exit code $LASTEXITCODE."
  }

  $unsignedApk = Join-Path $PSScriptRoot "app\build\outputs\apk\release\app-release-unsigned.apk"
  $alignedApk = Join-Path $PSScriptRoot "app-release-unsigned-aligned.apk"
  $signedApk = Join-Path $PSScriptRoot "app-release-signed.apk"
  $unsignedBundle = Join-Path $PSScriptRoot "app\build\outputs\bundle\release\app-release.aab"
  $signedBundle = Join-Path $PSScriptRoot "app-release-bundle.aab"

  & $zipalignPath -f -p 4 $unsignedApk $alignedApk
  if ($LASTEXITCODE -ne 0) {
    throw "zipalign failed with exit code $LASTEXITCODE."
  }

  & $apksignerPath sign `
    --ks $keystorePath `
    --ks-key-alias $keyAlias `
    --ks-pass env:OOS_ANDROID_STORE_PASSWORD `
    --key-pass env:OOS_ANDROID_KEY_PASSWORD `
    --out $signedApk `
    $alignedApk
  if ($LASTEXITCODE -ne 0) {
    throw "APK signing failed with exit code $LASTEXITCODE."
  }

  & $jarsignerPath `
    -keystore $keystorePath `
    -storepass:env OOS_ANDROID_STORE_PASSWORD `
    -keypass:env OOS_ANDROID_KEY_PASSWORD `
    -signedjar $signedBundle `
    $unsignedBundle `
    $keyAlias
  if ($LASTEXITCODE -ne 0) {
    throw "App Bundle signing failed with exit code $LASTEXITCODE."
  }
}
finally {
  Pop-Location
  Remove-Item Env:OOS_ANDROID_STORE_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:OOS_ANDROID_KEY_PASSWORD -ErrorAction SilentlyContinue
  $plainPassword = $null
}

Write-Host "Build complete." -ForegroundColor Green
