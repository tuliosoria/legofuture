import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync, symlinkSync, lstatSync, readlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
 const root = mkdtempSync(join(tmpdir(), 'native-hosting-fixture-')); roots.push(root);
 for (const path of ['.next/server/app', '.next/standalone/.next/server', '.next/static/media', 'node_modules/fixture', 'node_modules/next', 'public']) mkdirSync(join(root, path), {recursive:true});
 writeFileSync(join(root, '.next/standalone/server.js'), '// synthetic server');
 writeFileSync(join(root, '.next/server/app/page.js'), '// safe synthetic app');
 writeFileSync(join(root, '.next/server/app/page.js.nft.json'), JSON.stringify({version:1,files:['../../../node_modules/fixture/index.js']}));
 writeFileSync(join(root, 'node_modules/fixture/index.js'), 'module.exports=1;');
 writeFileSync(join(root, 'node_modules/next/package.json'), JSON.stringify({version:'16.2.6'}));
 writeFileSync(join(root, 'package.json'), JSON.stringify({dependencies:{next:'16.2.6'}}));
 writeFileSync(join(root, '.next/BUILD_ID'), 'synthetic-build');
 writeFileSync(join(root, '.next/next-server.js.nft.json'), JSON.stringify({version:1,files:['../node_modules/fixture/index.js']}));
 writeFileSync(join(root, '.next/server/app-paths-manifest.json'), JSON.stringify({'/page':'app/page.js'}));
 writeFileSync(join(root, '.next/static/media/font.woff2'), Buffer.concat([Buffer.from('wOF2'),Buffer.alloc(2048)]));
 writeFileSync(join(root, '.next/required-server-files.json'), JSON.stringify({version:1,config:{distDir:'.next',output:'standalone',env:{}},files:['.next/BUILD_ID','.next/required-server-files.json']},null,2));
 return realpathSync(root);
}
function run(root: string) {
 return spawnSync(process.execPath, [resolve('scripts/prepare-sunset-deploy.mjs'),'--native'], {cwd:root,encoding:'utf8',env:{NODE_ENV:'test'},timeout:5000});
}
it('prepares the genuine native Next artifact at the configured .next root', () => {
 const root=fixture(), original=readFileSync(join(root,'.next/required-server-files.json'));
 const result=run(root);
 expect(result.status, result.stderr).toBe(0);
 expect(result.stdout.trim()).toBe(join(root,'.next'));
 expect(readFileSync(join(result.stdout.trim(),'required-server-files.json')).equals(original)).toBe(true);
 expect(existsSync(join(root,'.amplify-hosting'))).toBe(false);
});

