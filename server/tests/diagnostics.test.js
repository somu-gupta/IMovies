const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../src/app');

const configuredToken = 'diagnostic-test-token-with-at-least-32-characters';

async function withServer(run) {
  const server = app.listen(0);
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function setDiagnosticToken(value) {
  const previous = process.env.MOVIE_DIAGNOSTIC_TOKEN;
  if (value === undefined) delete process.env.MOVIE_DIAGNOSTIC_TOKEN;
  else process.env.MOVIE_DIAGNOSTIC_TOKEN = value;
  return () => {
    if (previous === undefined) delete process.env.MOVIE_DIAGNOSTIC_TOKEN;
    else process.env.MOVIE_DIAGNOSTIC_TOKEN = previous;
  };
}

test('movie diagnostic returns 404 when the token is not configured', async () => {
  const restore = setDiagnosticToken(undefined);
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/diagnostics/movies`);
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Not found' });
    });
  } finally {
    restore();
  }
});

test('movie diagnostic returns 404 for missing or incorrect Bearer tokens', async () => {
  const restore = setDiagnosticToken(configuredToken);
  const previousDb = mongoose.connection.db;
  let collectionCalls = 0;
  mongoose.connection.db = { collection() { collectionCalls += 1; throw new Error('Must not query without authorization'); } };
  try {
    await withServer(async (baseUrl) => {
      const missing = await fetch(`${baseUrl}/api/diagnostics/movies`);
      const incorrect = await fetch(`${baseUrl}/api/diagnostics/movies`, { headers: { Authorization: 'Bearer incorrect-token' } });
      assert.equal(missing.status, 404);
      assert.equal(incorrect.status, 404);
      assert.deepEqual(await missing.json(), { error: 'Not found' });
      assert.deepEqual(await incorrect.json(), { error: 'Not found' });
      assert.equal(collectionCalls, 0);
    });
  } finally {
    mongoose.connection.db = previousDb;
    restore();
  }
});

test('authorized movie diagnostic returns only the database name and requested counts without writes', async () => {
  const restore = setDiagnosticToken(configuredToken);
  const previousDb = mongoose.connection.db;
  const operations = [];
  const database = {
    databaseName: 'diagnostic-test-db',
    collection(name) {
      assert.equal(name, 'movies');
      return {
        async countDocuments(filter) {
          operations.push(['countDocuments', filter]);
          if (Object.keys(filter).length === 0) return 8;
          if (filter.isActive === true) return 6;
          return 2;
        },
      };
    },
  };
  mongoose.connection.db = database;

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/diagnostics/movies`, {
        headers: { Authorization: `Bearer ${configuredToken}` },
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        databaseName: 'diagnostic-test-db',
        totalMovies: 8,
        activeMovies: 6,
        inactiveOrMissingIsActive: 2,
      });
      assert.deepEqual(operations, [
        ['countDocuments', {}],
        ['countDocuments', { isActive: true }],
        ['countDocuments', { $or: [{ isActive: false }, { isActive: { $exists: false } }] }],
      ]);
      assert.equal(operations.some(([operation]) => !['countDocuments'].includes(operation)), false);
    });
  } finally {
    mongoose.connection.db = previousDb;
    restore();
  }
});
