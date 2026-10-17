variable "aws_region" {
  description = "Region for the S3 bucket."
  type        = string
  default     = "us-west-2"
}

variable "bucket_name" {
  description = "Globally unique name for the private S3 bucket that holds the site."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.bucket_name))
    error_message = "bucket_name must be 3-63 characters: lowercase letters, numbers, dots, and hyphens."
  }
}

variable "domain_name" {
  description = "Custom domain to serve the site from (for example www.example.com). Leave empty to use the CloudFront domain."
  type        = string
  default     = ""
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID for domain_name. Required when domain_name is set; used for certificate validation and the DNS records."
  type        = string
  default     = ""
}

variable "price_class" {
  description = "CloudFront price class. PriceClass_100 covers North America and Europe and is the cheapest."
  type        = string
  default     = "PriceClass_100"
}

variable "create_deploy_user" {
  description = "Create an IAM user for deploying from a laptop. Terraform does not create access keys for it; create them yourself so they never land in Terraform state."
  type        = bool
  default     = false
}

variable "github_repo" {
  description = "GitHub repository (owner/name) allowed to deploy through OIDC. Leave empty to skip creating the deploy role."
  type        = string
  default     = ""
}

variable "github_branch" {
  description = "Branch that is allowed to assume the deploy role."
  type        = string
  default     = "main"
}

variable "create_github_oidc_provider" {
  description = "Create the GitHub OIDC identity provider. An AWS account can only have one, so set this to false and pass github_oidc_provider_arn if it already exists."
  type        = bool
  default     = true
}

variable "github_oidc_provider_arn" {
  description = "ARN of an existing GitHub OIDC provider. Only used when create_github_oidc_provider is false."
  type        = string
  default     = ""
}
