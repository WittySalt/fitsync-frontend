terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state in the SAME S3 bucket as the backend infra, but a SEPARATE key,
  # so the frontend has its own isolated state (blast radius: changing the SPA
  # bucket/CloudFront never touches backend VPC/EC2/RDS, and vice-versa).
  # Native S3 locking (use_lockfile). Workspaces: s3://<bucket>/env:/<workspace>/<key>.
  backend "s3" {
    bucket       = "fitsync-tfstate-437659978621"
    key          = "fitsync/frontend/terraform.tfstate"
    region       = "ap-southeast-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = var.project
      Env       = var.env
      Component = "frontend"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
