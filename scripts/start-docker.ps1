[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'common.ps1')
$Compose = @(Get-ComposeArguments)
$Engine = & docker info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop, then rerun this script.' }
if ($Engine.Trim() -ne 'linux') { throw 'Switch Docker Desktop to Linux containers, then rerun.' }
Invoke-Checked -Command 'docker' -Arguments ($Compose + @('config','--quiet'))
Invoke-Checked -Command 'docker' -Arguments ($Compose + @('up','--build','--wait','--wait-timeout','900'))
Invoke-Checked -Command 'docker' -Arguments ($Compose + @('ps'))
Write-Host 'Stack is healthy. Default web URL: http://127.0.0.1:8080 (WEB_PORT in .env.docker).'
Write-Host 'Use scripts/test-docker.ps1 to verify the proxy, routes and live data.'
