output "bucket_name" {
  description = "Name of the S3 bucket. Use as S3_BUCKET when deploying."
  value       = aws_s3_bucket.site.bucket
}

output "distribution_id" {
  description = "CloudFront distribution ID. Use as CLOUDFRONT_DISTRIBUTION_ID when deploying."
  value       = aws_cloudfront_distribution.site.id
}

output "site_url" {
  description = "Where the site is served."
  value       = local.use_custom_domain ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "deploy_policy_arn" {
  description = "Least-privilege deploy policy. Attach it to any principal that should be able to deploy."
  value       = aws_iam_policy.deploy.arn
}

output "github_deploy_role_arn" {
  description = "Role for GitHub Actions to assume. Save it as the AWS_DEPLOY_ROLE_ARN repository variable."
  value       = local.github_enabled ? aws_iam_role.github_deploy[0].arn : null
}
