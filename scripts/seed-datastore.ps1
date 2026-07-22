# Seeds the 16 Catalyst Data Store tables from Datasets/*.csv via the CLI's
# bulk-write (Insert operation). Prerequisite: the tables must already exist
# (see catalyst-schema.md for exact names/columns).
#
# Targets PRODUCTION by default. Reasons:
#   * The dev environment caps imports at 5,000 rows/table, which truncates
#     Accused (8,571), PersonMaster (8,149) and ComplainantDetails (5,245) --
#     silently breaking the offender-profile / repeat-offender / demographics
#     features. Production has no cap.
#   * `catalyst deploy` runs AppSail against the production Data Store anyway,
#     so production is the environment the deployed app reads.
#
# Usage (from repo root):
#   pwsh ./seed-datastore.ps1            # -> production (complete data)
#   pwsh ./seed-datastore.ps1 -Dev       # -> dev (3 tables will truncate at 5k)
param([switch]$Dev)

$envFlag = if ($Dev) { @() } else { @('--production') }
$envName = if ($Dev) { 'DEVELOPMENT (5k/table cap)' } else { 'PRODUCTION' }

# Import order: lookup/parent tables first so anything keyed off them lands cleanly.
$tables = @(
  'District', 'Unit', 'GravityOffence', 'CrimeHead', 'Employee',
  'PersonMaster', 'CaseMaster', 'Accused', 'Victim', 'ArrestSurrender',
  'Anomalies', 'Hotspots', 'TrendAlerts', 'StationRiskScore',
  'ComplainantDetails', 'OccupationMaster'
)

Write-Host "Seeding $($tables.Count) tables into $envName" -ForegroundColor Yellow

foreach ($t in $tables) {
  $csv = Join-Path 'Datasets' "$t.csv"
  Write-Host "==> Importing $csv -> table $t" -ForegroundColor Cyan
  if ($Dev) {
    catalyst ds:import $csv --table $t
  } else {
    catalyst ds:import $csv --table $t --production
  }
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: $t (fix and re-run; comment out already-imported tables above to resume)" -ForegroundColor Red
    exit 1
  }
}
Write-Host "All $($tables.Count) tables imported into $envName. Verify via the function's /health route." -ForegroundColor Green
