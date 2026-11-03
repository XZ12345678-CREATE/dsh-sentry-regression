import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as plugin from '../index.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
assert.equal(manifest.name,plugin.name);
assert.ok(existsSync(join(root,manifest.dsh.bundle.patch)));
const entries=await plugin.createProvider().list();
assert.deepEqual(entries.map(entry=>entry.name),[...plugin.skillNames]);
for(const entry of entries){
 const loaded=await plugin.createProvider().get(entry);
 const rel=relative(root,loaded.resourceBase.path);
 assert.ok(!rel.startsWith('..')&&!isAbsolute(rel));
 assert.ok(loaded.content.startsWith('# '));
}
function walk(folder){return readdirSync(folder,{withFileTypes:true}).flatMap(entry=>['node_modules','.git','dist'].includes(entry.name)?[]:entry.isDirectory()?walk(join(folder,entry.name)):[join(folder,entry.name)]);}
for(const file of walk(root).filter(file=>/\.(mjs|js)$/.test(file))){
 const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 for(const match of readFileSync(file,'utf8').matchAll(/from\s+['"](\.[^'"]+)['"]/g)){
  const target=resolve(dirname(file),match[1]),rel=relative(root,target);
  assert.ok(!rel.startsWith('..')&&!isAbsolute(rel),'Import escapes standalone repository');assert.ok(existsSync(target),'Missing local import: '+match[1]);
 }
}
assert.ok(existsSync(join(root,'LICENSE')));assert.ok(existsSync(join(root,'NOTICE.md')));
console.log(manifest.name+': standalone resources, syntax and local imports pass.');
