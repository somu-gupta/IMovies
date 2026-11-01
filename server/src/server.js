require('dotenv').config();
const app = require('./app');
const connectDatabase = require('./config/database');
const mongoose = require('mongoose');
const { startServer } = require('./startup');

const port = Number(process.env.PORT) || 5000;
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be set to at least 32 characters');
startServer({ app, connectDatabase, mongoose, port }).catch((error) => {
  console.error('Could not start IMovies API', { name: error.name, code: error.code });
  process.exitCode = 1;
});
