[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$mobileRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $mobileRoot "android"
$keystorePath = Join-Path $env:USERPROFILE ".android-signing\out-of-sight-upload.jks"
$keyAlias = "out_of_sight_upload"
$toolConfigPath = Join-Path $env:USERPROFILE ".bubblewrap\config.json"
$toolConfig = Get-Content -Raw -LiteralPath $toolConfigPath | ConvertFrom-Json
$keytoolPath = Join-Path $toolConfig.jdkPath "bin\keytool.exe"
$jarsignerPath = Join-Path $toolConfig.jdkPath "bin\jarsigner.exe"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$creatingKey = -not (Test-Path -LiteralPath $keystorePath)

$form = New-Object System.Windows.Forms.Form
$form.Text = "Sign Out Of Sight Capacitor bundle"
$form.StartPosition = "CenterScreen"
$form.ClientSize = New-Object System.Drawing.Size(480, 145)
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true

$label = New-Object System.Windows.Forms.Label
$label.Location = New-Object System.Drawing.Point(18, 18)
$label.Size = New-Object System.Drawing.Size(440, 22)
$label.Text = if ($creatingKey) {
  "Create a NEW password for the permanent Play Store upload key. Save it in your password manager."
} else {
  "Enter the password for the permanent Play Store upload key."
}
$form.Controls.Add($label)

$passwordBox = New-Object System.Windows.Forms.TextBox
$passwordBox.Location = New-Object System.Drawing.Point(18, 50)
$passwordBox.Size = New-Object System.Drawing.Size(440, 24)
$passwordBox.UseSystemPasswordChar = $true
$form.Controls.Add($passwordBox)

$confirmBox = $null
if ($creatingKey) {
  $form.ClientSize = New-Object System.Drawing.Size(480, 190)
  $confirmLabel = New-Object System.Windows.Forms.Label
  $confirmLabel.Location = New-Object System.Drawing.Point(18, 83)
  $confirmLabel.Size = New-Object System.Drawing.Size(110, 22)
  $confirmLabel.Text = "Confirm password"
  $form.Controls.Add($confirmLabel)

  $confirmBox = New-Object System.Windows.Forms.TextBox
  $confirmBox.Location = New-Object System.Drawing.Point(132, 80)
  $confirmBox.Size = New-Object System.Drawing.Size(326, 24)
  $confirmBox.UseSystemPasswordChar = $true
  $form.Controls.Add($confirmBox)

}

$buildButton = New-Object System.Windows.Forms.Button
$buildButton.Location = New-Object System.Drawing.Point(302, 94)
$buildButton.Size = New-Object System.Drawing.Size(75, 28)
$buildButton.Text = "Build"
$buildButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
$form.Controls.Add($buildButton)
$form.AcceptButton = $buildButton

$cancelButton = New-Object System.Windows.Forms.Button
$cancelButton.Location = New-Object System.Drawing.Point(383, 94)
$cancelButton.Size = New-Object System.Drawing.Size(75, 28)
$cancelButton.Text = "Cancel"
$cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.Controls.Add($cancelButton)
$form.CancelButton = $cancelButton
$buttonY = if ($creatingKey) { 135 } else { 94 }
$buildButton.Location = New-Object System.Drawing.Point(302, $buttonY)
$cancelButton.Location = New-Object System.Drawing.Point(383, $buttonY)
$form.Add_Shown({ $passwordBox.Select() })

if ($form.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
  throw "Signing was cancelled."
}
if ($passwordBox.Text.Length -lt 12) {
  throw "The upload-key password was not accepted."
}
if ($creatingKey -and $passwordBox.Text -cne $confirmBox.Text) {
  throw "The passwords did not match. No signing key was created."
}

$plainPassword = $passwordBox.Text
try {
  $env:OOS_ANDROID_STORE_PASSWORD = $plainPassword
  $env:JAVA_HOME = $toolConfig.jdkPath
  $env:ANDROID_HOME = $toolConfig.androidSdkPath

  if ($creatingKey) {
    New-Item -ItemType Directory -Force -Path (Split-Path $keystorePath) | Out-Null
    & $keytoolPath `
      -genkeypair `
      -keystore $keystorePath `
      -alias $keyAlias `
      -storepass:env OOS_ANDROID_STORE_PASSWORD `
      -keypass:env OOS_ANDROID_STORE_PASSWORD `
      -keyalg RSA `
      -keysize 2048 `
      -validity 10000 `
      -dname "CN=Jackson Mann, OU=Development, O=Out Of Sight, C=US"
    if ($LASTEXITCODE -ne 0) { throw "The Android signing key could not be created." }
  }

  Push-Location $mobileRoot
  & npm run sync
  if ($LASTEXITCODE -ne 0) { throw "Capacitor sync failed." }
  Pop-Location

  Push-Location $androidRoot
  & .\gradlew.bat --no-daemon bundleRelease
  if ($LASTEXITCODE -ne 0) { throw "Gradle bundle build failed." }

  $unsignedBundle = Join-Path $androidRoot "app\build\outputs\bundle\release\app-release.aab"
  $signedBundle = Join-Path $androidRoot "out-of-sight-capacitor-release.aab"
  & $jarsignerPath `
    -keystore $keystorePath `
    -storepass:env OOS_ANDROID_STORE_PASSWORD `
    -keypass:env OOS_ANDROID_STORE_PASSWORD `
    -signedjar $signedBundle `
    $unsignedBundle `
    $keyAlias
  if ($LASTEXITCODE -ne 0) { throw "App Bundle signing failed." }
  & $jarsignerPath -verify $signedBundle
  if ($LASTEXITCODE -ne 0) { throw "App Bundle signature verification failed." }
}
finally {
  Pop-Location -ErrorAction SilentlyContinue
  Remove-Item Env:OOS_ANDROID_STORE_PASSWORD -ErrorAction SilentlyContinue
  $plainPassword = $null
}

Write-Host "Signed bundle: $signedBundle" -ForegroundColor Green
