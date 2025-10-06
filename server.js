// Simple Node.js server for handling email sending
// Uses Resend integration for email delivery

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const { Resend } = require('resend');
const crypto = require('crypto');
const { convertMarkdownToHtml: mdToHtml, generateTOC, getReportStyles } = require('./reportRenderer');

const app = express();
// In development, backend runs on 3001 (Vite dev server uses 5000)
// In production, backend runs on 5000 (serves both frontend and API)
const PORT = process.env.NODE_ENV === 'production' ? (process.env.PORT || 5000) : 3001;

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
// Database-backed session store for admin authentication
// Sessions expire after 24 hours and are automatically cleaned up
// ============================================================================

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Generate a cryptographically secure random token
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Create a new session
async function createSession() {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION);
  
  await pool.query(
    `INSERT INTO sessions (token, expires_at) 
     VALUES ($1, $2)`,
    [token, expiresAt]
  );
  
  return { token, expiresAt: expiresAt.getTime() };
}

// Validate a session token
async function validateSession(token) {
  const result = await pool.query(
    `SELECT expires_at FROM sessions 
     WHERE token = $1 AND expires_at > NOW()`,
    [token]
  );
  
  if (result.rows.length === 0) {
    return false;
  }
  
  // Update last_accessed_at for activity tracking
  await pool.query(
    `UPDATE sessions SET last_accessed_at = NOW() WHERE token = $1`,
    [token]
  );
  
  return true;
}

// Invalidate a session (for logout)
async function invalidateSession(token) {
  const result = await pool.query(
    `DELETE FROM sessions WHERE token = $1 RETURNING token`,
    [token]
  );
  
  return result.rows.length > 0;
}

// Clean up expired sessions (runs periodically)
async function cleanupExpiredSessions() {
  try {
    const result = await pool.query(
      `DELETE FROM sessions WHERE expires_at < NOW() RETURNING id`
    );
    
    if (result.rows.length > 0) {
      console.log(`Cleaned up ${result.rows.length} expired sessions`);
    }
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

// Database setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Handle pool errors to prevent crashes
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client:', err);
  // Don't crash the server, just log the error
});

// Handle uncaught errors to prevent server crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Log but don't exit - keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log but don't exit - keep server running
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

// ============================================================================
// SETTINGS MANAGEMENT
// ============================================================================
// Get setting from database with environment variable fallback
async function getSetting(key, envVarName = null) {
  try {
    const result = await pool.query(
      'SELECT value FROM settings WHERE key = $1',
      [key]
    );
    
    // Check if value exists and is not empty/blank
    if (result.rows.length > 0 && result.rows[0].value !== null && result.rows[0].value.trim()) {
      return result.rows[0].value;
    }
    
    // Fallback to environment variable if provided
    if (envVarName && process.env[envVarName]) {
      return process.env[envVarName];
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    // Fallback to environment variable on database error
    if (envVarName && process.env[envVarName]) {
      return process.env[envVarName];
    }
    return null;
  }
}

// ============================================================================
// OPENROUTER PROXY
// ============================================================================
// Legacy proxy endpoint - kept for backward compatibility
app.post('/openrouter-proxy', async (req, res) => {
  try {
    const { model, messages, max_tokens, temperature } = req.body;
    
    // Get API key from database, fallback to environment variable
    const apiKey = await getSetting('openrouter_api_key', 'OPENROUTER_API_KEY');
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'OpenRouter API key not configured. Please set it in the admin settings or as an environment variable.' 
      });
    }
    
    // Build request body
    const requestBody = {
      model,
      messages,
      max_tokens: max_tokens || 4000
    };
    
    // Add temperature if provided
    if (temperature !== undefined) {
      requestBody.temperature = temperature;
    }
    
    // Make request to OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API Error:', errorText);
      return res.status(response.status).json({ 
        error: `OpenRouter API error: ${response.status} - ${errorText}` 
      });
    }
    
    const data = await response.json();
    res.json(data);
    
  } catch (error) {
    console.error('OpenRouter proxy error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to proxy request to OpenRouter' 
    });
  }
});

