'use client';
import {useState} from 'react';
import {RefreshCw} from 'lucide-react';
import type {ApiCall} from './assistant-panel';
export default function AIConnection({api,refresh,available}:{api:ApiCall;refresh:()=>Promise<void>;available:boolean}){
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(false);
 async function check(){setBusy(true);setStatus('');try{const result=await api({action:'checkAI'});setStatus(`Подключение работает · ${result.model}`);setError(false);await refresh()}catch(e){setStatus((e as Error).message);setError(true);await refresh().catch(()=>{})}finally{setBusy(false)}}
 return <div className="ai-connection">{!available&&<details open><summary>Как подключить советы</summary><ol><li>Создай API-ключ в <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">OpenAI</a>.</li><li>В папке проекта открой <code>.dev.vars</code> и добавь ключ после <code>OPENAI_API_KEY=</code>. Ключ остаётся на сервере.</li><li>Перезапусти сайт, проверь подключение и включи передачу контекста в «Обо мне».</li></ol><p className="field-help">Ключ не нужно присылать в чат. <a href="https://developers.openai.com/api/docs/quickstart" target="_blank" rel="noreferrer">Инструкция OpenAI</a></p></details>}<button className="button" disabled={busy} onClick={check}>{busy&&<RefreshCw size={15} className="spin"/>}{busy?'Проверяю…':'Проверить подключение'}</button><p className="field-help">Проверка отправляет короткий тестовый запрос без дневника.</p>{status&&<p role="status" className={error?'error-box':'connection-success'}>{status}</p>}</div>;
}
