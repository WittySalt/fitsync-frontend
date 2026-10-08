locals {
  name       = "${var.project}-${var.env}"
  account_id = data.aws_caller_identity.current.account_id
}

locals {
  # The custom domain needs the distribution to attach to.
  use_custom_domain = var.enable_cloudfront && var.custom_domain != ""
}
