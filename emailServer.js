// Simple Node.js server for handling email sending
// Uses Resend integration for email delivery

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { Resend } = require('resend');
const crypto = require('crypto');

const app = express();
const PORT = 3001;

// ============================================================================
// EMAIL CONFIGURATION
// ============================================================================
// 
// The "from" email address is configured through the Resend integration.
// To change it:
// 1. Go to Replit Integrations
// 2. Update the Resend connection's "From Email" field
// 3. Restart the email server
//
// Make sure the domain is verified in your Resend account (https://resend.com/domains)
// ============================================================================

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================
// In-memory session store for admin authentication
// Sessions expire after 24 hours and are automatically cleaned up
// ============================================================================

const sessions = new Map();
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Generate a cryptographically secure random token
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Create a new session
function createSession() {
  const token = generateSessionToken();
  const expiresAt = Date.now() + SESSION_DURATION;
  
  sessions.set(token, {
    createdAt: Date.now(),
    expiresAt: expiresAt
  });
  
  return { token, expiresAt };
}

// Validate a session token
function validateSession(token) {
  const session = sessions.get(token);
  
  if (!session) {
    return false;
  }
  
  // Check if session has expired
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return false;
  }
  
  return true;
}

// Invalidate a session (for logout)
function invalidateSession(token) {
  return sessions.delete(token);
}

// Clean up expired sessions (runs periodically)
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(token);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

// Database setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Resend client initialization
let connectionSettings;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings.api_key) {
    throw new Error('Resend not connected');
  }
  
  return {
    apiKey: connectionSettings.settings.api_key,
    fromEmail: connectionSettings.settings.from_email
  };
}

// Get fresh Resend client (tokens expire, so never cache)
async function getResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: credentials.fromEmail
  };
}

// Email sending function using Resend
async function sendEmail(message) {
  const { client, fromEmail } = await getResendClient();

  const emailData = {
    from: fromEmail,
    to: Array.isArray(message.to) ? message.to : [message.to],
    subject: message.subject,
    html: message.html || undefined,
    text: message.text || undefined,
    attachments: message.attachments || undefined
  };

  // Add CC if provided
  if (message.cc) {
    emailData.cc = Array.isArray(message.cc) ? message.cc : [message.cc];
  }

  const result = await client.emails.send(emailData);
  
  if (result.error) {
    throw new Error(result.error.message || 'Failed to send email');
  }

  return result.data;
}

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ status: 'Email server is running' });
});

