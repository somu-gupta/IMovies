const test = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns');
process.env.NODE_ENV = 'production';
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Movie = require('../src/models/Movie');
const Cinema = require('../src/models/Cinema');
const Show = require('../src/models/Show');
const Booking = require('../src/models/Booking');
const connectDatabase = require('../src/config/database');

process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters';

async function withServer(run) {
  const server = app.listen(0);
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function query(value) {
  return {
    sort() { return this; },
    limit() { return this; },
    populate() { return this; },
    select() { return this; },
    lean: async () => value,
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
}

function authToken(t) {
  t.mock.method(User, 'findById', async (id) => ({ _id: id, id, role: 'user' }));
  return jwt.sign({ sub: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
}

test('GET /api/movies and its trailing-slash form return active catalogue records', async (t) => {
  const movies = [{ _id: 'movie-1', title: 'Sample Film' }];
  t.mock.method(Movie, 'find', () => query(movies));
  await withServer(async (baseUrl) => {
    for (const path of ['/api/movies', '/api/movies/']) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).data.movies, movies);
    }
  });
});

test('GET /api/shows returns scheduled show records', async (t) => {
  const shows = [{ _id: 'show-1', startsAt: '2030-01-01T18:00:00.000Z' }];
  t.mock.method(Show, 'find', () => query(shows));
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/shows`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data.shows, shows);
  });
});

test('seat availability endpoints return the same live inventory and price', async (t) => {
  const show = { capacity: 60, bookedSeats: ['A1'], ticketPrice: 220, startsAt: '2030-01-01T18:00:00.000Z' };
  t.mock.method(Show, 'findOne', () => query(show));
  await withServer(async (baseUrl) => {
    for (const endpoint of ['availability', 'seats']) {
      const response = await fetch(`${baseUrl}/api/shows/507f1f77bcf86cd799439011/${endpoint}`);
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).data, { ...show, available: 59 });
    }
  });
});

test('GET /api/cinemas returns active cinema records', async (t) => {
  const cinemas = [{ _id: 'cinema-1', name: 'IMovies Downtown', screens: [{ name: 'Screen 1', capacity: 60 }] }];
  t.mock.method(Cinema, 'find', () => query(cinemas));
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/cinemas`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data.cinemas, cinemas);
  });
});

