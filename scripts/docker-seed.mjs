import {DatabaseSync,backup} from 'node:sqlite';
import {mkdir,readdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
// SQLite's backup API includes committed WAL contents while the diary is open.
// Never copy the running database file with a plain filesystem copy.
export async function snapshotDiary(source,target){
 const sourceDir=path.join(source,'v3/d1/miniflare-D1DatabaseObject');
 let files;try{files=(await readdir(sourceDir)).filter(n=>n.endsWith('.sqlite')&&n!=='metadata.sqlite')}catch(e){if(e.code!=='ENOENT')throw e;files=[]}
 if(!files.length){await mkdir(target,{recursive:true});return {databases:0}}
 try{await readFile(path.join(target,'snapshot.json'));return {existing:true}}catch(e){if(e.code!=='ENOENT')throw e}
 const stage=target+'-'+process.pid+'-'+Date.now();
 try{
  const output=path.join(stage,'v3/d1/miniflare-D1DatabaseObject');await mkdir(output,{recursive:true});
  for(const file of files){const db=new DatabaseSync(path.join(sourceDir,file),{readOnly:true});try{await backup(db,path.join(output,file))}finally{db.close()}}
  const metadata={createdAt:new Date().toISOString(),databases:files.length};await writeFile(path.join(stage,'snapshot.json'),JSON.stringify(metadata,null,2)+'\n');
  // Refuse to replace non-empty snapshots or any live state directory.
  await rm(target,{recursive:false}).catch(e=>{if(!['ENOENT','ERR_FS_EISDIR'].includes(e.code))throw e});
  await rename(stage,target);return metadata;
 }catch(e){await rm(stage,{recursive:true,force:true});throw e}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await snapshotDiary(path.join(root,'.wrangler/state'),path.join(root,'.docker-seed'));
 console.log(result.existing?'Снимок для Docker уже существует; исходный дневник не изменён.':result.databases?`Снимок дневника для Docker готов (${result.databases} база). Исходный дневник не изменён.`:'Локальная база не найдена. Docker создаст новый дневник.');
}
