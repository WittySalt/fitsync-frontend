locals {
  hostnames = concat([var.domain_name], var.alternative_names)

  tags = {
    Project   = "fitsync"
    Env       = "prod"
    Component = "frontend-domain"
    ManagedBy = "terraform"
  }

  # One A and one AAAA record per hostname, keyed "fitsyncapp.click/A".
  alias_records = var.create_alias_records ? {
    for pair in setproduct(local.hostnames, ["A", "AAAA"]) :
    "${pair[0]}/${pair[1]}" => { name = pair[0], type = pair[1] }
  } : {}
}

data "aws_route53_zone" "public" {
  zone_id = var.hosted_zone_id
}

data "aws_cloudfront_distribution" "prod" {
  id = var.distribution_id
}

# ── Phase 1: certificate ─────────────────────────────────────────────────────
resource "aws_acm_certificate" "prod" {
  provider                  = aws.us_east_1
  domain_name               = var.domain_name
  subject_alternative_names = var.alternative_names
  validation_method         = "DNS"

  tags = { Name = "fitsync-prod-frontend" }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.prod.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id         = data.aws_route53_zone.public.zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 300
  allow_overwrite = true
}

# Waits until ACM has issued the certificate.
resource "aws_acm_certificate_validation" "prod" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.prod.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# ── Phase 2: DNS, only once the distribution serves the names ────────────────
resource "aws_route53_record" "alias" {
  for_each = local.alias_records

  zone_id = data.aws_route53_zone.public.zone_id
  name    = each.value.name
  type    = each.value.type

  alias {
    name                   = data.aws_cloudfront_distribution.prod.domain_name
    zone_id                = data.aws_cloudfront_distribution.prod.hosted_zone_id
    evaluate_target_health = false
  }

  lifecycle {
    precondition {
      condition     = contains(tolist(data.aws_cloudfront_distribution.prod.aliases), each.value.name)
      error_message = "The distribution does not list ${each.value.name} as an alias yet. Run attach-prod-domain.ps1 -Apply first (see RUNBOOK.md)."
    }
    precondition {
      condition     = data.aws_cloudfront_distribution.prod.status == "Deployed"
      error_message = "The distribution is still deploying a change. Wait until its status is Deployed, then plan again."
    }
  }
}
