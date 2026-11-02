import FitnessApp from './fitness-app';
export const dynamic = 'force-dynamic';
export default function Home() { return <FitnessApp initialDate={new Date().toISOString().slice(0,10)} />; }
