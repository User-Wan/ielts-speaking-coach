$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverPath = Join-Path $projectRoot 'volc-realtime-bridge.mjs'
$pageUrl = 'http://127.0.0.1:4173/voice-room-desktop-v5.html'
$statusUrl = 'http://127.0.0.1:4173/api/voice/status'
$stdoutLog = Join-Path $projectRoot '.voice-server.out.log'
$stderrLog = Join-Path $projectRoot '.voice-server.err.log'

$serverProcess = Start-Process -FilePath 'node' -ArgumentList @($serverPath) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
try {
  $ready = $false
  for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
    try {
      $response = Invoke-RestMethod -Uri $statusUrl -TimeoutSec 1
      $ready = $true
      break
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }
  if (-not $ready) {
    throw '实时语音服务未能启动。'
  }
  Start-Process $pageUrl
  Wait-Process -Id $serverProcess.Id
} finally {
  if (-not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id
  }
}
