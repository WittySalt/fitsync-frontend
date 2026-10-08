terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Same tfstate bucket as the other stacks, its own key and no workspaces. This
  # state holds only the prod domain pieces (certificate, validation records,
  # alias records); the hand-built prod distribution is never in any state.
  backend "s3" {
    bucket       = "fitsync-tfstate-437659978621"
    key          = "fitsync/frontend-prod-domain/terraform.tfstate"
    region       = "ap-southeast-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = local.tags
  }
}

# CloudFront only accepts ACM certificates issued in us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.tags
  }
}
