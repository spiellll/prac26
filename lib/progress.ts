import {daysBetween,inPeriod,exerciseKey,exerciseCatalog,type Entry,type WorkoutSet} from './fitness';
export type SetPoint=WorkoutSet&{id:string;date:string;entryId:string;setIndex:number;exerciseName:string};
export function exercisePoints(entries:Entry[],key:string,now:string,days=90):SetPoint[]{
 return entries.filter(e=>e.kind==='workout'&&e.date<=now&&(days===0||inPeriod(e,days,now))).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)).flatMap(e=>e.exercises.flatMap((x,xi)=>exerciseKey(x.name)===key?x.sets.map((s,si)=>({...s,id:`${e.id}:${xi}:${si}`,date:e.date,entryId:e.id,setIndex:si+1,exerciseName:x.name})):[]));
}
export function dailyWeights(entries:Entry[],now:string,days=30){
 const buckets=new Map<string,number[]>();
 for(const e of entries.filter(e=>e.kind==='weight'&&e.value!==null&&e.date<=now&&(days===0||inPeriod(e,days,now))))buckets.set(e.date,[...(buckets.get(e.date)??[]),e.value!]);
 return [...buckets].sort(([a],[b])=>a.localeCompare(b)).map(([date,values])=>({date,value:values.reduce((a,b)=>a+b,0)/values.length,count:values.length}));
}
export const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b),m=Math.floor(sorted.length/2);return sorted.length%2?sorted[m]:(sorted[m-1]+sorted[m])/2;};
type Direction='up'|'down'|'flat';
export type StrengthComparison={name:string;before:number;after:number;change:number;reps:number;effort:WorkoutSet['effort'];beforeDate:string;afterDate:string;direction:Direction};
export function weightStrengthTrend(entries:Entry[],now:string,days=30){
 const weights=dailyWeights(entries,now,days);
 const empty={weightDelta:null as number|null,strengthChange:null as number|null,comparisons:[] as StrengthComparison[],from:weights[0]?.date??'',to:weights.at(-1)?.date??'',title:'Пока рано делать вывод',text:'Для тенденции нужны минимум 4 дня с измерением веса за 14 дней. График показывает все доступные замеры.'};
 if(weights.length<4||daysBetween(weights[0].date,weights.at(-1)!.date)<14)return empty;
 const from=weights[0].date,to=weights.at(-1)!.date,mid=daysBetween(from,to)/2;
 const first=weights.filter(p=>daysBetween(from,p.date)<=mid),last=weights.filter(p=>daysBetween(from,p.date)>mid);
 if(first.length<2||last.length<2)return {...empty,text:'Нужно хотя бы по 2 дня с измерением веса в первой и второй половине периода.'};
 const weightDelta=median(last.map(p=>p.value))-median(first.map(p=>p.value));
 const wd:Direction=weightDelta<-.3?'down':weightDelta>.3?'up':'flat';
 const weightTitle=wd==='down'?'Вес снижается':wd==='up'?'Вес растёт':'Вес примерно на месте';
 const inWindow=entries.filter(e=>e.date>=from&&e.date<=to);
 const strengthKeys=new Set(inWindow.flatMap(e=>e.exercises.filter(x=>x.groups.includes('strength')).map(x=>exerciseKey(x.name))));
 const comparisons:StrengthComparison[]=[];
 for(const item of exerciseCatalog(inWindow).filter(x=>strengthKeys.has(x.key))){
  const points=exercisePoints(inWindow,item.key,now,0).filter(p=>!p.warmup&&p.weight>0);
  const firstSets=points.filter(p=>daysBetween(from,p.date)<=mid),lastSets=points.filter(p=>daysBetween(from,p.date)>mid);
  const options=[...new Set(firstSets.map(p=>`${p.reps}:${p.effort??'unknown'}`))].map(signature=>{
   const a=firstSets.filter(p=>`${p.reps}:${p.effort??'unknown'}`===signature),b=lastSets.filter(p=>`${p.reps}:${p.effort??'unknown'}`===signature);
   return {a,b,score:Math.min(new Set(a.map(x=>x.date)).size,new Set(b.map(x=>x.date)).size)};
  }).filter(x=>x.score>0&&daysBetween(x.a[0].date,x.b.at(-1)!.date)>=7).sort((a,b)=>b.score-a.score||b.a.length+b.b.length-a.a.length-a.b.length||a.a[0].reps-b.a[0].reps);
  if(!options.length)continue;
  const {a,b}=options[0];
  const dailyBest=(points:SetPoint[])=>{const days=new Map<string,number>();for(const p of points)days.set(p.date,Math.max(days.get(p.date)??0,p.weight));return [...days.values()]};
  const before=median(dailyBest(a)),after=median(dailyBest(b)),change=(after/before-1)*100;
  comparisons.push({name:item.name,before,after,change,reps:a[0].reps,effort:a[0].effort,beforeDate:a[0].date,afterDate:b.at(-1)!.date,direction:change>2?'up':change< -2?'down':'flat'});
 }
 if(!comparisons.length)return {...empty,weightDelta,title:weightTitle,text:'Для сравнения силовых отметь упражнения категорией «Сила» и повтори их в обеих половинах периода: с одинаковыми повторениями и оценкой тяжести, с интервалом от 7 дней. Без разминки и подходов с 0 кг.'};
 const change=median(comparisons.map(x=>x.change));
 const mixed=comparisons.some(x=>x.direction==='up')&&comparisons.some(x=>x.direction==='down');
 const sd=mixed?'mixed':change>2?'up':change< -2?'down':'flat';
 const strengthTitle=sd==='mixed'?'рабочие веса меняются по-разному':sd==='up'?'рабочие веса растут':sd==='down'?'рабочие веса снижаются':'рабочие веса примерно на месте';
 let text='Сопоставь эту тенденцию со своей целью и планом. Это наблюдение по записям, а не измерение силы.';
 if(wd==='down'&&sd==='up')text='В сопоставимых подходах ты поднимаешь больше при снижении массы тела. Продолжай отмечать самочувствие и условия тренировок.';
 if(wd==='down'&&sd==='flat')text='Рабочие веса сохраняются на фоне снижения массы тела. Полезно следить и за повторениями, и за самочувствием.';
 if(wd==='down'&&sd==='down')text='Стоит свериться с записями сна, отдыха и самочувствия. На рабочие веса также может влиять запланированная смена нагрузки.';
 if(wd==='up'&&sd==='flat')text='Можно сопоставить питание с целью и планом тренировок. Эти графики сами по себе не объясняют причину изменения массы тела.';
 if(sd==='mixed')text='Одни упражнения показывают рост рабочих весов, другие — снижение. Посмотри сравнения отдельно: единый вывод скрыл бы эту разницу.';
 return {...empty,weightDelta,strengthChange:change,comparisons,title:`${weightTitle}, ${strengthTitle}`,text};
}
