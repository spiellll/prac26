import assert from 'node:assert/strict';
const base=process.env.RITM_TEST_URL||'http://localhost:5173';
const headers={'Content-Type':'application/json',origin:base};
const call=async body=>{const r=await fetch(base+'/api/diary',{method:'POST',headers,body:JSON.stringify(body)});return {status:r.status,body:await r.json()}};
const read=async()=>{const r=await fetch(base+'/api/diary');assert.equal(r.status,200);return r.json()};
const id=crypto.randomUUID();const entry={id,date:'2026-09-24',kind:'workout',title:'API QA disposable groups v3',text:'Synthetic verification record',exercises:[{name:'Присед',groups:[],sets:[{reps:10,weight:40,effort:'light',warmup:true},{reps:8,weight:62.5,effort:'hard',warmup:false}]}],value:null,cycleIndex:0,createdAt:new Date().toISOString()};
try{
 assert.ok((await read()).entries.length>=14,'Existing diary records remain available');
 assert.equal((await call({action:'saveEntry',entry})).status,200);
 let saved=(await read()).entries.find(e=>e.id===id);assert.deepEqual(saved.exercises[0].groups,[]);assert.deepEqual(saved.exercises[0].sets,entry.exercises[0].sets);
 entry.exercises[0].groups=['legs','glutes','strength'];entry.exercises[0].sets.push({reps:6,weight:70,effort:'hard',warmup:false});assert.equal((await call({action:'saveEntry',entry})).status,200);
 assert.deepEqual((await read()).entries.find(e=>e.id===id).exercises[0].groups,['legs','glutes','strength']);
 assert.equal((await read()).entries.filter(e=>e.id===id).length,1,'Retry updates same id');
 assert.equal((await read()).entries.find(e=>e.id===id).exercises[0].sets[2].weight,70);
 for(const sets of [[],[{reps:0,weight:60,effort:'hard',warmup:false}],[{reps:8,weight:-1,effort:'hard',warmup:false}],[{reps:8,weight:60,effort:'invented',warmup:false}]])assert.equal((await call({action:'saveEntry',entry:{...entry,exercises:[{...entry.exercises[0],sets}]}})).status,400);
 assert.equal((await fetch(base+'/api/diary',{method:'POST',headers:{...headers,origin:'https://unrelated.example'},body:JSON.stringify({action:'deleteEntry',id})})).status,403);
 assert.equal((await call({action:'saveEntry',entry:{...entry,exercises:[{...entry.exercises[0],groups:['legs','legs']}]}})).status,400,'Duplicate groups rejected');
 const diary=await read();assert.equal(diary.aiAvailable,false,'Offline mode does not require an AI key');
 entry.exercises=[{name:'QA предплечья',groups:['biceps','forearms'],targetReps:100,sets:[{reps:8,weight:12.5,effort:'hard',warmup:false}]},{name:'QA вакуум',tracking:'activity',notes:'3 раза по 20 секунд',groups:['core'],sets:[]}];assert.equal((await call({action:'saveEntry',entry})).status,200);
 const reread=(await read()).entries.find(e=>e.id===id);assert.deepEqual(reread.exercises,entry.exercises);
 assert.equal((await call({action:'saveEntry',entry:{...entry,exercises:[{...entry.exercises[1],sets:entry.exercises[0].sets}]}})).status,400,'Activity cannot silently carry sets');
 assert.equal((await call({action:'deleteEntry',id})).status,200);assert.equal((await read()).entries.some(e=>e.id===id),false);
 assert.equal((await call({action:'restoreEntry',id})).status,200);assert.equal((await read()).entries.some(e=>e.id===id),true);
 console.log('API checks passed: existing records, individual weights, save/reload, validation, origin, delete/restore.');
}finally{await call({action:'deleteEntry',id})}
