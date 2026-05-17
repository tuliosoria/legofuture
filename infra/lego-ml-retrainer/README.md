# LegoFuture ML retrainer — AWS infrastructure

Container-image AWS Lambda that runs the `lego-ml/` training pipeline on a
weekly EventBridge schedule (spec §9).

## Components

- **Lambda function** (`legofuture-ml-retrainer`) — packaged as a Docker
  container image (Python 3.11 base, `lego-ml/requirements.txt`
  installed). 2048 MB memory, 15 min timeout.
- **EventBridge rule** — `rate(7 days)`; invokes the function with an
  empty payload.
- **IAM role** — read/write on the `legofuture-cache` DynamoDB table only.

## Files

| File | Purpose |
| --- | --- |
| `Dockerfile` | Lambda container image (`public.ecr.aws/lambda/python:3.11`). |
| `retrain.py` | Thin handler that imports and calls `lego-ml/retrain.py`'s `main()`. |
| `template.yaml` | AWS SAM template (Lambda + Schedule + IAM). |

## Required environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `DYNAMODB_TABLE` | `legofuture-cache` | Set on the Lambda by `template.yaml`. |
| `AWS_REGION` | `us-east-1` | Provided by the Lambda runtime; deploy in `us-east-1`. |

## Prerequisites

- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- Docker (running locally, used by `sam build`)
- AWS credentials with permission to create Lambda functions, IAM roles,
  EventBridge rules, and an ECR repository for the container image.

## First-time deploy

```sh
cd infra/lego-ml-retrainer
sam build
sam deploy --guided
```

`--guided` walks you through stack name (suggested:
`legofuture-ml-retrainer`), region (`us-east-1`), and creates the managed
ECR repository SAM uses for image-based Lambdas. Answers are saved to
`samconfig.toml`.

## Subsequent deploys

```sh
cd infra/lego-ml-retrainer
sam build
sam deploy
```

From the repo root you can also run:

```sh
npm run infra:build
```

## Validating the template

```sh
sam validate --lint
# or, without SAM CLI:
cfn-lint infra/lego-ml-retrainer/template.yaml
```

## Manually triggering a run

```sh
aws lambda invoke \
  --function-name legofuture-ml-retrainer \
  --region us-east-1 \
  out.json
```

The function returns `{ statusCode, body: { action, samples_added, model_version } }`.
