#!/usr/bin/env node

// Production startup script that runs both frontend and email server
const { spawn } = require('child_process');

console.log('🚀 Starting production servers...');

// Start the email server
console.log('📧 Starting email server on port 3001...');
const emailServer = spawn('node', ['emailServer.js'], {
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
  emailServer.kill('SIGINT');
  frontendServer.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down servers...');
  emailServer.kill('SIGTERM');
  frontendServer.kill('SIGTERM');
  process.exit(0);
});

// Handle server crashes
emailServer.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Email server crashed with code ${code}`);
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