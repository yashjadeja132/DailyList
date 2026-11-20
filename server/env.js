// Loads server/.env (one KEY=value per line, # for comments) into process.env.
// Real environment variables always win over the file.
const fs = require('fs');
const path = require('path');

try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach((line) => {
    const text = line.trim();
    if (!text || text.startsWith('#')) return;
    const eq = text.indexOf('=');
    if (eq < 1) return;
    const key = text.slice(0, eq).trim();
    const value = text.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  });
} catch (e) { /* no .env file, that is fine */ }
