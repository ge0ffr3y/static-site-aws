#!/usr/bin/env bash
# Build the site, upload it to S3, and invalidate the CloudFront cache.
#
#   S3_BUCKET=my-bucket CLOUDFRONT_DISTRIBUTION_ID=E123ABC scripts/deploy.sh
#
# Both values come from `terraform output`. Credentials come from the usual AWS
# environment (AWS_PROFILE, environment variables, or an assumed role in CI).
#
#   DRY_RUN=1        show what would change without uploading or invalidating
#   CACHE_CONTROL    Cache-Control header for uploaded files (default: no-cache)
set -euo pipefail

: "${S3_BUCKET:?Set S3_BUCKET (see: terraform output bucket_name)}"
: "${CLOUDFRONT_DISTRIBUTION_ID:?Set CLOUDFRONT_DISTRIBUTION_ID (see: terraform output distribution_id)}"

CACHE_CONTROL="${CACHE_CONTROL:-no-cache}"
cd "$(dirname "$0")/.."

npm run build

sync_args=(--delete --cache-control "$CACHE_CONTROL")
if [ "${DRY_RUN:-0}" = "1" ]; then
  sync_args+=(--dryrun)
fi

# `sync` only uploads files whose size or timestamp changed, so a new CACHE_CONTROL
# value applies to changed files only.
aws s3 sync dist "s3://${S3_BUCKET}" "${sync_args[@]}"

if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "Dry run: nothing uploaded, cache not invalidated."
  exit 0
fi

aws cloudfront create-invalidation \
  --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" \
  --paths "/*" \
  --query 'Invalidation.{Id:Id,Status:Status}'
