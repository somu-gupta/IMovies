const path = require('node:path');
const mongoose = require('mongoose');
const connectDatabase = require('../src/config/database');
const Movie = require('../src/models/Movie');

function getMovieTextIndexDefinition() {
  const definition = Movie.schema.indexes().find(([keys]) => Object.values(keys).includes('text'));
  if (!definition) throw new Error('Movie schema does not declare a text index');

  const [keys, options] = definition;
  const name = options.name || Object.entries(keys).map(([field, direction]) => `${field}_${direction}`).join('_');
  return { keys, options, name };
}

function isTextIndex(index) {
  return Boolean(index.weights || index.textIndexVersion || index.key?._fts === 'text' || Object.values(index.key || {}).includes('text'));
}

function sameEntries(left, right) {
  const sortEntries = (value) => Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(sortEntries(left)) === JSON.stringify(sortEntries(right));
}

function matchesMovieTextDefinition(index, keys) {
  if (!isTextIndex(index)) return false;
  const textFields = Object.fromEntries(Object.entries(keys).filter(([, direction]) => direction === 'text').map(([field]) => [field, 1]));
  const companionFields = Object.fromEntries(Object.entries(keys).filter(([, direction]) => direction !== 'text'));
  const existingTextFields = index.weights || Object.fromEntries(Object.entries(index.key || {}).filter(([, direction]) => direction === 'text').map(([field]) => [field, 1]));
  const existingCompanionFields = Object.fromEntries(Object.entries(index.key || {}).filter(([field]) => !['_fts', '_ftsx'].includes(field) && index.key[field] !== 'text'));
  return sameEntries(existingTextFields, textFields) && sameEntries(existingCompanionFields, companionFields);
}

function hasCurrentOptions(index, options) {
  return index.default_language === options.default_language
    && index.language_override === options.language_override;
}

async function migrateMovieTextIndex(collection) {
  const definition = getMovieTextIndexDefinition();
  let existingIndexes;
  try {
    existingIndexes = await collection.listIndexes().toArray();
  } catch (error) {
    if (error.code !== 26 && error.codeName !== 'NamespaceNotFound') throw error;
    existingIndexes = [];
  }
  const textIndexes = existingIndexes.filter(isTextIndex);
  const matchingIndexes = textIndexes.filter((index) => matchesMovieTextDefinition(index, definition.keys));

  if (matchingIndexes.length > 1) {
    throw new Error('Multiple indexes match the Movie text definition; refusing to change indexes');
  }
  if (textIndexes.length > matchingIndexes.length) {
    throw new Error('An unrelated text index exists on movies; refusing to change indexes');
  }

  const nameCollision = existingIndexes.find((index) => index.name === definition.name && !isTextIndex(index));
  if (nameCollision) throw new Error('The expected Movie text index name is used by a non-text index; refusing to change indexes');

  const matchingIndex = matchingIndexes[0];
  if (matchingIndex && matchingIndex.name === definition.name && hasCurrentOptions(matchingIndex, definition.options)) {
    return { action: 'already-current', ...definition };
  }

  if (matchingIndex) await collection.dropIndex(matchingIndex.name);
  await collection.createIndex(definition.keys, { ...definition.options, name: definition.name });

  const migratedIndexes = await collection.listIndexes().toArray();
  const migratedIndex = migratedIndexes.find((index) => index.name === definition.name);
  if (!migratedIndex || !matchesMovieTextDefinition(migratedIndex, definition.keys) || !hasCurrentOptions(migratedIndex, definition.options)) {
    throw new Error('The Movie text index did not match the expected definition after creation');
  }
  return { action: matchingIndex ? 'recreated' : 'created', ...definition };
}

async function main() {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
  mongoose.set('autoIndex', false);
  await connectDatabase();
  try {
    const result = await migrateMovieTextIndex(Movie.collection);
    console.log(`Movie text index ${result.action}: ${result.name}`);
    console.log(`Definition: ${JSON.stringify(result.keys)}; default_language=${result.options.default_language}; language_override=${result.options.language_override}`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    const category = error.codeName || error.code || error.name || 'UnknownError';
    console.error(`Movie text index migration failed (${category}). No credentials were displayed.`);
    process.exitCode = 1;
  });
}

module.exports = { getMovieTextIndexDefinition, migrateMovieTextIndex };
