const http = require('http');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

// Initialize simple JSON DB
let db = { businesses: [], products: [], orders: [] };
if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} else {
  fs.writeFileSync(DB_FILE, JSON.stringify(db));
}

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  } 
  else if (req.method === 'GET' && url.pathname === '/api/businesses') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(db.businesses));
  }
  else if (req.method === 'POST' && url.pathname === '/api/businesses') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      const data = JSON.parse(body);
      const business = { id: Date.now().toString(), ...data };
      db.businesses.push(business);
      saveDb();
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, businessId: business.id }));
    });
  }
  else if (req.method === 'GET' && url.pathname === '/api/products') {
    const bId = url.searchParams.get('businessId');
    const prods = bId ? db.products.filter(p => p.businessId === bId) : db.products;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(prods));
  }
  else if (req.method === 'POST' && url.pathname === '/api/products') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      const data = JSON.parse(body);
      const product = { id: Date.now().toString(), ...data };
      db.products.push(product);
      saveDb();
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(product));
    });
  }
  else if (req.method === 'POST' && url.pathname === '/api/checkout') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      const data = JSON.parse(body);
      const { phone, message, businessId } = data;
      
      const order = { id: Date.now().toString(), phone, message, businessId, status: 'NUEVO', date: new Date() };
      db.orders.push(order);
      saveDb();

      console.log(`Sending WhatsApp via Evolution API to ${phone}`);
      // Evolution API POST would go here using native fetch()
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, orderId: order.id }));
    });
  }
  else {
    const safePath = path.normalize(url.pathname).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(__dirname, '..', safePath === '/' ? 'index.html' : safePath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(fs.readFileSync(filePath));
      return;
    }
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running without dependencies at http://localhost:${PORT}`);
});
