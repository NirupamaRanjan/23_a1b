[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-ProjectSettings
$Python = Get-ProjectPython
Push-Location -LiteralPath $ProjectRoot
try {
    Invoke-Checked -Command $Python -Arguments @('scripts/check-config.py','--connect')
    Push-Location -LiteralPath (Join-Path $ProjectRoot 'api')
    try { Invoke-Checked -Command $Python -Arguments @('main.py') }
    finally { Pop-Location }
} finally { Pop-Location }
