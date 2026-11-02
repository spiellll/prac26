'use client';
import { Sparkles } from 'lucide-react';
import { diaryObservations, type Diary } from '@/lib/fitness';

export default function AdvicePanel({ diary, now }: { diary: Diary; now: string }) {
  const notes = diaryObservations(diary.entries, diary.profile, now);
  return <div className="advice-layout"><div className="advice-main">
    <section className="card ai-advice"><div className="card-heading"><div><div className="eyebrow"><Sparkles size={14}/> ПО ТВОЕМУ ДНЕВНИКУ</div><h2>Что заметил Ритм</h2></div></div><p className="advice-status">Наблюдения рассчитаны здесь, на твоём компьютере. Данные остаются в папке проекта.</p></section>
    <div className="advice-section-heading"><h2>На что обратить внимание</h2><span>По сохранённым тренировкам</span></div>
    <div className="advice-notes">{notes.map(note=><article key={note.id} className="card advice-note"><span className="eyebrow">{note.detail}</span><h3>{note.title}</h3><p>{note.text}</p></article>)}</div>
  </div><aside><div className="soft-note"><Sparkles size={20}/><p>Это подсказки по твоим записям. Ты сам выбираешь, что подходит для следующей тренировки.</p></div></aside></div>;
}
