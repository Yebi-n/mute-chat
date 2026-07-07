param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("ios", "android-apk", "android-production")]
  [string]$Target
)

$ErrorActionPreference = "Stop"

function Run($Command, $Arguments) {
  Write-Host "> $Command $($Arguments -join ' ')"
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $Command $($Arguments -join ' ')"
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$branch = (& git -c safe.directory=$repoRoot branch --show-current).Trim()
if (-not $branch) {
  throw "Cannot detect current Git branch."
}

$expectedBranch = if ($Target -eq "ios") { "ios/review-4ce86e4" } else { "android/release" }

if ($branch -ne $expectedBranch) {
  throw @"
Build target does not match the current branch.

Target: $Target
Current branch: $branch
Required branch: $expectedBranch

Switch branch first:
git switch $expectedBranch
"@
}

Write-Host "Build target: $Target"
Write-Host "Verified branch: $branch"

Run "npm.cmd" @("run", "typecheck")

if ($Target -eq "ios") {
  Write-Host ""
  Write-Host "iOS builds are routed through Xcode Cloud only."
  Write-Host "This script only verifies the branch and runs typecheck."
  Write-Host ""
  Write-Host "Next:"
  Write-Host "1. Open App Store Connect > Xcode Cloud"
  Write-Host "2. Select branch ios/review-4ce86e4 in the iOS workflow"
  Write-Host "3. Start the manual build"
  exit 0
}

if ($Target -eq "android-apk") {
  Run "npx.cmd" @("eas-cli@latest", "build", "--platform", "android", "--profile", "androidPreview")
  exit 0
}

if ($Target -eq "android-production") {
  Run "npx.cmd" @("eas-cli@latest", "build", "--platform", "android", "--profile", "production")
  exit 0
}
