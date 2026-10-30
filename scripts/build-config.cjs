const fs = require('node:fs');
const path = require('node:path');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const safe = value => JSON.stringify(value).replace(/</g, '\u003c');
const output = 'window.KITCHEN_SUPABASE_CONFIG = { url: ' + safe(url) + ', anonKey: ' + safe(key) + ' };\n';
fs.mkdirSync(path.join(process.cwd(), 'dist'), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), 'dist', 'runtime-config.js'), output, 'utf8');
console.log('Generated dist/runtime-config.js (Supabase URL ' + (url ? 'configured' : 'not configured') + ')');
