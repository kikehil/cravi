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
  const { issuerRfc, receiver, items, serie, paymentForm, currency, cfdiType, relatedUuid, discount, tip, orderRef } = req.body;
  const issuer = db.issuers.find(i => i.rfc === (issuerRfc || '').toUpperCase());
  if (!issuer) return res.status(400).json({ error: 'Emisor no encontrado. Registra el CSD primero.' });
  if (!items || !items.length) return res.status(400).json({ error: 'Agrega al menos un concepto' });

  const folio = db.invoices.filter(i => i.issuerRfc === issuer.rfc).length + 1;
  const payload = f.buildCfdi({ issuer, receiver: receiver || {}, items, folio, serie, paymentForm, currency, cfdiType, relatedUuid, discount, tip, orderRef });

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
      serie: cfdiType === 'E' ? 'NC' : (serie || 'F'),
      folio,
      total: result.Total || 0,
      status: 'vigente',
      cfdiType: 'issued',
      type: cfdiType || 'I',
      orderRef: orderRef || null,
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
  const mime = { pdf: 'application/pdf', xml: 'application/xml', html: 'text/html' }[format] || 'application/octet-stream';
  const sendBuffer = (b64) => {
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${inv.serie}-${inv.folio}.${format}"`);
    res.send(Buffer.from(b64, 'base64'));
  };
  try {
    const data = await f.downloadCfdi(inv.cfdiType || 'issued', inv.facturamaId, format);
    sendBuffer(data.Content || data.content || data);
  } catch (e) {
    // Sandbox doesn't generate PDF/XML — build mock file from stored invoice data
    const { fakePdfBase64, fakeXmlBase64 } = require('./mock');
    const fakeCfdi = {
      Serie: inv.serie, Folio: String(inv.folio), Date: inv.createdAt,
      Total: inv.total, CfdiType: 'I', Currency: 'MXN',
      Issuer: { Rfc: inv.issuerRfc, Name: inv.issuerRfc, FiscalRegime: '' },
      Receiver: { Rfc: inv.receiverRfc, Name: inv.receiverName, CfdiUse: 'S01' },
      Complement: { TaxStamp: { Uuid: inv.uuid || 'N/A' } }
    };
    if (format === 'xml') {
      sendBuffer(fakeXmlBase64(fakeCfdi));
    } else {
      // Sandbox: PDF not available, serve as plain text
      const txt = Buffer.from(fakePdfBase64(fakeCfdi), 'base64').toString('utf8');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${inv.serie}-${inv.folio}-sandbox.txt"`);
      res.send(txt);
    }
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

// ── SAT CATALOGS ─────────────────────────────────────────────

const SAT_PROD_SERV = [
  // ── Pizzería / Restaurante ──
  { value: '50192100', label: 'Pizza preparada' },
  { value: '50192101', label: 'Pizza para llevar' },
  { value: '50192200', label: 'Alimentos preparados para consumo inmediato' },
  { value: '90111800', label: 'Servicio de restaurante / comida preparada' },
  { value: '90111801', label: 'Servicio de entrega a domicilio (delivery)' },
  { value: '90111802', label: 'Servicio para llevar (take away)' },
  { value: '50101500', label: 'Frutas y verduras (ingredientes)' },
  { value: '50111500', label: 'Carnes y embutidos' },
  { value: '50131500', label: 'Lácteos (queso, crema)' },
  { value: '50151500', label: 'Bebidas no alcohólicas' },
  { value: '50161500', label: 'Bebidas alcohólicas' },
  { value: '50171500', label: 'Confitería y postres' },
  { value: '73152100', label: 'Restaurante / alimentos (genérico)' },
  { value: '78131500', label: 'Mensajería y paquetería / delivery' },
  // ── General ──
  { value: '01010101', label: 'Sin clasificar (genérico)' },
  { value: '10101500', label: 'Animales vivos' },
  { value: '10111500', label: 'Ganado bovino vivo' },
  { value: '10131500', label: 'Aves de corral vivas' },
  { value: '14111500', label: 'Papel' },
  { value: '14111503', label: 'Papel bond' },
  { value: '14121500', label: 'Cartón' },
  { value: '15111500', label: 'Combustibles' },
  { value: '15121500', label: 'Gas LP' },
  { value: '25101500', label: 'Vehículos automotores' },
  { value: '25101503', label: 'Automóviles' },
  { value: '25101700', label: 'Camiones y tractores' },
  { value: '25172200', label: 'Bicicletas' },
  { value: '27111500', label: 'Herramientas de mano' },
  { value: '31000000', label: 'Materias primas y materiales' },
  { value: '32101500', label: 'Pinturas y barnices' },
  { value: '39111500', label: 'Generadores eléctricos' },
  { value: '40101700', label: 'Distribución y logística' },
  { value: '43211500', label: 'Computadoras y equipo' },
  { value: '43211503', label: 'Computadora de escritorio' },
  { value: '43211507', label: 'Laptop' },
  { value: '43211513', label: 'Tablet' },
  { value: '43211600', label: 'Monitores y pantallas' },
  { value: '43221500', label: 'Impresoras' },
  { value: '43222600', label: 'Escáneres' },
  { value: '43223400', label: 'Proyectores' },
  { value: '43232400', label: 'Software (licencias)' },
  { value: '43232401', label: 'Software de aplicación' },
  { value: '43232404', label: 'Software de seguridad' },
  { value: '44101500', label: 'Papelería y artículos de oficina' },
  { value: '44101503', label: 'Bolígrafos y plumas' },
  { value: '44121600', label: 'Cartuchos de tinta' },
  { value: '46101500', label: 'Seguridad industrial' },
  { value: '50101500', label: 'Frutas y verduras' },
  { value: '50111500', label: 'Carnes' },
  { value: '50121500', label: 'Mariscos' },
  { value: '50131500', label: 'Productos lácteos' },
  { value: '50151500', label: 'Bebidas no alcohólicas' },
  { value: '50161500', label: 'Bebidas alcohólicas' },
  { value: '51101500', label: 'Medicamentos' },
  { value: '51102200', label: 'Vitaminas y suplementos' },
  { value: '56101500', label: 'Arrendamiento de inmuebles' },
  { value: '60121500', label: 'Fotografía' },
  { value: '60141000', label: 'Entretenimiento' },
  { value: '62161500', label: 'Educación y capacitación' },
  { value: '70101500', label: 'Servicios de ingeniería' },
  { value: '70111500', label: 'Servicios de arquitectura' },
  { value: '70121500', label: 'Servicios ambientales' },
  { value: '72101500', label: 'Construcción' },
  { value: '72141500', label: 'Plomería' },
  { value: '72151500', label: 'Electricidad (instalaciones)' },
  { value: '72154000', label: 'Reparación y mantenimiento' },
  { value: '73101500', label: 'Servicios de limpieza' },
  { value: '73111500', label: 'Jardinería y paisajismo' },
  { value: '73121500', label: 'Vigilancia y seguridad' },
  { value: '73141700', label: 'Lavandería' },
  { value: '73152100', label: 'Restaurante / alimentos' },
  { value: '76111500', label: 'Telecomunicaciones' },
  { value: '76111600', label: 'Internet' },
  { value: '78101500', label: 'Transporte de pasajeros' },
  { value: '78102200', label: 'Transporte de carga' },
  { value: '78111500', label: 'Carga aérea' },
  { value: '78121500', label: 'Carga marítima' },
  { value: '78131500', label: 'Mensajería y paquetería' },
  { value: '80101500', label: 'Publicidad y marketing' },
  { value: '80101601', label: 'Diseño gráfico' },
  { value: '80101700', label: 'Relaciones públicas' },
  { value: '80111500', label: 'Servicios de TI' },
  { value: '80111600', label: 'Soporte técnico' },
  { value: '80111800', label: 'Redes y telecomunicaciones' },
  { value: '80121500', label: 'Servicios de gestión' },
  { value: '80131500', label: 'Contabilidad y auditoría' },
  { value: '80131600', label: 'Servicios fiscales' },
  { value: '80141600', label: 'Consultoría empresarial' },
  { value: '80141700', label: 'Servicios administrativos' },
  { value: '80151500', label: 'Recursos humanos' },
  { value: '81101500', label: 'Servicios legales' },
  { value: '81101600', label: 'Notaría' },
  { value: '81112000', label: 'Desarrollo de software' },
  { value: '81141500', label: 'Investigación y desarrollo' },
  { value: '82101500', label: 'Servicios editoriales' },
  { value: '82101600', label: 'Traducción e interpretación' },
  { value: '84101500', label: 'Seguros' },
  { value: '84111500', label: 'Servicios bancarios' },
  { value: '84121500', label: 'Inversiones y finanzas' },
  { value: '85101500', label: 'Médico general' },
  { value: '85111500', label: 'Odontología' },
  { value: '85121500', label: 'Oftalmología' },
  { value: '85121800', label: 'Servicios médicos' },
  { value: '85141600', label: 'Psicología' },
  { value: '85161500', label: 'Enfermería' },
  { value: '86101500', label: 'Servicios sociales' },
  { value: '90101500', label: 'Gobierno' },
  { value: '90111500', label: 'Servicios de contabilidad pública' },
  { value: '92101500', label: 'Defensa nacional' },
  { value: '93141500', label: 'Servicio postal' },
];

const SAT_UNIDAD = [
  { value: 'E48', label: 'Unidad de servicio' },
  { value: 'H87', label: 'Pieza' },
  { value: 'ACT', label: 'Actividad' },
  { value: 'EA',  label: 'Elemento' },
  { value: 'SET', label: 'Conjunto' },
  { value: 'KT',  label: 'Kit' },
  { value: 'MON', label: 'Mes (MON)' },
  { value: 'MO',  label: 'Mes' },
  { value: 'ANN', label: 'Año' },
  { value: 'DAY', label: 'Día' },
  { value: 'HUR', label: 'Hora' },
  { value: 'MIN', label: 'Minuto' },
  { value: 'WEE', label: 'Semana' },
  { value: 'KGM', label: 'Kilogramo' },
  { value: 'GRM', label: 'Gramo' },
  { value: 'TNE', label: 'Tonelada métrica' },
  { value: 'LTR', label: 'Litro' },
  { value: 'MLT', label: 'Mililitro' },
  { value: 'MTQ', label: 'Metro cúbico' },
  { value: 'MTR', label: 'Metro' },
  { value: 'CMT', label: 'Centímetro' },
  { value: 'MMT', label: 'Milímetro' },
  { value: 'MTK', label: 'Metro cuadrado' },
  { value: 'CMK', label: 'Centímetro cuadrado' },
  { value: 'XBX', label: 'Caja' },
  { value: 'XPK', label: 'Paquete' },
  { value: 'XBG', label: 'Bolsa' },
  { value: 'XBT', label: 'Botella' },
  { value: 'DZN', label: 'Docena' },
  { value: 'PR',  label: 'Par' },
  { value: 'ROL', label: 'Rollo' },
  { value: 'XSA', label: 'Costal' },
  { value: 'PK',  label: 'Paquete (PK)' },
  { value: 'BE',  label: 'Paca' },
  { value: 'STR', label: 'Tira' },
  { value: 'XTB', label: 'Tubo' },
  { value: 'XLA', label: 'Lata' },
  { value: 'WSD', label: 'Estereométrico' },
  { value: 'LO',  label: 'Lote' },
  { value: 'DPC', label: 'Docenas de piezas' },
];

app.get('/api/catalogo/prodserv', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const results = q
    ? SAT_PROD_SERV.filter(e => e.value.includes(q) || e.label.toLowerCase().includes(q)).slice(0, 50)
    : SAT_PROD_SERV.slice(0, 50);
  res.json(results);
});

app.get('/api/catalogo/unidad', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const results = q
    ? SAT_UNIDAD.filter(e => e.value.toLowerCase().includes(q) || e.label.toLowerCase().includes(q)).slice(0, 50)
    : SAT_UNIDAD.slice(0, 50);
  res.json(results);
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
