#!/usr/bin/env bash
# Upload the static build (make static) to an S3 bucket configured for static website hosting.
# Usage: scripts/deploy_s3.sh <bucket-name> [aws-region]
set -euo pipefail
BUCKET="${1:?usage: scripts/deploy_s3.sh <bucket-name> [region]}"
REGION="${2:-${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}}"
DIST="$(cd "$(dirname "$0")/.." && pwd)/frontend/dist"

test -f "$DIST/index.html" || { echo "No build found in $DIST. Run 'make static' first."; exit 1; }
test -d "$DIST/demo-data" || { echo "No demo-data in $DIST. Run 'make static' (not 'make build')."; exit 1; }

# Hashed JS/CSS bundles never change: cache for a year.
aws s3 sync "$DIST/assets" "s3://$BUCKET/assets" --region "$REGION" --delete \
  --cache-control "public,max-age=31536000,immutable"
# Data snapshot: cache for 5 minutes.
aws s3 sync "$DIST/demo-data" "s3://$BUCKET/demo-data" --region "$REGION" --delete \
  --cache-control "public,max-age=300"
# Everything else (favicon, etc.) except index.html.
aws s3 sync "$DIST" "s3://$BUCKET" --region "$REGION" --delete \
  --exclude "assets/*" --exclude "demo-data/*" --exclude "index.html" --cache-control "public,max-age=300"
# index.html last, never cached, so visitors always pick up the newest bundle names.
aws s3 cp "$DIST/index.html" "s3://$BUCKET/index.html" --region "$REGION" \
  --cache-control "no-cache,no-store,must-revalidate" --content-type "text/html; charset=utf-8"

case "$REGION" in
  us-east-1|us-west-1|us-west-2|eu-west-1|ap-southeast-1|ap-southeast-2|ap-northeast-1|sa-east-1|us-gov-west-1)
    echo "Deployed: http://$BUCKET.s3-website-$REGION.amazonaws.com" ;;
  *) echo "Deployed: http://$BUCKET.s3-website.$REGION.amazonaws.com" ;;
esac
