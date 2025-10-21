#!/usr/bin/env node
require('dotenv').config();

const { Pool } = require('pg');
const { seedPrompts } = require('./db/seedPrompts');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await seedPrompts(pool);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error seeding prompts:', error);
    process.exit(1);
  });
}

module.exports = { main };
