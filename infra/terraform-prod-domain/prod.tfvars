# Prod custom domain on the hand-built distribution E1APOLMHRQOW5Y.
# See ../terraform/RUNBOOK.md, section "Prod custom domain".
distribution_id   = "E1APOLMHRQOW5Y"
hosted_zone_id    = "Z03373831R8G5N1TEF6LB"
domain_name       = "fitsyncapp.click"
alternative_names = ["www.fitsyncapp.click"]

# Phase gate. false = certificate only (phase 1). Change to true for phase 2,
# after attach-prod-domain.ps1 -Apply has put the aliases on the distribution,
# and keep it true from then on: setting it back to false deletes the DNS records.
create_alias_records = false
