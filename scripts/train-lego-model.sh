#!/usr/bin/env bash
# scripts/train-lego-model.sh
#
# Wrapper: trains LEGO forecast models (1y, 3y, 5y) via Plan B XGBoost pipeline,
# writes JSON tree artifacts to models/, and optionally uploads to DynamoDB.
#
# Required environment variables (load from .env.local automatically via python-dotenv):
#   DYNAMODB_TABLE   DynamoDB table name (default: legofuture-cache)
#   AWS_REGION       AWS region          (default: us-east-1)
#   AWS_PROFILE      (optional) named AWS profile
#
# Usage:
#   bash scripts/train-lego-model.sh               # train only, write to models/
#   UPLOAD_TO_DDB=1 bash scripts/train-lego-model.sh  # train + upload to DDB
#
# npm shortcut:
#   npm run train:lego

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODELS_DIR="${REPO_ROOT}/models"
UPLOAD_FLAG=""

if [[ "${UPLOAD_TO_DDB:-}" == "1" ]]; then
  UPLOAD_FLAG="--upload-to-ddb --use-ddb"
  echo "[train-lego-model] Mode: train + upload to DDB (table=${DYNAMODB_TABLE:-legofuture-cache})"
else
  echo "[train-lego-model] Mode: train only (output: ${MODELS_DIR}/)"
fi

mkdir -p "${MODELS_DIR}"

for HORIZON in 1y 3y 5y; do
  echo ""
  echo "[train-lego-model] === Training horizon=${HORIZON} ==="
  python3 "${REPO_ROOT}/lego-ml/train.py" \
    --horizon "${HORIZON}" \
    --output "${MODELS_DIR}/" \
    ${UPLOAD_FLAG}
  echo "[train-lego-model] === Done: horizon=${HORIZON} ==="
done

echo ""
echo "[train-lego-model] All horizons complete."
echo "  Models written to: ${MODELS_DIR}/"
if [[ "${UPLOAD_TO_DDB:-}" == "1" ]]; then
  echo "  Verify DDB upload:"
  echo "    aws dynamodb query --table-name \${DYNAMODB_TABLE:-legofuture-cache} \\"
  echo "      --key-condition-expression 'pk = :pk' \\"
  echo "      --expression-attribute-values '{\":pk\":{\"S\":\"MODEL#FORECAST#5y\"}}'"
fi
