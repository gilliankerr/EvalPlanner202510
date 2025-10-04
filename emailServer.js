// Simple Node.js server for handling email sending
// Uses Resend integration for email delivery

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { Resend } = require('resend');

const app = express();
const PORT = 3001;

// ============================================================================
// EMAIL CONFIGURATION
// ============================================================================
// 
// Configure the "from" email address used for all outgoing emails.
// 
// CURRENT METHOD (Hardcoded):
// Change the FROM_EMAIL constant below to update the sender address.
// Make sure the domain is verified in your Resend account (https://resend.com/domains)
//
// ALTERNATIVE METHOD (Environment Variable):
// You can also set RESEND_FROM_EMAIL in your environment variables/secrets.
// If set, it will override the hardcoded value below.
//
// FUTURE IMPROVEMENT:
// Consider adding a "System Settings" section to the Admin interface where
// the from email can be configured dynamically without code changes.
// ============================================================================

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'ai@gkerr.com';

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
  const { client } = await getResendClient();

  const emailData = {
    from: FROM_EMAIL,
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
      res.json({ success: true });
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

// Simple authentication middleware for admin routes
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const adminKey = process.env.ADMIN_API_KEY || 'dev-admin-key-change-in-production';
  
  if (!authHeader || authHeader !== `Bearer ${adminKey}`) {
    return res.status(401).json({ error: 'Unauthorized - Admin access required' });
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
    const { content, change_notes } = req.body;
    
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
    
    // Update prompt content and version
    await client.query(
      'UPDATE prompts SET content = $1, current_version = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [content, newVersion, prompt.id]
    );
    
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Email server running on port ${PORT}`);
});
