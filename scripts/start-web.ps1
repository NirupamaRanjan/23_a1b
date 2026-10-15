[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'common.ps1')
Remove-Item Env:NAPI_RS_FORCE_WASI -ErrorAction SilentlyContinue
Push-Location -LiteralPath (Join-Path $ProjectRoot 'web')
try { Invoke-Checked -Command (Get-NpmCommand) -Arguments @('run','dev') }
finally { Pop-Location }
