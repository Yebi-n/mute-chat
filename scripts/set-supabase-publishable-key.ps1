$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env'

if (-not (Test-Path -LiteralPath $envPath)) {
    Copy-Item -LiteralPath (Join-Path $projectRoot '.env.example') -Destination $envPath
}

Write-Host ''
Write-Host 'Supabase Dashboard에서 Publishable key를 복사해 붙여넣으세요.' -ForegroundColor Cyan
Write-Host 'Secret key 또는 service_role key는 입력하지 마세요.' -ForegroundColor Yellow
Write-Host ''

$secureKey = Read-Host 'Publishable key' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)

try {
    $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim()
    if ($key -notmatch '^(sb_publishable_|eyJ)') {
        throw 'Publishable key 형식이 아닙니다.'
    }

    $content = Get-Content -LiteralPath $envPath
    if ($content -match '^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=') {
        $content = $content -replace '^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=.*$', "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$key"
    } else {
        $content += "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$key"
    }
    [IO.File]::WriteAllLines($envPath, $content, [Text.UTF8Encoding]::new($false))
    Write-Host ''
    Write-Host '설정 완료. 이 창을 닫아도 됩니다.' -ForegroundColor Green
} finally {
    if ($pointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
    Remove-Variable key -ErrorAction SilentlyContinue
}

Read-Host 'Enter를 눌러 닫기'
