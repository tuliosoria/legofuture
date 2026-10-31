import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const prices = /(?:currentPrice|newPrice|loosePrice|gradedPrice|medianSoldPrice|psa10Price|avgSoldPrice|proj5y)["']?\s*:\s*(?:[1-9]\d*|0?\.\d*[1-9])/;
const retained = /(?:^|\/)(?:bundled|\.sunset-retained)(?:\/|$)|\.retained(?:[.\/]|$)|(?:^|\/)src\/lib\/data\/(?:sealed-ml|lego-ml)(?:\/|$)/;
const inside = (root, path) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`); };
const normalized = (root, path) => relative(root, path).split(sep).join('/');
// Only reviewed source identities may be dependencies outside .next/node_modules.
// Schemas are closed: no provider prices, media, nested records or generic src paths.
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const identityText = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 2048 && !/[{}]|(?:https?|file|data|s3):/i.test(value);
const nullableIdentity = value => value === null || identityText(value);
const brickStrings = ['id', 'name', 'setNumber', 'theme', 'status'];
const sealedStrings = ['catalogId', 'catalogKey', 'runtimeId', 'setId', 'name', 'displayName', 'productType', 'searchText'];
const identitySchemas = {
 'src/lib/data/catalog-identities.json': value => Array.isArray(value) && value.every(row =>
  exactKeys(row, [...brickStrings, 'year', 'pieces']) && brickStrings.every(key => identityText(row[key]))
  && Number.isSafeInteger(row.year) && row.year >= 1900 && row.year <= 2200
  && Number.isSafeInteger(row.pieces) && row.pieces >= 0 && row.pieces <= 1000000),
 'src/lib/data/sealed-ml/sealed-search-catalog.json': value => Array.isArray(value) && value.every(row =>
  exactKeys(row, [...sealedStrings, 'releaseDate', 'pokedataId', 'priceChartingId', 'searchAliases'])
  && sealedStrings.every(key => identityText(row[key])) && typeof row.releaseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.releaseDate)
  && nullableIdentity(row.pokedataId) && nullableIdentity(row.priceChartingId)
  && Array.isArray(row.searchAliases) && row.searchAliases.every(identityText)),
 // The shipped card source is empty. Nonempty entries need their own review.
 'src/lib/data/cards/card-catalog.json': value => exactKeys(value, ['generatedAt', 'entries'])
  && value.generatedAt === null && Array.isArray(value.entries) && value.entries.length === 0,
};
function entryStat(path) {
 try { return lstatSync(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function omitted(path) {
 return path.split('/').some(part => part.startsWith('.env')) || retained.test(path)
  || /^\.next\/(?:standalone|cache|types|diagnostics|trace|trace-build)(?:\/|$)/.test(path)
  || /^\.next\/(?:server|static)\/.*\.map$/.test(path);
}
/** Prepare the standard native .next output; never create or rewrite Next metadata.
 * Excluded generated files/media are moved intact into a reversible local quarantine.
 * Full preflight precedes every move. No provider, database or network operations.
 */
export function prepareNativeSunset(root = process.cwd(), { publicShell = [], requireFonts = false, contentPattern = prices, identityAssets = [] } = {}) {
 root = realpathSync(resolve(root));
 const build = join(root, '.next');
 const metadataPath = join(build, 'required-server-files.json');
 if (existsSync(build) && lstatSync(build).isSymbolicLink()) throw new Error('Native build directory must not be a symlink');
 if (!existsSync(metadataPath)) throw new Error('Genuine required-server-files.json from next build is required');
 if (lstatSync(metadataPath).isSymbolicLink()) throw new Error('Native manifest must not be a symlink');
 const bytes = readFileSync(metadataPath);
 const metadata = JSON.parse(bytes.toString());
 if (metadata.version !== 1 || metadata.config?.distDir !== '.next' || !Array.isArray(metadata.files) || !metadata.files.length) throw new Error('Incompatible genuine native manifest');
 if (metadata.config.env && Object.keys(metadata.config.env).length) throw new Error('Embedded environment in native metadata; values withheld');
 const moves = [], kept = [];
 function visit(path) {
  if (omitted(normalized(root, path))) { moves.push(path); return; }
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw new Error('Symlink in native application output');
  if (stat.isDirectory()) for (const name of readdirSync(path)) visit(join(path, name));
  else if (stat.isFile()) kept.push(path);
  else throw new Error('Unsupported native application file');
 }
 visit(build);
 const closure = new Set();
 function checkDependency(path, label) {
  const rel = normalized(root, path);
  const identity = identityAssets.includes(rel) && Object.hasOwn(identitySchemas, rel);
  if (!inside(root, path) || (!identity && omitted(rel)) || (!identity && !rel.startsWith('.next/') && !rel.startsWith('node_modules/') && rel !== 'package.json')) throw new Error(`Unsafe ${label}; native package refused`);
  if (!existsSync(path) || !lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink()) throw new Error(`Missing ${label}; native package refused`);
  const actual = realpathSync(path);
  const dependencyRoot = join(root, 'node_modules');
  const allowedDependency = rel.startsWith('node_modules/') && existsSync(dependencyRoot) && inside(realpathSync(dependencyRoot), actual);
  if (!inside(root, actual) && !allowedDependency) throw new Error(`External symlink ${label}; native package refused`);
  if (!lstatSync(actual).isFile() || (!identity && omitted(normalized(root, actual)))) throw new Error(`Unsafe ${label}; native package refused`);
  if (identity) {
   if (actual !== path || lstatSync(path).isSymbolicLink()) throw new Error('Symlink in reviewed identity dependency');
   let value;
   try { value = JSON.parse(readFileSync(path, 'utf8')); } catch { throw new Error('Invalid reviewed identity JSON; values withheld'); }
   if (!identitySchemas[rel](value)) throw new Error('Invalid reviewed identity schema; values withheld');
  }
  closure.add(path);
 }
 for (const entry of metadata.files) {
  if (typeof entry !== 'string' || isAbsolute(entry) || entry.split(/[\\/]/).includes('..') || !entry.startsWith('.next/')) throw new Error('Unsafe required native file');
  checkDependency(resolve(root, entry), 'required native file');
 }
 // Next emits the global server trace separately from required-server-files.files.
 // Route manifests identify runtime JS entries; static HTML and declared Edge bundles
 // legitimately have no Node trace. App prerendering still retains its Node JS entry.
 checkDependency(join(build, 'next-server.js.nft.json'), 'runtime trace');
 const edgeEntries = new Set();
 const middlewarePath = join(build, 'server/middleware-manifest.json');
 if (existsSync(middlewarePath)) {
  const middleware = JSON.parse(readFileSync(middlewarePath, 'utf8'));
  // Edge middleware is separate from app/pages functions. Next also declares
  // wasm/assets here; every declared runtime file must survive the preflight.
  for (const definition of [...Object.values(middleware.functions ?? {}), ...Object.values(middleware.middleware ?? {})]) {
   if (![definition.files, definition.wasm ?? [], definition.assets ?? []].every(Array.isArray)) throw new Error('Invalid Edge runtime file list');
   const entries = [...definition.files, ...[...definition.wasm ?? [], ...definition.assets ?? []].map(asset => asset.filePath)];
   for (const entry of entries) {
    if (typeof entry !== 'string' || isAbsolute(entry) || entry.split(/[\\/]/).includes('..')) throw new Error('Unsafe Edge runtime file');
    const file = resolve(build, entry);
    checkDependency(file, 'Edge runtime file');
    edgeEntries.add(file);
   }
  }
 }
 // Next 16's final webpack output renames Node proxy.js (+trace) to
 // middleware.js. Its declaration lives outside the app/pages manifests.
 const functionsPath = join(build, 'server/functions-config-manifest.json');
 if (existsSync(functionsPath)) {
  const functions = JSON.parse(readFileSync(functionsPath, 'utf8'));
  const nodeMiddleware = functions.functions?.['/_middleware'];
  if (nodeMiddleware) {
   if (nodeMiddleware.runtime !== 'nodejs') throw new Error('Unsupported Node middleware runtime declaration');
   checkDependency(join(build, 'server/middleware.js'), 'Node middleware entrypoint');
   checkDependency(join(build, 'server/middleware.js.nft.json'), 'Node middleware runtime trace');
  }
 }
 let routeManifests = 0;
 for (const name of ['app-paths-manifest.json', 'pages-manifest.json']) {
  const manifestPath = join(build, 'server', name);
  if (!existsSync(manifestPath)) continue;
  routeManifests++;
  const routes = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const entry of Object.values(routes)) {
   if (typeof entry !== 'string' || isAbsolute(entry) || entry.split(/[\\/]/).includes('..')) throw new Error('Unsafe runtime entrypoint');
   const file = resolve(build, 'server', entry);
   checkDependency(file, 'runtime entrypoint');
   if (entry.endsWith('.js') && !edgeEntries.has(file)) checkDependency(file + '.nft.json', 'runtime trace');
  }
 }
 if (!routeManifests) throw new Error('Native routing manifest required to verify runtime traces');
 for (const file of kept.filter(path => path.endsWith('.nft.json'))) {
  const trace = JSON.parse(readFileSync(file, 'utf8'));
  if (trace.version !== 1 || !Array.isArray(trace.files)) throw new Error('Invalid native trace dependency list');
  for (const entry of trace.files) {
   if (typeof entry !== 'string' || isAbsolute(entry)) throw new Error('Unsafe trace dependency');
   checkDependency(resolve(dirname(file), entry), 'trace dependency');
  }
 }
 for (const file of kept) {
  const rel = normalized(root, file);
  if (/\.(?:js|json|html|rsc|txt|css)$/.test(file) && (prices.test(readFileSync(file, 'utf8')) || contentPattern.test(readFileSync(file, 'utf8')))) throw new Error('Retained content in native application output');
  if (retained.test(rel)) throw new Error('Retained content in native application output');
 }
 if (requireFonts) {
  const fonts = kept.filter(path => normalized(root, path).startsWith('.next/static/media/') && path.endsWith('.woff2'));
  if (!fonts.length || fonts.some(path => { const data = readFileSync(path); return data.length < 1000 || data.subarray(0, 4).toString() !== 'wOF2'; })) throw new Error('Real WOFF2 assets required; mock-font native packages are refused');
 }
 const publicDir = join(root, 'public');
 if (existsSync(publicDir)) {
  if (lstatSync(publicDir).isSymbolicLink()) throw new Error('Public directory must not be a symlink');
  for (const name of readdirSync(publicDir)) {
   const path = join(publicDir, name);
   if (!publicShell.includes(name)) moves.push(path);
   else if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) throw new Error('Approved public shell must be a regular file');
  }
 }
 const quarantine = join(root, '.sunset-retained/native-package');
 // Refuse collisions and symlink parents before mutating anything.
 for (const parent of [join(root, '.sunset-retained'), quarantine]) {
  const stat = entryStat(parent);
  if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) throw new Error('Unsafe native quarantine directory');
 }
 for (const source of moves) {
  const destination = join(quarantine, relative(root, source));
  if (entryStat(destination)) throw new Error('Native quarantine collision; originals preserved');
  for (let parent = dirname(destination); inside(quarantine, parent); parent = dirname(parent)) {
   const stat = entryStat(parent);
   if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) throw new Error('Unsafe native quarantine parent');
   if (parent === quarantine) break;
  }
 }
 for (const source of moves) {
  const destination = join(quarantine, relative(root, source));
  mkdirSync(dirname(destination), { recursive: true });
  renameSync(source, destination);
 }
 if (!readFileSync(metadataPath).equals(bytes)) throw new Error('Compiler manifest changed unexpectedly');
 for (const path of closure) if (!existsSync(path)) throw new Error('Native trace closure was broken unexpectedly');
 return build;
}
