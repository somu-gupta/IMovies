const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

async function withServer(run) {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test('health endpoint reports API status', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, data: { status: 'ok' } });
  });
});

test('CORS allows the configured local frontend origin', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  });
});

test('invalid JSON receives a safe client error', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{invalid' });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { success: false, error: { message: 'The request body must contain valid JSON' } });
  });
});

test('registration rejects malformed input before accessing the database', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'A', email: 'bad', password: 'short' }) });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error.message, /valid name, email and password/i);
  });
});

test('booking creation requires authentication', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/bookings`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ showId: '507f1f77bcf86cd799439011', seats: ['A1'] }) });
    assert.equal(response.status, 401);
  });
});