function put(root: string, path: string, body: string) { mkdirSync(resolve(root,path,'..'),{recursive:true}); writeFileSync(join(root,path),body); }
function retained(root: string) { return join(root,'.sunset-retained/native-package'); }
it('CI selects the native adapter root and limits runtime environment forwarding',()=>{
 const yml=readFileSync('amplify.yml','utf8');
 expect(yml).toContain('baseDirectory: .next');
 expect(yml).toContain('node scripts/prepare-sunset-deploy.mjs --native');
 expect(yml).not.toMatch(/for key in .*PRICECHARTING_API_TOKEN/);
});
it('quarantines generated env/cache/debug maps/public media reversibly and keeps dependency cache modules',()=>{
 const root=fixture();
 for(const path of ['.next/cache/retained.json','.next/standalone/.env.production','.next/server/app/page.js.map','public/retained/item.jpg','.next/diagnostics/build.json'])put(root,path,'synthetic retained bytes');
 put(root,'node_modules/fixture/cache/index.js','module.exports=2;');
 const result=run(root); expect(result.status,result.stderr).toBe(0);
 for(const path of ['.next/cache/retained.json','.next/standalone/.env.production','.next/server/app/page.js.map','public/retained/item.jpg','.next/diagnostics/build.json']) {
  expect(existsSync(join(root,path))).toBe(false);
  expect(readFileSync(join(retained(root),path),'utf8')).toBe('synthetic retained bytes');
 }
 expect(readFileSync(join(root,'node_modules/fixture/cache/index.js'),'utf8')).toBe('module.exports=2;');
 expect(run(root).status).toBe(0);
});
it.each(['../../../node_modules/fixture/missing.js','page.js.map','../../../public/retained/item.jpg','../../../.env.production','../../../src/lib/db/bundled/prices.json','../../../../outside.js'])('refuses an unsafe or missing trace dependency: %s',entry=>{
 const root=fixture();
 put(root,'.next/server/app/page.js.nft.json',JSON.stringify({version:1,files:[entry]}));
 const result=run(root); expect(result.status).not.toBe(0);
 expect(result.stderr).toMatch(/trace dependency/);
 expect(existsSync(retained(root))).toBe(false);
});
it.each(['.next/required-server-files.json','.next/server/app/page.js.nft.json'])('does not invent a missing compiler file: %s',path=>{
 const root=fixture();rmSync(join(root,path));
 const result=run(root);expect(result.status).not.toBe(0);expect(existsSync(join(root,path))).toBe(false);
});
it('refuses embedded environment without emitting the value or moving original outputs',()=>{
 const root=fixture(),path=join(root,'.next/required-server-files.json');
 const metadata=JSON.parse(readFileSync(path,'utf8'));metadata.config.env={FIXTURE_SECRET:'do-not-emit-fixture'};writeFileSync(path,JSON.stringify(metadata));
 const result=run(root);expect(result.status).not.toBe(0);expect(result.stderr).not.toContain('do-not-emit-fixture');expect(existsSync(retained(root))).toBe(false);
});
it.each(['const x={currentPrice:12};','const x={proj5y:12};'])('rejects retained content in native server output before mutation: %s',body=>{
 const root=fixture();put(root,'.next/server/app/page.js',body);
 const result=run(root);expect(result.status).not.toBe(0);expect(result.stderr).toContain('Retained content');expect(existsSync(retained(root))).toBe(false);
});
it('refuses a quarantine collision without overwriting prior retained bytes',()=>{
 const root=fixture();put(root,'.next/cache/item','new');put(root,'.sunset-retained/native-package/.next/cache/item','prior');
 const result=run(root);expect(result.status).not.toBe(0);expect(readFileSync(join(root,'.next/cache/item'),'utf8')).toBe('new');expect(readFileSync(join(retained(root),'.next/cache/item'),'utf8')).toBe('prior');
});

it('withholds untraced browser source maps as well as server source maps',()=>{
 const root=fixture();put(root,'.next/static/chunks/app.js.map','retained original source');
 const result=run(root);expect(result.status,result.stderr).toBe(0);
 expect(existsSync(join(root,'.next/static/chunks/app.js.map'))).toBe(false);
 expect(readFileSync(join(retained(root),'.next/static/chunks/app.js.map'),'utf8')).toBe('retained original source');
});
it('rejects external dependency symlinks before moving generated outputs',()=>{
 const root=fixture(),external=fixture();put(external,'outside.js','synthetic external');
 rmSync(join(root,'node_modules/fixture/index.js'));symlinkSync(join(external,'outside.js'),join(root,'node_modules/fixture/index.js'));
 const result=run(root);expect(result.status).not.toBe(0);expect(result.stderr).toMatch(/symlink/);expect(existsSync(retained(root))).toBe(false);
});

