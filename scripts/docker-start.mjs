import {mkdir,writeFile,cp,rename,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createLocalProxy} from './docker-proxy.mjs';
import {migrateDiary} from './docker-migrate.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function seedEmptyVolume(stateDir,seedDir){
 await mkdir(stateDir,{recursive:true});
 if(existsSync(path.join(stateDir,'v3'))||!existsSync(path.join(seedDir,'snapshot.json')))return false;
 const stage=path.join(stateDir,'.seed-incoming');await rm(stage,{recursive:true,force:true});
 await cp(path.join(seedDir,'v3'),stage,{recursive:true});await rename(stage,path.join(stateDir,'v3'));
 return true;
}
async function main(){
 if(process.env.RITM_CONTAINER!=='1')throw new Error('Этот сценарий запускается через docker compose up, не вместо npm run dev.');
 process.chdir(root);
 const envLines=['OPENAI_API_KEY','OPENAI_MODEL'].filter(k=>process.env[k]).map(k=>`${k}=${JSON.stringify(process.env[k])}`);
 // Runtime-only file, never part of the image or its build arguments.
 await writeFile(path.join(root,'.dev.vars'),envLines.join('\n')+'\n',{mode:0o600});
 const state=path.join(root,'.wrangler/state');
 if(await seedEmptyVolume(state,'/seed'))console.log('Дневник скопирован в отдельный Docker volume. Исходная база не изменена.');
 await migrateDiary(state);
 const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],{cwd:root,stdio:'inherit',env:process.env});
 const proxy=createLocalProxy();let stopping=false;
 function stop(signal='SIGTERM'){if(stopping)return;stopping=true;proxy.close();proxy.closeLocalConnections();child.kill(signal);setTimeout(()=>child.kill('SIGKILL'),10000).unref()}
 process.once('SIGTERM',()=>stop());process.once('SIGINT',()=>stop('SIGINT'));
 child.once('error',error=>{console.error(error.message);stop();process.exitCode=1});
 child.once('exit',(code,signal)=>{proxy.close();proxy.closeLocalConnections();process.exit(code??(stopping?0:1))});
 proxy.once('error',error=>{console.error(error.message);stop();process.exitCode=1});
 proxy.listen(8080,'0.0.0.0',()=>console.log('Docker: http://localhost:5174 — приложение запускается.'));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1});
