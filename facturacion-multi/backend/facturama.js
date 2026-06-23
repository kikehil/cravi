const https = require('https');

function getConfig() {
  const env = process.env.FACTURAMA_ENV || 'sandbox';
  return {
    host: env === 'production' ? 'api.facturama.mx' : 'apisandbox.facturama.mx',
    auth: Buffer.from(`${process.env.FACTURAMA_USER || 'prueba'}:${process.env.FACTURAMA_PASS || 'prueba2011'}`).toString('base64')
  };
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const { host, auth } = getConfig();
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: host, port: 443, path, method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) })
      }
    };
    console.log(`[Facturama] ${method} https://${host}${path}`);
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
          else reject({ statusCode: res.statusCode, body: parsed });
        } catch {
          reject({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.setTimeout(30000, () => { req.destroy(new Error('Timeout: Facturama no respondió en 30s')); });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── CSD ─────────────────────────────────────────────────────
const uploadCsd = (rfc, certificate, privateKey, privateKeyPassword) =>
  request('POST', '/api-lite/csds', { Rfc: rfc, Certificate: certificate, PrivateKey: privateKey, PrivateKeyPassword: privateKeyPassword });

const getCsd = rfc => request('GET', `/api-lite/csds/${rfc}`);
const deleteCsd = rfc => request('DELETE', `/api-lite/csds/${rfc}`);

// ── CFDI ─────────────────────────────────────────────────────
const createCfdi = payload => request('POST', '/api-lite/3/cfdis', payload);
const getCfdi = (type, id) => request('GET', `/api-lite/cfdis/${type}/${id}`);
const listCfdis = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request('GET', `/api-lite/cfdis${qs ? '?' + qs : ''}`);
};
const cancelCfdi = (type, id, motive = '02', uuidReplacement = null) => {
  let path = `/api-lite/cfdis/${type}/${id}?motive=${motive}`;
  if (uuidReplacement) path += `&uuidReplacement=${uuidReplacement}`;
  return request('DELETE', path);
};
const downloadCfdi = (type, id, format) =>
  request('GET', `/api-lite/cfdis/${type}/${id}/${format}`)
    .catch(() => request('GET', `/api-lite/cfdis/${id}/${format}`))
    .catch(() => request('GET', `/api-lite/3/cfdis/${type}/${id}/${format}`));

// ── Builder ──────────────────────────────────────────────────
function buildCfdi({ issuer, receiver, items, folio, serie = 'F', paymentForm = '01', currency = 'MXN',
                     expeditionPlace, cfdiType = 'I', relatedUuid = null, discount = 0, tip = 0, orderRef = null }) {
  const isPublic = !receiver.rfc || receiver.rfc === 'XAXX010101000';

  const cfdiItems = items.map(item => {
    const qty        = parseFloat(item.quantity) || 1;
    const unitPrice  = Math.round(parseFloat(item.unitPrice) * 100) / 100;
    const subtotal   = Math.round(unitPrice * qty * 100) / 100;
    const ivaRate    = item.ivaRate !== undefined ? parseFloat(item.ivaRate) : 0.16;
    const ivaTotal   = Math.round(subtotal * ivaRate * 100) / 100;
    const itemTotal  = Math.round((subtotal + ivaTotal) * 100) / 100;

    const taxes = ivaRate > 0
      ? [{ Total: ivaTotal, Name: 'IVA', Base: subtotal, Rate: ivaRate, IsRetention: false }]
      : [];

    return {
      ProductCode: item.productCode || '01010101',
      Description: item.description,
      UnitCode: item.unitCode || 'E48',
      Quantity: qty,
      UnitPrice: unitPrice,
      Subtotal: subtotal,
      Total: itemTotal,
      TaxObject: ivaRate > 0 ? '02' : '01',
      ...(taxes.length && { Taxes: taxes })
    };
  });

  // Tip is a separate non-taxed concept (propina)
  if (tip > 0) {
    const tipAmt = Math.round(parseFloat(tip) * 100) / 100;
    cfdiItems.push({
      ProductCode: '90111800',
      Description: 'Propina',
      UnitCode: 'ACT',
      Quantity: 1,
      UnitPrice: tipAmt,
      Subtotal: tipAmt,
      Total: tipAmt,
      TaxObject: '01'
    });
  }

  const rootSubtotal = Math.round(cfdiItems.reduce((s, i) => s + i.Subtotal, 0) * 100) / 100;
  const rootTaxes    = Math.round(cfdiItems.reduce((s, i) => s + (i.Taxes?.[0]?.Total || 0), 0) * 100) / 100;
  const rootDiscount = Math.round(parseFloat(discount || 0) * 100) / 100;
  const rootTotal    = Math.round((rootSubtotal + rootTaxes - rootDiscount) * 100) / 100;

  const now = new Date();
  // SAT requires date in Mexico City local time (America/Mexico_City)
  const mxDate = new Date().toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' }).replace(' ', 'T');
  const mxNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const month = String(mxNow.getMonth() + 1).padStart(2, '0');
  const year = String(mxNow.getFullYear());

  const payload = {
    NameId: '1',
    CfdiType: cfdiType,
    Serie: cfdiType === 'E' ? 'NC' : serie,
    Folio: String(folio),
    Date: mxDate,
    PaymentForm: paymentForm,
    PaymentMethod: 'PUE',
    Currency: currency,
    ExpeditionPlace: expeditionPlace || issuer.taxZipCode || '89000',
    Subtotal: rootSubtotal,
    ...(rootDiscount > 0 && { Discount: rootDiscount }),
    Total: rootTotal,
    ...(orderRef && { OrderNumber: orderRef }),
    Issuer: {
      FiscalRegime: issuer.fiscalRegime,
      Rfc: issuer.rfc.toUpperCase(),
      Name: issuer.legalName.toUpperCase()
    },
    Receiver: isPublic
      ? { Rfc: 'XAXX010101000', Name: 'PUBLICO EN GENERAL', FiscalRegime: '616', TaxZipCode: issuer.taxZipCode || '89000', CfdiUse: 'S01' }
      : { Rfc: receiver.rfc.toUpperCase(), Name: receiver.name.toUpperCase(), FiscalRegime: receiver.fiscalRegime, TaxZipCode: receiver.taxZipCode, CfdiUse: receiver.cfdiUse || 'G03' },
    Items: cfdiItems,
    ...(cfdiType === 'E' && relatedUuid && {
      Relations: { Type: '01', Cfdis: [{ Uuid: relatedUuid }] }
    })
  };

  // CFDI 4.0: InformacionGlobal es obligatorio cuando el receptor es Público en General
  if (isPublic) {
    payload.GlobalInformation = {
      Periodicity: '04',   // 04 = Mensual
      Months: month,
      Year: year
    };
  }

  return payload;
}

module.exports = { uploadCsd, getCsd, deleteCsd, createCfdi, getCfdi, listCfdis, cancelCfdi, downloadCfdi, buildCfdi };
