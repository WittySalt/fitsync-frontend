# ── One-time adoption of the hand-built prod frontend ────────────────────────
# Import blocks cannot be made workspace-conditional by themselves, so each one
# uses for_each over a map that is empty unless var.adopt is set. adopt is null
# by default and set only in prod.tfvars, so the staging workspace (and any
# fresh environment) plans these as nothing at all.
#
# Once the prod apply has imported everything, these blocks are no-ops (the
# resources are already in state), and `adopt` can be removed from prod.tfvars.
#
# aws_acm_certificate_validation has no import; the prod plan creates it, which
# only waits for the already ISSUED certificate and makes no AWS change.
# See RUNBOOK.md, "One-time adoption of the hand-built prod frontend".

locals {
  adopting = var.adopt != null
  adopt_id = local.adopting ? { prod = var.adopt } : {}
}

import {
  for_each = local.adopt_id
  to       = aws_s3_bucket.frontend
  id       = local.bucket_name
}

import {
  for_each = local.adopt_id
  to       = aws_s3_bucket_public_access_block.frontend
  id       = local.bucket_name
}

import {
  for_each = local.adopt_id
  to       = aws_s3_bucket_policy.frontend_public_read
  id       = local.bucket_name
}

import {
  for_each = local.adopt_id
  to       = aws_cloudfront_origin_access_control.frontend[0]
  id       = each.value.oac_id
}

import {
  for_each = local.adopt_id
  to       = aws_cloudfront_function.spa_fallback[0]
  id       = "${local.name}-spa-fallback"
}

import {
  for_each = local.adopt_id
  to       = aws_cloudfront_distribution.frontend[0]
  id       = each.value.distribution_id
}

import {
  for_each = local.adopt_id
  to       = aws_acm_certificate.frontend[0]
  id       = each.value.certificate_arn
}

# Route 53 record ids are <zone id>_<name>_<type>.
import {
  for_each = local.adopting ? var.adopt.cert_validation_records : {}
  to       = aws_route53_record.frontend_cert_validation[each.key]
  id       = "${data.aws_route53_zone.public[0].zone_id}_${each.value}_CNAME"
}

import {
  for_each = local.adopting ? local.alias_records : {}
  to       = aws_route53_record.frontend_alias[each.key]
  id       = "${data.aws_route53_zone.public[0].zone_id}_${each.value.name}_${each.value.type}"
}
