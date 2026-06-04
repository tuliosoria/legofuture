# LegoFuture ML retrainer — AWS Lambda container image.
# Base image: Python 3.12 on Amazon Linux 2023 (glibc 2.34) so the modern
# manylinux_2_28 wheels for xgboost / numpy / pandas install cleanly
# without falling back to source builds.
FROM public.ecr.aws/lambda/python:3.12

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DYNAMODB_TABLE=legofuture-cache \
    AWS_REGION=us-east-1

# Install Python dependencies first for better layer caching.
COPY lego-ml/requirements.txt ${LAMBDA_TASK_ROOT}/lego-ml/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/lego-ml/requirements.txt

# Copy the ML pipeline source.
COPY lego-ml/ ${LAMBDA_TASK_ROOT}/lego-ml/

# Copy the thin Lambda handler.
COPY infra/lego-ml-retrainer/retrain.py ${LAMBDA_TASK_ROOT}/retrain.py

# Make lego-ml importable as a top-level package path.
ENV PYTHONPATH=${LAMBDA_TASK_ROOT}/lego-ml:${LAMBDA_TASK_ROOT}

CMD ["retrain.lambda_handler"]
