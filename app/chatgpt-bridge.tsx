'use client';
import {useMemo,useState} from 'react';
import {Copy,ExternalLink,Check} from 'lucide-react';
import {chatGPTBrief,type Diary} from '@/lib/fitness';
export default function ChatGPTBridge({diary,now}:{diary:Diary;now:string}){
 const [status,setStatus]=useState(''),[show,setShow]=useState(false);
 const brief=useMemo(()=>chatGPTBrief(diary.entries,diary.profile,now),[diary.entries,diary.profile,now]);
 return <section className="card chatgpt-bridge"><div className="eyebrow">ТВОЙ ОТДЕЛЬНЫЙ ДИАЛОГ</div><h3>Продолжить в ChatGPT</h3><p>Скопируй сводку и вставь её в свой чат. В ней — цель, цикл, карта нагрузки и до 30 последних записей. Ответ появится в ChatGPT; автоматической синхронизации здесь нет.</p><div className="bridge-actions"><button className="button" onClick={async()=>{try{await navigator.clipboard.writeText(brief);setStatus('Сводка скопирована. Вставь её в ChatGPT.')}catch{setShow(true);setStatus('Выдели и скопируй сводку из поля ниже.')}}}><Copy size={16}/>Скопировать сводку</button><a className="button" href={diary.profile.chatgptUrl||'https://chatgpt.com/'} target="_blank" rel="noopener noreferrer">{diary.profile.chatgptUrl?'Открыть мой чат':'Открыть ChatGPT'}<ExternalLink size={16}/></a></div>{status&&<p role="status" className="save-status"><Check size={14}/>{status}</p>}<button className="text-button bridge-preview" onClick={()=>setShow(!show)}>{show?'Скрыть сводку':'Посмотреть, что попадёт в сводку'}</button>{show&&<textarea className="brief-preview" aria-label="Сводка для ChatGPT" readOnly value={brief} rows={10} onFocus={e=>e.currentTarget.select()}/>}<p className="field-help">Ссылку на постоянный чат можно сохранить во вкладке «Обо мне».</p></section>;
}