// New OpenRouter proxy endpoint that reads model/temperature from settings
// Frontend calls this endpoint with a 'step' parameter (prompt1, prompt2, or report_template)
app.post('/api/openrouter/chat/completions', async (req, res) => {
  try {
    const { step, messages, max_tokens } = req.body;
    
    if (!step) {
      return res.status(400).json({ 
        error: 'Missing step parameter. Must be one of: prompt1, prompt2, report_template' 
      });
    }
    
    // Get API key from database, fallback to environment variable
    const apiKey = await getSetting('openrouter_api_key', 'OPENROUTER_API_KEY');
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'OpenRouter API key not configured. Please set it in the admin settings or as an environment variable.' 
      });
    }
    
    // Get model and temperature for this step from settings
    // Settings keys: prompt1_model, prompt2_model, report_template_model
    // Environment fallbacks: PROMPT1_MODEL, PROMPT2_MODEL, REPORT_TEMPLATE_MODEL
    const stepUpperCase = step.toUpperCase();
    const model = await getSetting(`${step}_model`, `${stepUpperCase}_MODEL`) || 'openai/gpt-4o';
    
    // Temperature settings (optional)
    const temperatureStr = await getSetting(`${step}_temperature`, `${stepUpperCase}_TEMPERATURE`);
    const temperature = temperatureStr ? parseFloat(temperatureStr) : undefined;
    
    // Build request body
    const requestBody = {
      model,
      messages,
      max_tokens: max_tokens || 4000
    };
    
    // Add temperature if provided
    if (temperature !== undefined && !isNaN(temperature)) {
      requestBody.temperature = temperature;
    }
    
    console.log(`Making OpenRouter API call for step: ${step}, model: ${model}, max_tokens: ${requestBody.max_tokens}`);
    console.log('Request body:', JSON.stringify({...requestBody, messages: [{...requestBody.messages[0], content: requestBody.messages[0].content.substring(0, 200) + '...(truncated)'}]}, null, 2));
    
    // Retry logic for handling truncated responses
    let retries = 0;
    const maxRetries = 3;
    let lastError = null;
    
    while (retries < maxRetries) {
      // Make request to OpenRouter with extended timeout for large responses
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        console.error('Aborting request due to 5-minute timeout');
        controller.abort();
      }, 300000); // 5 minute timeout
      
      try {
        if (retries > 0) {
          const delay = Math.pow(2, retries) * 1000; // Exponential backoff: 2s, 4s, 8s
          console.log(`Retry attempt ${retries}/${maxRetries} after ${delay}ms delay...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        console.log('Sending request to OpenRouter...');
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        console.log(`OpenRouter response status: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('OpenRouter API Error:', errorText);
          return res.status(response.status).json({ 
            error: `OpenRouter API error: ${response.status} - ${errorText}` 
          });
        }
        
        console.log('Parsing OpenRouter response...');
        const responseText = await response.text();
        console.log(`Received response text of length: ${responseText.length}`);
        
        // Check if response seems truncated (too short for a valid GPT response)
        if (responseText.length < 500) {
          throw new Error(`Response too short (${responseText.length} chars), likely truncated`);
        }
        
        let data;
        try {
          data = JSON.parse(responseText);
          console.log(`Successfully parsed JSON response with ${data.choices?.[0]?.message?.content?.length || 0} characters`);
        } catch (parseError) {
          console.error('JSON parse error:', parseError.message);
          console.error('Response text preview:', responseText.substring(0, 500));
          throw new Error(`Failed to parse OpenRouter response: ${parseError.message}`);
        }
        
        // Success! Return the response
        return res.json(data);
        
      } catch (fetchError) {
        clearTimeout(timeout);
        lastError = fetchError;
        
        console.error(`Attempt ${retries + 1} failed:`, {
          name: fetchError.name,
          message: fetchError.message
        });
        
        if (fetchError.name === 'AbortError') {
          console.error('OpenRouter request timeout after 5 minutes');
          return res.status(408).json({ 
            error: 'Request timeout - the response took too long to generate. Please try again or use a smaller prompt.' 
          });
        }
        
        retries++;
        
        // If we've exhausted retries, throw the error
        if (retries >= maxRetries) {
          console.error('Max retries reached, giving up');
          throw lastError;
        }
      }
    }
    
    // This should never be reached, but just in case
    throw lastError || new Error('Unknown error occurred');
    
  } catch (error) {
    console.error('OpenRouter proxy error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to proxy request to OpenRouter' 
    });
  }
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ status: 'Backend API server is running' });
});

