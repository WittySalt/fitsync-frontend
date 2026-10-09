# ── S3: frontend SPA bucket (origin for CloudFront) ──────────────────────────
# Resource addresses are kept IDENTICAL to the backend's previous definitions so
# the one-time state migration is a clean `state rm` (backend) + `import`
# (here) with no rename. See RUNBOOK.md.
#
# Two ways for CloudFront to reach the bucket (var.s3_origin_type):
#   website: public-read bucket, S3 website endpoint as a custom origin (staging)
#   oac:     private bucket, S3 REST endpoint signed by an Origin Access Control (prod)
resource "aws_s3_bucket" "frontend" {
  bucket = local.bucket_name
  tags   = { Name = "${local.name}-frontend" }
}

# The website configuration became optional (prod has none). This keeps the
# staging instance where it is; in a workspace without it, the block does nothing.
moved {
  from = aws_s3_bucket_website_configuration.frontend
  to   = aws_s3_bucket_website_configuration.frontend[0]
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  count  = local.s3_via_oac ? 0 : 1
  bucket = aws_s3_bucket.frontend.id

  index_document { suffix = "index.html" }
  # SPA: route 404s back to index so Angular's client router handles them.
  error_document { key = "index.html" }
}

# website: public reads allowed. oac: everything blocked; CloudFront reads with SigV4.
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = local.s3_via_oac
  block_public_policy     = local.s3_via_oac
  ignore_public_acls      = local.s3_via_oac
  restrict_public_buckets = local.s3_via_oac
}

# The address keeps its old name. With oac the policy lets only this distribution read.
resource "aws_s3_bucket_policy" "frontend_public_read" {
  bucket = aws_s3_bucket.frontend.id
  policy = local.s3_via_oac ? jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontOAC"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.frontend.arn}/*"
      Condition = { StringEquals = { "AWS:SourceArn" = one(aws_cloudfront_distribution.frontend[*].arn) } }
    }]
    }) : jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicRead"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.frontend.arn}/*"
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.frontend]

  lifecycle {
    precondition {
      condition     = !local.s3_via_oac || var.enable_cloudfront
      error_message = "s3_origin_type = \"oac\" needs enable_cloudfront = true, because only the distribution may read the bucket."
    }
  }
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  count                             = local.s3_via_oac && var.enable_cloudfront ? 1 : 0
  name                              = var.oac_name != "" ? var.oac_name : "${local.name}-frontend-oac"
  description                       = var.oac_description
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ── CloudFront for the SPA (flagged: slow to deploy) ─────────────────────────
# A client-routed path (no file extension, e.g. /workout or /coach/plan) is served
# index.html so Angular's router takes it; real files and /api/* pass through untouched.
resource "aws_cloudfront_function" "spa_fallback" {
  count   = var.enable_cloudfront ? 1 : 0
  name    = "${local.name}-spa-fallback"
  runtime = "cloudfront-js-2.0"
  comment = "Serve index.html for client-routed paths"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      var last = request.uri.split('/').pop();
      if (last.indexOf('.') === -1) {
        request.uri = '/index.html';
      }
      return request;
    }
  EOT
}

resource "aws_cloudfront_distribution" "frontend" {
  count   = var.enable_cloudfront ? 1 : 0
  enabled = true
  comment = var.distribution_comment != "" ? var.distribution_comment : "${local.name}-frontend"

  price_class     = var.price_class
  is_ipv6_enabled = var.ipv6_enabled

  # Custom hostnames (domain.tf). The *.cloudfront.net hostname keeps working too.
  aliases = local.hostnames

  default_root_object = "index.html"

  origin {
    domain_name              = local.s3_via_oac ? aws_s3_bucket.frontend.bucket_regional_domain_name : one(aws_s3_bucket_website_configuration.frontend[*].website_endpoint)
    origin_id                = "s3-frontend"
    origin_access_control_id = local.s3_via_oac ? one(aws_cloudfront_origin_access_control.frontend[*].id) : null

    dynamic "custom_origin_config" {
      for_each = local.s3_via_oac ? [] : [1]
      content {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "http-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
    # An OAC origin has no config block: the provider sends an empty S3OriginConfig
    # (no legacy OAI), which is what the live prod origin has.
  }

  # API origin: proxy /api/* to the backend ALB (:80), which forwards to the gateway.
  # Lets the SPA keep using same-origin relative /api over HTTPS, like the prod dist.
  dynamic "origin" {
    for_each = var.api_origin_domain == "" ? [] : [1]
    content {
      domain_name = var.api_origin_domain
      # The id dates from when /api went straight to the EC2 gateway; it is only a label,
      # kept as is so the live distribution is not rewritten for a rename.
      origin_id = "ec2-api"

      custom_origin_config {
        http_port              = var.api_origin_port
        https_port             = 443
        origin_protocol_policy = "http-only"
        origin_ssl_protocols   = ["TLSv1.2"]
        # The coach streams its reply; 60 s is CloudFront's ceiling without a quota raise.
        origin_read_timeout = 60
      }
    }
  }

  default_cache_behavior {
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = var.default_allowed_methods
    cached_methods         = ["GET", "HEAD"]
    compress               = var.default_compress

    # A cache policy (prod uses Managed-CachingOptimized) or, when empty, the
    # legacy forwarded_values settings staging was created with.
    cache_policy_id = var.default_cache_policy_id != "" ? var.default_cache_policy_id : null

    dynamic "forwarded_values" {
      for_each = var.default_cache_policy_id != "" ? [] : [1]
      content {
        query_string = false
        cookies { forward = "none" }
      }
    }

    # SPA fallback on the S3 behaviour only. Distribution-wide custom_error_response rules
    # also rewrote the API's 403/404 into 200 + index.html, so the app never saw them.
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_fallback[0].arn
    }
  }

  # /api/* → gateway, pass-through. Use the same AWS managed policies as the prod
  # distribution: CachingDisabled (no caching) + AllViewer (forward every header,
  # cookie and query string to the origin, incl. Authorization). Guarantees the
  # API proxy behaves identically to prod.
  dynamic "ordered_cache_behavior" {
    for_each = var.api_origin_domain == "" ? [] : [1]
    content {
      path_pattern             = "/api/*"
      target_origin_id         = "ec2-api"
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed-CachingDisabled
      origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # Managed-AllViewer
    }
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  # With a custom domain: the validated us-east-1 ACM cert over SNI. Without one:
  # the default *.cloudfront.net certificate.
  viewer_certificate {
    cloudfront_default_certificate = local.use_custom_domain ? null : true
    acm_certificate_arn            = local.use_custom_domain ? aws_acm_certificate_validation.frontend[0].certificate_arn : null
    ssl_support_method             = local.use_custom_domain ? "sni-only" : null
    minimum_protocol_version       = local.use_custom_domain ? "TLSv1.2_2021" : null
  }

  tags = { Name = "${local.name}-frontend" }
}
