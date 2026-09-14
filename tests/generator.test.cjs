const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global;
require('../data.js');
require('../generator.js');
const data = SIMS_DATA;
let seed = 123456;
const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
test('all requested pool sizes, unique IDs, distinct texts, tiers and English data', () => {
 const minimum = {sim:40,start:35,goal:35,romance:35,secret:35,rule:40,problem:35,twist:50,disaster:50};
 const ids = new Set();
 for (const [key,pool] of Object.entries(data.pools)) {
  assert.ok(pool.length >= (minimum[key] || 16), key);
  assert.equal(new Set(pool.map(x=>x.text)).size,pool.length);
  for (const item of pool) { assert.ok(!ids.has(item.id)); ids.add(item.id); assert.ok([0,1,2].includes(item.tier)); assert.ok(item.text.length>15); }
 }
 assert.ok(data.footers.length>=25);
 assert.doesNotMatch(JSON.stringify(data), /[ąćęłńóśźż]/i);
});
for (const mode of [0,1,2]) test(`mode ${mode}: 1000 complete generations, tier gates, repeat control, compatibility`, () => {
 const engine = SimsGenerator.createEngine(data,rng);
 let previous;
 let preferred = 0;
 for(let i=0;i<1000;i++) {
  const save=engine.generate(mode);
  assert.equal(Object.keys(save.items).length,8);
  for(const key of Object.keys(save.items)) {
   const item=save.items[key];
   assert.ok(item.tier<=mode);
   assert.notEqual(item.id,previous?.items[key]?.id);
   assert.ok(SimsGenerator.compatible(item,Object.values(save.items).filter(x=>x!==item)));
   if(item.tier===mode) preferred++;
  }
  assert.notEqual(save.footer,previous?.footer);
  if(save.event) assert.ok(save.event.tier<=mode);
  previous=save;
 }
 assert.ok(preferred>4000,'chosen mode receives most selections');
});
for(const mode of [0,1,2]) test(`mode ${mode}: distinct objectives throughout each save and disaster stack`,()=>{
 const engine=SimsGenerator.createEngine(data,rng);
 for(let run=0;run<100;run++) {
  const save=engine.generate(mode), before=JSON.stringify(save.items);
  const all=[...Object.values(save.items),save.event].filter(Boolean);
  for(let n=0;n<100;n++) {
   const item=engine.addDisaster(save);
   if(!item) break;
   all.push(item); if(item.event) all.push(item.event);
  }
  for(let i=0;i<all.length;i++) assert.ok(SimsGenerator.compatible(all[i],all.slice(0,i)),all[i].id);
  assert.equal(JSON.stringify(save.items),before);
  assert.equal(engine.addDisaster(save),null,'exhaustion must not recycle prompts');
  const copy=SimsGenerator.formatChallenge(data,save);
  for(const item of all) assert.ok(copy.includes(item.text));
  assert.equal(engine.generate(mode).disasters.length,0);
 }
});
test('paraphrased challenges share themes across categories',()=>{
 const find=(key,text)=>data.pools[key].find(x=>x.text.includes(text));
 for(const [a,b] of [
  [find('goal','five cats'),find('twist','five cats')],
  [find('goal','basement'),find('twist','basement studio')],
  [find('goal','restaurant'),find('disaster','restaurant')],
  [find('goal','Charisma'),find('twist','Charisma')]
 ]) {assert.ok(a&&b);assert.equal(SimsGenerator.compatible(a,[b]),false);}
});
test('reject invalid modes',()=>assert.throws(()=>SimsGenerator.createEngine(data).generate(5)));
test('short fan prompts and header removal',()=>{
 const fs=require('node:fs');const path=require('node:path');
 for(const pool of Object.values(data.pools)) for(const item of pool) assert.ok(item.text.length<=120,item.id);
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.doesNotMatch(html,/THE SAVE FILE LAB|new-save|A LITTLE INSPIRATION|UNOFFICIAL\. UNHINGED\./);
 assert.ok(data.pools.goal.some(x=>x.text.includes('Charisma')&&x.text.includes('10')));
 assert.ok(data.pools.goal.some(x=>x.text.includes('five cats')));
 assert.ok(data.pools.goal.some(x=>x.text.includes('basement')));
 assert.ok(data.pools.goal.some(x=>x.text.includes('restaurant')));
});
test('semantic conflicts reject incompatible goals and rules',()=>{
 assert.equal(SimsGenerator.compatible({blocks:['career']},[{tags:['career']}]),false);
 assert.equal(SimsGenerator.compatible({tags:['build-now']},[{blocks:['build-now']}]),false);
 assert.equal(SimsGenerator.compatible({tags:['career']},[{tags:['build-now']}]),true);
});
