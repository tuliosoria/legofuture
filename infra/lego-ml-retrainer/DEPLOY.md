# Deploying the LegoFuture ML retrainer

Task 14 of the real-data activation plan. **Manual gate** — requires a
container runtime (Docker / Podman / OrbStack / Colima) and AWS credentials
with permission to create Lambda functions, IAM roles, ECR repositories,
and EventBridge schedules in `us-east-1`.

## Prerequisites

```bash
# 1. SAM CLI (installed via Homebrew on macOS)
brew install aws-sam-cli
sam --version  # expect >= 1.160

# 2. A container runtime that exposes a Docker-compatible socket.
#    Any of:
brew install --cask docker     # Docker Desktop
brew install colima && colima start
brew install --cask orbstack
# Verify:
docker version

# 3. AWS credentials with admin (or scoped IAM/Lambda/ECR/Events) access
aws sts get-caller-identity  # expect Account=825081952316
```

## First-time deploy

From the repo root:

```bash
# 1. Build the container image and SAM artifacts. Reads Dockerfile, builds
#    the image locally, packages template.yaml.
npm run infra:build

# 2. Guided deploy: SAM prompts for stack name (suggest: legofuture-ml-retrainer),
#    region (us-east-1), IAM-role confirmation (yes), and ECR repo (let SAM
#    create one).  Saves answers to samconfig.toml for subsequent deploys.
npm run infra:deploy
```

Expected resources after `CREATE_COMPLETE`:

- Lambda function `legofuture-ml-retrainer` (PackageType=Image, 2048MB, 900s timeout)
- IAM role `legofuture-ml-retrainer-RetrainerFunctionRole-…` with DDB read/write to `legofuture-cache`
- EventBridge rule `legofuture-ml-retrainer-weekly` firing `rate(7 days)`
- ECR repository created by SAM holding the built image

## Verifying the deploy

```bash
# 3. Smoke-test the function with an empty payload.
npm run infra:invoke

# Expected response.json:
# { "statusCode": 200, "body": "{\"action\":\"trained\",\"samples_added\":20,\"model_version\":\"2026-XX-XXTXXZ\"}" }

# 4. Confirm META#LAST_MODEL_TRAIN got refreshed by the Lambda run.
aws dynamodb get-item \
  --region us-east-1 \
  --table-name legofuture-cache \
  --key '{"pk":{"S":"META"},"sk":{"S":"LAST_MODEL_TRAIN"}}' \
  --query "Item.{timestamp:timestamp.S,sampleCount:sampleCount.N}" \
  --output table

# 5. Confirm the EventBridge schedule shows a next-trigger time.
aws events describe-rule \
  --region us-east-1 \
  --name legofuture-ml-retrainer-weekly \
  --query "{Schedule:ScheduleExpression,State:State}" \
  --output table
```

## Subsequent deploys (after code changes)

```bash
npm run infra:build && npm run infra:deploy:ci
```

The `:ci` variant skips the change-set confirmation prompt and tolerates
empty change-sets (useful in CI). For manual deploys with a review prompt,
use `npm run infra:deploy` instead.

## Teardown

```bash
aws cloudformation delete-stack \
  --region us-east-1 \
  --stack-name legofuture-ml-retrainer
```

ECR repo and image are not deleted by `delete-stack`; clean those up via
`aws ecr delete-repository --force` if you want a clean slate.

## Notes

- The template targets `arm64`. The Python wheels for `xgboost` / `numpy`
  / `pandas` all ship `manylinux_aarch64` builds, and AWS Lambda arm64
  runs are ~20% cheaper than x86_64. If you're deploying from an x86_64
  host (Linux server or Intel Mac) switch `Architectures` to `x86_64`
  in `template.yaml`.
- `lego-ml/train.py` and `lego-ml/retrain.py` both read DDB via the same
  credentials chain. The Lambda role grants table-scoped DDB access only,
  no public-internet or cross-account permissions.
- The image bakes in `lego-ml/requirements.txt` (xgboost, pandas, numpy,
  boto3, scikit-learn). Image size lands ~700 MB; cold start ~6–8 s with
  2048 MB memory.
