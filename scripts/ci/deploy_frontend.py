#!/usr/bin/env python3
"""Deploy Bricks main using temporary OIDC credentials, without blind retries."""
import json
import os
import re
import subprocess
import sys
import time
import urllib.request

APP = 'd2lnw5t0h096c1'
BRANCH = 'main'
REGION = 'us-east-1'
LIVE = 'https://bricksfuture.com/deployment.json'
ACTIVE = {'PENDING', 'PROVISIONING', 'RUNNING', 'CANCELLING'}
QUERIES = {'get-branch': 'branch.{enableAutoBuild:enableAutoBuild}',
           'list-jobs': 'jobSummaries', 'start-job': 'jobSummary', 'get-job': 'job.summary'}


def aws(operation, **params):
    command = ['aws', 'amplify', operation, '--region', REGION, '--app-id', APP,
               '--branch-name', BRANCH, '--output', 'json', '--no-cli-pager',
               '--query', QUERIES[operation]]
    for key, value in params.items():
        command.extend(['--'+key.replace('_', '-'), str(value)])
    if operation == 'list-jobs':
        command.extend(['--page-size', '50', '--max-items', '50'])
    # StartJob has no idempotency key: a timeout must never cause an automatic retry.
    env = {**os.environ, 'AWS_MAX_ATTEMPTS': '1', 'AWS_RETRY_MODE': 'standard'}
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=30, env=env, check=True)
        return json.loads(result.stdout)
    except (subprocess.SubprocessError, ValueError) as exc:
        code = 'local-error'
        if isinstance(exc, subprocess.CalledProcessError):
            match = re.search(r'An error occurred \(([A-Za-z0-9_.-]{1,80})\)', exc.stderr or '')
            code = match.group(1) if match else f'cli-exit-{exc.returncode}'
        elif isinstance(exc, subprocess.TimeoutExpired):
            code = 'timeout'
        raise RuntimeError(f'{operation} failed ({code}) or outcome uncertain; inspect Amplify jobs before retrying') from exc


def remote_head():
    result = subprocess.run(['git', 'ls-remote', 'origin', 'refs/heads/main'], capture_output=True,
                            text=True, timeout=30, check=True)
    fields = result.stdout.split()
    return fields[0] if fields else ''


def live_commit():
    request = urllib.request.Request(LIVE+'?verify='+str(time.time_ns()), headers={'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.loads(response.read(4096)).get('commit')


def deploy(expected, call=aws, head=remote_head, live=live_commit, sleep=time.sleep, clock=time.monotonic):
    if not re.fullmatch(r'[0-9a-f]{40}', expected):
        raise RuntimeError('Expected full Git commit SHA')
    branch = call('get-branch')
    if branch.get('enableAutoBuild') is not False:
        raise RuntimeError('Amplify autobuild not confirmed disabled; refuse competing release')
    jobs = call('list-jobs')
    active = [job for job in jobs if job.get('status') in ACTIVE]
    if len(active) > 1 or any(job.get('commitId') != expected for job in active):
        raise RuntimeError('Amplify has another active job; inspect it before retrying')
    if head() != expected:
        raise RuntimeError('main moved after validation; newest workflow must deploy instead')
    # Only latest success is reusable; an older matching commit may have been superseded.
    previous = jobs[0] if jobs and jobs[0].get('status') == 'SUCCEED' and jobs[0].get('commitId') == expected else None
    job = active[0] if active else previous
    if job is None:
        # RELEASE selects latest branch. commitId is also checked after start and during polling.
        job = call('start-job', job_type='RELEASE', commit_id=expected,
                   job_reason='GitHub validated main '+expected)
    job_id = job.get('jobId')
    if not job_id or not str(job_id).isdigit():
        raise RuntimeError('Missing Amplify job id; inspect jobs before retrying')
    deadline = clock() + 720
    while True:
        if job.get('commitId') != expected:
            raise RuntimeError('Amplify commit mismatch; inspect live deployment (no automatic stop/retry)')
        status = job.get('status')
        print(f'Amplify job {job_id}: {status}', flush=True)
        if status == 'SUCCEED':
            break
        if status not in ACTIVE:
            raise RuntimeError(f'Amplify ended with {status}')
        if clock() >= deadline:
            raise RuntimeError(f'Polling deadline reached; job {job_id} may still run. Inspect before retrying')
        sleep(10)
        job = call('get-job', job_id=job_id)
    for attempt in range(6):
        try:
            if live() == expected:
                return str(job_id)
        except (OSError, ValueError):
            pass
        if attempt < 5:
            sleep(10)
    raise RuntimeError('Amplify succeeded but live provenance does not match; no redeploy attempted')


if __name__ == '__main__':
    try:
        sha = os.environ['GITHUB_SHA']
        job_id = deploy(sha)
        with open(os.environ.get('GITHUB_STEP_SUMMARY', os.devnull), 'a') as summary:
            summary.write(f'BricksFuture published and live commit verified: `{sha}`, Amplify job `{job_id}`.\n')
    except Exception as exc:
        # Never print full AWS payloads (GetJob can contain signed URLs).
        print(f'::error::{exc}', file=sys.stderr)
        sys.exit(1)
