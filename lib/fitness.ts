export const GROUPS = [
  {id:'chest',name:'Грудь',color:'#8ccc66'}, {id:'back',name:'Спина',color:'#4fa35e'},
  {id:'shoulders',name:'Плечи',color:'#a9dd7d'}, {id:'arms',name:'Руки',color:'#71ba68'},
  {id:'biceps',name:'Бицепс',color:'#b2cbdc'}, {id:'forearms',name:'Предплечья',color:'#9bb8cf'},
  {id:'legs',name:'Ноги',color:'#b4d8ec'}, {id:'glutes',name:'Ягодицы',color:'#b6d58e'},
  {id:'core',name:'Пресс',color:'#c3de9f'}, {id:'calves',name:'Икры',color:'#a2cadb'},
  {id:'strength',name:'Сила',color:'#b8cedf'},
] as const;
export type Group = typeof GROUPS[number]['id'];
export type EntryKind = 'workout'|'weight'|'sleep'|'nutrition'|'feeling'|'note'|'rest';
export const EFFORTS = [{value:'light',label:'Легко',hint:'осталось бы 5+ повторений',factor:.18},{value:'moderate',label:'Рабочий',hint:'осталось бы 3–4 повторения',factor:.5},{value:'hard',label:'Тяжело',hint:'осталось бы 1–2 повторения',factor:.85},{value:'max',label:'Почти предел',hint:'повторений почти не осталось',factor:1}] as const;
export type Effort = typeof EFFORTS[number]['value'];
export type WorkoutSet = {reps:number;weight:number;effort:Effort|null;warmup:boolean};
export type Exercise = {name:string;groups:Group[];sets:WorkoutSet[];tracking?:'sets'|'activity';notes?:string;targetReps?:number};
export type PlanExercise=Omit<Exercise,'sets'>&{warmup?:boolean};
export const COMMON_PREPARATION:PlanExercise[]=[
 {name:'Подтягивания',groups:['back'],targetReps:100},
 {name:'Разминка всего тела',groups:[],tracking:'activity'},
 {name:'Разминка со штангой',groups:[],warmup:true},
 {name:'Вакуум',groups:['core'],tracking:'activity'},
 {name:'Пресс',groups:['core']},
];
export const WORKOUT_PLANS:{name:string;exercises:PlanExercise[]}[]=[
 {name:'Сила + руки',exercises:[...COMMON_PREPARATION,
  {name:'Брусья с дополнительным весом',groups:['chest','arms','strength']},
  {name:'Подтягивания с дополнительным весом',groups:['back','biceps','strength']},
  {name:'Предплечья со штангой',groups:['forearms']},
  {name:'Предплечья с гантелью',groups:['forearms']},
  {name:'Бицепс',groups:['biceps']},{name:'Плечи',groups:['shoulders']}]},
 {name:'Спина',exercises:[...COMMON_PREPARATION,
  {name:'Тяга верхнего блока',groups:['back']},
  {name:'Тяга горизонтального блока',groups:['back']},
  {name:'Лопатка с гантелью',groups:['back']},
  {name:'Спина: нижний блок',groups:['back']},{name:'Плечи',groups:['shoulders']}]},
 {name:'Ноги и остальное',exercises:[...COMMON_PREPARATION,
  {name:'Приседания с весом',groups:['legs','glutes','strength']},
  {name:'Гиперэкстензия',groups:['back','glutes']},
  {name:'Разгибание ног в блоке',groups:['legs']},
  {name:'Ноги в блоке',groups:['legs']},{name:'Плечи',groups:['shoulders']}]},
 {name:'Грудь, трицепс и плечи',exercises:[...COMMON_PREPARATION,
  {name:'Жим лёжа',groups:['chest','arms','strength']},
  {name:'Верх груди',groups:['chest']},
  {name:'Трицепс',groups:['arms']},{name:'Плечи',groups:['shoulders']}]},
];
export const LEGACY_CYCLE=['Фитнес + ноги','Брусья и подтягивания с весом','Спина','Грудь, плечи, руки'];
export function normalizeExercise(x:any):Exercise {
 const sets=Array.isArray(x.sets)?x.sets:Array.from({length:Math.min(30,Math.max(1,Number(x.sets)||1))},()=>({reps:x.reps,weight:x.weight,warmup:x.warmup,effort:null}));
 const rawGroups=Array.isArray(x.groups)?x.groups:x.group?[x.group]:[];
 return {...(x.tracking==='activity'?{tracking:'activity' as const}:{}),...(typeof x.notes==='string'?{notes:x.notes}:{}),...(Number.isInteger(x.targetReps)&&x.targetReps>0?{targetReps:x.targetReps}:{}),name:cleanExerciseName(x.name),groups:[...new Set<Group>(rawGroups.filter((id:Group)=>GROUPS.some(g=>g.id===id)))],sets:sets.map((s:any)=>({reps:s.reps,weight:s.weight,warmup:!!s.warmup,effort:EFFORTS.some(e=>e.value===s.effort)?s.effort:null}))};
}
export function normalizeEntry(e:Entry):Entry {return {...e,exercises:(e.exercises??[]).map(normalizeExercise)};}
export function exerciseSummary(x:Exercise){if(x.tracking==='activity')return x.notes?`Выполнено · ${x.notes}`:'Выполнено';return x.sets.map((s,i)=>`${i+1}: ${s.reps} × ${s.weight} кг${s.warmup?' · разминка':''}${s.effort?' · '+EFFORTS.find(e=>e.value===s.effort)!.label.toLowerCase():''}`).join(' / ');}
export function loadColor(load:number|null){return load===null?'#515763':load===0?'#333942':load<25?'#62778b':load<50?'#8bafbe':load<75?'#bed5dd':'#edf3f5';}

