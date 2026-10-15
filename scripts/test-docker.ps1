[CmdletBinding()]
param([int]$WebPort = 8080, [switch]$HttpOnly)
. (Join-Path $PSScriptRoot 'common.ps1')
if (-not $HttpOnly) {
    $Compose = @(Get-ComposeArguments)
    Invoke-Checked -Command 'docker' -Arguments ($Compose + @('config','--quiet'))
}
$Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$Base = "http://127.0.0.1:$WebPort"
$Health = Invoke-RestMethod -Uri "$Base/api/health" -WebSession $Session
if ($Health.status -ne 'ok') { throw 'Database health check failed.' }
$Actor = Invoke-RestMethod -Uri "$Base/api/v1/session" -WebSession $Session
if (-not $Actor.demo_mode) { throw 'The local demo API is not in demo mode.' }
foreach ($Route in @('browse','transaction','audit','analytics','map','reviews')) {
    $Page = Invoke-WebRequest -Uri "$Base/$Route" -UseBasicParsing -WebSession $Session
    if (($Page.StatusCode -ne 200) -or ($Page.Content -notmatch 'id="root"')) { throw "SPA route failed: $Route" }
}
foreach ($Path in @('clinics','patients','me/audit','reviews/insights','catalogs/specialties')) {
    $null = Invoke-RestMethod -Uri "$Base/api/v1/$Path" -WebSession $Session
}
Write-Host 'PASS: database health, same-origin session/proxy, six SPA routes and live-data endpoints.'