// Email endpoint
app.post('/api/send-email', async (req, res) => {
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
app.post('/api/verify-admin-password', async (req, res) => {
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
      const { token, expiresAt } = await createSession();
      
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
app.post('/api/admin-logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({ 
        success: false, 
        error: 'No session token provided' 
      });
    }
    
    const token = authHeader.substring(7);
    const invalidated = await invalidateSession(token);
    
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
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - Admin session required' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const isValid = await validateSession(token);
    if (!isValid) {
      return res.status(401).json({ error: 'Unauthorized - Session expired or invalid' });
    }
    next();
  } catch (error) {
    console.error('Session validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Prompt Management API Routes

// GET /api/prompts - List all prompts (read-only, no auth required)
app.get('/api/prompts', async (req, res) => {
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

// GET /api/prompts/:step - Get active prompt for a specific step (read-only, no auth required)
app.get('/api/prompts/:step', async (req, res) => {
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

// POST /api/prompts/:step - Create new version of a prompt (ADMIN ONLY)
app.post('/api/prompts/:step', authenticateAdmin, async (req, res) => {
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

// GET /api/prompts/:step/versions - Get version history
app.get('/api/prompts/:step/versions', async (req, res) => {
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

// POST /api/prompts/:step/rollback/:version - Rollback to a specific version (ADMIN ONLY)
app.post('/api/prompts/:step/rollback/:version', authenticateAdmin, async (req, res) => {
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

// Settings Management API Routes

// GET /api/settings - Get all settings (ADMIN ONLY)
app.get('/api/settings', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT key, value, description FROM settings ORDER BY key'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/:key - Get a specific setting (ADMIN ONLY)
app.get('/api/settings/:key', authenticateAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const result = await pool.query(
      'SELECT key, value, description FROM settings WHERE key = $1',
      [key]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/settings/:key - Update a setting (ADMIN ONLY)
app.put('/api/settings/:key', authenticateAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    // Check if setting exists
    const checkResult = await pool.query(
      'SELECT key FROM settings WHERE key = $1',
      [key]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    // Update the setting
    const result = await pool.query(
      'UPDATE settings SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2 RETURNING *',
      [value, key]
    );
    
    res.json({ 
      success: true, 
      setting: result.rows[0],
      message: `Setting '${key}' updated successfully` 
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: error.message });
  }
});

// Configuration endpoint - returns read-only system settings
app.get('/api/config', async (req, res) => {
  try {
    // Get from email from Resend integration
    let emailFromAddress = 'Not configured';
    try {
      const credentials = await getCredentials();
      emailFromAddress = credentials.fromEmail;
    } catch (error) {
      console.error('Could not fetch from email:', error.message);
    }

    // Get settings from database (with env var fallbacks)
    const prompt1Model = await getSetting('prompt1_model', 'VITE_PROMPT1_MODEL') || 'openai/gpt-4o';
    const prompt1Temp = await getSetting('prompt1_temperature', 'VITE_PROMPT1_TEMPERATURE');
    const prompt1WebSearch = await getSetting('prompt1_web_search', 'VITE_PROMPT1_WEB_SEARCH');
    
    const prompt2Model = await getSetting('prompt2_model', 'VITE_PROMPT2_MODEL') || 'openai/gpt-4o';
    const prompt2Temp = await getSetting('prompt2_temperature', 'VITE_PROMPT2_TEMPERATURE');
    const prompt2WebSearch = await getSetting('prompt2_web_search', 'VITE_PROMPT2_WEB_SEARCH');
    
    const reportModel = await getSetting('report_template_model', 'VITE_REPORT_TEMPLATE_MODEL') || 'openai/gpt-4o';
    const reportTemp = await getSetting('report_template_temperature', 'VITE_REPORT_TEMPLATE_TEMPERATURE');
    const reportWebSearch = await getSetting('report_template_web_search', 'VITE_REPORT_TEMPLATE_WEB_SEARCH');

    const config = {
      emailFromAddress,
      prompt1: {
        model: prompt1Model,
        temperature: prompt1Temp ? parseFloat(prompt1Temp) : 0.7,
        webSearch: prompt1WebSearch === 'false' ? false : true
      },
      prompt2: {
        model: prompt2Model,
        temperature: prompt2Temp ? parseFloat(prompt2Temp) : 0.7,
        webSearch: prompt2WebSearch === 'false' ? false : true
      },
      reportTemplate: {
        model: reportModel,
        temperature: reportTemp ? parseFloat(reportTemp) : 0.7,
        webSearch: reportWebSearch === 'true' ? true : false
      }
    };
    
    res.json(config);
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// ============================================================================
// ASYNC JOB QUEUE API
// ============================================================================

// POST /api/jobs - Create a new async job
app.post('/api/jobs', async (req, res) => {
  try {
    const { job_type, input_data, email } = req.body;
    
    if (!job_type || !input_data || !email) {
      return res.status(400).json({ 
        error: 'Missing required fields: job_type, input_data, email' 
      });
    }
    
    if (!['prompt1', 'prompt2', 'report_template'].includes(job_type)) {
      return res.status(400).json({ 
        error: 'Invalid job_type. Must be: prompt1, prompt2, or report_template' 
      });
    }
    
    const result = await pool.query(
      `INSERT INTO jobs (job_type, status, input_data, email) 
       VALUES ($1, 'pending', $2, $3) 
       RETURNING id, job_type, status, created_at`,
      [job_type, JSON.stringify(input_data), email]
    );
    
    const job = result.rows[0];
    console.log(`Created job ${job.id} (${job_type}) for ${email}`);
    
    // Trigger job processing (non-blocking)
    processNextJob().catch(err => console.error('Error processing job:', err));
    
    res.json({
      success: true,
      job_id: job.id,
      status: job.status,
      created_at: job.created_at
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/jobs/:id - Get job status and results
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT id, job_type, status, result_data, error, created_at, completed_at 
       FROM jobs WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const job = result.rows[0];
    res.json({
      id: job.id,
      job_type: job.job_type,
      status: job.status,
      result: job.result_data,
      error: job.error,
      created_at: job.created_at,
      completed_at: job.completed_at
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: error.message });
  }
});

// Convert markdown to formatted HTML with embedded CSS (using enhanced renderer)
function convertMarkdownToHtml(markdown, programName, organizationName) {
  // Generate TOC
  const tocHtml = generateTOC(markdown);
  
  // Convert markdown content with all enhanced features
  const contentHtml = mdToHtml(markdown, { programName, organizationName });
  
  // Get all report styles
  const styles = getReportStyles();
  
  // Create complete HTML document
  const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${organizationName} — ${programName} Evaluation Plan</title>
    <style>
        ${styles}
    </style>
</head>
<body>
    <div class="report-container">
        <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin-bottom: 2rem;">
            <h3 style="margin: 0 0 1rem 0; color: #1e293b; font-size: 1.25rem;">Table of Contents</h3>
            ${tocHtml}
        </div>
        ${contentHtml}
    </div>
</body>
</html>`;
  
  return htmlDocument;
}

// Background job processor
async function processNextJob() {
  let client;
  
  try {
    // Try to get a connection
    client = await pool.connect();
    await client.query('BEGIN');
    
    // Get the next pending job (with row lock)
    const jobResult = await client.query(
      `SELECT id, job_type, input_data, email 
       FROM jobs 
       WHERE status = 'pending' 
       ORDER BY created_at ASC 
       LIMIT 1 
       FOR UPDATE SKIP LOCKED`
    );
    
    if (jobResult.rows.length === 0) {
      await client.query('COMMIT');
      return;
    }
    
    const job = jobResult.rows[0];
    
    // Mark job as processing
    await client.query(
      `UPDATE jobs SET status = 'processing' WHERE id = $1`,
      [job.id]
    );
    
    await client.query('COMMIT');
    
    console.log(`Processing job ${job.id} (${job.job_type})...`);
    
    // Process the job (outside transaction)
    try {
      const inputData = job.input_data;
      const apiKey = await getSetting('openrouter_api_key', 'OPENROUTER_API_KEY');
      
      if (!apiKey) {
        throw new Error('OpenRouter API key not configured');
      }
      
      // Get model and temperature for this step
      const stepUpperCase = job.job_type.toUpperCase();
      const model = await getSetting(`${job.job_type}_model`, `${stepUpperCase}_MODEL`) || 'openai/gpt-4o';
      const temperatureStr = await getSetting(`${job.job_type}_temperature`, `${stepUpperCase}_TEMPERATURE`);
      const temperature = temperatureStr ? parseFloat(temperatureStr) : undefined;
      
      // Build request
      const requestBody = {
        model,
        messages: inputData.messages,
        max_tokens: inputData.max_tokens || 4000
      };
      
      if (temperature !== undefined && !isNaN(temperature)) {
        requestBody.temperature = temperature;
      }
      
      console.log(`Calling OpenRouter for job ${job.id}: model=${model}, max_tokens=${requestBody.max_tokens}`);
      
      // Call OpenRouter with retry logic
      let retries = 0;
      const maxRetries = 3;
      let result;
      
      while (retries < maxRetries) {
        try {
          if (retries > 0) {
            const delay = Math.pow(2, retries) * 1000;
            console.log(`Retry ${retries}/${maxRetries} after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
          }
          
          const responseText = await response.text();
          
          if (responseText.length < 500) {
            throw new Error(`Response too short (${responseText.length} chars), likely truncated`);
          }
          
          const data = JSON.parse(responseText);
          result = data.choices[0].message.content;
          break;
          
        } catch (fetchError) {
          retries++;
          if (retries >= maxRetries) {
            throw fetchError;
          }
        }
      }
      
      console.log(`Job ${job.id} completed successfully (${result.length} chars)`);
      
      // Update job as complete
      await pool.query(
        `UPDATE jobs 
         SET status = 'completed', result_data = $1, completed_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [result, job.id]
      );
      
      // Only send email for final report_template jobs (skip intermediate prompt1/prompt2 steps)
      if (job.job_type === 'report_template') {
        try {
          // Fetch email template from database
          const templateResult = await pool.query(
            'SELECT content FROM prompts WHERE step_name = $1',
            ['email_delivery']
          );
          
          let emailBody = 'Your evaluation plan is complete!';
          
          // Extract metadata from input_data
          const metadata = inputData.metadata || {};
          const programName = metadata.programName || 'your program';
          const organizationName = metadata.organizationName || 'your organization';
          
          if (templateResult.rows.length > 0) {
            // Get template content
            let templateContent = templateResult.rows[0].content;
            
            const currentDateTime = new Date().toLocaleString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZoneName: 'short'
            });
            
            // Replace template variables
            emailBody = templateContent
              .replace(/\{\{programName\}\}/g, programName)
              .replace(/\{\{organizationName\}\}/g, organizationName)
              .replace(/\{\{currentDateTime\}\}/g, currentDateTime);
          }
          
          // Create clean filename from metadata
          const orgNameClean = (organizationName || 'Organization').replace(/[^a-zA-Z0-9]/g, '_');
          const progNameClean = (programName || 'Program').replace(/[^a-zA-Z0-9]/g, '_');
          const filename = `${orgNameClean}_${progNameClean}_Evaluation_Plan.html`;
          
          // Convert markdown to formatted HTML with CSS
          const formattedHtml = convertMarkdownToHtml(result, programName, organizationName);
          
          // Convert formatted HTML to base64 for attachment
          const base64Content = Buffer.from(formattedHtml, 'utf-8').toString('base64');
          
          const emailSubject = `Evaluation Plan for ${programName}`;
          
          await sendEmail({
            to: job.email,
            subject: emailSubject,
            html: emailBody,
            attachments: [{
              filename: filename,
              content: base64Content,
              contentType: 'text/html',
              encoding: 'base64'
            }]
          });
          
          console.log(`Email with HTML attachment sent to ${job.email} for job ${job.id}`);
        } catch (emailError) {
          console.error(`Failed to send email for job ${job.id}:`, emailError);
        }
      } else {
        console.log(`Skipping email for intermediate step ${job.job_type} (job ${job.id})`);
      }
      
    } catch (processingError) {
      console.error(`Job ${job.id} failed:`, processingError);
      
      // Update job as failed
      await pool.query(
        `UPDATE jobs 
         SET status = 'failed', error = $1, completed_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [processingError.message, job.id]
      );
      
      // Send error email
      try {
        await sendEmail({
          to: job.email,
          subject: 'Evaluation plan processing failed',
          html: `
            <h2>Processing Error</h2>
            <p>Unfortunately, your ${job.job_type.replace('_', ' ')} failed to process.</p>
            <p><strong>Error:</strong> ${processingError.message}</p>
            <p><small>Job ID: ${job.id}</small></p>
          `
        });
      } catch (emailError) {
        console.error(`Failed to send error email for job ${job.id}:`, emailError);
      }
    }
    
    // Process next job if any
    processNextJob().catch(err => console.error('Error in job chain:', err));
    
  } catch (error) {
    console.error('Error in processNextJob:', error);
    // Try to rollback if we have a client
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
    }
  } finally {
    // Release client if we have one
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('Error releasing client:', releaseError);
      }
    }
  }
}

// Cleanup old jobs (runs every hour)
async function cleanupOldJobs() {
  try {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    
    const result = await pool.query(
      `DELETE FROM jobs 
       WHERE (status = 'completed' OR status = 'failed') 
       AND completed_at < $1 
       RETURNING id`,
      [sixHoursAgo]
    );
    
    if (result.rows.length > 0) {
      console.log(`Cleaned up ${result.rows.length} old jobs`);
    }
  } catch (error) {
    console.error('Error cleaning up old jobs:', error);
  }
}

// Run cleanup every hour
setInterval(cleanupOldJobs, 60 * 60 * 1000);

// ============================================================================
// STATIC FILE SERVING (PRODUCTION)
// ============================================================================
// Serve the built Vite frontend from project/dist
// This allows the frontend and backend to run from the same server/port
const distPath = path.join(__dirname, 'project', 'dist');
app.use(express.static(distPath));

// SPA fallback - serve index.html for all non-API routes
// This ensures React Router works correctly
app.use((req, res, next) => {
  // Skip if this is an API route
  if (req.path.startsWith('/api')) {
    return next();
  }
  
  // Serve index.html for all other routes (SPA fallback)
  res.sendFile(path.join(distPath, 'index.html'));
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
