'use client';
import {useEffect,useRef,useState} from 'react';
import {type Entry,shortDate,daysBetween,today} from '@/lib/fitness';
import {dailyWeights,weightStrengthTrend} from '@/lib/progress';
import {Choice} from './entry-editor';
const n=(v:number,digits=1)=>v.toLocaleString('ru-RU',{maximumFractionDigits:digits});
export function TrendSummary({entries,now,days=30,compact=false}:{entries:Entry[];now:string;days?:number;compact?:boolean}){
 const trend=weightStrengthTrend(entries,now,days);
 return <div className="trend-summary"><strong>{trend.title}</strong><p>{trend.text}</p>{trend.weightDelta!==null&&<div className="trend-metrics"><span>Изменение медианы веса: {trend.weightDelta>0?'+':''}{n(trend.weightDelta)} кг</span>{trend.strengthChange!==null&&<span>Рабочие веса: {trend.strengthChange>0?'+':''}{n(trend.strengthChange)}% · {trend.comparisons.length} упр.</span>}</div>}{!compact&&trend.comparisons.length>0&&<details className="chart-details"><summary>Какие подходы сравниваем</summary><div className="table-scroll"><table><thead><tr><th>Упражнение</th><th>Повторения</th><th>Раньше, кг</th><th>Позже, кг</th><th>Изменение</th></tr></thead><tbody>{trend.comparisons.map(c=><tr key={c.name}><td>{c.name}<small>{shortDate(c.beforeDate,true)} → {shortDate(c.afterDate,true)}</small></td><td>{c.reps}</td><td>{n(c.before)}</td><td>{n(c.after)}</td><td>{c.change>0?'+':''}{n(c.change)}%</td></tr>)}</tbody></table></div></details>}{!compact&&<details className="chart-details"><summary>Как считается вывод</summary><p>Сравниваем медианы ежедневных замеров массы тела в двух половинах показанного периода. Нужно минимум 4 дня измерений, по 2 в каждой половине, и интервал от 14 дней. Изменение до 0,3 кг считаем небольшим.</p><p>Для «Силы» сравниваем одинаковые упражнения, повторения и оценку тяжести. Если тяжесть не указана в обоих подходах, сравнение учитывается с этой неопределённостью. Берём медиану лучших рабочих весов за день в каждой половине; между тренировками — от 7 дней. Разминка и 0 кг исключены. Порог изменения — 2%. Разные упражнения объединяем по процентам, а не килограммам. При разнонаправленных изменениях показываем смешанную тенденцию.</p><p>Техника, оборудование, амплитуда и масса тела в упражнениях с собственным весом здесь не учтены. Сохраняй варианты упражнений под разными именами. Вывод описывает записи, а не состав тела или причину изменений.</p></details>}</div>;
}
export default function WeightChart({entries,now=today(),days=30,compact=false}:{entries:Entry[];now?:string;days?:number;compact?:boolean}){
 const [mode,setMode]=useState('weight'),[selected,setSelected]=useState<string|null>(null);
 const points=dailyWeights(entries,now,days),baseline=points[0]?.value??0;
 const chartRef=useRef<HTMLDivElement>(null),[chartWidth,setChartWidth]=useState(compact?540:800);
 useEffect(()=>{if(!chartRef.current)return;const observer=new ResizeObserver(([entry])=>setChartWidth(Math.floor(entry.contentRect.width)));observer.observe(chartRef.current);return()=>observer.disconnect()},[points.length]);
 if(!points.length)return <div className="chart-empty"><span>↗</span><p>Запиши вес, чтобы увидеть его изменения со временем.</p></div>;
 const dated=(date:string)=>shortDate(date,points.some(p=>p.date.slice(0,4)!==now.slice(0,4)));
 const values=points.map(p=>mode==='change'?p.value-baseline:p.value);
 const lo=Math.min(...values),hi=Math.max(...values),padding=Math.max(.4,(hi-lo)*.18),min=lo-padding,max=hi+padding;
 const width=Math.max(280,chartWidth),height=compact?240:width<500?260:300,left=52,right=20,top=42,bottom=56,plotWidth=width-left-right,plotHeight=height-top-bottom;
 const span=daysBetween(points[0].date,points.at(-1)!.date);
 const x=(date:string)=>span?left+daysBetween(points[0].date,date)/span*plotWidth:left+plotWidth/2;
 const y=(value:number)=>top+(max-value)/(max-min)*plotHeight;
 const line=points.map((p,i)=>`${i?'L':'M'}${x(p.date)},${y(values[i])}`).join(' ');
 const ticks=Array.from({length:5},(_,i)=>min+(max-min)*i/4);
 const dateTicks=[points[0]],labelGap=points.some(p=>p.date.slice(0,4)!==now.slice(0,4))?120:80;
 for(const p of points.slice(1,-1))if(x(p.date)-x(dateTicks.at(-1)!.date)>=labelGap&&x(points.at(-1)!.date)-x(p.date)>=labelGap)dateTicks.push(p);
 if(points.length>1)dateTicks.push(points.at(-1)!);
 const detail=points.find(p=>p.date===selected);
 return <div className={`weight-chart analytical-chart ${compact?'compact-chart':''}`}><div className="chart-mode" role="group" aria-label="Вид графика веса"><button aria-pressed={mode==='weight'} onClick={()=>setMode('weight')}>Вес, кг</button><button aria-pressed={mode==='change'} onClick={()=>setMode('change')}>Изменение, кг</button></div><div ref={chartRef} className="chart-scroll"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`График ${mode==='change'?'изменения веса':'массы тела'}: X — дата, Y — килограммы`}>
 <text x={left} y={20} className="axis-title">{mode==='change'?'Изменение веса, кг':'Масса тела, кг'}</text>{ticks.map(v=><g key={v}><line x1={left} x2={width-right} y1={y(v)} y2={y(v)} className="chart-gridline"/><text x={left-10} y={y(v)+4} textAnchor="end" className="axis-tick">{n(v)}</text></g>)}<line x1={left} x2={left} y1={top} y2={height-bottom} className="chart-axis"/>{mode==='change'&&<line x1={left} x2={width-right} y1={y(0)} y2={y(0)} className="chart-zero"/>}<path d={line} className="weight-line"/>{points.map((p,i)=><g key={p.date} className="weight-point" role="button" tabIndex={0} aria-label={`${dated(p.date)}: ${n(p.value)} кг, замеров ${p.count}`} onClick={()=>setSelected(p.date)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(p.date)}}}><circle cx={x(p.date)} cy={y(values[i])} r="12" fill="transparent"/><circle cx={x(p.date)} cy={y(values[i])} r={p.date===selected?6:4} className="weight-marker"/></g>)}{dateTicks.map((p,i)=><text key={p.date} x={x(p.date)} y={height-bottom+25} textAnchor={i===0?'start':i===dateTicks.length-1?'end':'middle'} className="axis-tick">{dated(p.date)}</text>)}<text x={width-right} y={height-7} textAnchor="end" className="axis-title">Дата</text></svg></div>
 {mode==='change'&&<p className="field-help">От первого замера: {dated(points[0].date)}, {n(baseline)} кг.</p>}<p className="chart-selection" aria-live="polite">{detail?`${shortDate(detail.date,true)} · ${n(detail.value)} кг${detail.count>1?` · среднее из ${detail.count} замеров`:''}`:points.length===1?'Один замер — одна точка. Линия появится после следующего дня.':'Нажми на точку, чтобы посмотреть измерение.'}</p><TrendSummary entries={entries} now={now} days={days} compact={compact}/></div>;
}
export function WeightProgress({entries,now}:{entries:Entry[];now:string}){
 const [days,setDays]=useState(90);
 return <section className="card weight-progress"><div className="card-heading"><div><h2>Вес и силовые в перспективе</h2><p>Дата по горизонтали · килограммы по вертикали</p></div><Choice label="Период графика веса" value={String(days)} onChange={v=>setDays(Number(v))} options={[{value:'30',label:'30 дней'},{value:'90',label:'90 дней'},{value:'0',label:'Вся история'}]}/></div><WeightChart entries={entries} now={now} days={days}/></section>;
}
