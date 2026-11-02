import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,mkdir,readdir,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import net from 'node:net';
import {snapshotDiary} from './docker-seed.mjs';
import {seedEmptyVolume} from './docker-start.mjs';
import {migrateDiary} from './docker-migrate.mjs';
import {createLocalProxy} from './docker-proxy.mjs';
const temp=await mkdtemp(path.join(os.tmpdir(),'ritm-docker-check-'));
const source=path.join(temp,'source'),seed=path.join(temp,'seed'),state=path.join(temp,'volume');
let db,proxy,backend,liveProxy;const fixtureSockets=new Set();
const listen=server=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(server.address().port))});
const close=server=>server?new Promise(resolve=>{server.closeLocalConnections?.();server.closeAllConnections?.();server.close(resolve)}):Promise.resolve();
try{
 const dbDir=path.join(source,'v3/d1/miniflare-D1DatabaseObject');await mkdir(dbDir,{recursive:true});
 db=new DatabaseSync(path.join(dbDir,'fixture.sqlite'));db.exec("PRAGMA journal_mode=WAL; CREATE TABLE test (value TEXT); INSERT INTO test VALUES ('kept in WAL');");
 await snapshotDiary(source,seed);assert.equal(await seedEmptyVolume(state,seed),true);
 const copy=new DatabaseSync(path.join(state,'v3/d1/miniflare-D1DatabaseObject/fixture.sqlite'));
 assert.equal(copy.prepare('SELECT value FROM test').get().value,'kept in WAL');copy.exec("UPDATE test SET value='new container record'");copy.close();
 assert.equal(await seedEmptyVolume(state,seed),false,'Existing Docker data must never be replaced by the seed');
 assert.equal((await snapshotDiary(source,seed)).existing,true);assert.equal(db.prepare('SELECT value FROM test').get().value,'kept in WAL');db.close();db=null;
 // Exercise real Wrangler migrations on disposable storage, including legacy
 // tables created before Wrangler's migration ledger was used.
 const migrated=path.join(temp,'migrated'),runtime=path.join(temp,'runtime');await migrateDiary(migrated,runtime);
 const migratedDir=path.join(migrated,'v3/d1/miniflare-D1DatabaseObject');const file=(await readdir(migratedDir)).find(n=>n.endsWith('.sqlite')&&n!=='metadata.sqlite');
 db=new DatabaseSync(path.join(migratedDir,file));db.exec("INSERT INTO profiles (user_id,data,updated_at) VALUES ('qa','{\"kept\":true}','2026-09-28'); DROP TABLE d1_migrations;");db.close();db=null;
 await migrateDiary(migrated,runtime);await migrateDiary(migrated,runtime);
 db=new DatabaseSync(path.join(migratedDir,file));assert.equal(db.prepare("SELECT data FROM profiles WHERE user_id='qa'").get().data,'{"kept":true}');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM d1_migrations').get().n,2);db.close();db=null;
 backend=http.createServer((req,res)=>{let text='';req.on('data',c=>text+=c);req.on('end',()=>{res.writeHead(201,{'content-type':'application/json','set-cookie':'qa=1; HttpOnly'});res.end(JSON.stringify({method:req.method,host:req.headers.host,text,remote:req.socket.remoteAddress}))})});
 backend.on('connection',socket=>{fixtureSockets.add(socket);socket.once('close',()=>fixtureSockets.delete(socket))});
 backend.on('upgrade',(_req,socket)=>{socket.on('error',()=>{});socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');socket.on('data',data=>socket.write(data))});
 const backendPort=await listen(backend);proxy=createLocalProxy(backendPort);const port=await listen(proxy);
 let response=await fetch(`http://127.0.0.1:${port}/path`,{method:'POST',body:'hello'});assert.equal(response.status,201);assert.ok(response.headers.get('set-cookie').includes('qa=1'));const body=await response.json();assert.equal(body.text,'hello');assert.equal(body.host,`127.0.0.1:${port}`);assert.equal(body.remote,'127.0.0.1');
 const blocked=await new Promise((resolve,reject)=>{const req=http.get({hostname:'127.0.0.1',port,headers:{Host:'unrelated.example'}},res=>{res.resume();resolve(res.statusCode)});req.on('error',reject)});assert.equal(blocked,403,'Non-local host must remain blocked');
 await new Promise((resolve,reject)=>{const socket=net.connect(port,'127.0.0.1');const timeout=setTimeout(()=>{socket.destroy();reject(new Error('WebSocket proxy timed out'))},5000);let upgraded=false,received='';socket.on('error',reject);socket.on('connect',()=>socket.write(`GET /hmr HTTP/1.1\r\nHost: localhost:${port}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n`));socket.on('data',chunk=>{received+=chunk.toString();if(!upgraded&&received.includes('\r\n\r\n')){assert.ok(received.startsWith('HTTP/1.1 101'));upgraded=true;received='';socket.write('proxy-echo')}else if(upgraded&&received.includes('proxy-echo')){clearTimeout(timeout);socket.destroy();resolve()}})});
 // Optional check against the already-running local diary; never changes rows.
 if(process.env.CHECK_LOCAL_DIARY==='1'){
  liveProxy=createLocalProxy(5173,'localhost');const livePort=await listen(liveProxy);const base=`http://127.0.0.1:${livePort}`;
  assert.equal((await fetch(base+'/api/diary')).status,401);
  const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});assert.equal(login.status,302);
  const cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');assert.ok(cookie);
  assert.equal((await fetch(base+'/api/diary',{headers:{cookie}})).status,200,'Local sign-in works through proxy');
  assert.equal((await fetch(base+'/api/diary',{method:'POST',headers:{cookie,origin:base,'content-type':'application/json'},body:JSON.stringify({action:'invalid-readonly-check'})})).status,400,'Same-origin POST passes origin/auth checks before validation');
  assert.equal((await fetch(base+'/api/diary',{method:'POST',headers:{cookie,origin:'https://unrelated.example','content-type':'application/json'},body:'{}'})).status,403,'Cross-origin POST remains rejected');
 }
 console.log('Docker support checks passed: WAL snapshot, independent volume, repeat/legacy migrations, HTTP/cookies, local host guard and WebSocket proxy. Docker image itself requires Docker Desktop.');
}finally{db?.close();for(const socket of fixtureSockets)socket.destroy();await close(liveProxy);await close(proxy);await close(backend);await rm(temp,{recursive:true,force:true})}
