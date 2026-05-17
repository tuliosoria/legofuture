# LegoFuture ML retrainer — AWS Lambda container image.
# Base image bundles the Lambda Runtime Interface Client for Python 3.11.
FROM public.ecr.aws/lambda/python:3.11

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DYNAMODB_TABLE=legofuture-cache \
    AWS_REGION=us-east-1

# Install Python dependencies first for better layer caching.
COPY lego-ml/requirements.txt ${LAMBDA_TASK_ROOT}/lego-ml/requirements.txt
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/lego-ml/requirements.txt

# Copy the ML pipeline source.
COPY lego-ml/ ${LAMBDA_TASK_ROOT}/lego-ml/

# Copy the thin Lambda handler.
COPY infra/lego-ml-retrainer/retrain.py ${LAMBDA_TASK_ROOT}/retrain.py

# Make lego-ml importable as a top-level package path.
ENV PYTHONPATH=${LAMBDA_TASK_ROOT}/lego-ml:${LAMBDA_TASK_ROOT}

CMD ["retrain.lambda_handler"]
