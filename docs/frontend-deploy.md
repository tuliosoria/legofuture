# BricksFuture frontend deployment (no permanent AWS key)

The `Frontend — validated OIDC deploy` workflow runs on pushes to `main` or manual dispatch of `main`. It first installs locked dependencies and passes Python guard tests plus lint, full tests and production build. Only the separate deploy job requests an AWS session, limited to 900 seconds.

Role: `github-actions-legofuture-frontend-deploy`. Trust is the GitHub `main` subject for `tuliosoria/legofuture`, audience `sts.amazonaws.com`. No environment is set on the job because that would change the OIDC subject. Permissions are only Amplify StartJob/GetJob for this app's main jobs, plus ListJobs/GetBranch on main. It cannot change IAM, read pricing data, read secrets, alter the Amplify service role, or stop jobs. Runtime and price-refresh roles are separate and unchanged.

## Claude / developer terminal

Use the existing GitHub authentication, not `aws configure`, an admin session, or a shared permanent key:

```sh
gh workflow run frontend-deploy.yml --repo tuliosoria/legofuture --ref main
gh run list --repo tuliosoria/legofuture --workflow frontend-deploy.yml --limit 5
gh run watch RUN_ID --repo tuliosoria/legofuture --exit-status
```

A push to main already queues this workflow, so do not also dispatch unless checking/recovering an existing run. Do not run the script locally with another AWS profile; the normal path is GitHub's short-lived role.

## Safety and evidence

- Workflow concurrency does not cancel a running deploy. GitHub may replace older pending runs with a newer one; only the current main SHA is eligible at release time.
- Amplify autobuild must remain off. The script refuses a competing active job from another SHA and resumes a matching job without starting another.
- StartJob is attempted once, with AWS retries disabled. A timeout can mean AWS accepted the release: inspect jobs; do not blindly issue another StartJob.
- `RELEASE` selects the latest branch change. AWS's commitId field is not documented as a hard pin. The script compares remote main immediately before release, passes the tested commitId and checks every returned job SHA. An external push in the narrow release window cannot be prevented by these permissions; mismatches fail loudly and need inspection, not a claim of success. No automatic rollback/StopJob is attempted.
- Amplify writes `/deployment.json` from the actual Git checkout SHA; it contains only service name and public commit. After success, the workflow polls this live file and requires exact match. Job status alone is insufficient proof of publication.
- Failure or 12-minute polling deadline leaves a clear job identifier; a job may still be running. Inspect it before rerunning.
- Manual rebuilds using AWS_COMMIT_ID=HEAD use the actual checkout SHA, not the word HEAD.

## Initial acceptance

Merge only after owner/coordinator approval. The first main run tests real OIDC trust; do not trigger a separate console deployment in parallel. Confirm both successful job SHA and live `/deployment.json` before declaring the pathway operational.

References: [Amplify StartJob](https://docs.aws.amazon.com/amplify/latest/APIReference/API_StartJob.html), [Amplify build variables](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html).
