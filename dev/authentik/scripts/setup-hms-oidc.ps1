#Requires -Version 5.1
<#
.SYNOPSIS
  Configures local Authentik for DiziDental HMS (groups, scope mapping, OIDC app/provider).
  Reads AUTHENTIK_TOKEN from .env (gitignored). Does not print the token.
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
if (-not $Token) { throw "AUTHENTIK_TOKEN missing in .env. Create via Admin UI API Tokens." }

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

function Get-OrCreateGroup {
  param([string]$Name)
  $existing = Invoke-Ak GET ("core/groups/?search=" + [uri]::EscapeDataString($Name))
  $hit = $existing.results | Where-Object { $_.name -eq $Name } | Select-Object -First 1
  if ($hit) {
    Write-Output "Group exists: $Name ($($hit.pk))"
    return $hit
  }
  $g = Invoke-Ak POST "core/groups/" @{ name = $Name; is_superuser = $false }
  Write-Output "Group created: $Name ($($g.pk))"
  return $g
}

Write-Output "=== Authentik HMS setup ==="
Write-Output "Base: $Base"

$groupDefs = @(
  @{ name = "hms-superadmin"; role = "SUPERADMIN" },
  @{ name = "hms-org"; role = "ORG" },
  @{ name = "hms-doctor"; role = "DOCTOR" },
  @{ name = "hms-service-provider"; role = "SERVICE_PROVIDER" },
  @{ name = "hms-patient"; role = "PATIENT" }
)

foreach ($gd in $groupDefs) {
  [void](Get-OrCreateGroup -Name $gd.name)
}

$mappingName = "HMS role and mobile claims"
$expr = @'
role = "PATIENT"
names = [g.name for g in request.user.ak_groups.all()]
mapping = {
  "hms-superadmin": "SUPERADMIN",
  "hms-org": "ORG",
  "hms-doctor": "DOCTOR",
  "hms-service-provider": "SERVICE_PROVIDER",
  "hms-patient": "PATIENT",
}
for n, r in mapping.items():
  if n in names:
    role = r
    break
mobile = request.user.attributes.get("mobile", request.user.username)
return {
  "hms_role": role,
  "mobile": mobile,
}
'@

$maps = Invoke-Ak GET ("propertymappings/scope/?search=" + [uri]::EscapeDataString($mappingName))
$scopeMap = $maps.results | Where-Object { $_.name -eq $mappingName } | Select-Object -First 1
$scopeBody = @{
  name        = $mappingName
  scope_name  = "hms"
  description = "Emits hms_role and mobile claims for Clinic HMS"
  expression  = $expr
}
if (-not $scopeMap) {
  $scopeMap = Invoke-Ak POST "propertymappings/scope/" $scopeBody
  Write-Output "Scope mapping created: $($scopeMap.pk)"
} else {
  $scopeMap = Invoke-Ak PUT ("propertymappings/scope/$($scopeMap.pk)/") $scopeBody
  Write-Output "Scope mapping updated: $($scopeMap.pk)"
}

$flows = Invoke-Ak GET "flows/instances/?page_size=100"
$authFlow = ($flows.results | Where-Object { $_.slug -eq "default-authentication-flow" } | Select-Object -First 1).pk
$authzFlow = ($flows.results | Where-Object { $_.slug -eq "default-provider-authorization-implicit-consent" } | Select-Object -First 1).pk
$invalidationFlow = ($flows.results | Where-Object { $_.slug -eq "default-provider-invalidation-flow" } | Select-Object -First 1).pk
if (-not $authFlow -or -not $authzFlow) { throw "Required default flows not found" }

$certs = Invoke-Ak GET "crypto/certificatekeypairs/"
$signingKey = ($certs.results | Select-Object -First 1).pk

