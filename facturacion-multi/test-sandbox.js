/**
 * Script de prueba del sandbox de Facturama.
 * Ejecutar desde: facturacion-multi/
 *   node test-sandbox.js
 *
 * Descarga el CSD de prueba del SAT, registra el emisor en el sandbox
 * y timbra una factura de prueba. Todo automático.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ── Config ───────────────────────────────────────────────
const SERVER = 'http://localhost:4000';

const TEST_RFC       = 'EKU9003173C9';
const TEST_NAME      = 'ESCUELA KEMPER URGATE SA DE CV';
const TEST_REGIME    = '601';
const TEST_ZIP       = '26015';
const TEST_KEY_PASS  = '12345678a';

// URLs públicas de los certificados de prueba del SAT (vía phpcfdi/finkok)
const CER_URL = 'https://raw.githubusercontent.com/phpcfdi/finkok/main/tests/_files/certs/EKU9003173C9.cer.pem';
const KEY_URL = 'https://raw.githubusercontent.com/phpcfdi/finkok/main/tests/_files/certs/EKU9003173C9.key.pem';

// ── Helpers ──────────────────────────────────────────────
const c = { ok: '\x1b[32m✓\x1b[0m', err: '\x1b[31m✗\x1b[0m', info: '\x1b[36mℹ\x1b[0m', bold: s => `\x1b[1m${s}\x1b[0m` };

function fetchUrl(url) {
  return new Promise((res, rej) => {
    https.get(url, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
    }).on('error', rej);
  });
}

function pemToBase64(pem) {
  return pem.split('\n').filter(l => !l.startsWith('-----') && l.trim()).join('');
}

function apiPost(path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const opts = {
      hostname: 'localhost', port: 4000, path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
    };
    const req = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on('error', reject); req.write(bodyStr); req.end();
  });
}

function apiGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:4000${path}`, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    }).on('error', reject);
  });
}

// ── Main ─────────────────────────────────────────────────
async function run() {
  console.log('\n' + c.bold('═══════════════════════════════════════'));
  console.log(c.bold(' PRUEBA SANDBOX — Facturación Multi-Emisor'));
  console.log(c.bold('═══════════════════════════════════════\n'));

  // 1. Verificar servidor
  process.stdout.write('1. Verificando servidor... ');
  try {
    const cfg = await apiGet('/api/config');
    if (cfg.status !== 200) throw new Error('No responde');
    console.log(`${c.ok} ${c.bold(cfg.body.env.toUpperCase())} — ${cfg.body.host}`);
  } catch (e) {
    console.log(`${c.err} No se puede conectar al servidor en ${SERVER}`);
    console.log('   Asegúrate de tener el servidor corriendo: node backend/index.js\n');
    process.exit(1);
  }

  // 2. Descargar CSD de prueba
  process.stdout.write('2. Descargando CSD de prueba del SAT... ');
  let cerB64, keyB64;
  try {
    const [cerPem, keyPem] = await Promise.all([fetchUrl(CER_URL), fetchUrl(KEY_URL)]);
    cerB64 = pemToBase64(cerPem);
    keyB64 = pemToBase64(keyPem);
    console.log(`${c.ok} RFC: ${TEST_RFC}`);
  } catch (e) {
    console.log(`${c.err} Error: ${e.message}`);
    process.exit(1);
  }

  // 3. Registrar emisor / subir CSD
  process.stdout.write('3. Cargando CSD en Facturama sandbox... ');
  const csdRes = await apiPost('/api/emisores', {
    rfc: TEST_RFC, legalName: TEST_NAME,
    fiscalRegime: TEST_REGIME, taxZipCode: TEST_ZIP,
    certificate: cerB64, privateKey: keyB64,
    privateKeyPassword: TEST_KEY_PASS
  });
  if (csdRes.status === 200 || csdRes.status === 201) {
    console.log(`${c.ok} Emisor registrado`);
  } else {
    console.log(`${c.err} Error (${csdRes.status}): ${JSON.stringify(csdRes.body?.error || csdRes.body)}`);
    // Si el CSD ya fue cargado antes, continuamos igual
    if (!JSON.stringify(csdRes.body).includes('already')) {
      process.exit(1);
    }
    console.log('   (El CSD ya estaba cargado, continuando...)');
  }

  // 4. Timbrar factura de prueba
  process.stdout.write('4. Timbrando CFDI de prueba... ');
  const facturaRes = await apiPost('/api/facturas', {
    issuerRfc: TEST_RFC,
    receiver: {
      rfc: 'XAXX010101000',
      name: 'PUBLICO EN GENERAL'
    },
    serie: 'TEST',
    paymentForm: '01',
    currency: 'MXN',
    items: [
      { description: 'Servicio de prueba sandbox', quantity: 1, unitPrice: 100.00, productCode: '01010101' },
      { description: 'Concepto adicional de prueba', quantity: 2, unitPrice: 50.00, productCode: '01010101' }
    ]
  });

  if (facturaRes.status === 201) {
    const inv = facturaRes.body.invoice;
    console.log(`${c.ok} CFDI timbrado exitosamente`);
    console.log('\n' + c.bold('  ┌─ Resultado ────────────────────────────────'));
    console.log(`  │  Folio:   ${c.bold(inv.serie + '-' + inv.folio)}`);
    console.log(`  │  UUID:    ${inv.uuid ? c.bold(inv.uuid) : '(disponible en Facturama)'}`);
    console.log(`  │  Total:   ${c.bold('$' + Number(inv.total).toFixed(2) + ' MXN')}`);
    console.log(`  │  Estado:  ${c.bold(inv.status)}`);
    console.log(`  │  ID:      ${inv.id}`);
    console.log('  └────────────────────────────────────────────\n');
    console.log(`  Descarga PDF: ${SERVER}/api/facturas/${inv.id}/download/pdf`);
    console.log(`  Descarga XML: ${SERVER}/api/facturas/${inv.id}/download/xml\n`);
  } else {
    console.log(`${c.err} Error (${facturaRes.status}): ${JSON.stringify(facturaRes.body?.error || facturaRes.body)}`);
    process.exit(1);
  }

  // 5. Listar facturas
  const listRes = await apiGet('/api/facturas');
  const total = listRes.body.length || 0;
  console.log(`${c.info} Total facturas en DB: ${c.bold(total)}`);

  console.log('\n' + c.bold('✅ Prueba completada. El sistema funciona correctamente.'));
  console.log(`   Panel web: ${c.bold(SERVER)}\n`);
}

run().catch(e => { console.error('\nError inesperado:', e); process.exit(1); });
