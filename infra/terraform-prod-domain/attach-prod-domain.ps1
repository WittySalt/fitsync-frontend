<#
.SYNOPSIS
  Puts the prod custom domain (aliases + ACM certificate) on the hand-built prod
  CloudFront distribution, or restores a saved config. Dry run unless -Apply.

.DESCRIPTION
  The prod distribution (E1APOLMHRQOW5Y, d26vi6hikexzev.cloudfront.net) is not
  managed by Terraform, so this step is done with the AWS CLI:

    1. get-distribution-config (config + ETag), saved to backups\ for rollback
    2. change ONLY Aliases and ViewerCertificate (sni-only, TLSv1.2_2021)
    3. update-distribution --if-match <ETag>   (only with -Apply)

  Every other field is sent back exactly as CloudFront returned it. Before the
  change, the script checks that the certificate is ISSUED in us-east-1 and
  covers every alias.

  Run it after phase 1 of infra/terraform-prod-domain (certificate validated)
  and before phase 2 (alias records). See infra/terraform/RUNBOOK.md.

.EXAMPLE
  .\attach-prod-domain.ps1                       # dry run, certificate from terraform output
  .\attach-prod-domain.ps1 -Apply                # attach for real
  .\attach-prod-domain.ps1 -RestoreFrom .\backups\E1APOLMHRQOW5Y-20261009-120000.json          # dry run of a rollback
  .\attach-prod-domain.ps1 -RestoreFrom .\backups\E1APOLMHRQOW5Y-20261009-120000.json -Apply   # rollback
#>
[CmdletBinding()]
param(
    [string]$DistributionId = 'E1APOLMHRQOW5Y',
    [string]$CertificateArn = '',
    [string[]]$Aliases = @('fitsyncapp.click', 'www.fitsyncapp.click'),
    [string]$RestoreFrom = '',
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'

# Windows PowerShell 5.1 serialises arrays as {"value":[...],"Count":n} while
# this type data is loaded, which would corrupt the distribution config.
if (Get-TypeData -TypeName System.Array) { Remove-TypeData -TypeName System.Array }

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$backupDir = Join-Path $PSScriptRoot 'backups'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

function Invoke-AwsJson([string[]]$Arguments) {
    $raw = & aws @Arguments --output json | Out-String
    if ($LASTEXITCODE -ne 0) { throw "aws $($Arguments -join ' ') failed (exit $LASTEXITCODE)" }
    # The console code page could garble non-ASCII text on the way back in; the
    # config is plain ASCII today, so refuse rather than send a garbled field.
    if ($raw -match '[^\x00-\x7F]') { throw "aws $($Arguments[0]) $($Arguments[1]) returned non-ASCII text; edit the config by hand instead." }
    return $raw | ConvertFrom-Json
}

function Write-JsonFile([string]$Path, $Object) {
    $json = $Object | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText($Path, $json, $utf8NoBom)
}

function Show-Domain([string]$Label, $Config) {
    Write-Host "${Label}:" -ForegroundColor Cyan
    Write-Host ('  Aliases           ' + ($Config.Aliases | ConvertTo-Json -Depth 5 -Compress))
    Write-Host ('  ViewerCertificate ' + ($Config.ViewerCertificate | ConvertTo-Json -Depth 5 -Compress))
}

# ── Current config and ETag ──────────────────────────────────────────────────
$current = Invoke-AwsJson @('cloudfront', 'get-distribution-config', '--id', $DistributionId)
$etag = $current.ETag
$config = $current.DistributionConfig
if (-not $etag) { throw "No ETag returned for distribution $DistributionId" }

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$backupPath = Join-Path $backupDir "$DistributionId-$stamp.json"
Write-JsonFile $backupPath $config
Write-Host "Saved the current config to $backupPath (pass it to -RestoreFrom to roll back)."
Show-Domain 'Current' $config

if ($RestoreFrom) {
    # ── Rollback: send a saved config back unchanged ─────────────────────────
    $restorePath = (Resolve-Path $RestoreFrom).Path
    $newConfig = [System.IO.File]::ReadAllText($restorePath) | ConvertFrom-Json
    if ($newConfig.CallerReference -ne $config.CallerReference) {
        throw "$restorePath belongs to a different distribution (CallerReference differs)."
    }
} else {
    # ── Attach: check the certificate, then change only the two fields ───────
    if (-not $CertificateArn) {
        Push-Location $PSScriptRoot
        try { $CertificateArn = (& terraform output -raw certificate_arn | Out-String).Trim() } finally { Pop-Location }
        if ($LASTEXITCODE -ne 0 -or -not $CertificateArn.StartsWith('arn:aws:acm:us-east-1:')) {
            throw 'Could not read certificate_arn from terraform output. Apply phase 1 first or pass -CertificateArn.'
        }
    }
    if (-not $CertificateArn.StartsWith('arn:aws:acm:us-east-1:')) {
        throw "CloudFront needs a certificate from us-east-1; got $CertificateArn"
    }

    $cert = (Invoke-AwsJson @('acm', 'describe-certificate', '--region', 'us-east-1', '--certificate-arn', $CertificateArn)).Certificate
    if ($cert.Status -ne 'ISSUED') { throw "Certificate status is $($cert.Status), not ISSUED. Wait for validation." }
    $covered = @($cert.SubjectAlternativeNames)
    foreach ($alias in $Aliases) {
        if ($covered -notcontains $alias) { throw "Certificate does not cover $alias (covers: $($covered -join ', '))." }
    }
    Write-Host "Certificate $CertificateArn is ISSUED and covers $($Aliases -join ', ')." -ForegroundColor Green

    $newConfig = $config | ConvertTo-Json -Depth 100 | ConvertFrom-Json
    $newConfig.Aliases = [ordered]@{ Quantity = $Aliases.Count; Items = @($Aliases) }
    $newConfig.ViewerCertificate = [ordered]@{
        CloudFrontDefaultCertificate = $false
        ACMCertificateArn            = $CertificateArn
        SSLSupportMethod             = 'sni-only'
        MinimumProtocolVersion       = 'TLSv1.2_2021'
    }
}

Show-Domain 'New' $newConfig
$newPath = Join-Path $backupDir "$DistributionId-$stamp.new.json"
Write-JsonFile $newPath $newConfig
$fileUri = 'file://' + ($newPath -replace '\\', '/')

if (-not $Apply) {
    Write-Host ''
    Write-Host 'DRY RUN: nothing was changed. The config that would be sent is' -ForegroundColor Yellow
    Write-Host "  $newPath"
    Write-Host 'Run again with -Apply to send:' -ForegroundColor Yellow
    Write-Host "  aws cloudfront update-distribution --id $DistributionId --if-match $etag --distribution-config $fileUri"
    return
}

$result = Invoke-AwsJson @('cloudfront', 'update-distribution', '--id', $DistributionId, '--if-match', $etag, '--distribution-config', $fileUri)
Write-Host "Update accepted. Status: $($result.Distribution.Status). New ETag: $($result.ETag)" -ForegroundColor Green
Write-Host "Wait until it is deployed (5-15 min):  aws cloudfront wait distribution-deployed --id $DistributionId"
