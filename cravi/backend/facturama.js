// Facturama Multi-Emisor API client
const https = require('https');
const http = require('http');

const FACTURAMA_ENV = process.env.FACTURAMA_ENV || 'sandbox';
const BASE_URL = FACTURAMA_ENV === 'production'
  ? 'api.facturama.mx'
  : 'apisandbox.facturama.mx';

function getAuthHeader() {
  const user = process.env.FACTURAMA_USER || 'prueba';
  const pass = process.env.FACTURAMA_PASS || 'prueba2011';
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: BASE_URL,
      port: 443,
      path,
      method,
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    };
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject({ statusCode: res.statusCode, body: parsed });
          }
        } catch (e) {
          reject({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function downloadRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Authorization': getAuthHeader(),
        'Accept': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject({ statusCode: res.statusCode, body: parsed });
          }
        } catch (e) {
          reject({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Upload CSD certificate for an RFC (only needed once per RFC)
async function uploadCsd({ rfc, certificate, privateKey, privateKeyPassword }) {
  return apiRequest('POST', '/api-lite/csds', {
    Rfc: rfc,
    Certificate: certificate,
    PrivateKey: privateKey,
    PrivateKeyPassword: privateKeyPassword
  });
}

// Get CSD info for an RFC
async function getCsd(rfc) {
  return apiRequest('GET', `/api-lite/csds/${rfc}`);
}

// Delete CSD for an RFC
async function deleteCsd(rfc) {
  return apiRequest('DELETE', `/api-lite/csds/${rfc}`);
}

// Create a CFDI 4.0 (multi-emisor)
async function createCfdi(cfdiData) {
  return apiRequest('POST', '/api-lite/3/cfdis', cfdiData);
}

// Get a CFDI by type and id
async function getCfdi(type, id) {
  return apiRequest('GET', `/api-lite/cfdis/${type}/${id}`);
}

// List CFDIs with optional filters
async function listCfdis(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiRequest('GET', `/api-lite/cfdis${qs ? '?' + qs : ''}`);
}

// Cancel a CFDI (motive: 01=error, 02=no transaction, 03=partial, 04=substitution)
async function cancelCfdi(type, id, motive = '02', uuidReplacement = null) {
  let path = `/api-lite/cfdis/${type}/${id}?motive=${motive}`;
  if (uuidReplacement) path += `&uuidReplacement=${uuidReplacement}`;
  return apiRequest('DELETE', path);
}

// Download CFDI in a given format (pdf, xml, html) - returns base64 content
async function downloadCfdi(type, id, format) {
  return downloadRequest(`/api-lite/cfdis/${type}/${id}/${format}`);
}

// Build a standard CFDI payload for a Cravi order
function buildOrderCfdi({ business, order, folio, customerRfc, customerName, customerFiscalRegime, customerTaxZip, cfdiUse }) {
  const subtotal = order.subtotal || (order.total / 1.16);
  const iva = subtotal * 0.16;
  const total = subtotal + iva;

  const receiver = customerRfc && customerRfc !== 'XAXX010101000'
    ? {
        Rfc: customerRfc.toUpperCase(),
        Name: customerName.toUpperCase(),
        FiscalRegime: customerFiscalRegime || '612',
        TaxZipCode: customerTaxZip || business.taxZipCode || '89000',
        CfdiUse: cfdiUse || 'G03'
      }
    : {
        Rfc: 'XAXX010101000',
        Name: 'PUBLICO EN GENERAL',
        FiscalRegime: '616',
        TaxZipCode: business.taxZipCode || '89000',
        CfdiUse: 'S01'
      };

  return {
    NameId: '1',
    CfdiType: 'I',
    Serie: 'CRAVI',
    Folio: String(folio),
    Date: new Date().toISOString().replace('Z', '').slice(0, 19),
    PaymentForm: paymentFormCode(order.paymentMethod),
    PaymentMethod: 'PUE',
    Currency: 'MXN',
    ExpeditionPlace: business.taxZipCode || '89000',
    Issuer: {
      FiscalRegime: business.fiscalRegime || '612',
      Rfc: business.rfc.toUpperCase(),
      Name: business.legalName || business.bizName
    },
    Receiver: receiver,
    Items: buildItems(order.items, subtotal)
  };
}

function paymentFormCode(method) {
  const map = {
    'cash': '01',
    'efectivo': '01',
    'card': '04',
    'tarjeta': '04',
    'transfer': '03',
    'transferencia': '03'
  };
  return map[(method || '').toLowerCase()] || '01';
}

function buildItems(items, orderSubtotal) {
  if (!items || items.length === 0) {
    const base = Math.round(orderSubtotal * 100) / 100;
    return [{
      ProductCode: '90101501',
      Description: 'Servicio de comida a domicilio',
      UnitCode: 'E48',
      Quantity: 1,
      UnitPrice: base,
      Subtotal: base,
      TaxObject: '02',
      Taxes: [{
        Total: Math.round(base * 0.16 * 100) / 100,
        Name: 'IVA',
        Base: base,
        Rate: 0.16,
        IsRetention: false
      }]
    }];
  }

  return items.map(item => {
    const qty = item.quantity || 1;
    const unitPrice = Math.round((item.price || 0) * 100) / 100;
    const subtotal = Math.round(unitPrice * qty * 100) / 100;
    const ivaTotal = Math.round(subtotal * 0.16 * 100) / 100;
    return {
      ProductCode: '90101501',
      Description: item.name || 'Producto',
      UnitCode: 'E48',
      Quantity: qty,
      UnitPrice: unitPrice,
      Subtotal: subtotal,
      TaxObject: '02',
      Taxes: [{
        Total: ivaTotal,
        Name: 'IVA',
        Base: subtotal,
        Rate: 0.16,
        IsRetention: false
      }]
    };
  });
}

module.exports = {
  uploadCsd,
  getCsd,
  deleteCsd,
  createCfdi,
  getCfdi,
  listCfdis,
  cancelCfdi,
  downloadCfdi,
  buildOrderCfdi
};
