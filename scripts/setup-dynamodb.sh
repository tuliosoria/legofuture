#!/usr/bin/env bash
#
# scripts/setup-dynamodb.sh
#
# Provisions the legofuture-cache DynamoDB table (single-table, on-demand).
# Idempotent — safe to run repeatedly.
#
# Usage:
#   AWS_REGION=us-east-1 DYNAMODB_TABLE=legofuture-cache \
#     bash scripts/setup-dynamodb.sh

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
DYNAMODB_TABLE="${DYNAMODB_TABLE:-legofuture-cache}"

if ! command -v aws >/dev/null 2>&1; then
  echo "❌ aws CLI not found. Install AWS CLI v2." >&2
  exit 1
fi

set +e
DESCRIBE_OUTPUT=$(aws dynamodb describe-table \
  --table-name "$DYNAMODB_TABLE" \
  --region "$AWS_REGION" 2>&1)
DESCRIBE_EXIT=$?
set -e

if [ $DESCRIBE_EXIT -eq 0 ]; then
  echo "✅ Table $DYNAMODB_TABLE already exists in $AWS_REGION"
  exit 0
fi

if echo "$DESCRIBE_OUTPUT" | grep -q "ResourceNotFoundException"; then
  echo "ℹ️  Table $DYNAMODB_TABLE not found in $AWS_REGION — creating..."

  aws dynamodb create-table \
    --table-name "$DYNAMODB_TABLE" \
    --region "$AWS_REGION" \
    --attribute-definitions \
      AttributeName=pk,AttributeType=S \
      AttributeName=sk,AttributeType=S \
    --key-schema \
      AttributeName=pk,KeyType=HASH \
      AttributeName=sk,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --tags Key=Project,Value=LegoFuture Key=ManagedBy,Value=setup-dynamodb.sh \
    >/dev/null

  aws dynamodb wait table-exists \
    --table-name "$DYNAMODB_TABLE" \
    --region "$AWS_REGION"

  echo "✅ Created table $DYNAMODB_TABLE"
  exit 0
fi

echo "❌ Unexpected error from aws dynamodb describe-table (exit $DESCRIBE_EXIT):" >&2
echo "$DESCRIBE_OUTPUT" >&2
exit "$DESCRIBE_EXIT"
