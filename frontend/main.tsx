import React from 'react';
import { createRoot } from 'react-dom/client';
import FitnessApp from '../app/fitness-app';
import { today } from '../lib/fitness';
import '../app/globals.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><FitnessApp initialDate={today()} /></React.StrictMode>,
);
