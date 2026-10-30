const dns = require('node:dns');
const mongoose = require('mongoose');

const DEFAULT_DNS_SERVERS = ['1.1.1.1', '8.8.8.8'];

function configureDns() {
  const configuredServers = process.env.DNS_SERVERS
    ?.split(',')
    .map((server) => server.trim())
    .filter(Boolean);
  dns.setServers(configuredServers?.length ? configuredServers : DEFAULT_DNS_SERVERS);
}

async function connectDatabase() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  configureDns();
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log('Connected to MongoDB');
}

module.exports = connectDatabase;
