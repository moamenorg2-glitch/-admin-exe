import https from 'https';

const options = {
  hostname: 'ais-pre-fq35qqepcygp5opugmoebg-181556651247.europe-west3.run.app',
  path: '/api/admin/delete-user',
  method: 'OPTIONS',
  headers: {
    'Origin': 'http://localhost',
    'Access-Control-Request-Method': 'POST'
  }
};

const req = https.request(options, (res) => {
  console.log('STATUS:', res.statusCode);
  console.log('HEADERS:', JSON.stringify(res.headers, null, 2));
});

req.on('error', (e) => {
  console.error('ERROR:', e.message);
});

req.end();
