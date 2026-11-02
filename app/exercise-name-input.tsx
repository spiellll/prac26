'use client';
import {useRef,useState} from 'react';
import {Combobox as Primitive} from '@base-ui/react';
import {Combobox,ComboboxInput,ComboboxList,ComboboxItem,ComboboxEmpty} from '@/components/ui/combobox';
import {exerciseKey,type CatalogExercise} from '@/lib/fitness';
export default function ExerciseNameInput({value,onChange,onSelect,items,index}:{value:string;onChange:(v:string)=>void;onSelect:(x:CatalogExercise)=>void;items:CatalogExercise[];index:number}){
 const popupContainer=useRef<HTMLDivElement>(null);
 const names=items.map(x=>x.name);
 const [selected,setSelected]=useState<string|null>(()=>names.find(n=>exerciseKey(n)===exerciseKey(value))??null);
 return <div className="exercise-autocomplete" ref={popupContainer}><label htmlFor={`exercise-name-${index}`}>Упражнение</label><Combobox items={names} inputValue={value} onInputValueChange={(text,event)=>{if(event.reason==='input-change'){setSelected(null);onChange(text)}}} value={selected} onValueChange={name=>{setSelected(name);const item=items.find(x=>x.name===name);if(item)onSelect(item)}} filter={(item,query)=>[item,...(items.find(x=>x.name===item)?.aliases??[])].some(name=>exerciseKey(name).includes(exerciseKey(query))||name.toLowerCase().replaceAll('ё','е').includes(query.trim().toLowerCase().replaceAll('ё','е')))} autoHighlight={false}>
 {/* Keep the popup inside the dialog so its focus trap allows item selection. */}
 <ComboboxInput id={`exercise-name-${index}`} aria-label={`Упражнение ${index}`} required maxLength={120} placeholder="Начни вводить название" showTrigger={items.length>0}/><Primitive.Portal container={popupContainer}><Primitive.Positioner sideOffset={6} className="exercise-suggestion-positioner"><Primitive.Popup className="exercise-suggestions group/combobox-content" data-slot="combobox-content"><ComboboxEmpty>Новое упражнение — название сохранится</ComboboxEmpty><ComboboxList>{(name:string)=><ComboboxItem key={name} value={name}><span>{name}</span><small>Из твоего дневника</small></ComboboxItem>}</ComboboxList></Primitive.Popup></Primitive.Positioner></Primitive.Portal></Combobox><p className="field-help">Выбери знакомое упражнение, чтобы продолжить его график.</p></div>;
}
