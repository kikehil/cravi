const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'db.json');

let data = { issuers: [], invoices: [] };

if (fs.existsSync(FILE)) {
  try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
  if (!data.issuers) data.issuers = [];
  if (!data.invoices) data.invoices = [];
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

module.exports = { data, save };