it.each(['.next/next-server.js.nft.json','.next/server/app/page.js.nft.json'])('refuses a missing expected runtime trace without adding it to metadata.files: %s',path=>{
 const root=fixture(),bytes=readFileSync(join(root,'.next/required-server-files.json'));
 rmSync(join(root,path));put(root,'.next/cache/preserved','unchanged');
 const result=run(root);expect(result.status).not.toBe(0);expect(result.stderr).toMatch(/runtime trace/);
 expect(readFileSync(join(root,'.next/required-server-files.json')).equals(bytes)).toBe(true);
 expect(existsSync(join(root,path))).toBe(false);expect(readFileSync(join(root,'.next/cache/preserved'),'utf8')).toBe('unchanged');expect(existsSync(retained(root))).toBe(false);
});
it('requires traces of pages-router server entrypoints as well as app entrypoints',()=>{
 const root=fixture();put(root,'.next/server/pages/api/example.js','// synthetic node API');
 put(root,'.next/server/pages-manifest.json',JSON.stringify({'/api/example':'pages/api/example.js'}));
 expect(run(root).status).not.toBe(0);
 put(root,'.next/server/pages/api/example.js.nft.json',JSON.stringify({version:1,files:[]}));
 expect(run(root).status).toBe(0);
});
it('does not require Node traces for static HTML entries or manifest-declared Edge entries',()=>{
 const root=fixture();put(root,'.next/server/pages/404.html','synthetic static page');
 put(root,'.next/server/pages-manifest.json',JSON.stringify({'/404':'pages/404.html'}));
 put(root,'.next/server/app/edge/page.js','// synthetic Edge bundle');
 put(root,'.next/server/app-paths-manifest.json',JSON.stringify({'/page':'app/page.js','/edge/page':'app/edge/page.js'}));
 put(root,'.next/server/middleware-manifest.json',JSON.stringify({version:3,middleware:{},functions:{'/edge':{page:'/edge',files:['server/app/edge/page.js']}}}));
 expect(run(root).status).toBe(0);
});
it('still requires the app Node trace when its route has prerendered HTML',()=>{
 const root=fixture();rmSync(join(root,'.next/server/app/page.js.nft.json'));
 put(root,'.next/prerender-manifest.json',JSON.stringify({version:4,routes:{'/':{initialRevalidateSeconds:false}},dynamicRoutes:{},notFoundRoutes:[]}));
 put(root,'.next/server/app/index.html','synthetic prerender');expect(run(root).status).not.toBe(0);
});
it.each(['.sunset-retained/native-package/.next/server/app/page.js.map','.sunset-retained/native-package/.next/server/app','.sunset-retained/native-package','.sunset-retained'])('refuses dangling quarantine entries without replacing a link or moving bytes: %s',path=>{
 const root=fixture();put(root,'.next/server/app/page.js.map','new synthetic map');
 mkdirSync(resolve(root,path,'..'),{recursive:true});symlinkSync('prior-synthetic-missing-target',join(root,path));
 const result=run(root);expect(result.status).not.toBe(0);
 expect(readFileSync(join(root,'.next/server/app/page.js.map'),'utf8')).toBe('new synthetic map');
 expect(lstatSync(join(root,path)).isSymbolicLink()).toBe(true);expect(readlinkSync(join(root,path))).toBe('prior-synthetic-missing-target');
});

