import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    {
      name: 'domfx-local-evidence',
      configureServer(server) {
        server.middlewares.use('/__evidence', async (request, response) => {
          if (
            request.method !== 'POST' ||
            request.headers.origin !== `http://${request.headers.host}`
          ) {
            response.writeHead(403).end();
            return;
          }
          try {
            let body = '';
            for await (const chunk of request) {
              body += chunk;
              if (body.length > 20_000_000) throw new Error('evidence too large');
            }
            const { report, images } = JSON.parse(body);
            const directory = resolve(
              import.meta.dirname,
              '../../docs/evidence/capture-sdf',
              new Date().toISOString().replace(/[:.]/g, '-'),
            );
            await mkdir(directory, { recursive: true });
            await writeFile(
              resolve(directory, 'report.json'),
              JSON.stringify(report, null, 2) + '\n',
            );
            for (const [name, data] of Object.entries(images as Record<string, string>)) {
              if (!/^[a-z0-9-]+$/.test(name) || !data.startsWith('data:image/png;base64,'))
                throw new Error('invalid diagnostic image');
              await writeFile(
                resolve(directory, `${name}.png`),
                Buffer.from(data.slice(22), 'base64'),
              );
            }
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ directory }));
          } catch (error) {
            response.writeHead(500).end(String(error));
          }
        });
      },
    },
  ],
});
