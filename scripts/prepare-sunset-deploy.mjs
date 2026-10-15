#!/usr/bin/env node
/** LOCAL ONLY. Assembles an audited Amplify layout; no AWS API, upload or deployment. */
import {cpSync,existsSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const forbiddenContent = /pricecharting\.com|["']?proj5y["']?\s*:|medianSoldPrice|avgSoldPrice|learner_model_param|gradient_booster|lego-forecast\.retained|lego-search\.retained|lego-forecast-[135]y\.json/;
function files(root) {
 if(!existsSync(root)) return [];
 return readdirSync(root,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(root,entry.name)):entry.isFile()?[join(root,entry.name)]:[]);
}
export function auditSunsetBuild(root) {
 const server=join(root,'.next/standalone/.next/server');
 for(const file of [...files(server),...files(join(root,'.next/static'))]) {
  if(!/\.(js|json|html|rsc|txt|css|map)$/.test(file)) continue;
  if(forbiddenContent.test(readFileSync(file,'utf8'))) throw new Error(`retained content in release build: ${relative(root,file)}`);
 }
 const fonts=files(join(root,'.next/static/media')).filter(file=>file.endsWith('.woff2'));
 if(!fonts.length || fonts.some(file=>statSync(file).size<1000 || readFileSync(file).subarray(0,4).toString()!=='wOF2')) throw new Error('real WOFF2 font assets required; mock-font builds cannot be staged');
 return {fontFiles:fonts.length,appFiles:files(server).length};
}
export function prepareSunsetDeploy(root=process.cwd()) {
 root=resolve(root);
 const audit=auditSunsetBuild(root);
 const standalone=join(root,'.next/standalone');
 if(!existsSync(join(standalone,'server.js'))) throw new Error('standalone server missing');
 const stage=mkdtempSync(join(root,'.sunset-deploy-'));
 const compute=join(stage,'compute/default');
 mkdirSync(compute,{recursive:true});
 cpSync(standalone,compute,{recursive:true,filter:path=>!relative(standalone,path).split(/[\\/]/).some(segment=>segment==='public'||segment==='cache'||segment.startsWith('.env')||segment.includes('.retained')||segment==='bundled')});
 cpSync(join(root,'.next/static'),join(compute,'.next/static'),{recursive:true});
 mkdirSync(join(stage,'static/_next'),{recursive:true});
 cpSync(join(root,'.next/static'),join(stage,'static/_next/static'),{recursive:true});
 // No public/ assets copied: original media stays untouched pending rights review.
 const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
 const lock=existsSync(join(root,'package-lock.json'))?JSON.parse(readFileSync(join(root,'package-lock.json'),'utf8')):null;
 const nextVersion=lock?.packages?.['node_modules/next']?.version ?? pkg.dependencies.next.replace(/^[^\d]*/,'');
 writeFileSync(join(stage,'deploy-manifest.json'),JSON.stringify({version:1,framework:{name:'next-js',version:nextVersion},routes:[{path:'/_next/static/*',target:{kind:'Static',cacheControl:'public, max-age=31536000, immutable'}},{path:'/*',target:{kind:'Compute',src:'default'}}],computeResources:[{name:'default',runtime:'nodejs20.x',entrypoint:'server.js'}]},null,2));
 writeFileSync(join(stage,'release-audit.json'),JSON.stringify({...audit,browse:'disabled',publicMedia:'excluded',retainedArtifacts:'not copied; originals preserved',target:{appId:'d2lnw5t0h096c1',region:'us-east-1'},deployExecuted:false},null,2));
 return stage;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(prepareSunsetDeploy());
