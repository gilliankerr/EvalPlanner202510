// Simple Node.js server for handling email sending
// Uses Resend integration for email delivery

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { Pool } = require('pg');
const { Resend } = require('resend');
const crypto = require('crypto');
// Import the unified report generator
const { generateFullHtmlDocument } = require('./reportGeneratorServer.cjs');

let markedInstancePromise;

function getMarked() {
  if (!markedInstancePromise) {
    markedInstancePromise = import('marked').then((module) => {
      const candidate = module.marked ?? module.default ?? module;
      if (!candidate || typeof candidate.parse !== 'function') {
        throw new Error('Failed to load the marked markdown parser.');
      }
      return candidate;
    });
  }
  return markedInstancePromise;
}

const app = express();
// In development, backend runs on 3001 (Vite dev server uses 5000)
// In production, backend runs on 5000 (serves both frontend and API)
const PORT = process.env.NODE_ENV === 'production' ? (process.env.PORT || 5000) : 3001;

// ============================================================================
// EMAIL CONFIGURATION
// ============================================================================
// 
// The "from" email address is configured via environment variables when
// deploying to Railway. Set RESEND_API_KEY and RESEND_FROM_EMAIL on the
// service (or as shared variables) before deploying. Make sure the domain is
// verified in your Resend account (https://resend.com/domains).
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

// Create a new session with user identity tracking
async function createSession(userIdentifier, role = 'admin') {
  try {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION);
    
    await pool.query(
      `INSERT INTO sessions (token, expires_at, user_identifier, user_role) 
       VALUES ($1, $2, $3, $4)`,
      [token, expiresAt, userIdentifier, role]
    );
    
    console.log(`Session created for ${userIdentifier}: ${token.substring(0, 8)}... (expires: ${expiresAt.toISOString()})`);
    return { token, expiresAt: expiresAt.getTime(), userIdentifier };
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
}

// Validate a session token and return user information
async function validateSession(token) {
  try {
    const result = await pool.query(
      `SELECT user_identifier, user_role, expires_at FROM sessions 
       WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    // Update last_accessed_at for activity tracking
    await pool.query(
      `UPDATE sessions SET last_accessed_at = NOW() WHERE token = $1`,
      [token]
    );
    
    return {
      userIdentifier: result.rows[0].user_identifier,
      userRole: result.rows[0].user_role
    };
  } catch (error) {
    console.error('Error validating session:', error);
    throw error;
  }
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

// Audit logging function
async function logAuditEvent(action, userIdentifier, resourceType = null, resourceId = null, details = null, ipAddress = null) {
  try {
    await pool.query(
      `INSERT INTO audit_log (action, user_identifier, resource_type, resource_id, details, ip_address) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [action, userIdentifier, resourceType, resourceId, details ? JSON.stringify(details) : null, ipAddress]
    );
  } catch (error) {
    console.error('Error logging audit event:', error);
    // Don't throw - audit logging failures shouldn't break the app
  }
}

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

// Resend configuration helpers (Railway environment variables)
function resolveResendConfiguration() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }

  if (!fromEmail) {
    throw new Error('RESEND_FROM_EMAIL environment variable is not set');
  }

  return { apiKey, fromEmail };
}

function createResendClient() {
  const { apiKey } = resolveResendConfiguration();
  return new Resend(apiKey);
}

