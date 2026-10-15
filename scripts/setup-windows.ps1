[CmdletBinding()]
param([switch]$Bootstrap, [switch]$TestTools)
. (Join-Path $PSScriptRoot 'common.ps1')
Push-Location -LiteralPath $ProjectRoot
try {
    Assert-ProjectSettings
    Write-Host 'Required: Node 22.14+ (22.x) or Node 24+; Python 3.12+.'
    Invoke-Checked -Command 'node' -Arguments @('-e', 'const [a,b]=process.versions.node.split(''.'').map(Number);process.exit(Number(!((a===22&&b>=14)||a>=24)))')
    $Python = Join-Path $ProjectRoot '.venv/Scripts/python.exe'
    if (-not (Test-Path -LiteralPath $Python)) {
        if (Get-Command 'python' -ErrorAction SilentlyContinue) {
            Invoke-Checked -Command 'python' -Arguments @('-c', 'import sys;sys.exit(sys.version_info < (3,12))')
            Invoke-Checked -Command 'python' -Arguments @('-m', 'venv', '.venv')
        } elseif (Get-Command 'py' -ErrorAction SilentlyContinue) {
            Invoke-Checked -Command 'py' -Arguments @('-3', '-m', 'venv', '.venv')
        } else {
            throw 'Install Python 3.12+ and enable the Python command/launcher, then rerun.'
        }
    }
    Invoke-Checked -Command $Python -Arguments @('-c', 'import sys;sys.exit(sys.version_info < (3,12))')
    $Requirements = 'api/requirements.txt'
    if ($TestTools) { $Requirements = 'api/requirements-dev.txt' }
    Invoke-Checked -Command $Python -Arguments @('-m','pip','install','-r',$Requirements,'-r','data_generation/requirements.txt')
    Remove-Item Env:NAPI_RS_FORCE_WASI -ErrorAction SilentlyContinue
    Push-Location -LiteralPath (Join-Path $ProjectRoot 'web')
    try { Invoke-Checked -Command (Get-NpmCommand) -Arguments @('ci') }
    finally { Pop-Location }
    if ($Bootstrap) {
        Invoke-Checked -Command $Python -Arguments @('scripts/check-config.py', '--connect')
        Invoke-Checked -Command $Python -Arguments @('data_generation/bootstrap.py')
    }
    Write-Host 'Setup complete. Open separate terminals for scripts/start-api.ps1 and scripts/start-web.ps1.'
} finally { Pop-Location }
