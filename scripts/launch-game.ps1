$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$url = 'http://127.0.0.1:5173/'
$mutex = New-Object System.Threading.Mutex($false, 'Local\CyberpunkRedSoloRunnerLauncher')
$locked = $false

function Test-GameServer {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
        return $response.Content -match '<title>Cyberpunk RED Solo Runner</title>'
    } catch {
        return $false
    }
}

try {
    $locked = $mutex.WaitOne(0)
    if (-not $locked) { exit }
    if (-not (Test-GameServer)) {
        if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) {
            throw 'Port 5173 is occupied. Close the other service and try again.'
        }
        $node = (Get-Command node -ErrorAction Stop).Source
        $vite = Join-Path $root 'node_modules\vite\bin\vite.js'
        if (-not (Test-Path -LiteralPath $vite)) {
            throw 'Project dependencies are missing. Run npm install in the project folder first.'
        }
        $logs = Join-Path $root '.local-sources'
        New-Item -ItemType Directory -Path $logs -Force | Out-Null
        $server = Start-Process -FilePath $node -ArgumentList ('"{0}" --config vite.config.ts --host 127.0.0.1 --port 5173 --strictPort' -f $vite) -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'launcher.out.log') -RedirectStandardError (Join-Path $logs 'launcher.err.log') -PassThru
        $ready = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            if (Test-GameServer) { $ready = $true; break }
            if ($server.HasExited) { break }
            Start-Sleep -Milliseconds 500
        }
        if (-not $ready) { throw 'Game server could not start. Check .local-sources\launcher.err.log in the project folder.' }
    }
    Start-Process $url
} catch {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($_.Exception.Message, 'Cyberpunk RED', 'OK', 'Error') | Out-Null
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
