import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';

const root = resolve('dist');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.jpg':'image/jpeg', '.png':'image/png', '.mp4':'video/mp4' };
createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let file = resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type':types[extname(file)] || 'application/octet-stream' }).end(data);
  } catch { response.writeHead(404).end('Não encontrado'); }
}).listen(4173, '127.0.0.1', () => console.log('Preview at http://127.0.0.1:4173/'));

