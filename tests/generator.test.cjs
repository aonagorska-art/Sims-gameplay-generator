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
test('all 53 packs are represented and every prompt has valid requirements and a game reference',()=>{
 const packs=Object.entries(data.packs).filter(([id])=>id!=='base');
 assert.equal(packs.filter(([,p])=>p.type==='Expansion Pack').length,21);
 assert.equal(packs.filter(([,p])=>p.type==='Game Pack').length,12);
 assert.equal(packs.filter(([,p])=>p.type==='Stuff Pack').length,20);
 const prompts=Object.values(data.pools).flat();
 assert.equal(prompts.length,660);
 for(const item of prompts){
  assert.ok(item.packs.length>0,item.id);
  assert.equal(new Set(item.packs).size,item.packs.length,item.id);
  assert.ok(item.packs.every(id=>data.packs[id]),item.id);
  assert.ok(item.reference && item.text.toLowerCase().includes(item.reference.toLowerCase()),item.id);
  assert.ok(!item.packs.includes('base') || item.packs.length===1,item.id);
 }
 for(const [id] of packs) assert.ok(prompts.filter(item=>item.id.startsWith('pack-')&&item.packs.includes(id)).length>=4,id);
 assert.deepEqual(data.pools.secret.find(x=>x.id==='secret-6').packs,['base']);
 assert.deepEqual(data.pools.sim.find(x=>x.id==='sim-29').packs,['island','vampires']);
});
test('copied challenges include pack names and types for every kind of card',()=>{
 const engine=SimsGenerator.createEngine(data,rng),save=engine.generate(2);
 save.event=data.pools.goal.find(x=>x.id==='pack-university-goal');
 save.disasters=[{...data.pools.goal.find(x=>x.id==='pack-paranormal-goal'),event:data.pools.goal.find(x=>x.id==='pack-crystal-goal')}];
 const text=SimsGenerator.formatChallenge(data,save);
 for(const label of ['Discover University · Expansion Pack','Paranormal · Stuff Pack','Crystal Creations · Stuff Pack']) assert.ok(text.includes(label),label);
});

for (const mode of [0, 1, 2]) test(`mode ${mode}: selected packs filter stories, events and every disaster`, () => {
 const engine = SimsGenerator.createEngine(data, rng);
 for (const packs of [[], ['cats'], ['island'], ['island', 'vampires'], ['university', 'magic']]) {
  for (let n = 0; n < 80; n++) {
   const save = engine.generate(mode, { packs });
   const entries = [...Object.values(save.items), save.event].filter(Boolean);
   for (let i = 0; i < 30; i++) {
    const extra = engine.addDisaster(save);
    if (!extra) break;
    entries.push(extra); if (extra.event) entries.push(extra.event);
   }
   for (const entry of entries) assert.ok(SimsGenerator.ownsPacks(entry, packs), entry.id);
   for (let i = 0; i < entries.length; i++) assert.ok(SimsGenerator.compatible(entries[i], entries.slice(0, i)));
  }
 }
});
test('cross-pack ideas require all packs; Base Game is always available', () => {
 const cross = data.pools.sim.find(x => x.id === 'sim-29');
 assert.equal(SimsGenerator.ownsPacks(cross, ['island']), false);
 assert.equal(SimsGenerator.ownsPacks(cross, ['island', 'vampires']), true);
 assert.equal(SimsGenerator.ownsPacks({packs:['base']}, []), true);
});
test('kept cards survive repeated rolls, with their themes reserved across the whole story', () => {
 const engine = SimsGenerator.createEngine(data, rng);
 for (const packs of [[], ['cats', 'magic'], Object.keys(data.packs)]) {
  for (const mode of [0, 1, 2]) {
   let save = engine.generate(mode, {packs});
   const locked = {goal:save.items.goal, twist:save.items.twist, rule:save.items.rule};
   for (let n=0; n<80; n++) {
    const old = save;
    save = engine.generate(mode, {packs, locked});
    for (const key of Object.keys(locked)) assert.equal(save.items[key], locked[key]);
    for (const key of ['sim','start','romance','secret','problem']) assert.notEqual(save.items[key].id, old.items[key].id);
    const entries = [...Object.values(save.items), save.event].filter(Boolean);
    for (let i=0; i<entries.length; i++) assert.ok(SimsGenerator.compatible(entries[i], entries.slice(0,i)));
    assert.deepEqual(save.disasters, []);
   }
  }
 }
});
test('ineligible or conflicting locks fail without mutating the existing story', () => {
 const engine = SimsGenerator.createEngine(data, rng), save = engine.generate(2);
 const before = JSON.stringify(save);
 const cross = data.pools.sim.find(x=>x.id==='sim-29');
 assert.throws(()=>engine.generate(2,{packs:[],locked:{sim:cross}}), /kept idea/);
 const intense = data.pools.goal.find(x=>x.tier===2);
 assert.throws(()=>engine.generate(0,{locked:{goal:intense}}), /kept idea/);
 const goal=data.pools.goal.find(x=>x.text.includes('five cats'));
 const twist=data.pools.twist.find(x=>x.text.includes('five cats'));
 assert.throws(()=>engine.generate(2,{locked:{goal,twist}}), /kept idea/);
 assert.equal(JSON.stringify(save), before);
 const allKept=engine.generate(2,{locked:save.items});
 assert.deepEqual(allKept.items, save.items);
});
test('an impossible constrained story reports a recoverable error', () => {
 const a={id:'a', text:'a', tier:0, packs:['base'],themes:['same']};
 const b={...a,id:'b',text:'b'};
 const tiny={sections:[{key:'sim'},{key:'goal'}],pools:{sim:[a],goal:[b],event:[]},packs:{base:{}},footers:['ok']};
 assert.throws(()=>SimsGenerator.createEngine(tiny,rng).generate(0,{packs:[],locked:{goal:b}}), /No matching story/);
});
