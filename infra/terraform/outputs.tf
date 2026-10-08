output "frontend_bucket" {
  description = "S3 bucket the SPA build is synced to (S3_BUCKET_STAGING in CI)"
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_website_endpoint" {
  description = "S3 website endpoint (CloudFront origin)"
  value       = aws_s3_bucket_website_configuration.frontend.website_endpoint
}

output "cloudfront_domain" {
  description = "CloudFront domain (null unless enable_cloudfront=true)"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.frontend[0].domain_name : null
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution id for cache invalidation (null unless enabled)"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.frontend[0].id : null
}

output "custom_domain_url" {
  description = "HTTPS URL on the custom domain (null unless custom_domain is set)"
  value       = local.use_custom_domain ? "https://${var.custom_domain}" : null
}
