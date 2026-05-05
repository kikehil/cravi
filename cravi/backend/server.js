const http = require('http');
const fs = require('fs');
const path = require('path');

// Manual .env loader
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) process.env[key.trim()] = value.trim().replace(/^"(.*)"$/, '$1');
  });
}

const DB_FILE = path.join(__dirname, 'db.json');

// CEO Credentials
const CEO_USER = process.env.CEO_USER || 'admin';
const CEO_PASS = process.env.CEO_PASS || 'cravi2024';

// Initialize simple JSON DB
let db = { businesses: [], products: [], orders: [], waitlist: [] };
if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  if (!db.waitlist) db.waitlist = [];
} else {
  fs.writeFileSync(DB_FILE, JSON.stringify(db));
}

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Evolution API Configuration (Update these in .env or here)
const EVO_URL = process.env.EVO_URL || 'http://localhost:8080';
const EVO_KEY = process.env.EVO_KEY || '429683C4C97C-43E1-92D0-62985160'; // Placeholder
const EVO_INSTANCE = process.env.EVO_INSTANCE || 'MainInstance';

async function sendWhatsApp(phone, text) {
  if (!phone) return;
  console.log(`[WhatsApp] Sending to ${phone}: ${text.substring(0, 50)}...`);
  try {
    const res = await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY },
      body: JSON.stringify({ number: phone, text: text })
    });
    return await res.json();
  } catch (err) {
    console.error('[WhatsApp] Error:', err.message);
  }
}

const nodemailer = require('nodemailer');

