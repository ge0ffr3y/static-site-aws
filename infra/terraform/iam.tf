# ---------------------------------------------------------------------------
# Deploy permissions: least privilege. Whoever deploys can write to this one bucket and
# invalidate this one distribution. Nothing else in the account is reachable.
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "deploy" {
  statement {
    sid       = "SyncObjects"
    actions   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
  }

  statement {
    sid       = "ListBucket"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.site.arn]
  }

  statement {
    sid       = "InvalidateCache"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.site.arn]
  }
}

resource "aws_iam_policy" "deploy" {
  name        = "${local.name}-deploy"
  description = "Deploy ${var.bucket_name}: sync objects and invalidate its CloudFront cache"
  policy      = data.aws_iam_policy_document.deploy.json
}

# --- Option 1: an IAM user for deploying from a laptop (off by default) -----------

resource "aws_iam_user" "deploy" {
  count = var.create_deploy_user ? 1 : 0

  name = "${local.name}-deploy"
}

resource "aws_iam_user_policy_attachment" "deploy" {
  count = var.create_deploy_user ? 1 : 0

  user       = aws_iam_user.deploy[0].name
  policy_arn = aws_iam_policy.deploy.arn
}

# --- Option 2: GitHub Actions through OIDC, with no long-lived keys ---------------

locals {
  github_enabled = var.github_repo != ""
}

resource "aws_iam_openid_connect_provider" "github" {
  count = local.github_enabled && var.create_github_oidc_provider ? 1 : 0

  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  # AWS no longer validates this for GitHub's provider, but older provider versions still
  # require a value.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

locals {
  github_oidc_provider_arn = local.github_enabled ? (
    var.create_github_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : var.github_oidc_provider_arn
  ) : ""
}

data "aws_iam_policy_document" "github_trust" {
  count = local.github_enabled ? 1 : 0

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.github_oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Only this repository, only this branch. GitHub puts either "repo:owner/name" or, for
    # repositories created with immutable subjects, "repo:owner@<id>/name@<id>" in the token.
    # By default both forms are accepted, with the numeric IDs wildcarded. Set
    # github_subject_prefix to pin the exact value.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = var.github_subject_prefix != "" ? [
        "${var.github_subject_prefix}:ref:refs/heads/${var.github_branch}",
        ] : [
        "repo:${var.github_repo}:ref:refs/heads/${var.github_branch}",
        "repo:${split("/", var.github_repo)[0]}@*/${split("/", var.github_repo)[1]}@*:ref:refs/heads/${var.github_branch}",
      ]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  count = local.github_enabled ? 1 : 0

  name               = "${local.name}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_trust[0].json
}

resource "aws_iam_role_policy_attachment" "github_deploy" {
  count = local.github_enabled ? 1 : 0

  role       = aws_iam_role.github_deploy[0].name
  policy_arn = aws_iam_policy.deploy.arn
}
