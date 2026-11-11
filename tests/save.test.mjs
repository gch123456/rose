import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultSave, loadSave, persist, recordStart, recordResult, nextUnlockTarget, SAVE_KEY} from '../assets/scripts/SaveData.ts';

test('a fresh save only has the shooter unlocked and the shooter as current',()=>{
 const s=defaultSave();
 assert.deepEqual(s.unlocked,['shooter']);
 assert.equal(s.current,'shooter');
 assert.deepEqual(s.wins,{shooter:false,warrior:false,mage:false});
});

test('the first shooter win permanently unlocks the warrior and never repeats the reward',()=>{
 const a=recordResult(defaultSave(),'shooter',true);
 assert.deepEqual(a.unlocked,['warrior'],'first win unlocks the warrior');
 assert.equal(a.save.wins.shooter,true);
 const b=recordResult(a.save,'shooter',true);
 assert.deepEqual(b.unlocked,[],'repeat settlement must not reward again');
 assert.equal(b.save.wins.shooter,true);
 assert.equal(b.save.unlocked.filter(c=>c==='warrior').length,1);
});

test('losses never unlock, never un-unlock and never count as wins',()=>{
 const won=recordResult(defaultSave(),'shooter',true).save;
 const lost=recordResult(won,'shooter',false).save;
 assert.deepEqual(lost.unlocked,won.unlocked);
 assert.equal(lost.wins.shooter,true);
 const fresh=recordResult(defaultSave(),'warrior',false);
 assert.deepEqual(fresh.unlocked,[]);
 assert.equal(fresh.save.wins.warrior,false);
});

test('the unlock chain walks shooter win, warrior win, mage win',()=>{
 let s=defaultSave();
 s=recordResult(s,'shooter',true).save;
 s=recordResult(s,'warrior',true).save;
 const last=recordResult(s,'mage',true);
 assert.deepEqual(last.unlocked,[],'the mage win unlocks nothing further');
 assert.equal(last.save.wins.mage,true);
 assert.deepEqual(last.save.unlocked,['shooter','warrior','mage']);
});

test('a warrior win recorded from a default save still unlocks the mage',()=>{
 const s=recordResult(defaultSave(),'warrior',true);
 assert.deepEqual(s.unlocked,['mage']);
});

test('the current character can only be switched to an unlocked one',()=>{
 const s=defaultSave();
 assert.equal(recordStart(s,'warrior').current,'shooter','locked characters stay unselected');
 const open=recordResult(s,'shooter',true).save;
 assert.equal(recordStart(open,'warrior').current,'warrior');
});

test('corrupt or foreign-version saves fall back to defaults without crashing',()=>{
 for (const raw of [null,undefined,'', 'not json', '{"version":99}', '{"version":1}']) {
  const s=loadSave(raw);
  assert.deepEqual(s.unlocked,['shooter'],String(raw).slice(0,20));
  assert.equal(s.current,'shooter');
  assert.equal(s.version,2);
 }
});

test('a valid-shape save is trusted, but the current pick is clamped into the unlocked set',()=>{
 const s=loadSave('{"version":1,"unlocked":["mage"],"current":"warrior","wins":{"mage":true}}');
 assert.deepEqual(s.unlocked,['mage'],'a valid save keeps its own unlocked list');
 assert.equal(s.current,'shooter','a locked current character falls back to the shooter');
 const ok=loadSave('{"version":1,"unlocked":["shooter","mage"],"current":"mage","wins":{}}');
 assert.equal(ok.current,'mage');
});

test('a valid save round-trips through persist and loadSave, written in one atomic call',()=>{
 const base=recordResult(defaultSave(),'shooter',true).save;
 const picked=recordStart(base,'warrior');
 let calls=0,saved='';
 persist(picked,(key,value)=>{calls++;saved=value;});
 assert.equal(calls,1,'atomic save is a single write');
 const back=loadSave(saved);
 assert.deepEqual(back.unlocked,picked.unlocked);
 assert.equal(back.current,'warrior');
 assert.equal(back.wins.shooter,true);
});

test('the save key is stable so the ui and tests agree on storage',()=>{
 assert.equal(SAVE_KEY,'goduck-save');
});

test('the rescue target is the first locked character on the unlock chain',()=>{
 assert.equal(nextUnlockTarget(defaultSave()),'warrior','a fresh save rescues the warrior');
 const afterShooter=recordResult(defaultSave(),'shooter',true).save;
 assert.equal(nextUnlockTarget(afterShooter),'mage','after the shooter wins the mage is next');
 const afterWarrior=recordResult(afterShooter,'warrior',true).save;
 assert.equal(nextUnlockTarget(afterWarrior),null,'a fully unlocked chain rescues nobody');
});
