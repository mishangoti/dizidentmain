#Requires -Version 5.1
<#
.SYNOPSIS
  Creates Authentik OAuth Sources for Google and/or Microsoft Entra ID when credentials are present in .env.
  Does not print secrets. Still attach sources to the identification stage in Admin UI (see sso-sources-checklist.md).
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
if (-not $Token) { throw "AUTHENTIK_TOKEN missing in .env" }

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

function Get-SourceBySlug {
  param([string]$Slug)
  $list = Invoke-Ak GET ("sources/all/?search=" + [uri]::EscapeDataString($Slug))
  return $list.results | Where-Object { $_.slug -eq $Slug } | Select-Object -First 1
}

Write-Output "=== Authentik SSO Sources (U6) ==="
Write-Output "Base: $Base"

$googleId = $vars['GOOGLE_OAUTH_CLIENT_ID']
$googleSecret = $vars['GOOGLE_OAUTH_CLIENT_SECRET']
$googleSlug = if ($vars['GOOGLE_OAUTH_SLUG']) { $vars['GOOGLE_OAUTH_SLUG'] } else { 'google' }

if ($googleId -and $googleSecret) {
  $existing = Get-SourceBySlug -Slug $googleSlug
  if ($existing) {
    Write-Output "Google source already exists: slug=$googleSlug"
  } else {
    # Generic OAuth source with Google endpoints (provider type name varies by Authentik version)
    $body = @{
      name           = "Google"
      slug           = $googleSlug
      enabled        = $true
      user_matching_mode = "email_link"
      consumer_key   = $googleId
      consumer_secret = $googleSecret
      provider_type  = "google"
    }
    try {
      $created = Invoke-Ak POST "sources/oauth/" $body
      Write-Output "Google source created: $($created.slug)"
    } catch {
      Write-Warning "Could not create Google source via API. Create manually per sso-sources-checklist.md"
    }
  }
} else {
  Write-Output "Skip Google (set GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET in .env)"
}

$entraId = $vars['ENTRA_OAUTH_CLIENT_ID']
$entraSecret = $vars['ENTRA_OAUTH_CLIENT_SECRET']
$entraTenant = $vars['ENTRA_TENANT_ID']
$entraSlug = if ($vars['ENTRA_OAUTH_SLUG']) { $vars['ENTRA_OAUTH_SLUG'] } else { 'entra-id' }

if ($entraId -and $entraSecret) {
  $existing = Get-SourceBySlug -Slug $entraSlug
  if ($existing) {
    Write-Output "Entra source already exists: slug=$entraSlug"
  } else {
    $tenantPath = if ($entraTenant) { $entraTenant } else { 'common' }
    $body = @{
      name            = "Microsoft Entra ID"
      slug            = $entraSlug
      enabled         = $true
      user_matching_mode = "email_link"
      consumer_key    = $entraId
      consumer_secret = $entraSecret
      provider_type   = "openidconnect"
      authorization_url = "https://login.microsoftonline.com/$tenantPath/oauth2/v2.0/authorize"
      access_token_url  = "https://login.microsoftonline.com/$tenantPath/oauth2/v2.0/token"
      profile_url       = "https://graph.microsoft.com/v1.0/me"
      oidc_jwks_url     = "https://login.microsoftonline.com/$tenantPath/discovery/v2.0/keys"
    }
    try {
      $created = Invoke-Ak POST "sources/oauth/" $body
      Write-Output "Entra source created: $($created.slug)"
    } catch {
      Write-Warning "Could not create Entra source via API. Create manually per sso-sources-checklist.md (prefer Entra ID OAuth Source type in UI)."
    }
  }
} else {
  Write-Output "Skip Entra (set ENTRA_OAUTH_CLIENT_ID + ENTRA_OAUTH_CLIENT_SECRET [+ ENTRA_TENANT_ID] in .env)"
}

Write-Output "=== Done ==="
Write-Output "Attach source(s) to the identification stage in Admin UI (see sso-sources-checklist.md)."
