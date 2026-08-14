import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? 4000);

// Placeholder transport. Step 3 replaces this with the Express app, keeping /healthz at the
// same path so the deployment's warm-up target never moves.
const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
});

server.listen(port, () => {
  process.stdout.write(`Server listening on http://localhost:${port}\n`);
});
