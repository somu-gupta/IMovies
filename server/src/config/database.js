const dns = require('node:dns');
const mongoose = require('mongoose');

function configureDns() {
  const configuredServers = process.env.DNS_SERVERS
    ?.split(',')
    .map((server) => server.trim())
    .filter(Boolean);
  if (configuredServers?.length) dns.setServers(configuredServers);
}

async function connectDatabase() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  configureDns();
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log('Connected to MongoDB');
}

module.exports = connectDatabase;