test('database configuration requires MONGODB_URI and makes no connection without it', async () => {
  const previousUri = process.env.MONGODB_URI;
  delete process.env.MONGODB_URI;
  try { await assert.rejects(connectDatabase(), /MONGODB_URI is required/); }
  finally { if (previousUri === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = previousUri; }
});

test('database configures custom DNS servers before connecting with Mongoose', async (t) => {
  const previousUri = process.env.MONGODB_URI;
  const previousDnsServers = process.env.DNS_SERVERS;
  const calls = [];
  process.env.MONGODB_URI = 'mongodb+srv://example.invalid/test';
  process.env.DNS_SERVERS = '9.9.9.9, 8.8.4.4';
  t.mock.method(console, 'log', () => {});
  t.mock.method(dns, 'setServers', (servers) => calls.push(['dns', servers]));
  t.mock.method(mongoose, 'connect', async (...args) => calls.push(['mongoose', ...args]));
  try {
    await connectDatabase();
    assert.deepEqual(calls.map(([name]) => name), ['dns', 'mongoose']);
    assert.deepEqual(calls[0][1], ['9.9.9.9', '8.8.4.4']);
    assert.equal(calls[1][1], process.env.MONGODB_URI);
  } finally {
    if (previousUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousUri;
    if (previousDnsServers === undefined) delete process.env.DNS_SERVERS;
    else process.env.DNS_SERVERS = previousDnsServers;
  }
});

test('database DNS configuration leaves the operating system resolver unchanged when DNS_SERVERS is unset', async (t) => {
  const previousUri = process.env.MONGODB_URI;
  const previousDnsServers = process.env.DNS_SERVERS;
  const calls = [];
  process.env.MONGODB_URI = 'mongodb+srv://example.invalid/test';
  delete process.env.DNS_SERVERS;
  t.mock.method(console, 'log', () => {});
  t.mock.method(dns, 'setServers', (servers) => calls.push(servers));
  t.mock.method(mongoose, 'connect', async () => {});
  try {
    await connectDatabase();
    assert.deepEqual(calls, []);
  } finally {
    if (previousUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousUri;
    if (previousDnsServers === undefined) delete process.env.DNS_SERVERS;
    else process.env.DNS_SERVERS = previousDnsServers;
  }
});

test('GET /api/bookings/my and /me require auth and list only the current user records', async (t) => {
  const token = authToken(t);
  const bookings = [{ _id: 'booking-1', seats: ['A1'] }];
  t.mock.method(Booking, 'find', () => query(bookings));
  await withServer(async (baseUrl) => {
    for (const endpoint of ['my', 'me']) {
      const response = await fetch(`${baseUrl}/api/bookings/${endpoint}`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).data.bookings, bookings);
    }
    const unauthorized = await fetch(`${baseUrl}/api/bookings/my`);
    assert.equal(unauthorized.status, 401);
  });
});

test('login verifies credentials and returns a signed token', async (t) => {
  const user = { id: '507f1f77bcf86cd799439011', name: 'Test User', email: 'test@example.com', role: 'user', checkPassword: async (password) => password === 'correct-password' };
  t.mock.method(User, 'findOne', () => query(user));
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: user.email, password: 'correct-password' }) });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(jwt.verify(body.data.token, process.env.JWT_SECRET).sub, user.id);
  });
});

test('invalid and duplicate seat submissions are rejected before booking writes', async (t) => {
  const token = authToken(t);
  const reserve = t.mock.method(Show, 'findOneAndUpdate', async () => null);
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/bookings`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ showId: '507f1f77bcf86cd799439011', seats: ['A1', 'A1'] }) });
    assert.equal(response.status, 400);
    assert.equal(reserve.mock.callCount(), 0);
  });
});

test('concurrent attempts for one seat create at most one booking', async (t) => {
  const token = authToken(t);
  const occupied = new Set();
  const session = { withTransaction: async (run) => run(), endSession: async () => {} };
  t.mock.method(mongoose, 'startSession', async () => session);
  t.mock.method(Show, 'findOneAndUpdate', (filter, update) => {
    const seats = update.$addToSet.bookedSeats.$each;
    let result = null;
    if (!seats.some((seat) => occupied.has(seat))) {
      seats.forEach((seat) => occupied.add(seat));
      result = { _id: filter._id, bookedSeats: [...occupied], movie: { _id: 'movie-1' }, cinema: { _id: 'cinema-1' }, ticketPrice: 200 };
    }
    const chain = { populate() { return this; }, then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); } };
    return chain;
  });
  t.mock.method(Booking, 'create', async (records) => (Array.isArray(records) ? records : [records]).map((record) => ({ ...record, _id: 'booking-1', async populate() { return this; } })));
  await withServer(async (baseUrl) => {
    const create = () => fetch(`${baseUrl}/api/bookings`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ showId: '507f1f77bcf86cd799439011', seats: ['A1'] }) });
    const responses = await Promise.all([create(), create()]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
    assert.equal(occupied.size, 1);
  });
});

test('standalone database fallback releases a seat when booking validation fails', async (t) => {
  const token = authToken(t);
  t.mock.method(mongoose, 'startSession', async () => ({
    withTransaction: async () => { throw Object.assign(new Error('Transaction numbers are only allowed on a replica set member'), { code: 20 }); },
    endSession: async () => {},
  }));
  const show = { _id: '507f1f77bcf86cd799439011', bookedSeats: ['B2'], movie: { _id: 'movie-1' }, cinema: { _id: 'cinema-1' }, ticketPrice: 220 };
  const chain = { populate() { return this; }, then(resolve, reject) { return Promise.resolve(show).then(resolve, reject); } };
  t.mock.method(Show, 'findOneAndUpdate', () => chain);
  t.mock.method(Booking, 'create', async () => { throw new mongoose.Error.ValidationError(); });
  const release = t.mock.method(Show, 'updateOne', async () => ({ modifiedCount: 1 }));
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/bookings`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ showId: show._id, seats: ['B2'] }) });
    assert.equal(response.status, 400);
    assert.deepEqual(release.mock.calls[0].arguments[1], { $pullAll: { bookedSeats: ['B2'] } });
  });
});

