import { database, readDiary, entryStatement, profileStatement } from '@/db/store';
import { actionSchema } from '@/lib/validation';
import { insights, muscleStats, nextCycle, resolveExerciseName, parseExercises, TOPICS, type Entry, type Topic } from '@/lib/fitness';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const LOCAL_USER_ID='local_seedy';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){try{return json({...await readDiary(LOCAL_USER_ID),aiAvailable:false});}catch(error){console.error('diary read failed',error);return json({error:error instanceof Error?error.message:'Не удалось загрузить дневник.'},503);}}
function followUp(topic:Topic,text:string,count:number){
 const questions:Record<Topic,string[]>={workout:['Какие ощущения были после тренировки? Что далось легко, а что тяжело?','Сколько длилась разминка и основная часть?','Что хочешь изменить в следующей тренировке?'],weight:['В какое время и при каких условиях взвешивался?','Что ещё хочешь отметить о сегодняшнем дне?'],sleep:['Насколько выспался? Как это сказалось на энергии?','Что могло повлиять на качество сна?'],nutrition:['Как менялись голод и сытость в течение дня?','Что было удобно в сегодняшнем питании, а что хотелось бы изменить?'],feeling:['Что сегодня могло повлиять на твоё самочувствие?','Что помогло бы сделать следующую тренировку комфортнее?'],note:['Как это связано с твоими тренировками или повседневным ритмом?','Что ещё важно учесть? Можно продолжить эту мысль или выбрать новую тему.','Есть ли привычка, которую хочешь сохранить или изменить?']};
 if(/бол[ьи]|травм|дискомфорт/i.test(text))return 'В каких движениях или обстоятельствах возникает дискомфорт? Сохраним это как контекст, без попытки поставить диагноз.';
 return questions[topic][count%questions[topic].length];
}
export async function POST(request:Request){
 try{const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Запрос с другого сайта отклонён.'},403);
 const raw=await request.text();if(raw.length>150000)return json({error:'Слишком большая запись.'},413);let input;try{input=JSON.parse(raw)}catch{return json({error:'Некорректный запрос.'},400)}
 const parsed=actionSchema.safeParse(input);if(!parsed.success)return json({error:parsed.error.issues[0]?.message??'Проверь введённые данные.'},400);const data=parsed.data;const db=database(),uid=LOCAL_USER_ID;
 if(data.action==='saveEntry'){if(data.entry.date>new Date(Date.now()+86400000).toISOString().slice(0,10))return json({error:'Тренировку из будущего пока нельзя записать.'},400);const diary=await readDiary(uid);const entry={...data.entry,exercises:data.entry.exercises.map(x=>({...x,name:resolveExerciseName(x.name,diary.entries)}))};await entryStatement(uid,entry).run();return json({ok:true});}
 if(data.action==='saveProfile'){await profileStatement(uid,data.profile).run();return json({ok:true});}
 if(data.action==='deleteEntry'){await db.prepare('UPDATE entries SET deleted_at = ? WHERE id = ? AND user_id = ?').bind(new Date().toISOString(),data.id,uid).run();return json({ok:true});}
 if(data.action==='restoreEntry'){await db.prepare('UPDATE entries SET deleted_at = NULL WHERE id = ? AND user_id = ?').bind(data.id,uid).run();return json({ok:true});}
 const diary=await readDiary(uid);
 if(data.action==='checkAI'||data.action==='advice')return json({error:'В локальной версии ИИ не используется.'},410);
 if(data.action==='report'){const stats=muscleStats(diary.entries,30,data.date),notes=insights(diary.entries,diary.profile,data.date),stage=nextCycle(diary.entries,diary.profile,data.date);const nonzero=stats.filter(g=>g.sets>0).sort((a,b)=>b.sets-a.sets);return json({reply:diary.entries.some(e=>e.kind==='workout')?`${notes.map(x=>x.title+'. '+x.text).join('\n\n')}\n\nВ твоём цикле следующим идёт «${diary.profile.cycle[stage]}». ${nonzero.length?`За 30 дней больше всего записанных рабочих подходов: ${nonzero.slice(0,2).map(g=>`${g.name.toLowerCase()} — ${g.sets}`).join(', ')}.`:''}\n\nЭто обзор записей, а не оценка восстановления. Как чувствуешь себя сегодня?`:'Сначала добавь хотя бы одну тренировку. Тогда я смогу показать распределение нагрузки и заметить, что выпадает из твоего цикла.'});}
 const existing=await db.prepare('SELECT text FROM messages WHERE id = ? AND user_id = ?').bind(data.id+'-reply',uid).first<{text:string}>();
 if(existing)return json({reply:existing.text,duplicate:true,draft:parseExercises(data.text),mode:'questions'});
 const total=await db.prepare("SELECT COUNT(*) AS count FROM messages WHERE user_id = ? AND role = 'user'").bind(uid).first<{count:number}>();
 const mode='questions',warning='',reply='Записал. '+followUp(data.topic,data.text,total?.count??0);
 const timestamp=new Date().toISOString();let value:number|null=null;const simpleNumber=data.text.trim().match(/^(\d{1,3}(?:[.,]\d+)?)\s*(?:кг|час(?:а|ов)?|ч)?\s*$/i);if(simpleNumber)value=Number(simpleNumber[1].replace(',','.'));
 const kind=data.topic==='weight'&&value!==null&&value>=20&&value<=400?'weight':data.topic==='sleep'&&value!==null&&value>=0&&value<=24?'sleep':['nutrition','feeling'].includes(data.topic)?data.topic as 'nutrition'|'feeling':'note';
 const entry:Entry={id:data.id,date:data.date,kind,text:(data.question?`Вопрос: ${data.question}\n\n`:'')+data.text,title:TOPICS.find(t=>t.id===data.topic)?.name??'Заметка',exercises:[],value:kind==='weight'||kind==='sleep'?value:null,cycleIndex:null,createdAt:timestamp};
 await db.batch([entryStatement(uid,entry),db.prepare('INSERT INTO messages (id,user_id,role,text,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(data.id+'-user',uid,'user',data.text,timestamp),db.prepare('INSERT INTO messages (id,user_id,role,text,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(data.id+'-reply',uid,'assistant',reply,new Date(Date.now()+1).toISOString())]);
 return json({reply,mode,warning,draft:data.topic==='workout'?parseExercises(data.text):[],entryId:data.id});
 }catch(error){console.error('diary save failed',error);return json({error:'Не удалось сохранить. Текст остался на экране — попробуй ещё раз.'},503);}
}
