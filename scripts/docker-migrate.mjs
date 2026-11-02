import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function migrateDiary(stateDir=path.join(root,'.wrangler/state'),runtimeDir=path.join(root,'.docker-runtime')){
 const built=JSON.parse(await readFile(path.join(root,'dist/server/wrangler.json'),'utf8'));
 const database=built.d1_databases?.find(x=>x.binding==='DB');if(!database)throw new Error('Сначала выполни npm run build: нужна конфигурация базы DB.');
 const migrations=path.join(runtimeDir,'migrations');await mkdir(migrations,{recursive:true});
 for(const name of (await readdir(path.join(root,'drizzle'))).filter(n=>n.endsWith('.sql')).sort()){
  let sql=await readFile(path.join(root,'drizzle',name),'utf8');
  // Older local installs applied the first migration manually, without D1's
  // migration ledger. Bootstrap its existing tables without replacing rows.
  if(name==='0000_grey_vision.sql')sql=sql.replace(/CREATE TABLE /g,'CREATE TABLE IF NOT EXISTS ').replace(/CREATE INDEX /g,'CREATE INDEX IF NOT EXISTS ');
  await writeFile(path.join(migrations,name),sql);
 }
 const config=path.join(runtimeDir,'wrangler.json');
 await writeFile(config,JSON.stringify({name:'ritm-local-docker',compatibility_date:built.compatibility_date,d1_databases:[{...database,migrations_dir:migrations}]}));
 const result=spawnSync(process.execPath,['--import',path.join(root,'scripts/sites-env.mjs'),path.join(root,'node_modules/wrangler/bin/wrangler.js'),'d1','migrations','apply','DB','--local','--persist-to',stateDir,'--config',config],{cwd:root,stdio:['ignore','inherit','inherit'],env:{...process.env,CI:'true'}});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error('Не удалось подготовить локальную базу. Посмотри ошибку выше и повтори настройку.');
}
