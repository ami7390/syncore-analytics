// Restrict every Chromium HTTP(S) connection, including redirects and subresources.
// Bind locally; never expose this proxy to the internet.
import http from 'node:http';
import net, { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

export function isPublicIPv4(ip) {
  if (isIP(ip) !== 4) return false;
  const [a,b,c] = ip.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || b === 88 && c === 99)) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113));
}

export async function resolvePublicHost(hostname) {
  if (!hostname || isIP(hostname) || hostname === 'localhost' || !hostname.includes('.')) throw new Error('Host rejected');
  const addresses = await lookup(hostname, { all: true, family: 4, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicIPv4(address))) throw new Error('Non-public DNS answer');
  return addresses[0].address;
}

export async function startAuditProxy() {
  const server = http.createServer((_req, res) => { res.writeHead(403); res.end(); });
  server.on('connect', async (req, client, head) => {
    let upstream;
    try {
      const match = /^([^:/\s]+):(443)$/.exec(req.url || '');
      if (!match) throw new Error('Only HTTPS 443 allowed');
      const address = await resolvePublicHost(match[1].toLowerCase());
      upstream = net.connect({ host: address, port: 443, timeout: 15000 });
      upstream.once('connect', () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream.write(head);
        client.pipe(upstream); upstream.pipe(client);
      });
      upstream.on('error', () => client.destroy());
      upstream.on('timeout', () => upstream.destroy());
      client.on('error', () => upstream.destroy());
      client.on('close', () => upstream.destroy());
    } catch {
      client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      upstream?.destroy();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { port: server.address().port, close: () => new Promise(resolve => server.close(resolve)) };
}
