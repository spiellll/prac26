import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const python = process.env.RITM_PYTHON || join(root, '.venv', 'bin', 'python');
const mode = process.argv[2] || 'start';
if (!['start', 'dev'].includes(mode)) throw new Error('Expected start or dev');
if (!existsSync(python)) {
  console.error('Создай Python-окружение в папке afanasev1:\npython3 -m venv .venv\nsource .venv/bin/activate\npython -m pip install -r backend/requirements-dev.txt');
  process.exit(1);
}
const vite = join(root, 'node_modules/vite/bin/vite.js');
if (!existsSync(vite)) {
  console.error('Выполни npm ci в папке afanasev1.');
  process.exit(1);
}
if (mode === 'start' && !existsSync(join(root, 'frontend-dist/index.html'))) {
  const build = spawnSync(process.execPath, [vite, 'build', '--config', 'vite.practice.config.ts'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status || 1);
}
const children = [];
let exiting = false;
function stop(signal = 'SIGTERM') {
  if (exiting) return;
  exiting = true;
  for (const child of children) child.kill(signal);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(signal));
function launch(command, args, options = {}) {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', ...options });
  children.push(child);
  child.on('error', error => { console.error(error.message); stop(); process.exitCode = 1; });
  child.on('exit', code => { if (!exiting) { process.exitCode = code || 0; stop(); } });
}
console.log(mode === 'dev' ? '\nРитм: http://127.0.0.1:5173/ · Flask API на 5001\n' : '\nРитм: http://127.0.0.1:5001/ · Ctrl+C для остановки\n');
launch(python, ['-m', 'flask', '--app', 'backend.wsgi:app', 'run', '--host', '127.0.0.1', '--port', '5001']);
if (mode === 'dev') launch(process.execPath, [vite, '--config', 'vite.practice.config.ts']);
