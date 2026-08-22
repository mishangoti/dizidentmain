#Requires -Version 5.1
<#
.SYNOPSIS
  Provisions Authentik users for DiziDental HMS seed accounts (U3).
  Creates users (username=mobile), sets passwords, adds to hms-* groups,
  and optionally writes authentik_user_id back to clinic_hms.users.

.NOTES
  Requires AUTHENTIK_TOKEN in ../.env (gitignored). Does not print the token.
  Optional HMS DB link-back: HMS_DB_* vars or defaults matching application-dev.properties.
#>
$ErrorActionPreference = "Stop"
$AuthDir = Split-Path $PSScriptRoot -Parent
$EnvFile = Join-Path $AuthDir ".env"
if (-not (Test-Path $EnvFile)) { throw ".env not found at $EnvFile" }

$vars = @{}
Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
  $parts = $_ -split '=', 2
  if ($parts.Count -ge 2) { $vars[$parts[0].Trim()] = $parts[1].Trim() }
}
$Base = if ($vars['AUTHENTIK_URL']) { $vars['AUTHENTIK_URL'].TrimEnd('/') } else { 'http://localhost:9000' }
$Token = $vars['AUTHENTIK_TOKEN']
if (-not $Token) { throw "AUTHENTIK_TOKEN missing in .env. Create via Admin UI → API Tokens." }

$HmsHost = if ($vars['HMS_DB_HOST']) { $vars['HMS_DB_HOST'] } else { 'localhost' }
$HmsPort = if ($vars['HMS_DB_PORT']) { $vars['HMS_DB_PORT'] } else { '5432' }
$HmsDb = if ($vars['HMS_DB_NAME']) { $vars['HMS_DB_NAME'] } else { 'clinic_hms' }
$HmsUser = if ($vars['HMS_DB_USER']) { $vars['HMS_DB_USER'] } else { 'postgres' }
$HmsPass = if ($vars['HMS_DB_PASSWORD']) { $vars['HMS_DB_PASSWORD'] } else { 'Admin123' }
$SkipDb = ($vars['HMS_DB_SKIP'] -eq '1' -or $vars['HMS_DB_SKIP'] -eq 'true')

$Headers = @{
  Authorization = "Bearer $Token"
  "Content-Type" = "application/json"
}

function Invoke-Ak {
  param([string]$Method, [string]$Path, $Body = $null)
  $uri = "$Base/api/v3/$Path"
  $params = @{ Uri = $uri; Method = $Method; Headers = $Headers; UseBasicParsing = $true }
  if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress) }
  try {
    return Invoke-RestMethod @params
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $errBody = $reader.ReadToEnd()
      Write-Warning "$Method $Path failed: $errBody"
    }
    throw
  }
}

function Invoke-AkNoContent {
  param([string]$Method, [string]$Path, $Body = $null)
  $uri = "$Base/api/v3/$Path"
  $json = if ($null -ne $Body) { ($Body | ConvertTo-Json -Depth 20 -Compress) } else { $null }
  try {
    if ($null -ne $json) {
      Invoke-WebRequest -Uri $uri -Method $Method -Headers $Headers -Body $json -UseBasicParsing | Out-Null
    } else {
      Invoke-WebRequest -Uri $uri -Method $Method -Headers $Headers -UseBasicParsing | Out-Null
    }
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $errBody = $reader.ReadToEnd()
      # Idempotent: already in group / password already set style conflicts
      if ($errBody -match 'already|exists|duplicate') {
        Write-Warning "Ignored: $Method $Path - $errBody"
        return
      }
      Write-Warning "$Method $Path failed: $errBody"
    }
    throw
  }
}

function Get-GroupByName {
  param([string]$Name)
  $existing = Invoke-Ak GET ("core/groups/?search=" + [uri]::EscapeDataString($Name))
  $hit = $existing.results | Where-Object { $_.name -eq $Name } | Select-Object -First 1
  if (-not $hit) { throw "Group not found: $Name (run configure_hms.py / setup-hms-oidc.ps1 first)" }
  return $hit
}

function Get-OrCreateUser {
  param(
    [string]$Username,
    [string]$Email,
    [string]$Name,
    [string]$Mobile
  )
  $existing = Invoke-Ak GET ("core/users/?username=" + [uri]::EscapeDataString($Username))
  $hit = $existing.results | Where-Object { $_.username -eq $Username } | Select-Object -First 1
  if ($hit) {
    Write-Output "User exists: $Username (pk=$($hit.pk))"
    # Ensure attributes.mobile
    $attrs = @{}
    if ($hit.attributes) {
      $hit.attributes.PSObject.Properties | ForEach-Object { $attrs[$_.Name] = $_.Value }
    }
    $attrs['mobile'] = $Mobile
    $patch = @{
      username = $Username
      email = $Email
      name  = $Name
      attributes = $attrs
      is_active = $true
    }
    $hit = Invoke-Ak PUT "core/users/$($hit.pk)/" $patch
    return $hit
  }
  $body = @{
    username   = $Username
    name       = $Name
    email      = $Email
    is_active  = $true
    path       = "users"
    attributes = @{ mobile = $Mobile }
  }
  $u = Invoke-Ak POST "core/users/" $body
  Write-Output "User created: $Username (pk=$($u.pk))"
  return $u
}

