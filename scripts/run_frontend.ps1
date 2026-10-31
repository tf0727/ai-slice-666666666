param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path $RepoRoot).Path
$runDir = Join-Path $repoRoot ".run"
$logDir = Join-Path $repoRoot "logs"
$pidPath = Join-Path $runDir "frontend.pid"
$stdoutPath = Join-Path $logDir "frontend.out.log"
$stderrPath = Join-Path $logDir "frontend.err.log"
$frontendDir = Join-Path $repoRoot "frontend"

New-Item -ItemType Directory -Force -Path $runDir, $logDir | Out-Null
Set-Content -Path $pidPath -Value $PID -Encoding ascii
Set-Location $frontendDir

try {
    $command = 'npm.cmd run dev -- --host 127.0.0.1 1>"{0}" 2>"{1}"' -f $stdoutPath, $stderrPath
    & cmd.exe /c $command
    exit $LASTEXITCODE
} finally {
    Remove-Item -Path $pidPath -Force -ErrorAction SilentlyContinue
}
