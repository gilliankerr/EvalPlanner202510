#!/usr/bin/env node

/**
 * Dedicated background worker entrypoint for Railway deployments.
 *
 * This script bootstraps the shared Express application in "worker only"
 * mode so that the async job processor and cleanup routines run without
 * exposing an HTTP server. Use this for long-running job processing in a
 * separate Railway service or task runner.
 */

const { startServer } = require('./server');

(async () => {
  try {
    const { shutdown } = await startServer({
      startHttp: false,
      enableJobProcessor: true,
      enableSessionCleanup: true
    });

    console.log('Background worker started successfully.');
    console.log('Press Ctrl+C to exit.');

    const gracefulShutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Shutting down worker...`);
      try {
        await shutdown();
      } catch (error) {
        console.error('Error during worker shutdown:', error);
      } finally {
        process.exit(0);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (error) {
    console.error('Failed to start background worker:', error);
    process.exit(1);
  }
})();