function Set-UserPassword {
  param($UserPk, [string]$Password)
  Invoke-AkNoContent POST "core/users/$UserPk/set_password/" @{ password = $Password }
  Write-Output "  password set for pk=$UserPk"
}

function Add-UserToGroup {
  param($GroupUuid, $UserPk)
  Invoke-AkNoContent POST "core/groups/$GroupUuid/add_user/" @{ pk = $UserPk }
  Write-Output "  added to group $GroupUuid"
}

function Update-HmsAuthentikId {
  param([string]$Mobile, [string]$AuthentikPk)
  if ($SkipDb) {
    Write-Output "  HMS DB skip (HMS_DB_SKIP); set authentik_user_id=$AuthentikPk for mobile=$Mobile manually"
    return
  }
  $psql = Get-Command psql -ErrorAction SilentlyContinue
  if (-not $psql) {
    Write-Warning "psql not on PATH - skip DB link for $Mobile (authentik pk=$AuthentikPk)"
    return
  }
  $env:PGPASSWORD = $HmsPass
  $sql = "UPDATE users SET authentik_user_id = '$AuthentikPk', updated_at = NOW() WHERE mobile = '$Mobile';"
  $out = & psql -h $HmsHost -p $HmsPort -U $HmsUser -d $HmsDb -v ON_ERROR_STOP=1 -c $sql 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "psql failed for $Mobile : $out"
  } else {
    Write-Output "  HMS users.authentik_user_id updated for $Mobile → $AuthentikPk"
  }
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

$seedUsers = @(
  @{ mobile = "9999999999"; password = "admin123";   email = "superadmin@dizidental.local"; name = "Seed Superadmin"; group = "hms-superadmin" },
  @{ mobile = "8888888888"; password = "org123";     email = "org@dizidental.local";         name = "Seed Org";        group = "hms-org" },
  @{ mobile = "7777777777"; password = "doctor123";  email = "doctor@dizidental.local";      name = "Seed Doctor";     group = "hms-doctor" },
  @{ mobile = "6666666666"; password = "sp123";      email = "sp@dizidental.local";          name = "Seed Lab Provider"; group = "hms-service-provider" },
  @{ mobile = "5555555555"; password = "patient123"; email = "patient@dizidental.local";     name = "Seed Patient";    group = "hms-patient" }
)

Write-Output "=== Authentik HMS user sync (U3) ==="
Write-Output "Base: $Base"

$groupCache = @{}
foreach ($gu in @("hms-superadmin", "hms-org", "hms-doctor", "hms-service-provider", "hms-patient")) {
  $g = Get-GroupByName -Name $gu
  $groupCache[$gu] = $g.pk
  Write-Output "Group ${gu}: $($g.pk)"
}

$linkSql = @("-- Generated by sync-hms-users.ps1", "-- Apply: psql -h localhost -U postgres -d clinic_hms -f link-authentik-ids.sql", "")
foreach ($su in $seedUsers) {
  Write-Output "--- $($su.name) ($($su.mobile)) ---"
  $u = Get-OrCreateUser -Username $su.mobile -Email $su.email -Name $su.name -Mobile $su.mobile
  Set-UserPassword -UserPk $u.pk -Password $su.password
  Add-UserToGroup -GroupUuid $groupCache[$su.group] -UserPk $u.pk
  $pk = [string]$u.pk
  # Prefer UUID: JWT sub uses USER_UUID mode (not Authentik API "uid" hash).
  $uid = if ($u.uuid) { [string]$u.uuid } elseif ($u.uid) { [string]$u.uid } else { $pk }
  Update-HmsAuthentikId -Mobile $su.mobile -AuthentikPk $uid
  $linkSql += "UPDATE users SET authentik_user_id = '$uid', updated_at = NOW() WHERE mobile = '$($su.mobile)';"
  Write-Output "  authentik link id=$uid (pk=$pk)"
}

$sqlPath = Join-Path $PSScriptRoot "link-authentik-ids.sql"
$linkSql | Set-Content -Path $sqlPath -Encoding utf8
Write-Output "Wrote $sqlPath"

Write-Output "=== Sync complete ==="
Write-Output "Login in Authentik with username=mobile and the seed passwords above."
