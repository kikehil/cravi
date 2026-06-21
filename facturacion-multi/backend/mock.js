// Mock que simula las respuestas de Facturama para pruebas sin red externa
const { randomUUID } = require('crypto');

function fakeCsd(rfc) {
  return { Rfc: rfc, CertificateNumber: '30001000000500003416', ValidFrom: '2023-05-18', ValidTo: '2027-05-18', IsActive: true };
}

function fakeCfdi(payload) {
  const uuid = randomUUID().toUpperCase();
  const issuer = payload.Issuer || {};
  const receiver = payload.Receiver || {};
  const items = payload.Items || [];
  const subtotal = items.reduce((s, i) => s + (i.Subtotal || 0), 0);
  const iva = Math.round(subtotal * 0.16 * 100) / 100;
  const total = Math.round((subtotal + iva) * 100) / 100;

  return {
    Id: 'mock-' + Date.now(),
    CfdiType: payload.CfdiType || 'I',
    Serie: payload.Serie || 'F',
    Folio: payload.Folio || '1',
    Date: payload.Date || new Date().toISOString().slice(0, 19),
    PaymentForm: payload.PaymentForm || '01',
    PaymentMethod: payload.PaymentMethod || 'PUE',
    Currency: payload.Currency || 'MXN',
    Subtotal: subtotal,
    Total: total,
    Issuer: { Rfc: issuer.Rfc, Name: issuer.Name, FiscalRegime: issuer.FiscalRegime },
    Receiver: { Rfc: receiver.Rfc, Name: receiver.Name, CfdiUse: receiver.CfdiUse },
    Items: items,
    Complement: {
      TaxStamp: {
        Uuid: uuid,
        NoCertificateSat: '20001000000300022815',
        NoCertificateCfdi: '30001000000500003416',
        Date: new Date().toISOString(),
        RfcProvCertif: 'SAT970701NN3',
        Seal: 'MockSealBase64==',
        SatSeal: 'MockSatSealBase64=='
      }
    },
    OriginalString: `||4.0|${payload.Serie}|${payload.Folio}|${payload.Date}|${issuer.Rfc}|${total}|MXN||`,
    Status: 'active'
  };
}

// Genera un PDF/XML falso en base64 para poder probar la descarga
function fakePdfBase64(invoice) {
  const content = `CFDI DE PRUEBA (MOCK)
=========================
Folio:    ${invoice.Serie || 'F'}-${invoice.Folio || '1'}
UUID:     ${invoice.Complement?.TaxStamp?.Uuid || 'N/A'}
Emisor:   ${invoice.Issuer?.Rfc} - ${invoice.Issuer?.Name}
Receptor: ${invoice.Receiver?.Rfc} - ${invoice.Receiver?.Name}
Total:    $${invoice.Total} MXN
Fecha:    ${invoice.Date}
=========================
(Este es un CFDI simulado para pruebas.
 En produccion se generaria el PDF real.)`;
  return Buffer.from(content).toString('base64');
}

function fakeXmlBase64(invoice) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  Version="4.0"
  Serie="${invoice.Serie || 'F'}"
  Folio="${invoice.Folio || '1'}"
  Fecha="${invoice.Date}"
  Moneda="${invoice.Currency || 'MXN'}"
  Total="${invoice.Total}"
  TipoDeComprobante="${invoice.CfdiType || 'I'}">
  <cfdi:Emisor Rfc="${invoice.Issuer?.Rfc}" Nombre="${invoice.Issuer?.Name}" RegimenFiscal="${invoice.Issuer?.FiscalRegime}"/>
  <cfdi:Receptor Rfc="${invoice.Receiver?.Rfc}" Nombre="${invoice.Receiver?.Name}" UsoCFDI="${invoice.Receiver?.CfdiUse}"/>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital
      xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigitalv11"
      UUID="${invoice.Complement?.TaxStamp?.Uuid}"
      FechaTimbrado="${invoice.Date}"
      RfcProvCertFEA="SAT970701NN3"
      NoCertificadoSAT="20001000000300022815"
      SelloCFD="MockSello=="
      SelloSAT="MockSelloSAT=="/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  return Buffer.from(xml).toString('base64');
}

module.exports = { fakeCsd, fakeCfdi, fakePdfBase64, fakeXmlBase64 };
