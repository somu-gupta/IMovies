const test = require('node:test');
const assert = require('node:assert/strict');
const { getMovieTextIndexDefinition, migrateMovieTextIndex } = require('../scripts/migrate-movie-text-index');

function fakeCollection(indexes) {
  const state = { indexes: structuredClone(indexes), dropped: [], created: [] };
  return {
    state,
    listIndexes() { return { toArray: async () => structuredClone(state.indexes) }; },
    async dropIndex(name) {
      state.dropped.push(name);
      state.indexes = state.indexes.filter((index) => index.name !== name);
    },
    async createIndex(keys, options) {
      state.created.push({ keys, options });
      const weights = Object.fromEntries(Object.entries(keys).filter(([, value]) => value === 'text').map(([field]) => [field, 1]));
      const companions = Object.fromEntries(Object.entries(keys).filter(([, value]) => value !== 'text'));
      state.indexes.push({ name: options.name, key: { _fts: 'text', _ftsx: 1, ...companions }, weights, default_language: options.default_language, language_override: options.language_override, textIndexVersion: 3 });
      return options.name;
    },
  };
}

const unrelatedIndex = { name: '_id_', key: { _id: 1 } };
const oldMovieTextIndex = {
  name: 'title_text_genre_1_language_1',
  key: { _fts: 'text', _ftsx: 1, genre: 1, language: 1 },
  weights: { title: 1 },
  default_language: 'english',
  language_override: 'language',
  textIndexVersion: 3,
};

test('Movie text migration targets the schema index and replaces only its outdated version', async () => {
  const definition = getMovieTextIndexDefinition();
  assert.equal(definition.name, 'title_text_genre_1_language_1');
  assert.deepEqual(definition.keys, { title: 'text', genre: 1, language: 1 });
  assert.equal(definition.options.default_language, 'none');
  assert.equal(definition.options.language_override, 'textSearchLanguage');

  const collection = fakeCollection([unrelatedIndex, oldMovieTextIndex]);
  const result = await migrateMovieTextIndex(collection);
  assert.equal(result.action, 'recreated');
  assert.deepEqual(collection.state.dropped, [oldMovieTextIndex.name]);
  assert.equal(collection.state.indexes.some((index) => index.name === unrelatedIndex.name), true);
  assert.equal(collection.state.indexes.find((index) => index.name === definition.name).language_override, 'textSearchLanguage');
});

test('Movie text migration is repeatable when the expected index already exists', async () => {
  const definition = getMovieTextIndexDefinition();
  const current = {
    ...oldMovieTextIndex,
    default_language: definition.options.default_language,
    language_override: definition.options.language_override,
  };
  const collection = fakeCollection([unrelatedIndex, current]);
  const result = await migrateMovieTextIndex(collection);
  assert.equal(result.action, 'already-current');
  assert.deepEqual(collection.state.dropped, []);
  assert.deepEqual(collection.state.created, []);
});

test('Movie text migration creates the expected index when the collection has no indexes yet', async () => {
  const definition = getMovieTextIndexDefinition();
  const collection = fakeCollection([]);
  const result = await migrateMovieTextIndex(collection);
  assert.equal(result.action, 'created');
  assert.deepEqual(collection.state.dropped, []);
  assert.equal(collection.state.created.length, 1);
  assert.equal(collection.state.created[0].options.name, definition.name);
});

test('Movie text migration refuses an unrelated text index without changing indexes', async () => {
  const unrelatedTextIndex = { name: 'description_text', key: { _fts: 'text', _ftsx: 1 }, weights: { description: 1 }, textIndexVersion: 3 };
  const collection = fakeCollection([unrelatedIndex, unrelatedTextIndex]);
  await assert.rejects(migrateMovieTextIndex(collection), /unrelated text index/);
  assert.deepEqual(collection.state.dropped, []);
  assert.deepEqual(collection.state.created, []);
});