// Email sending function using Resend
async function sendEmail(message) {
  const { fromEmail } = resolveResendConfiguration();
  const client = createResendClient();

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

// Helper function to convert markdown to HTML for email bodies
async function convertMarkdownToEmailHtml(markdown) {
  if (!markdown) return '';

  const marked = await getMarked();
  // Configure marked for email-friendly HTML
  marked.setOptions({
    breaks: true, // Convert line breaks to <br>
    gfm: true // GitHub Flavored Markdown
  });

  // Convert markdown to HTML
  const html = marked.parse(markdown);

  // Return with basic styling for better email rendering
  return html;
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

async function resolveOpenRouterApiKey() {
  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey && envKey.trim()) {
    return { value: envKey.trim(), source: 'environment' };
  }

  try {
    const result = await pool.query(
      'SELECT value FROM settings WHERE key = $1',
      ['openrouter_api_key']
    );

    if (result.rows.length > 0 && result.rows[0].value !== null && result.rows[0].value.trim()) {
      return { value: result.rows[0].value.trim(), source: 'database' };
    }

    return { value: null, source: 'none' };
  } catch (error) {
    console.error('Error resolving OpenRouter API key from database:', error);
    return { value: null, source: 'error' };
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
    const { value: apiKey } = await resolveOpenRouterApiKey();
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'OpenRouter API key not configured. Please set it via your environment secrets (OPENROUTER_API_KEY).' 
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
    const { value: apiKey } = await resolveOpenRouterApiKey();
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'OpenRouter API key not configured. Please contact the administrator.' 
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
            error: `OpenRouter API error. Please try again or contact support if the issue persists.` 
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
          throw new Error(`Failed to parse OpenRouter response`);
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
      error: 'Failed to process request. Please try again or contact support if the issue persists.' 
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

// ============================================================================
// RATE LIMITING FOR AUTHENTICATION
// ============================================================================
// Simple in-memory rate limiting for admin password attempts
const loginAttempts = new Map(); // IP -> { count, resetTime }
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip);
  
  if (!attempts) {
    loginAttempts.set(ip, { count: 1, resetTime: now + LOCKOUT_DURATION });
    return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS - 1 };
  }
  
  // Reset if lockout period has passed
  if (now > attempts.resetTime) {
    loginAttempts.set(ip, { count: 1, resetTime: now + LOCKOUT_DURATION });
    return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS - 1 };
  }
  
  // Check if locked out
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const minutesLeft = Math.ceil((attempts.resetTime - now) / 60000);
    return { 
      allowed: false, 
      remaining: 0, 
      lockoutMinutes: minutesLeft 
    };
  }
  
  // Increment attempts
  attempts.count++;
  return { 
    allowed: true, 
    remaining: MAX_LOGIN_ATTEMPTS - attempts.count 
  };
}

function resetRateLimit(ip) {
  loginAttempts.delete(ip);
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempts] of loginAttempts.entries()) {
    if (now > attempts.resetTime) {
      loginAttempts.delete(ip);
    }
  }
}, 60000); // Clean every minute