$allScope = Invoke-Ak GET "propertymappings/scope/?page_size=100"
$wantedScopes = @("openid", "email", "profile", "offline_access")
$mappingPks = @()
foreach ($s in $allScope.results) {
  if ($wantedScopes -contains $s.scope_name -or $s.pk -eq $scopeMap.pk) {
    $mappingPks += $s.pk
  }
}
if ($mappingPks -notcontains $scopeMap.pk) { $mappingPks += $scopeMap.pk }

$clientId = "dizidental-hms-spa"
$providers = Invoke-Ak GET ("providers/oauth2/?search=" + [uri]::EscapeDataString("DiziDental"))
$provider = $providers.results | Where-Object { $_.client_id -eq $clientId -or $_.name -eq "DiziDental HMS OIDC" } | Select-Object -First 1

$providerBody = @{
  name                         = "DiziDental HMS OIDC"
  authorization_flow           = $authzFlow
  authentication_flow          = $authFlow
  invalidation_flow            = $invalidationFlow
  client_type                  = "public"
  client_id                    = $clientId
  redirect_uris                = @(
    @{ matching_mode = "strict"; url = "http://localhost:5173/auth/callback" },
    @{ matching_mode = "strict"; url = "http://127.0.0.1:5173/auth/callback" }
  )
  property_mappings            = $mappingPks
  sub_mode                     = "hashed_user_id"
  include_claims_in_id_token   = $true
  issuer_mode                  = "per_provider"
  access_code_validity         = "minutes=1"
  access_token_validity        = "minutes=60"
  refresh_token_validity       = "days=30"
}
if ($signingKey) { $providerBody.signing_key = $signingKey }

if (-not $provider) {
  $provider = Invoke-Ak POST "providers/oauth2/" $providerBody
  Write-Output "Provider created: $($provider.pk)"
} else {
  $provider = Invoke-Ak PUT ("providers/oauth2/$($provider.pk)/") $providerBody
  Write-Output "Provider updated: $($provider.pk)"
}

$apps = Invoke-Ak GET ("core/applications/?search=" + [uri]::EscapeDataString("DiziDental HMS"))
$app = $apps.results | Where-Object { $_.slug -eq "dizidental-hms" } | Select-Object -First 1
$appBody = @{
  name               = "DiziDental HMS"
  slug               = "dizidental-hms"
  provider           = $provider.pk
  meta_launch_url    = "http://localhost:5173/"
  open_in_new_tab    = $false
  policy_engine_mode = "any"
}
if (-not $app) {
  $app = Invoke-Ak POST "core/applications/" $appBody
  Write-Output "Application created: $($app.pk)"
} else {
  $app = Invoke-Ak PATCH ("core/applications/$($app.slug)/") $appBody
  Write-Output "Application updated: $($app.slug)"
}

$issuer = "$Base/application/o/dizidental-hms/"
$outFile = Join-Path $AuthDir "hms-oidc-config.generated.json"
$configObj = [ordered]@{
  issuer                 = $issuer
  client_id              = $clientId
  client_type            = "public"
  redirect_uri           = "http://localhost:5173/auth/callback"
  post_logout_redirect   = "http://localhost:5173/login"
  jwks_uri               = ($issuer + "jwks/")
  authorization_endpoint = "$Base/application/o/authorize/"
  token_endpoint         = "$Base/application/o/token/"
  userinfo_endpoint      = "$Base/application/o/userinfo/"
  end_session_endpoint   = "$Base/application/o/dizidental-hms/end-session/"
  scopes                 = "openid profile email offline_access hms"
  groups                 = @($groupDefs | ForEach-Object { $_.name })
  application_slug       = "dizidental-hms"
  provider_pk            = $provider.pk
}
($configObj | ConvertTo-Json -Depth 5) | Set-Content -Path $outFile -Encoding UTF8
Write-Output "Wrote $outFile"
Write-Output "=== DONE ==="
Write-Output "Issuer: $issuer"
Write-Output "Client ID: $clientId (public SPA)"
