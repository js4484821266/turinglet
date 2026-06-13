#!/bin/pwsh
# Saammago LLM Server with auto-restart and monitoring

param(
    [int]$MaxRestarts = 0  # 0 = infinite
)

$script:restartCount = 0
$script:maxRestarts = $MaxRestarts

function Start-LlmServer {
    $restartCount++
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    if ($MaxRestarts -gt 0 -and $restartCount -gt $MaxRestarts) {
        Write-Host "[$timestamp] Max restarts ($MaxRestarts) reached. Stopping." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "[$timestamp] Starting LLM server (attempt #$restartCount)..." -ForegroundColor Green
    
    # Run the npm command
    & npm run llm:server
    
    $exitCode = $LASTEXITCODE
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    Write-Host "[$timestamp] LLM server crashed (exit code: $exitCode)" -ForegroundColor Red
    Write-Host "Waiting 5 seconds before restart..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
}

# Continuous restart loop
while ($true) {
    Start-LlmServer
}