function declareMiddleware(root: string, runtime: 'edge' | 'node') {
 if(runtime==='node') {
  put(root,'.next/server/functions-config-manifest.json',JSON.stringify({version:1,functions:{'/_middleware':{runtime:'nodejs',matchers:[{regexp:'^.*$',originalSource:'/:path*'}]}}}));
  put(root,'.next/server/middleware.js','// synthetic final Node proxy');
  put(root,'.next/server/middleware.js.nft.json',JSON.stringify({version:1,files:['../../node_modules/fixture/index.js']}));
  return ['.next/server/middleware.js','.next/server/middleware.js.nft.json'];
 }
 const files=['server/edge-runtime-webpack.js','server/src/middleware.js'];
 const wasm=[{name:'syntheticWasm',filePath:'server/middleware.wasm'}],assets=[{name:'syntheticAsset',filePath:'server/middleware-asset.txt'}];
 put(root,'.next/server/middleware-manifest.json',JSON.stringify({version:3,functions:{},middleware:{'/':{name:'src/middleware',page:'/',entrypoint:'server/src/middleware.js',files,wasm,assets}}}));
 const entries=[...files,...wasm.map(item=>item.filePath),...assets.map(item=>item.filePath)].map(path=>'.next/'+path);
 for(const path of entries)put(root,path,'// safe synthetic middleware asset');
 return entries;
}
it.each(['edge','node'] as const)('accepts complete %s middleware outside app/pages routes while preserving metadata and traces',runtime=>{
 const root=fixture(),entries=declareMiddleware(root,runtime);
 const manifest=readFileSync(join(root,'.next/required-server-files.json'));
 const declared=readFileSync(join(root,runtime==='edge'?'.next/server/middleware-manifest.json':'.next/server/functions-config-manifest.json'));
 put(root,'.next/cache/preserved','synthetic cache');
 const before=entries.map(path=>readFileSync(join(root,path)));
 const result=run(root);expect(result.status,result.stderr).toBe(0);
 expect(readFileSync(join(root,'.next/required-server-files.json')).equals(manifest)).toBe(true);
 expect(readFileSync(join(root,runtime==='edge'?'.next/server/middleware-manifest.json':'.next/server/functions-config-manifest.json')).equals(declared)).toBe(true);
 entries.forEach((path,index)=>expect(readFileSync(join(root,path)).equals(before[index])).toBe(true));
 expect(readFileSync(join(retained(root),'.next/cache/preserved'),'utf8')).toBe('synthetic cache');
});
it.each([
 ['edge',0],['edge',1],['edge',2],['edge',3],['node',0],['node',1]
] as const)('refuses missing declared %s middleware entry %i before any quarantine rename',(runtime,index)=>{
 const root=fixture(),entries=declareMiddleware(root,runtime),missing=entries[index];
 const bytes=readFileSync(join(root,'.next/required-server-files.json'));
 rmSync(join(root,missing));put(root,'.next/cache/preserved','unchanged bytes');
 const result=run(root);expect(result.status).not.toBe(0);expect(result.stderr).toMatch(/middleware|runtime/);
 expect(existsSync(join(root,missing))).toBe(false);expect(existsSync(retained(root))).toBe(false);
 expect(readFileSync(join(root,'.next/cache/preserved'),'utf8')).toBe('unchanged bytes');
 expect(readFileSync(join(root,'.next/required-server-files.json')).equals(bytes)).toBe(true);
});
it('rejects an unfinished Node proxy build that has not produced the final middleware filenames',()=>{
 const root=fixture();declareMiddleware(root,'node');
 put(root,'.next/server/proxy.js',readFileSync(join(root,'.next/server/middleware.js'),'utf8'));
 put(root,'.next/server/proxy.js.nft.json',readFileSync(join(root,'.next/server/middleware.js.nft.json'),'utf8'));
 rmSync(join(root,'.next/server/middleware.js'));rmSync(join(root,'.next/server/middleware.js.nft.json'));
 expect(run(root).status).not.toBe(0);expect(existsSync(retained(root))).toBe(false);
});

