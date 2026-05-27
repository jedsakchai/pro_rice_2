const { spawn, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
require('dotenv').config({ override: true });

const port = Number(process.env.PORT || 3002);
const root = path.join(__dirname, '..');
const nodeExe = process.env.NODE_EXE || 'C:\\Program Files\\nodejs\\node.exe';

async function main() {
  const ngrokCmd = path.join(root, 'node_modules', 'ngrok', 'bin', 'ngrok.exe');
  const ngrokConfig = path.join(root, 'ngrok.yml');
  if (!fs.existsSync(ngrokCmd)) {
    throw new Error(`ngrok binary not found at ${ngrokCmd}. Run npm install first.`);
  }

  if (!process.env.NGROK_AUTHTOKEN || !String(process.env.NGROK_AUTHTOKEN).trim()) {
    throw new Error('NGROK_AUTHTOKEN is missing. Set it in .env or the shell before starting the tunnel.');
  }

  console.log(`Starting app on port ${port}...`);
  const appChild = spawn(nodeExe, ['app.js'], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  appChild.unref();

  process.on('exit', () => {
    try { appChild.kill(); } catch {}
  });

  console.log(`Starting ngrok tunnel to http://localhost:${port}...`);
  const tunnelArgs = ['http', String(port), '--log=stdout'];
  const tunnelChild = spawn(ngrokCmd, tunnelArgs, {
    cwd: root,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: process.env,
  });

  tunnelChild.stdout?.on('data', (chunk) => process.stdout.write(chunk));
  tunnelChild.stderr?.on('data', (chunk) => process.stderr.write(chunk));

  let publicUrl = null;
  for (let i = 0; i < 50; i += 1) {
    try {
      publicUrl = await new Promise((resolve) => {
        const req = http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
          let raw = '';
          res.on('data', (chunk) => { raw += chunk; });
          res.on('end', () => {
            try {
              const data = JSON.parse(raw);
              const tunnels = Array.isArray(data.tunnels) ? data.tunnels : [];
              const httpsTunnel = tunnels.find((t) => t.proto === 'https');
              const anyTunnel = tunnels[0];
              resolve((httpsTunnel || anyTunnel || {}).public_url || null);
            } catch {
              resolve(null);
            }
          });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(1000, () => {
          req.destroy();
          resolve(null);
        });
      });
      if (publicUrl) break;
    } catch {
      // retry until ngrok API is ready
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!publicUrl) {
    throw new Error('ngrok started but no public URL was detected. Check http://127.0.0.1:4040');
  }

  console.log(`Public URL: ${publicUrl}`);

  try {
    if (process.platform === 'win32') {
      execFile('cmd', ['/c', 'start', '', publicUrl], { cwd: root, stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      execFile('open', [publicUrl], { cwd: root, stdio: 'ignore' });
    } else {
      execFile('xdg-open', [publicUrl], { cwd: root, stdio: 'ignore' });
    }
  } catch {
    // ignore open failures
  }

  try {
    console.log('ngrok inspector: http://127.0.0.1:4040');
  } catch {
    // ignore
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});