export type Entry = {id:string;date:string;kind:EntryKind;text:string;title:string;exercises:Exercise[];value:number|null;cycleIndex:number|null;createdAt:string};
export type Profile = {name:string;goal:string;experience:string;preferences:string;frequency:number;cycle:string[];reminders:boolean;gapDays:number;reminderTime:string;pausedUntil:string;aiConsent:boolean;chatgptUrl:string};
export type Message = {id:string;role:'user'|'assistant';text:string;createdAt:string};
export type Advice = {text:string;generatedAt:string;revision:string;date:string};
export type Diary = {profile:Profile;entries:Entry[];messages:Message[];aiAvailable:boolean;advice:Advice|null;publicDemo?:boolean};
export const defaultProfile:Profile={name:'',goal:'Просушиться и привести себя в форму',experience:'Раньше занимался армрестлингом, сейчас не занимаюсь.',preferences:'Люблю долгую фитнес-разминку всего тела перед основной тренировкой.',frequency:4,cycle:WORKOUT_PLANS.map(p=>p.name),reminders:true,gapDays:3,reminderTime:'18:00',pausedUntil:'',aiConsent:false,chatgptUrl:''};
export function normalizeProfile(raw:Partial<Profile>):Profile {const profile={...defaultProfile,...raw};if(JSON.stringify(profile.cycle)===JSON.stringify(LEGACY_CYCLE))profile.cycle=WORKOUT_PLANS.map(p=>p.name);return profile;}
export function today(){const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function addDays(day:string,n:number){const d=new Date(day+'T12:00:00'); d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function daysBetween(a:string,b:string){return Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);}
export function shortDate(day:string,withYear=false){return new Date(day+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short',...(withYear?{year:'numeric' as const}:{})});}
export function inPeriod(e:Entry,days:number,now=today()){const age=daysBetween(e.date,now);return age>=0&&age<days;}
// Diary heuristic, not a physiological recovery estimate. Weight is recorded for
// progression; kilograms across different exercises are deliberately not compared.
export function muscleStats(entries:Entry[],days=30,now=today()) {
 return GROUPS.map(g=>{
  const all=entries.filter(e=>e.kind==='workout'&&e.date<=now&&e.exercises.some(x=>x.groups.includes(g.id)&&x.sets.some(s=>!s.warmup)));
  const relevant=all.filter(e=>inPeriod(e,days,now));
  const sets=relevant.reduce((n,e)=>n+e.exercises.filter(x=>x.groups.includes(g.id)).reduce((sum,x)=>sum+x.sets.filter(s=>!s.warmup).length,0),0);
  let units=0,ratedSets=0,unratedSets=0;
  for(const e of all.filter(e=>inPeriod(e,14,now)))for(const x of e.exercises.filter(x=>x.groups.includes(g.id)))for(const s of x.sets.filter(s=>!s.warmup)){
   if(!s.effort){unratedSets++;continue;}
   ratedSets++;
   const effort=EFFORTS.find(f=>f.value===s.effort)!.factor;
   const share=g.id==='strength'?1:1/Math.max(1,x.groups.filter(id=>id!=='strength').length);
   units+=share*effort*Math.min(1.25,Math.max(.65,Math.sqrt(s.reps/8)))*(1-daysBetween(e.date,now)/14);
  }
  const last=all.map(e=>e.date).sort().at(-1);
  const load=unratedSets&&!ratedSets?null:Math.min(100,Math.round(100*(1-Math.exp(-units/6))));
  return {...g,sets,load,ratedSets,unratedSets,last:last??null,daysAgo:last?daysBetween(last,now):null,entries:relevant};
 });
}
export function loadLabel(g:ReturnType<typeof muscleStats>[number]){return g.load===null||!g.last?'—':`${g.unratedSets?'≥ ':''}${g.load}%`;}
export function diaryRevision(entries:Entry[],profile:Profile){
 const input=JSON.stringify({entries:[...entries].sort((a,b)=>a.id.localeCompare(b.id)),profile:{goal:profile.goal,experience:profile.experience,preferences:profile.preferences,frequency:profile.frequency,cycle:profile.cycle,plans:WORKOUT_PLANS}});
 let hash=2166136261;for(let i=0;i<input.length;i++){hash^=input.charCodeAt(i);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);
}
export function diaryObservations(entries:Entry[],profile:Profile,now=today()){
 const result=insights(entries,profile,now).map(x=>({...x,detail:'По датам записей'}));
 if(!entries.some(e=>e.kind==='workout'&&e.date<=now))return result;
 const stats=muscleStats(entries,30,now);
 for(const g of stats.filter(g=>g.daysAgo!==null&&g.daysAgo>=14))if(!result.some(x=>x.id.startsWith('muscle-'+g.id)))result.push({id:'muscle-'+g.id,title:`${g.name}: ${g.daysAgo} дн. без записей`,text:`Последняя основная нагрузка: ${shortDate(g.last!)}; можно свериться со своим циклом и самочувствием.`,kind:'muscle',detail:'По датам записей'});
 const missing=stats.filter(g=>g.id!=='strength'&&!g.last).map(g=>g.name.toLowerCase());
 if(missing.length)result.push({id:'missing-groups',title:'Пока нет записей об этих группах',text:`${missing.join(', ')}. Возможно, нагрузка была, но не записана или не привязана к группе. Сверься со своей программой.`,kind:'muscle',detail:'Пробелы истории'});
 const unknown=entries.filter(e=>e.kind==='workout'&&inPeriod(e,14,now)).reduce((n,e)=>n+e.exercises.filter(x=>x.groups.length).reduce((v,x)=>v+x.sets.filter(s=>!s.warmup&&!s.effort).length,0),0);
 if(unknown)result.push({id:'effort',title:`Тяжесть не указана: ${unknown} подходов`,text:'Добавь ощущения от рабочих подходов за последние 14 дней. Тогда карта сможет оценить их вклад в нагрузку.',kind:'start',detail:'Неполные данные'});
 const lastByExercise=new Map<string,{name:string;date:string}>();for(const e of recentWorkouts(entries).filter(e=>e.date<=now))for(const x of e.exercises)if(x.sets.some(s=>!s.warmup)&&!lastByExercise.has(exerciseKey(x.name)))lastByExercise.set(exerciseKey(x.name),{name:x.name,date:e.date});
 for(const x of [...lastByExercise.values()].filter(x=>daysBetween(x.date,now)>=14).slice(0,4))result.push({id:'exercise-'+x.name,title:`${x.name}: давно не записывал`,text:`Последняя запись — ${shortDate(x.date)}, ${daysBetween(x.date,now)} дн. назад. Возможно, упражнение заменено другим — это тоже полезно отметить.`,kind:'muscle',detail:'История упражнения'});
 if(!result.length)result.push({id:'cycle',title:'Есть свежие записи',text:`Следующим в твоём цикле идёт «${profile.cycle[nextCycle(entries,profile)]}». Сверься с самочувствием перед выбором нагрузки.`,kind:'start',detail:'Твой цикл'});
 return result;
}
export function diaryContext(entries:Entry[],profile:Profile,now=today()){
 return {date:now,profile:{goal:profile.goal,experience:profile.experience,preferences:profile.preferences,frequency:profile.frequency,cycle:profile.cycle},trainingCycle:{sequence:'Одна тренировка за раз: 1 → 2 → 3 → 4 → 1. Это последовательность занятий, не четыре занятия в один день.',nextIndex:nextCycle(entries,profile,now),plans:WORKOUT_PLANS.map((p,i)=>({...p,name:profile.cycle[i]})),note:'Это планы, не выполненная работа. Цель 100 подтягиваний не означает, что они сделаны; учитывай только записанные подходы.'},model:'Условный индекс записанной нагрузки: усилие и повторения рабочих подходов, линейный спад за 14 дней; не физиология и не восстановление. ≥ — нижняя оценка при неизвестной тяжести части подходов. Килограммы разных упражнений не сравниваются. При нескольких мышцах вклад делится поровну; Сила — отдельная категория и не забирает долю мышц.',muscles:muscleStats(entries,30,now).map(({name,sets,last,load,ratedSets,unratedSets})=>({name,sets,last,load:last?load:null,ratedSets,unratedSets})),observations:diaryObservations(entries,profile,now),recentEntries:entries.filter(e=>e.date<=now).slice(0,30)};
}
export function chatGPTBrief(entries:Entry[],profile:Profile,now=today()){
 return 'Ты мой ассистент дневника тренировок. Учти мои цели, опыт и цикл. Заметь группы и упражнения, которые давно не встречались в записях; не делай вывод, что я точно их не тренировал. Предложи варианты, а не обязательный план. Отделяй факты от предположений. Индекс нагрузки условный, не показатель восстановления. Задай один вопрос, который дополнит контекст.\n\n'+JSON.stringify(diaryContext(entries,profile,now),null,2);
}
export function recentWorkouts(entries:Entry[]){return entries.filter(e=>e.kind==='workout').sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));}
export function nextCycle(entries:Entry[],profile:Profile,now=today()){const latest=recentWorkouts(entries).find(e=>e.cycleIndex!==null&&e.date<=now);return latest?((latest.cycleIndex??0)+1)%profile.cycle.length:0;}
export function insights(entries:Entry[],profile:Profile,now=today()){
 const workouts=recentWorkouts(entries).filter(e=>e.date<=now), last=workouts[0], result:{id:string;title:string;text:string;kind:'gap'|'muscle'|'start'}[]=[];
 if(!last)return [{id:'start',title:'Начнём с первой записи?',text:'Добавь тренировку — и здесь появятся наблюдения по твоему дневнику.',kind:'start' as const}];
 if(entries.some(e=>e.kind==='rest'&&e.date===now))return [];
 const gap=daysBetween(last.date,now);
 if(gap>=profile.gapDays)result.push({id:`gap-${last.date}`,title:`${gap} дн. без записи о тренировке`,text:'Может быть, ты отдыхал или просто не записал занятие. Как у тебя дела?',kind:'gap'});
 const neglected=muscleStats(entries,30,now).filter(g=>g.daysAgo!==null&&g.daysAgo>=14).sort((a,b)=>(b.daysAgo??0)-(a.daysAgo??0));
 if(neglected.length){const g=neglected[0];result.push({id:`muscle-${g.id}-${g.last}`,title:`${g.name}: ${g.daysAgo} дн. без записей`,text:`Последняя основная нагрузка отмечена ${shortDate(g.last!)} — если это не запланированный перерыв, можно уделить внимание этой группе.`,kind:'muscle'});}
 return result;
}
export const TOPICS=[{id:'workout',name:'Тренировка',emoji:'💪',question:'Что сегодня делал в зале? Напиши упражнения, вес, подходы и повторения. Например: «Присед 60 кг 3×10».'},{id:'weight',name:'Вес тела',emoji:'⚖️',question:'Какой сейчас вес тела? Укажи число в килограммах — например, 82,4.'},{id:'sleep',name:'Сон',emoji:'🌙',question:'Сколько часов спал? Можно добавить, во сколько лёг и насколько выспался.'},{id:'nutrition',name:'Питание',emoji:'🥑',question:'Что и когда ел сегодня? Запиши в удобном виде, без обязательного подсчёта калорий.'},{id:'feeling',name:'Самочувствие',emoji:'☀️',question:'Как чувствуешь себя сегодня? Что замечаешь до или после тренировки?'},{id:'note',name:'Что-то ещё',emoji:'✏️',question:'Что ещё мне стоит знать о тебе? Привычки, планы, ограничения или просто мысли — всё можно записать.'}] as const;
export type Topic = typeof TOPICS[number]['id'];
export const EXERCISES:{name:string;group:Group;pattern:RegExp}[]=[
{name:'Становая тяга',group:'back',pattern:/станов[а-я]*\s*(?:тяга)?/i},{name:'Приседания',group:'legs',pattern:/присед/i},{name:'Жим ногами',group:'legs',pattern:/жим ног/i},{name:'Выпады',group:'legs',pattern:/выпад/i},{name:'Разгибание ног',group:'legs',pattern:/разгибан.*ног/i},{name:'Сгибание ног',group:'legs',pattern:/сгибан.*ног/i},
{name:'Подтягивания',group:'back',pattern:/подтяг/i},{name:'Тяга верхнего блока',group:'back',pattern:/верхн.*блок|вертикальн.*тяг/i},{name:'Тяга в наклоне',group:'back',pattern:/тяг.*наклон|горизонтальн.*тяг|нижн.*блок/i},
{name:'Брусья',group:'chest',pattern:/брус/i},{name:'Жим лёжа',group:'chest',pattern:/жим.*л[её]жа|жим штанг/i},{name:'Отжимания',group:'chest',pattern:/отжим/i},{name:'Жим гантелей',group:'chest',pattern:/жим гант/i},
{name:'Жим над головой',group:'shoulders',pattern:/жим.*стоя|жим.*голов|армейск.*жим/i},{name:'Махи в стороны',group:'shoulders',pattern:/мах|разведен.*сторон/i},
{name:'Предплечья со штангой',group:'forearms',pattern:/предплеч.*штанг/i},{name:'Предплечья с гантелью',group:'forearms',pattern:/предплеч.*гантел/i},{name:'Сгибания на бицепс',group:'biceps',pattern:/бицепс/i},{name:'Разгибания на трицепс',group:'arms',pattern:/трицепс/i},{name:'Ягодичный мост',group:'glutes',pattern:/ягодич|мост/i},{name:'Подъём на носки',group:'calves',pattern:/носк|икр/i},{name:'Скручивания',group:'core',pattern:/скручив|пресс/i}];
export function parseExercises(text:string):Exercise[]{
 const parts=text.split(/[\n;]+|,\s*(?=[а-яёa-z])/i);const result:Exercise[]=[];
 for(const part of parts){const match=EXERCISES.find(e=>e.pattern.test(part)); if(!match)continue; const numbers=part.match(/(\d{1,2})\s*[xх×*]\s*(\d{1,3})/i)||part.match(/(\d{1,2})\s*(?:подход\w*\s*)?по\s*(\d{1,3})/i);if(!numbers)continue;const sets=Number(numbers[1]),reps=Number(numbers[2]);if(sets<1||sets>30||reps<1||reps>200)continue; const weight=part.match(/(\d{1,3}(?:[.,]\d+)?)\s*кг/i); const rawName=part.slice(0,Math.min(...[numbers.index,weight?.index].filter((v):v is number=>v!==undefined))).replace(/[—–:,-]+$/,'').trim(); const name=canonicalExerciseName(rawName||match.name);
 result.push({name,groups:exerciseKey(name)==='становая тяга'?['back','legs','glutes','strength']:exerciseKey(name)==='приседания'?['legs','glutes','strength']:[match.group],sets:Array.from({length:sets},()=>({reps,weight:weight?Number(weight[1].replace(',','.')):0,warmup:/размин/i.test(part),effort:null}))}); }
 return result;
}
export function demoEntries(now=today()):Entry[]{
const stageGroups:Group[][]=[['legs','glutes','calves'],['back','chest','arms'],['back','shoulders'],['chest','shoulders','arms','core']];
const stages=[0,1,2,3,1,2,3,1,2,3,2,1];const ages=[28,26,24,22,20,18,16,13,10,8,5,3];
const titles=defaultProfile.cycle;
const entries:Entry[]=stages.map((stage,i)=>({id:`demo-${i}`,date:addDays(now,-ages[i]),kind:'workout',title:titles[stage],text:'Демонстрационная запись. Это пример, а не твоя тренировка.',cycleIndex:stage,value:null,createdAt:addDays(now,-ages[i])+'T12:00:00Z',exercises:stageGroups[stage].map((g,j)=>({name:EXERCISES.find(e=>e.group===g)?.name??g,groups:([g,...(['legs','back','chest'].includes(g)?['strength']:[])] as Group[]),sets:Array.from({length:3+(i+j)%2},(_,k)=>({reps:8+(i%3)*2,weight:20+(i%3)*5+k*2.5,warmup:false,effort:k===0?'moderate':'hard'}))}))}));
 [84.1,83.8,83.9,83.3,83.1,82.8,82.4].forEach((v,i)=>entries.push({id:`demo-weight-${i}`,date:addDays(now,-28+i*4),kind:'weight',title:'Вес тела',text:'Пример измерения',exercises:[],cycleIndex:null,value:v,createdAt:addDays(now,-28+i*4)+'T09:00:00Z'}));return entries;
}
export const KIND_NAMES:Record<EntryKind,string>={workout:'Тренировка',weight:'Вес тела',sleep:'Сон',nutrition:'Питание',feeling:'Самочувствие',note:'Заметка',rest:'Отдых'};

// Only explicit aliases are merged. Variants (incline, machine, dumbbell, etc.)
// keep distinct keys; fuzzy search is a suggestion, never a silent merge.
const EXERCISE_ALIASES:Record<string,string>={
 'брусья с весом':'брусья с дополнительным весом','подтягивания с весом':'подтягивания с дополнительным весом',
 'предплечье штанга':'предплечья со штангой','предплечья с штангой':'предплечья со штангой','предплечье гантель':'предплечья с гантелью',
 'блок верт спина':'тяга верхнего блока','спина вертикальный блок':'тяга верхнего блока',
 'блок гориз спина':'тяга горизонтального блока','спина горизонтальный блок':'тяга горизонтального блока',
 'лопатка гантель':'лопатка с гантелью','спина нижний блок':'спина: нижний блок',
 'блок квадрицепс':'разгибание ног в блоке','ноги блок':'ноги в блоке','верхний грудь':'верх груди',
 'ваакуум':'вакуум',
 'присед':'приседания','приседы':'приседания','приседание':'приседания',
 'брусья с доп весом':'брусья с дополнительным весом','отжимания на брусьях с дополнительным весом':'брусья с дополнительным весом','отжимания на брусьях с доп весом':'брусья с дополнительным весом',
 'подтягивания с доп весом':'подтягивания с дополнительным весом',
 'становая':'становая тяга','становая тяга':'становая тяга',
 'подтягивание':'подтягивания','отжимание':'отжимания',
 'жим лежа':'жим лежа','жим штанги лежа':'жим лежа','жим штанги лёжа':'жим лежа',
};
export function cleanExerciseName(name:string){return name.trim().replace(/\s+/g,' ');}
export function exerciseKey(name:string){const key=cleanExerciseName(name).toLocaleLowerCase('ru-RU').replaceAll('ё','е');return EXERCISE_ALIASES[key]??key;}
export function canonicalExerciseName(name:string){const key=exerciseKey(name);return ({'брусья с дополнительным весом':'Брусья с дополнительным весом','подтягивания с дополнительным весом':'Подтягивания с дополнительным весом'} as Record<string,string>)[key]??EXERCISES.find(x=>exerciseKey(x.name)===key)?.name??cleanExerciseName(name);}
export type CatalogExercise={key:string;name:string;groups:Group[];last:string;count:number;aliases:string[]};
export function exerciseCatalog(entries:Entry[]):CatalogExercise[]{
 const items=new Map<string,CatalogExercise>();
 for(const e of recentWorkouts(entries))for(const x of e.exercises){const key=exerciseKey(x.name);if(!key)continue;const existing=items.get(key);if(existing){existing.count++;if(!existing.aliases.includes(x.name))existing.aliases.push(x.name);}else items.set(key,{key,name:canonicalExerciseName(x.name),groups:x.groups,last:e.date,count:1,aliases:[x.name]});}
 return [...items.values()];
}
export function resolveExerciseName(name:string,entries:Entry[]){return exerciseCatalog(entries).find(x=>x.key===exerciseKey(name))?.name??canonicalExerciseName(name);}