// Password verification endpoint
app.post('/api/verify-admin-password', async (req, res) => {
  try {
    const { password } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Check rate limit
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIp}`);
      return res.status(429).json({ 
        success: false, 
        error: `Too many failed login attempts. Please try again in ${rateLimit.lockoutMinutes} minutes.` 
      });
    }
    
    if (!password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password is required' 
      });
    }
    
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
      console.error('ADMIN_PASSWORD environment variable not set');
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error' 
      });
    }
    
    if (password === adminPassword) {
      // Reset rate limit on successful login
      resetRateLimit(clientIp);
      
      // Create a new session with admin identifier
      // For single-admin setup, use 'admin' as identifier
      // For multi-user setup, this would be the user's email/username
      const adminIdentifier = 'admin';
      const { token, expiresAt } = await createSession(adminIdentifier, 'admin');
      
      // Log the login event
      await logAuditEvent('admin_login', adminIdentifier, null, null, { success: true }, clientIp);
      
      console.log(`Admin login successful from IP: ${clientIp}`);
      
      res.json({ 
        success: true,
        sessionToken: token,
        expiresAt: expiresAt
      });
    } else {
      console.warn(`Failed admin login attempt from IP: ${clientIp} (${rateLimit.remaining} attempts remaining)`);
      res.status(401).json({ 
        success: false, 
        error: 'Invalid password',
        attemptsRemaining: rateLimit.remaining
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
    const session = await validateSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized - Session expired or invalid' });
    }
    
    // Attach user info to request for use in route handlers
    req.user = {
      identifier: session.userIdentifier,
      role: session.userRole
    };
    req.userIp = req.ip || req.connection.remoteAddress || 'unknown';
    
    next();
  } catch (error) {
    console.error('Session validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Prompt Management API Routes

// GET /api/prompts/content/:step - Get prompt content for workflow execution (PUBLIC)
// This endpoint is used by the main app workflow to fetch prompts for AI processing
app.get('/api/prompts/content/:step', async (req, res) => {
  try {
    const { step } = req.params;
    const result = await pool.query(
      'SELECT content FROM prompts WHERE step_name = $1 AND is_active = true',
      [step]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    // Only return the content field, not sensitive metadata
    res.json({ content: result.rows[0].content });
  } catch (error) {
    console.error('Error fetching prompt content:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/prompts - List all prompts (ADMIN ONLY - contains sensitive business logic)
app.get('/api/prompts', authenticateAdmin, async (req, res) => {
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

// GET /api/prompts/:step - Get full prompt details (ADMIN ONLY)
app.get('/api/prompts/:step', authenticateAdmin, async (req, res) => {
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
    
    // Log the action
    await logAuditEvent(
      'prompt_updated',
      req.user.identifier,
      'prompt',
      prompt.id.toString(),
      { step_name: step, version: newVersion, change_notes },
      req.userIp
    );
    
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

// GET /api/prompts/:step/versions - Get version history (ADMIN ONLY)
app.get('/api/prompts/:step/versions', authenticateAdmin, async (req, res) => {
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

// Allowlist of settings keys that can be read/modified via API
const ALLOWED_SETTINGS_KEYS = [
  'prompt1_model',
  'prompt1_temperature',
  'prompt1_web_search',
  'prompt2_model',
  'prompt2_temperature',
  'prompt2_web_search',
  'report_template_model',
  'report_template_temperature',
  'report_template_web_search'
];

// GET /api/settings - Get all settings (ADMIN ONLY)
app.get('/api/settings', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT key, value, description FROM settings WHERE key = ANY($1) ORDER BY key',
      [ALLOWED_SETTINGS_KEYS]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/settings/:key - Get a specific setting (ADMIN ONLY)
app.get('/api/settings/:key', authenticateAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    
    // Validate key is in allowlist
    if (!ALLOWED_SETTINGS_KEYS.includes(key)) {
      return res.status(403).json({ 
        error: 'Access to this setting is not permitted' 
      });
    }
    
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/settings/:key - Update a setting (ADMIN ONLY)
app.put('/api/settings/:key', authenticateAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    
    // Validate key is in allowlist
    if (!ALLOWED_SETTINGS_KEYS.includes(key)) {
      return res.status(403).json({
        error: 'This setting cannot be modified via the API. Sensitive settings must be managed via environment variables.'
      });
    }

    const { value, description } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Setting value is required' });
    }

    const checkResult = await pool.query(
      'SELECT key, description FROM settings WHERE key = $1',
      [key]
    );

    // Determine whether to insert or update
    if (checkResult.rows.length === 0) {
      const descriptionToUse = description !== undefined && description !== null
        ? description
        : 'Created via admin interface';

      const insertResult = await pool.query(
        'INSERT INTO settings (key, value, description) VALUES ($1, $2, $3) RETURNING *',
        [key, value, descriptionToUse]
      );

      return res.status(201).json({
        success: true,
        setting: insertResult.rows[0],
        message: `Setting '${key}' created successfully`
      });
    }

    const currentDescription = checkResult.rows[0].description;
    const descriptionToUse = description !== undefined ? description : currentDescription;

    const result = await pool.query(
      'UPDATE settings SET value = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE key = $3 RETURNING *',
      [value, descriptionToUse, key]
    );

    // Log the action
    await logAuditEvent(
      'setting_updated',
      req.user.identifier,
      'setting',
      key,
      { old_value: checkResult.rows[0]?.value, new_value: value },
      req.userIp
    );
    
    res.json({
      success: true,
      setting: result.rows[0],
      message: `Setting '${key}' updated successfully`
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Configuration endpoint - returns read-only system settings
app.get('/api/config', async (req, res) => {
  try {
    // Get from email from Resend integration
    let emailFromAddress = 'Not configured';
    try {
      const { fromEmail } = resolveResendConfiguration();
      emailFromAddress = fromEmail;
    } catch (error) {
      console.error('Could not fetch from email:', error.message);
    }

    // Get settings from database (with env var fallbacks)
    const openRouterKeyInfo = await resolveOpenRouterApiKey();
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
      },
      openRouter: {
        configured: !!openRouterKeyInfo.value,
        source: openRouterKeyInfo.source
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

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// POST /api/jobs - Create a new async job
app.post('/api/jobs', async (req, res) => {
  try {
    const { job_type, input_data, email } = req.body;
    
    // Input validation
    if (!job_type || !input_data || !email) {
      return res.status(400).json({ 
        error: 'Missing required fields: job_type, input_data, email' 
      });
    }
    
    // Validate job type
    if (!['prompt1', 'prompt2', 'report_template'].includes(job_type)) {
      return res.status(400).json({ 
        error: 'Invalid job_type. Must be: prompt1, prompt2, or report_template' 
      });
    }
    
    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({ 
        error: 'Invalid email address format' 
      });
    }
    
    // Validate input_data structure
    if (typeof input_data !== 'object' || !input_data.messages) {
      return res.status(400).json({ 
        error: 'Invalid input_data structure. Must include messages array' 
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
    
    res.json({
      success: true,
      job_id: job.id,
      status: job.status,
      created_at: job.created_at
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/jobs/:id - Get job status and results
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.query;
    
    // Require email parameter for ownership verification
    if (!email) {
      return res.status(400).json({ 
        error: 'Email parameter required for job access' 
      });
    }
    
    const result = await pool.query(
      `SELECT id, job_type, status, result_data, error, created_at, completed_at, email
       FROM jobs WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const job = result.rows[0];
    
    // Verify ownership: only the user who created the job can access it
    if (job.email !== email) {
      return res.status(403).json({ 
        error: 'Access denied: you can only access your own jobs' 
      });
    }
    
    // Remove email from response for privacy
    const { email: _, ...jobResponse } = job;
    
    res.json({
      id: jobResponse.id,
      job_type: jobResponse.job_type,
      status: jobResponse.status,
      result: jobResponse.result_data,
      error: jobResponse.error,
      created_at: jobResponse.created_at,
      completed_at: jobResponse.completed_at
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Convert markdown to formatted HTML using the unified generator
async function convertMarkdownToHtml(markdown, programName, organizationName) {
  // Use the unified HTML generation function
  return generateFullHtmlDocument(markdown, {
    programName,
    organizationName,
    includePrintButton: true  // Include print button for email attachments
  });
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
      const { value: apiKey } = await resolveOpenRouterApiKey();
      
      if (!apiKey) {
        throw new Error('OpenRouter API key not configured. Please set it via your environment secrets (OPENROUTER_API_KEY).');
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
              timeZoneName: 'short',
              timeZone: 'America/Toronto'
            });
            
            // Replace template variables
            const emailBodyMarkdown = templateContent
              .replace(/\{\{programName\}\}/g, programName)
              .replace(/\{\{organizationName\}\}/g, organizationName)
              .replace(/\{\{currentDateTime\}\}/g, currentDateTime);
            
            // Convert markdown to HTML for proper email formatting
            emailBody = await convertMarkdownToEmailHtml(emailBodyMarkdown);
          }
          
          // Create clean filename from metadata
          const orgNameClean = (organizationName || 'Organization').replace(/[^a-zA-Z0-9]/g, '_');
          const progNameClean = (programName || 'Program').replace(/[^a-zA-Z0-9]/g, '_');
          const filename = `${orgNameClean}_${progNameClean}_Evaluation_Plan.html`;
          
          // Convert markdown to formatted HTML with CSS
          const formattedHtml = await convertMarkdownToHtml(result, programName, organizationName);
          
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

async function startServer(options = {}) {
  const startHttp = options.startHttp ?? (process.env.WORKER_ONLY !== 'true');
  const enableJobProcessor = options.enableJobProcessor ?? (process.env.ENABLE_JOB_PROCESSOR !== 'false');
  const enableSessionCleanup = options.enableSessionCleanup ?? enableJobProcessor;
  const port = options.port ?? PORT;

  console.log('=== Backend Startup ===');
  console.log(`Mode: ${startHttp ? 'API server' : 'Worker only'}`);
  console.log(`Job processor: ${enableJobProcessor ? 'enabled' : 'disabled'}`);
  console.log('Environment checks:');
  console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? '✓ Set' : '✗ Missing'}`);
  console.log(`- RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '✓ Set' : '✗ Missing'}`);
  console.log(`- RESEND_FROM_EMAIL: ${process.env.RESEND_FROM_EMAIL ? '✓ Set' : '✗ Missing'}`);
  console.log(`- ADMIN_PASSWORD: ${process.env.ADMIN_PASSWORD ? '✓ Set' : '✗ Missing'}`);
  console.log(`- OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? '✓ Set' : '✗ Missing'}`);

  try {
    console.log('\nTesting database connection...');
    await pool.query('SELECT NOW()');
    console.log('✓ Database connection successful');

    console.log('\nValidating Resend configuration...');
    try {
      const { fromEmail } = resolveResendConfiguration();
      console.log('✓ Resend configuration detected');
      console.log(`  Emails will be sent from: ${fromEmail}`);
    } catch (error) {
      console.error('✗ Resend configuration missing:', error.message);
      console.error('  Emails will fail to send until configuration is provided.');
    }

    console.log('\nChecking prompts table...');
    const promptsCheck = await pool.query('SELECT COUNT(*) FROM prompts');
    console.log(`✓ Prompts table accessible (${promptsCheck.rows[0].count} prompts found)`);

    if (enableSessionCleanup) {
      console.log('\nCleaning up expired sessions...');
      await cleanupExpiredSessions();
    }

    let jobProcessingInterval = null;
    let jobCleanupInterval = null;
    let sessionCleanupInterval = null;

    const stopBackgroundJobs = () => {
      if (jobProcessingInterval) {
        clearInterval(jobProcessingInterval);
        jobProcessingInterval = null;
      }
      if (jobCleanupInterval) {
        clearInterval(jobCleanupInterval);
        jobCleanupInterval = null;
      }
      if (sessionCleanupInterval) {
        clearInterval(sessionCleanupInterval);
        sessionCleanupInterval = null;
      }
    };

    const startBackgroundJobs = () => {
      if (enableJobProcessor && !jobProcessingInterval) {
        console.log('\nStarting background job processor...');
        processNextJob().catch(err => console.error('Initial job processor error:', err));
        jobProcessingInterval = setInterval(() => {
          processNextJob().catch(err => console.error('Job processor error:', err));
        }, 5000);
        console.log('✓ Background job processor started (runs every 5 seconds)');
      } else if (!enableJobProcessor) {
        console.log('\nBackground job processor disabled via configuration.');
      }

      if (enableJobProcessor && !jobCleanupInterval) {
        jobCleanupInterval = setInterval(cleanupOldJobs, 60 * 60 * 1000);
        console.log('✓ Job cleanup scheduled (runs hourly)');
      }

      if (enableSessionCleanup && !sessionCleanupInterval) {
        sessionCleanupInterval = setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
        console.log('✓ Session cleanup scheduled (runs hourly)');
      }
    };

    startBackgroundJobs();

    let httpServer = null;

    if (startHttp) {
      await new Promise((resolve, reject) => {
        httpServer = app.listen(port, '0.0.0.0', (error) => {
          if (error) {
            return reject(error);
          }

          console.log(`\n✓ API server running on port ${port}`);
          console.log('=========================\n');
          resolve();
        });
      });
    } else {
      console.log('\nHTTP server disabled; running in worker-only mode.');
    }

    const shutdown = async () => {
      stopBackgroundJobs();

      if (httpServer) {
        await new Promise((resolve, reject) => {
          httpServer.close((error) => {
            if (error) {
              return reject(error);
            }
            resolve();
          });
        });
      }
    };

    return {
      app,
      pool,
      httpServer,
      startBackgroundJobs,
      stopBackgroundJobs,
      shutdown
    };
  } catch (error) {
    console.error('\n✗ FATAL ERROR during server startup:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('\nServer cannot start. Please check the errors above.');

    const aggregateErrors = Array.isArray(error.errors) ? error.errors : [];
    const primaryError = aggregateErrors[0] || error;
    const errorCode = primaryError && primaryError.code ? primaryError.code : error.code;

    if (errorCode === 'ECONNREFUSED') {
      if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('.railway.internal')) {
        console.error('\nHint: The DATABASE_URL points to the internal Railway host (postgres.railway.internal).');
        console.error('      That hostname is only reachable from within Railway.');
        console.error('      For local development, use `railway connect`/`railway shell` to proxy the database');
        console.error('      or replace DATABASE_URL with the public connection string from the Railway dashboard.');
      } else {
        console.error('\nHint: The application could not reach the Postgres instance.');
        console.error('      Double-check the database credentials, host, network access, and that the service is running.');
      }
    }

    throw error;
  }
}

if (require.main === module) {
  startServer().catch(() => {
    process.exit(1);
  });
}

module.exports = { startServer };
