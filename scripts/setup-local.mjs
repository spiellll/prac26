import './sites-env.mjs';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {migrateDiary} from './docker-migrate.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
try{
 if(!existsSync(path.join(root,'node_modules/vinext/dist/cli.js'))){
  throw new Error('Сначала установи зависимости командой npm ci.');
 }
 console.log('Подготавливаю приложение и локальную базу дневника…');
 const build=spawnSync(process.execPath,[path.join(root,'scripts/run-framework.mjs'),'build'],{cwd:root,stdio:'inherit'});
 if(build.error)throw build.error;
 if(build.status!==0)throw new Error('Сборка не завершилась. Исправь ошибку выше и повтори npm run setup:local.');
 await migrateDiary(path.join(root,'.wrangler/state'),path.join(root,'.wrangler/setup'));
 console.log('\nБаза готова. Существующие записи сохранены.');
 console.log('Запусти npm run dev и открой адрес из терминала (обычно http://localhost:5173).');
 console.log('Дневник хранится в .wrangler/state на этом компьютере. Перенос записей с другого компьютера выполняется отдельно.');
}catch(error){
 console.error('\n'+(error instanceof Error?error.message:String(error)));
 process.exitCode=1;
}
