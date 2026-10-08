# ── S3: frontend SPA bucket (origin for CloudFront) ──────────────────────────
# Resource addresses are kept IDENTICAL to the backend's previous definitions so
# the one-time state migration is a clean `state rm` (backend) + `import`
# (here) with no rename. See RUNBOOK.md.
resource "aws_s3_bucket" "frontend" {
  bucket = "${local.name}-frontend-${local.account_id}"
  tags   = { Name = "${local.name}-frontend" }
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document { suffix = "index.html" }
  # SPA: route 404s back to index so Angular's client router handles them.
  error_document { key = "index.html" }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "frontend_public_read" {
  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({
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
}

# ── CloudFront for the SPA (flagged: slow to deploy) ─────────────────────────
resource "aws_cloudfront_distribution" "frontend" {
  count   = var.enable_cloudfront ? 1 : 0
  enabled = true
  comment = "${local.name}-frontend"

  default_root_object = "index.html"

  origin {
    domain_name = aws_s3_bucket_website_configuration.frontend.website_endpoint
    origin_id   = "s3-frontend"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # API origin: proxy /api/* to the backend ALB (:80), which forwards to the gateway.
  # Lets the SPA keep using same-origin relative /api over HTTPS, like the prod dist.
  dynamic "origin" {
    for_each = var.api_origin_domain == "" ? [] : [1]
    content {
      domain_name = var.api_origin_domain
      # The id dates from when /api went straight to the EC2 gateway; it is only a label,
      # kept as is so the live distribution is not rewritten for a rename.
      origin_id   = "ec2-api"

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
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
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

  # SPA fallback: serve index.html for client-routed paths.
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = { Name = "${local.name}-frontend" }
}
