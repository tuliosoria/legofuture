import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function provenance(commit, declaredCommit) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Expected full checked-out Git SHA');
  // Amplify documents AWS_COMMIT_ID=HEAD for rebuilds; actual checkout wins.
  if (declaredCommit && declaredCommit !== 'HEAD' && declaredCommit !== commit) {
    throw new Error('Amplify commit and checked-out commit differ');
  }
  return { service: 'legofuture', commit };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  mkdirSync('public', { recursive: true });
  writeFileSync('public/deployment.json', JSON.stringify(provenance(commit, process.env.AWS_COMMIT_ID))+'\n');
}
