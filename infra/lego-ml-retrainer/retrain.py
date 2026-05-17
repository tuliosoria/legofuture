"""Thin AWS Lambda handler that wraps ``lego-ml/retrain.py``'s ``main``.

The container image (see ``Dockerfile``) puts ``lego-ml/`` on ``PYTHONPATH``
so ``retrain`` resolves to the ML pipeline module. ``main()`` is expected to
return a dict with at least ``action``, ``samples_added``, and
``model_version`` keys (spec §9). Any unexpected exception is logged and
re-raised so EventBridge marks the invocation as failed and CloudWatch
alarms can fire.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("lego-ml-retrainer.handler")

# When running locally (outside the Lambda container) make sure the sibling
# ``lego-ml/`` directory is importable.
_REPO_ROOT = Path(__file__).resolve().parents[2]
_LEGO_ML_DIR = _REPO_ROOT / "lego-ml"
if _LEGO_ML_DIR.is_dir() and str(_LEGO_ML_DIR) not in sys.path:
    sys.path.insert(0, str(_LEGO_ML_DIR))


def _invoke_retrain_main() -> dict:
    import retrain as ml_retrain  # type: ignore[import-not-found]

    result = ml_retrain.main()
    if not isinstance(result, dict):
        result = {"action": "unknown", "samples_added": 0, "model_version": None}
    return {
        "action": result.get("action", "unknown"),
        "samples_added": int(result.get("samples_added", 0) or 0),
        "model_version": result.get("model_version"),
    }


def lambda_handler(event, context):  # noqa: ARG001 - Lambda signature
    log.info(
        "Starting lego-ml retrain (table=%s region=%s)",
        os.environ.get("DYNAMODB_TABLE"),
        os.environ.get("AWS_REGION"),
    )
    try:
        body = _invoke_retrain_main()
    except Exception:
        log.exception("lego-ml retrain failed")
        raise

    log.info("lego-ml retrain finished: %s", body)
    return {
        "statusCode": 200,
        "body": json.dumps(body, default=str),
    }