test('Mongoose model validation covers refs, unique seat values and show constraints without connecting', async () => {
  const user = new User({ name: 'Test User', email: 'invalid', password: 'long-enough-password' });
  const movie = new Movie({ title: 'Test Film', slug: 'not a slug', description: 'A film', genre: 'Drama', language: 'English', duration: 100 });
  const cinema = new Cinema({ name: 'Test Cinema', city: 'Test City', address: '1 Main Street', screens: [{ name: 'One', capacity: 60 }, { name: 'One', capacity: 50 }] });
  const show = new Show({ movie: new mongoose.Types.ObjectId(), cinema: new mongoose.Types.ObjectId(), screen: 'One', startsAt: new Date('2030-01-02'), endsAt: new Date('2030-01-01'), ticketPrice: 200, capacity: 60, bookedSeats: ['A1', 'A1'] });
  const booking = new Booking({ reference: 'REF', user: new mongoose.Types.ObjectId(), show: new mongoose.Types.ObjectId(), movie: new mongoose.Types.ObjectId(), cinema: new mongoose.Types.ObjectId(), seats: ['A1', 'A1'], totalAmount: 400 });
  for (const model of [user, movie, cinema, show, booking]) await assert.rejects(model.validate());
});

test('movie text search index ignores content-language metadata and uses neutral search', () => {
  const textIndex = Movie.schema.indexes().find(([keys]) => keys.title === 'text');
  assert.ok(textIndex);
  assert.equal(textIndex[1].default_language, 'none');
  assert.equal(textIndex[1].language_override, 'textSearchLanguage');
  assert.equal(Movie.schema.path('language').options.required, true);
});

test('concurrent cancellation releases seats only for the winning status transition', async (t) => {
  const token = authToken(t);
  const booking = {
    _id: '507f1f77bcf86cd799439010',
    seats: ['A1'],
    status: 'confirmed',
    show: { _id: '507f1f77bcf86cd799439012', startsAt: new Date(Date.now() + 4 * 60 * 60 * 1000) },
  };
  const populated = { populate() { return this; }, then(resolve, reject) { return Promise.resolve(booking).then(resolve, reject); } };
  t.mock.method(Booking, 'findOne', () => populated);
  let transitions = 0;
  t.mock.method(Booking, 'findOneAndUpdate', async () => {
    transitions += 1;
    return transitions === 1 ? { ...booking, status: 'cancelled' } : null;
  });
  const release = t.mock.method(Show, 'updateOne', async () => ({ matchedCount: 1, modifiedCount: 1 }));
  await withServer(async (baseUrl) => {
    const cancel = () => fetch(`${baseUrl}/api/bookings/${booking._id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const responses = await Promise.all([cancel(), cancel()]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    assert.equal(release.mock.callCount(), 1);
  });
});

test('administrator catalogue writes reject signed-in non-admin users', async (t) => {
  const token = authToken(t);
  const createMovie = t.mock.method(Movie, 'create', async (movie) => movie);
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/movies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Not Allowed', slug: 'not-allowed', description: 'Test', genre: 'Drama', language: 'English', duration: 100 }),
    });
    assert.equal(response.status, 403);
    assert.equal(createMovie.mock.callCount(), 0);
  });
});
