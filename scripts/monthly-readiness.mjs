#!/usr/bin/env node
// Offline preflight only. Does not load .env, call providers or write a database.
// Node 22.18+ supports this TypeScript import without a build step.
import { getMonthlyReadiness } from '../src/lib/domain/monthly-readiness.ts';
console.log(JSON.stringify(getMonthlyReadiness(), null, 2));
// A blocked job must never look like a successful price update to an operator.
process.exitCode = 2;
