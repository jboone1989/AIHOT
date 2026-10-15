import fs from 'node:fs';
const p=['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome','/opt/google/chrome/chrome','/home/ubuntu/.cache/ms-playwright','/usr/bin/firefox','/home/ubuntu/.cache/puppeteer'];
console.log(JSON.stringify(Object.fromEntries(p.map(v=>[v,fs.existsSync(v)]))));
