param(
  [string]$ProjectRef = "oxanqrmkvyniocxwreia"
)

$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Read-RequiredValue {
  param(
    [string]$Prompt,
    [switch]$Secret
  )

  if ($Secret) {
    $secureValue = Read-Host -Prompt $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    try {
      $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
  }
  else {
    $value = Read-Host -Prompt $Prompt
  }

  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "$Prompt 값은 비워둘 수 없습니다."
  }

  return $value.Trim()
}

Write-Host ""
Write-Host "입력값은 이 터미널에서만 사용되며 프로젝트 파일에는 저장되지 않습니다."
Write-Host ""

$apiKey = Read-RequiredValue -Prompt "Solapi API Key" -Secret
$apiSecret = Read-RequiredValue -Prompt "Solapi API Secret" -Secret
$senderNumber = Read-RequiredValue -Prompt "Solapi에 등록 완료된 발신번호 (숫자만)"
$hookSecret = Read-RequiredValue -Prompt "Supabase Auth Hook Secret" -Secret
$hookSecret = $hookSecret.Trim().Trim('"').Trim("'")

$whsecIndex = $hookSecret.IndexOf("whsec_", [StringComparison]::OrdinalIgnoreCase)
if ($whsecIndex -gt 0) {
  $hookSecret = $hookSecret.Substring($whsecIndex)
}

if ($senderNumber -notmatch "^\d{8,11}$") {
  throw "발신번호는 하이픈 없이 숫자 8~11자리로 입력해 주세요."
}

if ($hookSecret -notmatch "^whsec_[A-Za-z0-9+/=_-]{20,}$") {
  throw "Supabase Authentication > Hooks에서 표시된 Secret 값을 전체 복사해 입력해 주세요."
}

npx.cmd supabase secrets set `
  --project-ref $ProjectRef `
  "SOLAPI_API_KEY=$apiKey" `
  "SOLAPI_API_SECRET=$apiSecret" `
  "SOLAPI_SENDER_NUMBER=$senderNumber" `
  "SEND_SMS_HOOK_SECRET=$hookSecret"

if ($LASTEXITCODE -ne 0) {
  throw "Supabase Secret 저장에 실패했습니다."
}

Write-Host ""
Write-Host "Supabase Secret 저장을 완료했습니다."
