locals {
  name       = "${var.project}-${var.env}"
  account_id = data.aws_caller_identity.current.account_id

  bucket_name = var.bucket_name != "" ? var.bucket_name : "${local.name}-frontend-${local.account_id}"
  s3_via_oac  = var.s3_origin_type == "oac"
}

locals {
  # The custom domain needs the distribution to attach to.
  use_custom_domain = var.enable_cloudfront && var.custom_domain != ""

  # Every hostname on the distribution and the certificate, primary first.
  hostnames = local.use_custom_domain ? concat([var.custom_domain], var.alternative_names) : []

  # One A and one AAAA record per hostname. The primary keeps the bare "A"/"AAAA"
  # keys staging was created with; further names are keyed "www.example.com/A".
  alias_records = local.use_custom_domain ? merge(
    { for t in ["A", "AAAA"] : t => { name = var.custom_domain, type = t } },
    {
      for pair in setproduct(var.alternative_names, ["A", "AAAA"]) :
      "${pair[0]}/${pair[1]}" => { name = pair[0], type = pair[1] }
    }
  ) : {}
}
