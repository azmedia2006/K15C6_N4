'use strict';
// Canonical local entry: persistent single-process storage, SMTP explicitly opt-in.
const path = require('path');
require('dotenv').config({ path: [path.join(__dirname, '.env'), path.join(__dirname, '../.env')] });
process.env.TMS_OFFLINE = 'true';
require('./localDatabase').acquireLock();
const app = require('./server');
require('./localDatabase').commit();
const port = process.env.PORT || 3000;
app.listen(port, process.env.HOST || '127.0.0.1', () => {
    console.log(`TMS local demo: http://localhost:${port}/Login.html`);
    console.log('KN-156: offline demo; Local persistent storage. SMTP is enabled only when SMTP_ENABLED=true and credentials are configured.');
});