const identityFixtures: {path: string; data: Record<string, unknown>[] | {generatedAt: null; entries: never[]}}[] = JSON.parse(readFileSync('package.json','utf8')).name==='pokefuture' ? [
 {path:'src/lib/data/sealed-ml/sealed-search-catalog.json',data:[{catalogId:'fixture',catalogKey:'fixture-box',runtimeId:'local-fixture',setId:'fixture',name:'Fixture',displayName:'Fixture Box',productType:'booster-box',releaseDate:'2026-01-01',pokedataId:null,priceChartingId:'123',searchAliases:['Fixture box'],searchText:'fixture box'}]},
 {path:'src/lib/data/cards/card-catalog.json',data:{generatedAt:null,entries:[]}}
] : [{path:'src/lib/data/catalog-identities.json',data:[{id:'fixture-set',name:'Fixture set',setNumber:'12345',theme:'Fixture',status:'retired',year:2020,pieces:100}]}];
function traceIdentity(root: string, path: string, data: unknown) {
 put(root,path,JSON.stringify(data));
 put(root,'.next/server/app/page.js.nft.json',JSON.stringify({version:1,files:['../../../'+path]}));
}
it.each(identityFixtures)('preserves reviewed identity source and genuine trace bytes in native closure: $path',({path,data})=>{
 const root=fixture();traceIdentity(root,path,data);
 const sourceBytes=readFileSync(join(root,path)),traceBytes=readFileSync(join(root,'.next/server/app/page.js.nft.json')),metadata=readFileSync(join(root,'.next/required-server-files.json'));
 const result=run(root);expect(result.status,result.stderr).toBe(0);
 expect(readFileSync(join(root,path)).equals(sourceBytes)).toBe(true);
 expect(readFileSync(join(root,'.next/server/app/page.js.nft.json')).equals(traceBytes)).toBe(true);
 expect(readFileSync(join(root,'.next/required-server-files.json')).equals(metadata)).toBe(true);
 const entry=JSON.parse(traceBytes.toString()).files[0];
 expect(readFileSync(resolve(root,'.next/server/app',entry)).equals(sourceBytes)).toBe(true);
});
it.each(['currentPrice','price','imageUrl','credentials','metadata'])('rejects extra %s fields in reviewed identity assets including mixed valid/invalid rows',key=>{
 const root=fixture(),asset=identityFixtures[0];
 const data=Array.isArray(asset.data)?[...asset.data,{...asset.data[0],[key]:key==='price'?0:{nested:'forbidden'}}]:{...asset.data,[key]:{nested:'forbidden'}};
 traceIdentity(root,asset.path,data);put(root,'.next/cache/preserved','untouched');
 const result=run(root);expect(result.status).not.toBe(0);expect(existsSync(retained(root))).toBe(false);expect(readFileSync(join(root,'.next/cache/preserved'),'utf8')).toBe('untouched');
});
it('rejects nested values or media URLs disguised as identity names',()=>{
 const asset=identityFixtures[0];
 if(!Array.isArray(asset.data))throw new Error('identity row fixture required');
 for(const name of [{price:12},'https://example.test/retained.jpg']) {
  const root=fixture();traceIdentity(root,asset.path,[{...asset.data[0],name}]);
  expect(run(root).status).not.toBe(0);expect(existsSync(retained(root))).toBe(false);
 }
});
it('rejects nonempty cards rather than inferring an unreviewed card-entry schema',()=>{
 const root=fixture();traceIdentity(root,'src/lib/data/cards/card-catalog.json',{generatedAt:null,entries:[{id:'fixture',name:'card'}]});
 expect(run(root).status).not.toBe(0);expect(existsSync(retained(root))).toBe(false);
});
it.each(['src/lib/data/sealed-ml/unreviewed.json','src/lib/data/catalog-identities-extra.json','.env.production'])('does not extend exact identity admission to unreviewed paths: %s',path=>{
 const root=fixture();traceIdentity(root,path,identityFixtures[0].data);
 expect(run(root).status).not.toBe(0);expect(existsSync(retained(root))).toBe(false);
});
it('rejects a reviewed identity pathname that resolves through a symlink',()=>{
 const root=fixture(),asset=identityFixtures[0];traceIdentity(root,asset.path,asset.data);
 put(root,'identity-target.json',JSON.stringify(asset.data));rmSync(join(root,asset.path));symlinkSync(join(root,'identity-target.json'),join(root,asset.path));
 const result=run(root);expect(result.status).not.toBe(0);expect(lstatSync(join(root,asset.path)).isSymbolicLink()).toBe(true);expect(existsSync(retained(root))).toBe(false);
});
