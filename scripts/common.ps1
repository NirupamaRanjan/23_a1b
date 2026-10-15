Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Checked {
    param([Parameter(Mandatory=$true)][string]$Command, [string[]]$Arguments = @())
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed (exit $LASTEXITCODE): $Command"
    }
}

function Get-ProjectPython {
    $Path = Join-Path $ProjectRoot '.venv/Scripts/python.exe'
    if (-not (Test-Path -LiteralPath $Path)) {
        throw 'Virtual environment missing. Run scripts/setup-windows.ps1 first.'
    }
    return $Path
}

function Get-NpmCommand {
    if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) { return 'npm.cmd' }
    return 'npm'
}

function Assert-ProjectSettings {
    $RootEnv = Join-Path $ProjectRoot '.env'
    $LegacyEnv = Join-Path $ProjectRoot 'api/.env'
    if (-not ((Test-Path -LiteralPath $RootEnv) -or (Test-Path -LiteralPath $LegacyEnv))) {
        Copy-Item -LiteralPath (Join-Path $ProjectRoot '.env.example') -Destination $RootEnv
        throw 'Created .env from the example. Edit your database connection settings, then rerun. Existing settings are never overwritten.'
    }
}

function Get-ComposeArguments {
    $DockerEnv = Join-Path $ProjectRoot '.env.docker'
    if (-not (Test-Path -LiteralPath $DockerEnv)) {
        Copy-Item -LiteralPath (Join-Path $ProjectRoot '.env.docker.example') -Destination $DockerEnv
    }
    return @('compose', '--env-file', $DockerEnv, '-f', (Join-Path $ProjectRoot 'docker-compose.yml'))
}
