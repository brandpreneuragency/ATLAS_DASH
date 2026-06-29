const http = require('http');

const port = 4010;
const models = {
  object: 'list',
  data: [
    { id: 'mock-model-1', object: 'model', owned_by: 'mock' },
    { id: 'mock-model-2', object: 'model', owned_by: 'mock' },
  ],
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/v1/models' || req.url === '/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(models));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found', path: req.url }));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`mock provider listening on ${port}`);
});
