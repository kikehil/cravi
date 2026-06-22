const fs = require('fs');
const path = require('path');

// Load .env
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  });
}

const express = require('express');
const cors = require('cors');
const { data: db, save } = require('./db');
const f = require('./facturama');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// ── EMISORES ──────────────────────────────────────────────────

// List all issuers
app.get('/api/emisores', (req, res) => {
  res.json(db.issuers.map(i => ({ ...i, privateKeyPassword: undefined })));
});

// Upload CSD and register issuer
app.post('/api/emisores', async (req, res) => {
  const { rfc, legalName, fiscalRegime, taxZipCode, certificate, privateKey, privateKeyPassword } = req.body;
  if (!rfc || !legalName || !fiscalRegime || !taxZipCode || !certificate || !privateKey || !privateKeyPassword) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }
  try {
    await f.uploadCsd(rfc.toUpperCase(), certificate, privateKey, privateKeyPassword);
    // Fetch CSD details to get exact name from the certificate
    let certName = legalName.toUpperCase();
    try {
      const csdInfo = await f.getCsd(rfc.toUpperCase());
      console.log('CSD info from Facturama:', JSON.stringify(csdInfo));
      if (csdInfo.TaxpayerName || csdInfo.Name || csdInfo.RazonSocial) {
        certName = (csdInfo.TaxpayerName || csdInfo.Name || csdInfo.RazonSocial).toUpperCase();
      }
    } catch (e2) {
      console.log('Could not fetch CSD details, using provided name:', e2.message || e2);
    }
    const existing = db.issuers.findIndex(i => i.rfc === rfc.toUpperCase());
    const issuer = { rfc: rfc.toUpperCase(), legalName: certName, fiscalRegime, taxZipCode, csdActive: true, createdAt: new Date() };
    if (existing > -1) db.issuers[existing] = { ...db.issuers[existing], ...issuer };
    else db.issuers.push(issuer);
    save();
    res.json({ success: true, issuer });
  } catch (e) {
    const msg = e.body?.ModelState ? Object.values(e.body.ModelState).flat().join(', ') : (e.body?.Message || JSON.stringify(e));
    res.status(e.statusCode || 500).json({ error: msg });
  }
});

// Get CSD status from Facturama
app.get('/api/emisores/:rfc/csd', async (req, res) => {
  try {
    const csd = await f.getCsd(req.params.rfc.toUpperCase());
    res.json(csd);
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.body?.Message || 'Error al consultar CSD' });
  }
});

// Delete issuer CSD
app.delete('/api/emisores/:rfc', async (req, res) => {
  const rfc = req.params.rfc.toUpperCase();
  try {
    await f.deleteCsd(rfc);
    const idx = db.issuers.findIndex(i => i.rfc === rfc);
    if (idx > -1) { db.issuers.splice(idx, 1); save(); }
    res.json({ success: true });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.body?.Message || 'Error al eliminar CSD' });
  }
});

// ── FACTURAS ──────────────────────────────────────────────────

// List invoices (optional filter by ?rfc=)
app.get('/api/facturas', (req, res) => {
  const { rfc } = req.query;
  const result = rfc ? db.invoices.filter(i => i.issuerRfc === rfc.toUpperCase()) : db.invoices;
  res.json(result);
});

// Create CFDI
app.post('/api/facturas', async (req, res) => {
  const { issuerRfc, receiver, items, serie, paymentForm, currency } = req.body;
  const issuer = db.issuers.find(i => i.rfc === (issuerRfc || '').toUpperCase());
  if (!issuer) return res.status(400).json({ error: 'Emisor no encontrado. Registra el CSD primero.' });
  if (!items || !items.length) return res.status(400).json({ error: 'Agrega al menos un concepto' });

  const folio = db.invoices.filter(i => i.issuerRfc === issuer.rfc).length + 1;
  const payload = f.buildCfdi({ issuer, receiver: receiver || {}, items, folio, serie, paymentForm, currency });

  try {
    console.log('CFDI Issuer payload:', JSON.stringify(payload.Issuer));
    const result = await f.createCfdi(payload);
    const invoice = {
      id: Date.now().toString(),
      facturamaId: result.Id,
      uuid: result.Complement?.TaxStamp?.Uuid || null,
      issuerRfc: issuer.rfc,
      receiverRfc: receiver?.rfc || 'XAXX010101000',
      receiverName: receiver?.name || 'PUBLICO EN GENERAL',
      serie: serie || 'F',
      folio,
      total: result.Total || 0,
      status: 'vigente',
      cfdiType: 'issued',
      createdAt: new Date()
    };
    db.invoices.push(invoice);
    save();
    res.status(201).json({ success: true, invoice, cfdi: result });
  } catch (e) {
    const msg = e.body?.ModelState ? Object.values(e.body.ModelState).flat().join(', ') : (e.body?.Message || JSON.stringify(e));
    res.status(e.statusCode || 500).json({ error: msg });
  }
});

// Get invoice detail
app.get('/api/facturas/:id', (req, res) => {
  const inv = db.invoices.find(i => i.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Factura no encontrada' });
  res.json(inv);
});

// Download invoice (pdf, xml, html)
app.get('/api/facturas/:id/download/:format', async (req, res) => {
  const inv = db.invoices.find(i => i.id === req.params.id);
  if (!inv || !inv.facturamaId) return res.status(404).json({ error: 'Factura no encontrada' });
  const { format } = req.params;
  try {
    const data = await f.downloadCfdi(inv.cfdiType || 'issued', inv.facturamaId, format);
    const content = data.Content || data.content || data;
    const buffer = Buffer.from(content, 'base64');
    const mime = { pdf: 'application/pdf', xml: 'application/xml', html: 'text/html' }[format] || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${inv.serie}-${inv.folio}.${format}"`);
    res.send(buffer);
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.body?.Message || 'Error al descargar' });
  }
});

// Cancel invoice
app.delete('/api/facturas/:id', async (req, res) => {
  const inv = db.invoices.find(i => i.id === req.params.id);
  if (!inv || !inv.facturamaId) return res.status(404).json({ error: 'Factura no encontrada' });
  const motive = req.query.motive || '02';
  try {
    await f.cancelCfdi(inv.cfdiType || 'issued', inv.facturamaId, motive);
    inv.status = 'cancelada';
    save();
    res.json({ success: true });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.body?.Message || 'Error al cancelar' });
  }
});

// ── CONFIG ───────────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  res.json({
    env: process.env.FACTURAMA_ENV || 'sandbox',
    user: process.env.FACTURAMA_USER || 'prueba',
    host: (process.env.FACTURAMA_ENV || 'sandbox') === 'production' ? 'api.facturama.mx' : 'apisandbox.facturama.mx'
  });
});

// ── START ─────────────────────────────────────────────────────

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n✅ Facturación Multi-Emisor corriendo en http://localhost:${PORT}`);
  console.log(`   Facturama: ${(process.env.FACTURAMA_ENV || 'sandbox').toUpperCase()} — ${process.env.FACTURAMA_USER || 'prueba'}\n`);
});