const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendEmail(email, subject, text) {
  if (!email || !process.env.SMTP_USER) {
    console.log(`[Email] Skipped (no SMTP config) → ${email}: ${subject}`);
    return;
  }
  try {
    await emailTransporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject,
      text
    });
    console.log(`[Email] Sent to ${email}: ${subject}`);
  } catch (err) {
    console.error('[Email] Error:', err.message);
  }
}

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Invalid URL' }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  } 
  else if (req.method === 'GET' && url.pathname === '/api/businesses') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(db.businesses));
  }
  else if (req.method === 'GET' && url.pathname === '/activate') {
    const id = url.searchParams.get('id');
    const biz = db.businesses.find(b => b.id === id);
    if (biz) {
      biz.active = true;
      biz.status = 'activo';
      saveDb();
      const isPlus = biz.plan && biz.plan.toLowerCase() === 'plus';
      const panelUrl = isPlus ? `/cravi-panelplus.html?id=${biz.id}` : `/business-panel.html?id=${biz.id}`;
      const activationMsg = `🎉 ¡Tu cuenta en Cravi está activa!\n\nYa puedes acceder a tu panel: ${(process.env.BASE_URL || 'http://localhost:3000')}${panelUrl}`;
      sendWhatsApp(biz.bizWhatsapp || biz.ownerPhone, activationMsg);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="3;url=${panelUrl}"><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff8f5}.box{text-align:center;padding:40px}h1{color:#FF4103}p{color:#666}</style></head><body><div class="box"><div style="font-size:60px">🎉</div><h1>¡Cuenta activada!</h1><p><strong>${biz.bizName}</strong> ya está activo en Cravi.</p><p>Redirigiendo al panel...</p><p><a href="${panelUrl}" style="color:#FF4103;font-weight:700">Ir al panel →</a></p></div></body></html>`);
    } else {
      res.writeHead(404);
      res.end('Negocio no encontrado');
    }
  }
  else if (req.method === 'POST' && url.pathname === '/api/businesses') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const business = { id: Date.now().toString(), ...data, active: false, status: 'pendiente' };
        db.businesses.push(business);
        saveDb();

        const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
        const activationLink = `${BASE_URL}/activate?id=${business.id}`;
        const message = `¡Bienvenido a Cravi! 🚀\n\nTu negocio *${business.bizName || 'Nuevo Negocio'}* ha sido registrado.\n\nEn cuanto nuestro equipo lo active, recibirás otro mensaje. Acceso anticipado:\n${activationLink}`;

        sendWhatsApp(data.bizWhatsapp || data.ownerPhone, message);
        sendEmail(data.ownerEmail, 'Activa tu cuenta en Cravi', message);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, businessId: business.id }));
      } catch (e) {
        console.error('Error parsing business data:', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON data' }));
      }
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
      try {
        const data = JSON.parse(body);
        const product = { id: Date.now().toString(), ...data };
        db.products.push(product);
        saveDb();
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(product));
      } catch (e) {
        console.error('Error parsing product data:', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON data' }));
      }
    });
  }
  else if (req.method === 'PUT' && url.pathname === '/api/products') {
    const id = url.searchParams.get('id');
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const idx = db.products.findIndex(p => p.id === id);
        if (idx > -1) {
          db.products[idx] = { ...db.products[idx], ...data };
          saveDb();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(db.products[idx]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Product not found' }));
        }
      } catch (e) {
        console.error('Error updating product:', e);
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON data' }));
      }
    });
  }
  else if (req.method === 'GET' && url.pathname === '/api/orders') {
    const bId = url.searchParams.get('businessId');
    const orders = bId ? db.orders.filter(o => o.businessId === bId) : db.orders;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(orders));
  }
  else if (req.method === 'PATCH' && url.pathname === '/api/orders') {
    const id = url.searchParams.get('id');
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const idx = db.orders.findIndex(o => o.id === id);
        if (idx > -1) {
          db.orders[idx] = { ...db.orders[idx], ...data };
          saveDb();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(db.orders[idx]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Order not found' }));
        }
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  }
  else if (req.method === 'PUT' && url.pathname === '/api/businesses') {
    const id = url.searchParams.get('id');
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const idx = db.businesses.findIndex(b => b.id === id);
        if (idx > -1) {
          db.businesses[idx] = { ...db.businesses[idx], ...data };
          saveDb();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(db.businesses[idx]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Business not found' }));
        }
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  }
  else if (req.method === 'POST' && url.pathname === '/api/checkout') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { phone, message, businessId, items, total, customerName, address, paymentMethod, customerNote } = data;
        
        const order = { 
          id: Date.now().toString(), 
          phone, 
          message, 
          businessId, 
          status: 'NUEVO', 
          date: new Date(),
          items: items || [],
          total: total || 0,
          customerName: customerName || 'Anónimo',
          address: address || '',
          paymentMethod: paymentMethod || 'Efectivo',
          customerNote: customerNote || ''
        };
        db.orders.push(order);
        saveDb();

        const orderBiz = db.businesses.find(b => b.id === businessId);
        const bizPhone = orderBiz ? (orderBiz.bizWhatsapp || orderBiz.ownerPhone) : null;
        console.log(`Sending WhatsApp to business ${bizPhone}`);
        sendWhatsApp(bizPhone, message);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, orderId: order.id }));
      } catch (e) {
        console.error('Error parsing checkout data:', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON data' }));
      }
    });
  }
  else if (req.method === 'POST' && url.pathname === '/api/waitlist') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const entry = { id: Date.now().toString(), date: new Date(), ...data };
        db.waitlist.push(entry);
        saveDb();

        if (data.email) {
          const subject = data.type === 'business' ? 'Registro de negocio en Cravi' : 'Bienvenido a la lista de espera de Cravi';
          const text = data.type === 'business' 
            ? `Hola ${data.bizName},\n\nHemos recibido tu solicitud para registrar tu negocio en Cravi. Nuestro equipo se pondrá en contacto contigo pronto.`
            : `Hola ${data.name},\n\n¡Gracias por unirte a la lista de espera de Cravi! Serás de los primeros en saber cuando estemos listos en Pánuco.`;
          
          sendEmail(data.email, subject, text);
        }

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  }
  // --- CEO DASHBOARD ENDPOINTS ---
  else if (req.method === 'POST' && url.pathname === '/api/ceo/login') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        if (username === CEO_USER && password === CEO_PASS) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, token: 'ceo-session-' + Date.now() }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid credentials' }));
        }
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  }
  else if (req.method === 'GET' && url.pathname === '/api/ceo/stats') {
    const totalBusinesses = db.businesses.length;
    const activeBusinesses = db.businesses.filter(b => b.active).length;
    const totalOrders = db.orders.length;
    const activeUsersCount = new Set(db.orders.map(o => o.phone)).size;
    
    const stats = {
      totalBusinesses,
      activeBusinesses,
      totalOrders,
      conversionRate: totalOrders > 0 ? (totalOrders / (activeUsersCount * 2 || 1) * 100).toFixed(1) : 0,
      churnRate: 0,
      activeUsers: activeUsersCount || 0
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats));
  }
  else if (req.method === 'GET' && url.pathname === '/api/ceo/revenue') {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago'];
    const currentYear = new Date().getFullYear();
    const activityHistory = months.map((m, i) => {
      const count = db.orders.filter(o => {
        const d = new Date(o.date);
        return d.getMonth() === i && d.getFullYear() === currentYear;
      }).length;
      return { month: m, orders: count, newUsers: Math.floor(count * 0.1) };
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ history: activityHistory }));
  }
  else if (req.method === 'GET' && url.pathname === '/api/ceo/businesses') {
    const businessesWithMetrics = db.businesses.map(b => {
      const bizOrders = db.orders.filter(o => o.businessId === b.id);
      return {
        ...b,
        ordersCount: bizOrders.length,
        renewalDate: '2024-12-31'
      };
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(businessesWithMetrics));
  }
  else if (req.method === 'GET' && url.pathname === '/api/ceo/orders-stats') {
    const total = db.orders.length;
    const completed = db.orders.filter(o => o.status === 'ENTREGADO' || o.status === 'ENTREGADO_MANUAL').length;
    
    let manana = 0, tarde = 0, noche = 0;
    db.orders.forEach(o => {
      const hour = new Date(o.date).getHours();
      if (hour >= 6 && hour < 12) manana++;
      else if (hour >= 12 && hour < 19) tarde++;
      else noche++;
    });

    const stats = {
      total,
      completionRate: total > 0 ? (completed / total * 100).toFixed(1) : 0,
      avgItemsPerOrder: total > 0 ? 3.2 : 0,
      dist: {
        manana: total > 0 ? Math.round(manana/total*100) : 33,
        tarde: total > 0 ? Math.round(tarde/total*100) : 34,
        noche: total > 0 ? Math.round(noche/total*100) : 33
      }
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats));
  }
  else {
    const decodedPath = decodeURIComponent(url.pathname);
    const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[\/\\])+/, '');
    const safePath = (normalizedPath === '/' || normalizedPath === '\\' || normalizedPath === '') ? 'index.html' : normalizedPath;
    const filePath = path.join(__dirname, '..', safePath);
    
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = { 
        '.html': 'text/html', 
        '.js': 'text/javascript', 
        '.css': 'text/css', 
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
      };
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