// Email endpoint
app.post('/send-email', async (req, res) => {
  console.log('Received email request:', req.body);
  try {
    const { to, subject, text, html, attachments } = req.body;
    
    console.log('Sending email to:', to);
    const result = await sendEmail({
      to,
      subject,
      text,
      html,
      attachments
    });
    
    console.log('Email sent successfully:', result);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Password verification endpoint
app.post('/verify-admin-password', (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password is required' 
      });
    }
    
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (password === adminPassword) {
      // Create a new session
      const { token, expiresAt } = createSession();
      
      res.json({ 
        success: true,
        sessionToken: token,
        expiresAt: expiresAt
      });
    } else {
      res.status(401).json({ 
        success: false, 
        error: 'Invalid password' 
      });
    }
  } catch (error) {
    console.error('Error verifying password:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Admin logout endpoint
app.post('/admin-logout', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({ 
        success: false, 
        error: 'No session token provided' 
      });
    }
    
    const token = authHeader.substring(7);
    const invalidated = invalidateSession(token);
    
    res.json({ 
      success: true,
      message: invalidated ? 'Session invalidated successfully' : 'Session already expired or invalid'
    });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Session-based authentication middleware for admin routes
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - Admin session required' });
  }
  
  const token = authHeader.substring(7);
  
  if (!validateSession(token)) {
    return res.status(401).json({ error: 'Unauthorized - Session expired or invalid' });
  }
  
  next();
};

// Prompt Management API Routes

// GET /prompts - List all prompts (read-only, no auth required)
app.get('/prompts', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, step_name, display_name, current_version, is_active, updated_at FROM prompts ORDER BY step_name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /prompts/:step - Get active prompt for a specific step (read-only, no auth required)
app.get('/prompts/:step', async (req, res) => {
  try {
    const { step } = req.params;
    const result = await pool.query(
      'SELECT * FROM prompts WHERE step_name = $1 AND is_active = true',
      [step]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching prompt:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /prompts/:step - Create new version of a prompt (ADMIN ONLY)
app.post('/prompts/:step', authenticateAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { step } = req.params;
    const { content, display_name, change_notes } = req.body;
    
    await client.query('BEGIN');
    
    // Get current prompt
    const promptResult = await client.query(
      'SELECT id, current_version FROM prompts WHERE step_name = $1',
      [step]
    );
    
    if (promptResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    const prompt = promptResult.rows[0];
    const newVersion = prompt.current_version + 1;
    
    // Update prompt content, display_name (if provided), and version
    if (display_name !== undefined) {
      await client.query(
        'UPDATE prompts SET content = $1, display_name = $2, current_version = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        [content, display_name, newVersion, prompt.id]
      );
    } else {
      await client.query(
        'UPDATE prompts SET content = $1, current_version = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [content, newVersion, prompt.id]
      );
    }
    
    // Insert version history
    await client.query(
      'INSERT INTO prompt_versions (prompt_id, version_number, content, change_notes) VALUES ($1, $2, $3, $4)',
      [prompt.id, newVersion, content, change_notes || 'Updated via admin interface']
    );
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      version: newVersion,
      message: 'Prompt updated successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating prompt:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// GET /prompts/:step/versions - Get version history
app.get('/prompts/:step/versions', async (req, res) => {
  try {
    const { step } = req.params;
    
    const result = await pool.query(`
      SELECT pv.*, p.step_name, p.display_name
      FROM prompt_versions pv
      JOIN prompts p ON pv.prompt_id = p.id
      WHERE p.step_name = $1
      ORDER BY pv.version_number DESC
    `, [step]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching version history:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /prompts/:step/rollback/:version - Rollback to a specific version (ADMIN ONLY)
app.post('/prompts/:step/rollback/:version', authenticateAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { step, version } = req.params;
    
    await client.query('BEGIN');
    
    // Get the prompt
    const promptResult = await client.query(
      'SELECT id FROM prompts WHERE step_name = $1',
      [step]
    );
    
    if (promptResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    const promptId = promptResult.rows[0].id;
    
    // Get the version content
    const versionResult = await client.query(
      'SELECT content FROM prompt_versions WHERE prompt_id = $1 AND version_number = $2',
      [promptId, version]
    );
    
    if (versionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Version not found' });
    }
    
    const versionContent = versionResult.rows[0].content;
    
    // Update current prompt
    await client.query(
      'UPDATE prompts SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [versionContent, promptId]
    );
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: `Rolled back to version ${version}`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error rolling back prompt:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Configuration endpoint - returns read-only system settings
app.get('/config', async (req, res) => {
  try {
    // Get from email from Resend integration
    let emailFromAddress = 'Not configured';
    try {
      const credentials = await getCredentials();
      emailFromAddress = credentials.fromEmail;
    } catch (error) {
      console.error('Could not fetch from email:', error.message);
    }

    const config = {
      emailFromAddress,
      prompt1: {
        model: process.env.VITE_PROMPT1_MODEL || 'openai/gpt-5',
        temperature: process.env.VITE_PROMPT1_TEMPERATURE ? parseFloat(process.env.VITE_PROMPT1_TEMPERATURE) : null,
        webSearch: process.env.VITE_PROMPT1_WEB_SEARCH === 'false' ? false : true
      },
      prompt2: {
        model: process.env.VITE_PROMPT2_MODEL || 'openai/gpt-5',
        temperature: process.env.VITE_PROMPT2_TEMPERATURE ? parseFloat(process.env.VITE_PROMPT2_TEMPERATURE) : null,
        webSearch: process.env.VITE_PROMPT2_WEB_SEARCH === 'false' ? false : true
      },
      reportTemplate: {
        model: process.env.VITE_REPORT_TEMPLATE_MODEL || 'openai/gpt-5',
        temperature: process.env.VITE_REPORT_TEMPLATE_TEMPERATURE ? parseFloat(process.env.VITE_REPORT_TEMPLATE_TEMPERATURE) : null,
        webSearch: process.env.VITE_REPORT_TEMPLATE_WEB_SEARCH === 'true' ? true : false
      }
    };
    
    res.json(config);
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

async function startServer() {
  try {
    console.log('=== Email Server Startup ===');
    console.log('Environment checks:');
    console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? '✓ Set' : '✗ Missing'}`);
    console.log(`- REPLIT_CONNECTORS_HOSTNAME: ${process.env.REPLIT_CONNECTORS_HOSTNAME ? '✓ Set' : '✗ Missing'}`);
    console.log(`- REPL_IDENTITY or WEB_REPL_RENEWAL: ${(process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL) ? '✓ Set' : '✗ Missing'}`);
    console.log(`- ADMIN_PASSWORD: ${process.env.ADMIN_PASSWORD ? '✓ Set' : '✗ Missing'}`);

    console.log('\nTesting database connection...');
    const dbTest = await pool.query('SELECT NOW()');
    console.log('✓ Database connection successful');

    console.log('\nTesting Resend connection...');
    try {
      const credentials = await getCredentials();
      console.log('✓ Resend connection successful');
      console.log(`  Emails will be sent from: ${credentials.fromEmail}`);
    } catch (error) {
      console.error('✗ Resend connection failed:', error.message);
      console.error('  This may work in development but will cause issues when sending emails');
    }

    console.log('\nChecking prompts table...');
    const promptsCheck = await pool.query('SELECT COUNT(*) FROM prompts');
    console.log(`✓ Prompts table accessible (${promptsCheck.rows[0].count} prompts found)`);

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✓ Email server running on port ${PORT}`);
      console.log('=========================\n');
    });
  } catch (error) {
    console.error('\n✗ FATAL ERROR during server startup:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('\nServer cannot start. Please check the errors above.');
    process.exit(1);
  }
}

startServer();
