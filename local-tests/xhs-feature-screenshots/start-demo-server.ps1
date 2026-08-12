$ErrorActionPreference = 'Stop'

$projectRoot = 'C:\Users\44519\.codex\.chatgpt-projects\g-p-6a5b1afb1f70819185624009a37f0022\ielts-speaking-coach'
$demoDataRoot = Join-Path $projectRoot 'local-tests\xhs-feature-screenshots\data'
$stdoutPath = Join-Path $projectRoot 'local-tests\xhs-feature-screenshots\server.out.log'
$stderrPath = Join-Path $projectRoot 'local-tests\xhs-feature-screenshots\server.err.log'

New-Item -ItemType Directory -Force $demoDataRoot | Out-Null

$process = Start-Process -FilePath 'node' `
  -ArgumentList @('mcp/server.mjs', '--dashboard-only') `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -Environment @{
    IELTS_SPEAKING_DATA_DIR = $demoDataRoot
    IELTS_SPEAKING_DASHBOARD_PORT = '43129'
    IELTS_SPEAKING_SAMPLE_BANK_ONLY = '1'
  } `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath `
  -PassThru

Write-Output $process.Id
