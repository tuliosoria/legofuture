#!/usr/bin/env node
/**
 * scripts/deploy-amplify-compute.mjs
 *
 * Manual deploy to Amplify Hosting Compute (WEB_COMPUTE).
 *
 * Builds the .amplify-hosting/ deployment bundle layout from a Next.js
 * standalone build, zips it, and uploads it via the create-deployment
 * + start-deployment Amplify API flow.
 *
 * Usage:
 *   APP_ID=d2lnw5t0h096c1 BRANCH=main node scripts/deploy-amplify-compute.mjs
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, rmSync, cpSync, writeFileSync, readFileSync, createReadStream, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const STAGE = join(ROOT, ".amplify-hosting");
const COMPUTE = join(STAGE, "compute", "default");
const STATIC_DIR = join(STAGE, "static");
const MANIFEST = join(STAGE, "deploy-manifest.json");
const ZIP_PATH = join(ROOT, "amplify-deploy.zip");

const APP_ID = process.env.APP_ID;
const BRANCH = process.env.BRANCH || "main";
const REGION = process.env.AMPLIFY_REGION || "us-east-1";

if (!APP_ID) {
  console.error("❌ APP_ID env var is required");
  process.exit(1);
}

const SRC_STANDALONE = join(ROOT, ".next", "standalone");
const SRC_STATIC = join(ROOT, ".next", "static");
const SRC_PUBLIC = join(ROOT, "public");

if (!existsSync(SRC_STANDALONE)) {
  console.error("❌ .next/standalone missing — run `npm run build` first");
  process.exit(1);
}

console.log("🧹 Cleaning stage dirs…");
rmSync(STAGE, { recursive: true, force: true });
rmSync(ZIP_PATH, { force: true });

console.log("📦 Assembling compute/default…");
mkdirSync(COMPUTE, { recursive: true });
cpSync(SRC_STANDALONE, COMPUTE, { recursive: true });
mkdirSync(join(COMPUTE, ".next", "static"), { recursive: true });
cpSync(SRC_STATIC, join(COMPUTE, ".next", "static"), { recursive: true });
if (existsSync(SRC_PUBLIC)) {
  cpSync(SRC_PUBLIC, join(COMPUTE, "public"), { recursive: true });
}

console.log("🖼️  Assembling static/…");
mkdirSync(STATIC_DIR, { recursive: true });
mkdirSync(join(STATIC_DIR, "_next", "static"), { recursive: true });
cpSync(SRC_STATIC, join(STATIC_DIR, "_next", "static"), { recursive: true });
if (existsSync(SRC_PUBLIC)) {
  cpSync(SRC_PUBLIC, STATIC_DIR, { recursive: true });
}

console.log("📝 Writing deploy-manifest.json…");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const manifest = {
  version: 1,
  framework: {
    name: "next-js",
    version: pkg.dependencies?.next?.replace(/^[^\d]*/, "") || "16.0.0",
  },
  imageSettings: {
    sizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    domains: [],
    remotePatterns: [],
    formats: ["image/webp"],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: false,
  },
  routes: [
    { path: "/_next/static/*", target: { kind: "Static", cacheControl: "public, max-age=31536000, immutable" } },
    { path: "/_next/image*", target: { kind: "ImageOptimization", cacheControl: "public, max-age=3600, immutable" }, fallback: { kind: "Static", cacheControl: "public, max-age=3600, immutable" } },
    { path: "/api/*", target: { kind: "Compute", src: "default" } },
    { path: "/*.*", target: { kind: "Static", cacheControl: "public, max-age=2" }, fallback: { kind: "Compute", src: "default" } },
    { path: "/*", target: { kind: "Compute", src: "default" }, fallback: { kind: "Static", cacheControl: "public, max-age=2" } },
  ],
  computeResources: [
    { name: "default", runtime: "nodejs20.x", entrypoint: "server.js" },
  ],
};
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

console.log("🗜️  Zipping bundle…");
execSync(`cd "${STAGE}" && zip -rq "${ZIP_PATH}" . -x "*.DS_Store"`, { stdio: "inherit" });
const zipSize = statSync(ZIP_PATH).size;
console.log(`   → ${(zipSize / 1024 / 1024).toFixed(1)} MB`);

console.log(`🚀 create-deployment ${APP_ID}/${BRANCH}…`);
const createOut = execSync(
  `aws amplify create-deployment --app-id ${APP_ID} --branch-name ${BRANCH} --region ${REGION} --output json`,
  { encoding: "utf8" }
);
const { jobId, zipUploadUrl } = JSON.parse(createOut);
console.log(`   → jobId=${jobId}`);

console.log("📤 Uploading zip via presigned URL…");
await new Promise((resolve, reject) => {
  const url = new URL(zipUploadUrl);
  const req = https.request(
    {
      method: "PUT",
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: { "Content-Length": zipSize, "Content-Type": "application/zip" },
    },
    (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`PUT failed ${res.statusCode}: ${body}`));
        }
      });
    }
  );
  req.on("error", reject);
  createReadStream(ZIP_PATH).pipe(req);
});

console.log(`▶️  start-deployment jobId=${jobId}…`);
execSync(
  `aws amplify start-deployment --app-id ${APP_ID} --branch-name ${BRANCH} --job-id ${jobId} --region ${REGION} --output json`,
  { stdio: "inherit" }
);

console.log("⏳ Polling job status…");
const start = Date.now();
while (true) {
  const out = execSync(
    `aws amplify get-job --app-id ${APP_ID} --branch-name ${BRANCH} --job-id ${jobId} --region ${REGION} --query 'job.summary.status' --output text`,
    { encoding: "utf8" }
  ).trim();
  const elapsed = Math.floor((Date.now() - start) / 1000);
  process.stdout.write(`   [${elapsed}s] ${out}\r`);
  if (out === "SUCCEED") {
    console.log("\n✅ Deployed.");
    break;
  }
  if (out === "FAILED" || out === "CANCELLED") {
    console.error("\n❌ Deployment failed");
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 5000));
}
