#!/usr/bin/env node

// Production startup script that runs both frontend and backend API server
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting production servers...');
console.log('=================================\n');

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

// Start the backend API server
console.log('🔧 Starting backend API server on port 3001...');
const backendServer = spawn('node', ['server.js'], {
  stdio: 'inherit',
  env: { ...process.env }
});

// Start the frontend server  
console.log('🌐 Starting frontend server on port 5000...');
const frontendServer = spawn('npm', ['start'], {
  cwd: 'project',
  stdio: 'inherit',
  env: { ...process.env }
});

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down servers...');
  backendServer.kill('SIGINT');
  frontendServer.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down servers...');
  backendServer.kill('SIGTERM');
  frontendServer.kill('SIGTERM');
  process.exit(0);
});

// Handle server crashes
backendServer.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Backend API server crashed with code ${code}`);
    process.exit(1);
  }
});

frontendServer.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Frontend server crashed with code ${code}`);
    process.exit(1);
  }
});

console.log('✅ Both servers started successfully!');