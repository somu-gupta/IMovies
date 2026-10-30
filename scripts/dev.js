const { spawn } = require('node:child_process');

const commands = [
  ['API', ['--prefix', 'server', 'run', 'dev']],
  ['WEB', ['--prefix', 'client', 'run', 'dev']],
];
const children = commands.map(([label, args]) => {
  const child = spawn('npm', args, { stdio: 'inherit', shell: process.platform === 'win32' });
  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`${label} process stopped with exit code ${code}`);
  });
  return child;
});

function stopAll() {
  for (const child of children) if (!child.killed) child.kill();
}
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
