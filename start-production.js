#!/usr/bin/env node

// Production startup script
// The backend (server.js) serves BOTH the built frontend files AND the API
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const serviceName = (process.env.RAILWAY_SERVICE_NAME || '').toLowerCase();
const isWorkerOnly = process.env.WORKER_ONLY === 'true' || serviceName.includes('worker');

if (isWorkerOnly) {
  console.log('⚙️  Starting background worker...');
} else {
  console.log('🚀 Starting production server...');
  console.log('================================\n');
}

// Check if frontend is built
const distPath = path.join(__dirname, 'project', 'dist');
if (!isWorkerOnly) {
  if (!fs.existsSync(distPath)) {
    console.error('❌ ERROR: Frontend not built!');
    console.error('   The dist/ folder does not exist.');
    console.error('   This usually means the build step failed or was not run.');
    console.error('   Check the build logs for errors.\n');
    process.exit(1);
  }

  console.log('✓ Frontend build detected\n');
} else if (!fs.existsSync(distPath)) {
  console.warn('⚠️  Frontend build not detected. Worker will continue without serving static assets.');
}

const entryScript = isWorkerOnly ? 'worker.js' : 'server.js';

if (isWorkerOnly) {
  console.log('🔧 Launching worker entrypoint (worker.js)...');
  console.log('   - HTTP server skipped (WORKER_ONLY=true)');
  console.log('   - Background job processor enabled\n');
} else {
  // Start the unified server (serves both frontend and API)
  const port = process.env.PORT || '5000';
  console.log(`🔧 Starting unified server on port ${port}...`);
  console.log('   - Serving built frontend from /project/dist');
  console.log('   - Serving API endpoints from /api/*\n');
}

const childEnv = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'production'
};

if (isWorkerOnly) {
  childEnv.WORKER_ONLY = 'true';
  if (!('ENABLE_JOB_PROCESSOR' in childEnv)) {
    childEnv.ENABLE_JOB_PROCESSOR = 'true';
  }
} else if (!childEnv.PORT) {
  childEnv.PORT = '5000';
}

// Optionally run DB migrations at startup when RUN_DB_MIGRATIONS=true
if (process.env.RUN_DB_MIGRATIONS === 'true') {
  console.log('🔁 RUN_DB_MIGRATIONS=true - running database migrations before starting service');
  const { spawnSync } = require('child_process');
  const migrate = spawnSync('npm', ['run', 'db:migrate'], { stdio: 'inherit', env: childEnv });
  if (migrate.status !== 0) {
    console.error('❌ Database migrations failed. Aborting startup.');
    process.exit(migrate.status || 1);
  }
  console.log('✅ Database migrations completed successfully');
}

// Log optional migration tuning for visibility
if (process.env.RUN_DB_MIGRATIONS === 'true') {
  console.log(`   - DB_MIGRATE_ADVISORY_LOCK: ${process.env.DB_MIGRATE_ADVISORY_LOCK || '1234567890 (default)'}`);
  console.log(`   - DB_MIGRATE_MAX_RETRIES: ${process.env.DB_MIGRATE_MAX_RETRIES || '12 (default)'}`);
  console.log(`   - DB_MIGRATE_SLEEP_SECONDS: ${process.env.DB_MIGRATE_SLEEP_SECONDS || '5 (default)'}`);
}

const server = spawn('node', [entryScript], {
  stdio: 'inherit',
  env: childEnv
});

// Handle process cleanup
const shutdownLabel = isWorkerOnly ? 'worker' : 'server';

process.on('SIGINT', () => {
  console.log(`\n🛑 Shutting down ${shutdownLabel}...`);
  server.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`\n🛑 Shutting down ${shutdownLabel}...`);
  server.kill('SIGTERM');
  process.exit(0);
});

// Handle server crashes
server.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ ${isWorkerOnly ? 'Worker' : 'Server'} crashed with code ${code}`);
    process.exit(1);
  }
});

console.log(`✅ ${isWorkerOnly ? 'Worker' : 'Server'} started successfully!`);