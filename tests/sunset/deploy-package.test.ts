import {it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareSunsetDeploy} from '../../scripts/prepare-sunset-deploy.mjs';
it('copies only release outputs without deleting retained originals or publishing public media',()=>{
 const root=mkdtempSync(join(tmpdir(),'lego-safe-stage-'));
 for(const path of ['.next/standalone/.next/server/chunks','.next/static/media','public/pc-media'])mkdirSync(join(root,path),{recursive:true});
 writeFileSync(join(root,'.next/standalone/server.js'),'// safe app');writeFileSync(join(root,'.next/standalone/.env'),'fixture-private');writeFileSync(join(root,'.next/static/media/font.woff2'),Buffer.concat([Buffer.from('wOF2'),Buffer.alloc(2048)]));writeFileSync(join(root,'public/pc-media/retained.jpg'),'retained original');writeFileSync(join(root,'package.json'),JSON.stringify({dependencies:{next:'16.2.6'}}));
 const output=prepareSunsetDeploy(root);
 expect(existsSync(join(output,'compute/default/server.js'))).toBe(true);expect(existsSync(join(output,'compute/default/.env'))).toBe(false);expect(existsSync(join(output,'static/pc-media'))).toBe(false);expect(readFileSync(join(root,'public/pc-media/retained.jpg'),'utf8')).toBe('retained original');
});
it('refuses an app chunk containing retained forecasts or PC media',()=>{const root=mkdtempSync(join(tmpdir(),'lego-unsafe-stage-'));mkdirSync(join(root,'.next/standalone/.next/server/chunks'),{recursive:true});mkdirSync(join(root,'.next/static'),{recursive:true});writeFileSync(join(root,'.next/standalone/.next/server/chunks/unsafe.js'),'const retained={proj5y:100};');expect(()=>prepareSunsetDeploy(root)).toThrow('retained');});
it('supports a repeatable CI output while preserving retained source data',()=>{
 const root=mkdtempSync(join(tmpdir(),'lego-ci-stage-'));
 for(const path of ['.next/standalone/.next/server/chunks','.next/static/media','public/pc-media'])mkdirSync(join(root,path),{recursive:true});
 writeFileSync(join(root,'.next/standalone/server.js'),'// safe app');writeFileSync(join(root,'.next/static/media/font.woff2'),Buffer.concat([Buffer.from('wOF2'),Buffer.alloc(2048)]));writeFileSync(join(root,'public/pc-media/retained.jpg'),'retained original');writeFileSync(join(root,'package.json'),JSON.stringify({dependencies:{next:'16.2.6'}}));
 const output=prepareSunsetDeploy(root,'.amplify-hosting');
 expect(output).toBe(join(root,'.amplify-hosting'));
 writeFileSync(join(output,'obsolete-generated-file'),'old generated output');
 expect(prepareSunsetDeploy(root,'.amplify-hosting')).toBe(output);
 expect(existsSync(join(output,'obsolete-generated-file'))).toBe(false);
 expect(existsSync(join(output,'deploy-manifest.json'))).toBe(true);
 expect(readFileSync(join(root,'public/pc-media/retained.jpg'),'utf8')).toBe('retained original');
 expect(()=>prepareSunsetDeploy(root,'public')).toThrow('output');
});
it('CI verifies then packages the custom Amplify deployment layout',()=>{
 const config=readFileSync('amplify.yml','utf8');
 expect(config).toContain('baseDirectory: .amplify-hosting');
 expect(config).toContain('npm run verify');
 expect(config).toContain('node scripts/prepare-sunset-deploy.mjs --output .amplify-hosting');
 expect(config.indexOf('npm run verify')).toBeLessThan(config.indexOf('node scripts/prepare-sunset-deploy.mjs'));
});
