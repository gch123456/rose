import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export function prepareProfile(root,apply=false){
 const file=path.join(root,'settings/v2/packages/engine.json');
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!data.modules?.configs?.defaultConfig)throw new Error('Expected GoDuck defaultConfig; refusing to guess a project profile');
 const existing=data.modules.configs.colorClear;
 if(existing&&(!existing.includeModules?.includes('3d')||!existing.includeModules?.includes('primitive')))throw new Error('Existing colorClear profile is incompatible; preserve it for manual review');
 if(apply&&!existing){
  const profile=JSON.parse(JSON.stringify(data.modules.configs.defaultConfig));profile.name='Color Clear 3D 原型';
  for(const key of ['3d','primitive']){profile.cache[key]={...profile.cache[key],_value:true};if(!profile.includeModules.includes(key))profile.includeModules.push(key);}
  profile.includeModules.sort();data.modules.configs.colorClear=profile;
  fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
 }
 return {ready:!!(existing||apply),activeProfile:data.modules.globalConfigKey,profile:'colorClear'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=prepareProfile(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),process.argv.includes('--apply'));
 console.log(JSON.stringify(result));if(process.argv.includes('--check')&&!result.ready)process.exitCode=1;
}
