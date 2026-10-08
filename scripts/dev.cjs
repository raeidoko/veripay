const { spawn } = require('node:child_process');

const path = require('node:path');

function run(name, command, args) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.log(`[${name}] exited with code ${code}`);
      shutdown(code || 0);
    }
  });

  return child;
}

let shuttingDown = false;
const viteBin = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
const children = [
  run('api', process.execPath, ['server.cjs']),
  run('web', process.execPath, [viteBin, '--port=3001', '--host=0.0.0.0']),
];

function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
