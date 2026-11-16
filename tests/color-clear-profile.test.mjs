import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prepareProfile } from '../tools/prepare-color-clear-cocos.mjs';
test('3D profile preparation preserves the old active 2D profile and is idempotent',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'color-clear-profile-'));
 try{
  fs.mkdirSync(path.join(root,'settings/v2/packages'),{recursive:true});
  const target=path.join(root,'settings/v2/packages/engine.json');
  const original=JSON.parse(fs.readFileSync(new URL('../settings/v2/packages/engine.json',import.meta.url),'utf8'));
  delete original.modules.configs.colorClear;
  fs.writeFileSync(target,JSON.stringify(original));
  assert.equal(prepareProfile(root,false).ready,false);assert.deepEqual(JSON.parse(fs.readFileSync(target,'utf8')),original);
  assert.equal(prepareProfile(root,true).ready,true);
  const result=JSON.parse(fs.readFileSync(target,'utf8'));
  assert.equal(result.modules.globalConfigKey,original.modules.globalConfigKey);
  assert.deepEqual(result.modules.configs.defaultConfig,original.modules.configs.defaultConfig);
  assert.ok(result.modules.configs.colorClear.includeModules.includes('3d'));
  assert.ok(result.modules.configs.colorClear.includeModules.includes('primitive'));
  assert.equal(result.modules.configs.colorClear.cache.physics._value,false);
  const once=fs.readFileSync(target,'utf8');prepareProfile(root,true);assert.equal(fs.readFileSync(target,'utf8'),once);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
