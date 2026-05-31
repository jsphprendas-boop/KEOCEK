
async function ping() {
  console.log('--- PING START ---');
  try {
    console.log('Fetching /api/db...');
    const r1 = await fetch('http://localhost:3000/api/db');
    console.log('/api/db respondido con status:', r1.status);
    
    console.log('Fetching /api/logs...');
    const r2 = await fetch('http://localhost:3000/api/logs');
    console.log('/api/logs respondido con status:', r2.status);
    
    const logs = await r2.json();
    console.log('All Logs:', logs);
  } catch(e) {
    console.error('Ping failed with ERROR:', e);
  }
  console.log('--- PING END ---');
}
ping();
