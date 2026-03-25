const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// Read API key from key.txt
let API_KEY = process.env.OPENROUTER_API_KEY || '';
try {
  const keyFile = path.join(__dirname, 'key.txt');
  if (fs.existsSync(keyFile)) {
    API_KEY = fs.readFileSync(keyFile, 'utf8').trim();
  }
} catch(e) {}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // Serve index.html
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // Chat API
  if (req.method === 'POST' && req.url === '/api/chat') {
    if (!API_KEY) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API key not set in key.txt' }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { messages, system } = JSON.parse(body);

        // Build messages array with system prompt as first user message
        const allMessages = [];
        if (system) {
          allMessages.push({ role: 'system', content: system });
        }
        allMessages.push(...messages);

        const payload = JSON.stringify({
          model: 'openrouter/auto',
          messages: allMessages,
          max_tokens: 2048,
          temperature: 0.85
        });

        const options = {
          hostname: 'openrouter.ai',
          path: '/api/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'AJ Chat',
            'Content-Length': Buffer.byteLength(payload)
          }
        };

        const apiReq = https.request(options, (apiRes) => {
          let data = '';
          apiRes.on('data', chunk => data += chunk);
          apiRes.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: parsed.error.message || 'API error' }));
                return;
              }
              const text = parsed?.choices?.[0]?.message?.content || '';
              // Return in same format frontend expects
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ content: [{ type: 'text', text }] }));
            } catch(e) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Parse error: ' + e.message }));
            }
          });
        });

        apiReq.on('error', (e) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        });

        apiReq.write(payload);
        apiReq.end();

      } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ✦ AJ Chat — Powered by OpenRouter (FREE Llama 3.3 70B)');
  console.log('  → Open: http://localhost:' + PORT);
  console.log('');
  if (!API_KEY) {
    console.log('  ⚠  Get FREE key: https://openrouter.ai  → Sign up → API Keys');
    console.log('  → Paste in key.txt and restart');
  } else {
    console.log('  ✓ API key loaded — Ready!');
  }
  console.log('');
});