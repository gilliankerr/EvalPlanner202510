#!/usr/bin/env node

// Production startup script
// The backend (server.js) serves BOTH the built frontend files AND the API
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting production server...');
console.log('================================\n');

// Check if frontend is built
const distPath = path.join(__dirname, 'project', 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ ERROR: Frontend not built!');
  console.error('   The dist/ folder does not exist.');
  console.error('   This usually means the build step failed or was not run.');
  console.error('   Check the build logs for errors.\n');
  process.exit(1);
}

console.log('✓ Frontend build detected\n');

// Start the unified server (serves both frontend and API)
console.log('🔧 Starting unified server on port 5000...');
console.log('   - Serving built frontend from /project/dist');
console.log('   - Serving API endpoints from /api/*\n');

const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  env: { 
    ...process.env,
    NODE_ENV: 'production',  // Ensures backend runs on port 5000
    PORT: '5000'
  }
});

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  server.kill('SIGTERM');
  process.exit(0);
});

// Handle server crashes
server.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Server crashed with code ${code}`);
    process.exit(1);
  }
});

console.log('✅ Server started successfully!');