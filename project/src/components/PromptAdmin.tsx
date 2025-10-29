import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, History, RotateCcw, Check, LogOut } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import styles from './PromptAdmin.module.css';

interface Prompt {
  id: number;
  step_name: string;
  display_name: string;
  content: string;
  current_version: number;
  is_active: boolean;
  updated_at: string;
}

interface PromptVersion {
  id: number;
  prompt_id: number;
  version_number: number;
  content: string;
  created_at: string;
  created_by: string;
  change_notes: string;
}

interface Config {
  emailFromAddress: string;
  prompt1: {
    model: string;
    temperature: number | null;
    webSearch: boolean;
  };
  prompt2: {
    model: string;
    temperature: number | null;
    webSearch: boolean;
  };
  reportTemplate: {
    model: string;
    temperature: number | null;
    webSearch: boolean;
  };
  openRouter: {
    configured: boolean;
    source: 'environment' | 'database' | 'none' | 'error' | 'unknown';
  };
}

interface PromptAdminProps {
  onBack: () => void;
}

const PromptAdmin: React.FC<PromptAdminProps> = ({ onBack }) => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [editedContent, setEditedContent] = useState<string | undefined>('');
  const [editedDisplayName, setEditedDisplayName] = useState<string>('');
  const [changeNotes, setChangeNotes] = useState<string>('');
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [config, setConfig] = useState<Config | null>(null);
  const [sessionToken, setSessionToken] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(false);
  const API_URL = '/api';

  const openRouterStatus = config?.openRouter;
  const openRouterConfigured = openRouterStatus?.configured ?? false;

  const openRouterStatusTitle = (() => {
    if (!openRouterStatus) {
      return 'Status unavailable';
    }
    if (!openRouterStatus.configured) {
      return 'Not configured';
    }
    switch (openRouterStatus.source) {
      case 'environment':
        return 'Configured via environment secret';
      case 'database':
        return 'Configured via database (legacy)';
      default:
        return 'Configured';
    }
  })();

  const openRouterStatusDescription = (() => {
    if (!openRouterStatus) {
      return 'We could not determine the OpenRouter configuration. Check your deployment secrets.';
    }
    if (!openRouterStatus.configured) {
      return 'Add your OpenRouter API key to the OPENROUTER_API_KEY environment secret in your hosting platform (e.g., Railway, Vercel, or Docker Compose). The admin UI no longer stores API keys.';
    }
    if (openRouterStatus.source === 'environment') {
      return 'The application is reading the OpenRouter API key from the OPENROUTER_API_KEY environment secret.';
    }
    if (openRouterStatus.source === 'database') {
      return 'The key is being read from the database. Move it into the OPENROUTER_API_KEY environment secret and remove the database entry to complete the migration.';
    }
    if (openRouterStatus.source === 'error') {
      return 'An error occurred while checking the OpenRouter API key. Verify your database connectivity.';
    }
    return 'The OpenRouter API key is available for use.';
  })();

  const openRouterStatusSummary = (() => {
    if (!openRouterStatus) {
      return 'Unable to determine current status.';
    }
    if (!openRouterStatus.configured) {
      return 'Set the OPENROUTER_API_KEY environment secret to enable OpenRouter requests.';
    }
    if (openRouterStatus.source === 'environment') {
      return 'Using the OPENROUTER_API_KEY environment secret.';
    }
    if (openRouterStatus.source === 'database') {
      return 'Using a legacy database value — move this into the OPENROUTER_API_KEY secret.';
    }
    if (openRouterStatus.source === 'error') {
      return 'Error resolving the API key — check server logs.';
    }
    return 'OpenRouter API key is available.';
  })();

  const openRouterStatusHint = (() => {
    if (!openRouterStatus) {
      return null;
    }
    if (!openRouterStatus.configured) {
      return 'Requests to OpenRouter will fail until the API key is configured.';
    }
    if (openRouterStatus.source === 'database') {
      return 'For security, rotate and store this key in the OPENROUTER_API_KEY environment secret.';
    }
    return null;
  })();

  useEffect(() => {
    sessionStorage.removeItem('adminAuthenticated');
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPrompts();
      fetchConfig();
      fetchSettings();
    }
  }, [isAuthenticated]);

  const fetchPrompts = async () => {
    try {
      const response = await fetch(`${API_URL}/prompts`);
      const data = await response.json();
      setPrompts(data);
    } catch (error) {
      console.error('Error fetching prompts:', error);
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/config`);
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/settings`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      const data = await response.json();
      const settingsObj = data.reduce((acc: any, setting: any) => {
        acc[setting.key] = setting.value || '';
        return acc;
      }, {});
      setSettings(settingsObj);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const updateSetting = async (key: string, value: string) => {
    try {
      const response = await fetch(`${API_URL}/settings/${key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ value })
      });
      
      if (response.ok) {
        setSettingsSaveSuccess(true);
        fetchSettings();
        fetchConfig();
        setTimeout(() => setSettingsSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error updating setting:', error);
    }
  };

  const selectPrompt = async (prompt: Prompt) => {
    setChangeNotes('');
    setSaveSuccess(false);
    setShowVersions(false);
    
    // Fetch full prompt details including content
    try {
      const response = await fetch(`${API_URL}/prompts/${prompt.step_name}`);
      const fullPromptData = await response.json();
      setSelectedPrompt(fullPromptData);
      setEditedContent(fullPromptData.content);
      setEditedDisplayName(fullPromptData.display_name);
      
      // Fetch versions for this prompt
      const versionsResponse = await fetch(`${API_URL}/prompts/${prompt.step_name}/versions`);
      const versionsData = await versionsResponse.json();
      setVersions(versionsData);
    } catch (error) {
      console.error('Error fetching prompt details:', error);
    }
  };

  const savePrompt = async () => {
    if (!selectedPrompt) return;
    
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/prompts/${selectedPrompt.step_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          content: editedContent,
          display_name: editedDisplayName,
          change_notes: changeNotes || 'Updated via admin interface'
        })
      });
      
      if (response.ok) {
        setSaveSuccess(true);
        fetchPrompts();
        
        // Refresh the selected prompt
        const updatedPrompt = await fetch(`${API_URL}/prompts/${selectedPrompt.step_name}`);
        const updatedData = await updatedPrompt.json();
        setSelectedPrompt(updatedData);
        setEditedDisplayName(updatedData.display_name);
        
        // Refresh versions
        const versionsResponse = await fetch(`${API_URL}/prompts/${selectedPrompt.step_name}/versions`);
        const versionsData = await versionsResponse.json();
        setVersions(versionsData);
        
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error saving prompt:', error);
    } finally {
      setSaving(false);
    }
  };

  const rollbackToVersion = async (version: number) => {
    if (!selectedPrompt) return;
    
    if (!confirm(`Are you sure you want to rollback to version ${version}?`)) {
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/prompts/${selectedPrompt.step_name}/rollback/${version}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      if (response.ok) {
        // Refresh the selected prompt
        const updatedPrompt = await fetch(`${API_URL}/prompts/${selectedPrompt.step_name}`);
        const updatedData = await updatedPrompt.json();
        setSelectedPrompt(updatedData);
        setEditedContent(updatedData.content);
        setEditedDisplayName(updatedData.display_name);
        
        // Refresh versions
        const versionsResponse = await fetch(`${API_URL}/prompts/${selectedPrompt.step_name}/versions`);
        const versionsData = await versionsResponse.json();
        setVersions(versionsData);
        
        fetchPrompts();
      }
    } catch (error) {
      console.error('Error rolling back:', error);
    }
  };

  const verifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    
    try {
      const response = await fetch(`${API_URL}/verify-admin-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSessionToken(data.sessionToken);
        setIsAuthenticated(true);
        setPassword('');
      } else {
        setPasswordError('Incorrect password. Please try again.');
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      setPasswordError('An error occurred. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      if (sessionToken) {
        await fetch(`${API_URL}/admin-logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setIsAuthenticated(false);
      setSessionToken('');
      setPassword('');
      setPasswordError('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={styles.authContainer}>
        <div className={styles.authCard}>
          <h2 className={styles.authTitle}>
            Admin Authentication Required
          </h2>
          <form onSubmit={verifyPassword} className={styles.authForm}>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value="admin"
              readOnly
              style={{ display: 'none' }}
              aria-hidden="true"
              tabIndex={-1}
            />
            <div>
              <label className={styles.authLabel}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className={styles.authInput}
                autoComplete="current-password"
                name="admin-password"
                autoFocus
              />
            </div>
            {passwordError && (
              <div className={styles.authError}>
                {passwordError}
              </div>
            )}
            <button
              type="submit"
              className={styles.authButton}
            >
              Access Admin Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.adminContainer}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerTop}>
            <div className={styles.headerLeft}>
              <button
                onClick={onBack}
                className={styles.backButton}
              >
                <ArrowLeft className={styles.iconMd} />
              </button>
              <h1 className={styles.title}>
                Administration
              </h1>
            </div>
            <div className={styles.headerRight}>
              {selectedPrompt && (
                <>
                  {saveSuccess && (
                    <div className={styles.saveSuccess}>
                      <Check className={styles.iconMd} />
                      <span className={styles.buttonText}>Saved successfully!</span>
                    </div>
                  )}
                  <button
                    onClick={() => setShowVersions(!showVersions)}
                    className={styles.headerButton}
                  >
                    <History className={styles.icon} />
                    <span className={styles.buttonText}>Version History</span>
                  </button>
                  <button
                    onClick={savePrompt}
                    disabled={saving || (editedContent === selectedPrompt.content && editedDisplayName === selectedPrompt.display_name)}
                    className={`${styles.headerButton} ${styles.saveButton}`}
                  >
                    <Save className={styles.icon} />
                    <span className={styles.buttonText}>{saving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </>
              )}
              <button
                onClick={handleLogout}
                className={styles.headerButton}
                title="Logout"
              >
                <LogOut className={styles.icon} />
                <span className={styles.buttonText}>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.contentGrid}>
          <div className={styles.sidebar}>
            <div className={styles.sidebarCard}>
              <h2 className={styles.sidebarTitle}>
                Admin Options
              </h2>
              <div className={styles.optionsList}>
                <button
                  onClick={() => { setSelectedPrompt(null); setShowSettings(false); }}
                  className={`${styles.optionButton} ${!selectedPrompt && !showSettings ? styles.optionButtonActive : ''}`}
                >
                  <div className={styles.optionTitle}>📖 Instructions</div>
                  <div className={styles.optionSubtitle}>
                    View help and guides
                  </div>
                </button>

                <button
                  onClick={() => { setSelectedPrompt(null); setShowSettings(true); }}
                  className={`${styles.optionButton} ${showSettings ? styles.optionButtonActive : ''}`}
                >
                  <div className={styles.optionTitle}>⚙️ Settings</div>
                  <div className={styles.optionSubtitle}>
                    Configure AI models & system settings
                  </div>
                </button>
                
                {prompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    onClick={() => { selectPrompt(prompt); setShowSettings(false); }}
                    className={`${styles.optionButton} ${selectedPrompt?.id === prompt.id ? styles.optionButtonActive : ''}`}
                  >
                    <div className={styles.optionTitle}>{prompt.display_name}</div>
                    <div className={styles.optionSubtitle}>
                      Version {prompt.current_version}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.sidebarCard}>
              <h2 className={styles.sidebarTitle}>
                Configuration
              </h2>
              {config ? (
                <div className={styles.configList}>
                  <div className={styles.configItem}>
                    <div className={styles.configLabel}>OpenRouter status:</div>
                    <div className={styles.configValue}>
                      {openRouterStatusTitle}
                    </div>
                    <div className={`${styles.configValue} ${styles.textSm}`}>
                      {openRouterStatusSummary}
                    </div>
                    {openRouterStatusHint && (
                      <div className={`${styles.configValue} ${styles.textSm}`}>
                        {openRouterStatusHint}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className={styles.configLabel}>Sent-from email address:</div>
                    <div className={styles.configValue}>{config.emailFromAddress}</div>
                  </div>
                  <div className={styles.configItem}>
                    <div className={styles.configLabel}>{prompts.find(p => p.step_name === 'prompt1')?.display_name} LLM:</div>
                    <div className={styles.configValue}>
                      {config.prompt1.model}
                      {config.prompt1.temperature !== null && ` (temp: ${config.prompt1.temperature})`}
                    </div>
                    <div className={styles.configValue}>
                      🌐 Web search: {config.prompt1.webSearch ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
                  <div className={styles.configItem}>
                    <div className={styles.configLabel}>{prompts.find(p => p.step_name === 'prompt2')?.display_name} LLM:</div>
                    <div className={styles.configValue}>
                      {config.prompt2.model}
                      {config.prompt2.temperature !== null && ` (temp: ${config.prompt2.temperature})`}
                    </div>
                    <div className={styles.configValue}>
                      🌐 Web search: {config.prompt2.webSearch ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
                  <div className={styles.configItem}>
                    <div className={styles.configLabel}>{prompts.find(p => p.step_name === 'report_template')?.display_name} LLM:</div>
                    <div className={styles.configValue}>
                      {config.reportTemplate.model}
                      {config.reportTemplate.temperature !== null && ` (temp: ${config.reportTemplate.temperature})`}
                    </div>
                    <div className={styles.configValue}>
                      🌐 Web search: {config.reportTemplate.webSearch ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.configValue}>Loading configuration...</div>
              )}
            </div>
          </div>

          <div className={styles.editorArea}>
            {showSettings ? (
              <div className={styles.editorCard}>
                <h2 className={styles.sectionTitle} style={{ marginBottom: '1.5rem' }}>
                  ⚙️ System Settings
                </h2>
                
                {settingsSaveSuccess && (
                  <div className={styles.saveSuccess} style={{ marginBottom: '1rem' }}>
                    <Check className={styles.iconMd} />
                    <span className={styles.buttonText}>Settings saved successfully!</span>
                  </div>
                )}

                {settings && (
                  <div style={{ maxWidth: '600px' }}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>OpenRouter Connection</label>
                      <div className={`${styles.statusBox} ${openRouterConfigured ? styles.statusConfigured : styles.statusUnconfigured}`}>
                        <div className={styles.statusTitle}>{openRouterStatusTitle}</div>
                        <p className={styles.statusDescription}>{openRouterStatusDescription}</p>
                        {openRouterStatusHint && (
                          <p className={styles.statusHint}>{openRouterStatusHint}</p>
                        )}
                        <p className={styles.statusDescription}>
                          Manage this key via the <code className={styles.code}>OPENROUTER_API_KEY</code> environment secret in your deployment platform.
                        </p>
                      </div>
                    </div>

                    <h3 className={styles.subsectionTitle} style={{ marginTop: '2rem', marginBottom: '1rem' }}>
                      Model Configuration
                    </h3>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Prompt 1 Model</label>
                      <input
                        type="text"
                        value={settings.prompt1_model || ''}
                        onChange={(e) => setSettings({ ...settings, prompt1_model: e.target.value })}
                        placeholder="e.g., openai/gpt-4o"
                        className={styles.formInput}
                      />
                      <button
                        onClick={() => updateSetting('prompt1_model', settings.prompt1_model)}
                        className={styles.headerButton}
                        style={{ marginTop: '0.5rem' }}
                      >
                        Save
                      </button>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Prompt 2 Model</label>
                      <input
                        type="text"
                        value={settings.prompt2_model || ''}
                        onChange={(e) => setSettings({ ...settings, prompt2_model: e.target.value })}
                        placeholder="e.g., openai/gpt-4o"
                        className={styles.formInput}
                      />
                      <button
                        onClick={() => updateSetting('prompt2_model', settings.prompt2_model)}
                        className={styles.headerButton}
                        style={{ marginTop: '0.5rem' }}
                      >
                        Save
                      </button>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Report Template Model</label>
                      <input
                        type="text"
                        value={settings.report_template_model || ''}
                        onChange={(e) => setSettings({ ...settings, report_template_model: e.target.value })}
                        placeholder="e.g., openai/gpt-4o"
                        className={styles.formInput}
                      />
                      <button
                        onClick={() => updateSetting('report_template_model', settings.report_template_model)}
                        className={styles.headerButton}
                        style={{ marginTop: '0.5rem' }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : selectedPrompt ? (
              <div className={styles.editorCard}>
                <div className={styles.versionInfo}>
                  <p className={styles.versionText}>
                    Current Version: {selectedPrompt.current_version}
                  </p>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Display Name</label>
                  <input
                    type="text"
                    value={editedDisplayName}
                    onChange={(e) => setEditedDisplayName(e.target.value)}
                    placeholder="Enter prompt display name..."
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Change Notes (Optional)</label>
                  <input
                    type="text"
                    value={changeNotes}
                    onChange={(e) => setChangeNotes(e.target.value)}
                    placeholder="Describe what you changed..."
                    className={styles.formInput}
                  />
                </div>

                <div>
                  <label className={styles.formLabel}>Prompt Content (Markdown)</label>
                  <div data-color-mode="light">
                    {/* @ts-ignore - MDEditor type incompatibility with React types */}
                    <MDEditor
                      value={editedContent}
                      onChange={(value) => setEditedContent(value || '')}
                      height={500}
                      preview="edit"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.instructionsCard}>
                <h1 className={styles.instructionsTitle}>
                  Instructions
                </h1>
                
                <div className={styles.instructionsContent}>
                  <div>
                    <h2 className={styles.sectionTitle}>
                      How to edit AI prompts
                    </h2>
                    <p className={styles.mb4}>
                      Prompts are the instructions that tell the AI what to do when analyzing programs. You can customize these instructions to match your organization's evaluation approach.
                    </p>
                    
                    <p className={`${styles.mb2} ${styles.fontMedium}`}>Step-by-step guide:</p>
                    <ol className={styles.instructionsList}>
                      <li>
                        <strong>Pick a prompt</strong> - Click on one from the left sidebar (they're named like "Analyze program model")
                      </li>
                      <li>
                        <strong>Edit the text</strong> - Write your instructions in everyday language. The AI will automatically get all the program details, so just tell it what analysis you want
                      </li>
                      <li>
                        <strong>Add a note</strong> - (Optional) Write a quick reminder about why you changed it
                      </li>
                      <li>
                        <strong>Save it</strong> - Click the "Save Changes" button at the top
                      </li>
                      <li>
                        <strong>See old versions</strong> - Click "Show Versions" to view or restore any previous version
                      </li>
                    </ol>
                    
                    <p className={styles.noteBox}>
                      ✅ <strong>Don't worry about breaking things:</strong> Every time you save, a complete backup is created automatically. You can always restore any previous version.
                    </p>
                  </div>

                  <div className={styles.instructionSection}>
                    <h2 className={styles.sectionTitle}>
                      How to change system settings
                    </h2>
                    
                    <div className={styles.spaceY6}>
                      <div>
                        <h3 className={styles.subsectionTitle}>
                          How to manage the OpenRouter API key
                        </h3>
                        <p className={styles.mb3}>
                          For security, the OpenRouter key lives in your hosting provider's secret manager, not in this dashboard.
                        </p>
                        <ol className={styles.instructionsList}>
                          <li>Open your deployment platform (Railway, Vercel, Docker, etc.) and locate the environment variables or secrets settings</li>
                          <li>Add or update a secret named <code className={styles.code}>OPENROUTER_API_KEY</code> with your current API key</li>
                          <li>Restart or redeploy the application so the new secret is loaded</li>
                        </ol>
                        <p className={`${styles.noteBox} ${styles.blueNoteBox}`}>
                          🔐 <strong>We never store API keys in the database.</strong> Use this page to confirm whether the secret is configured and which source is active.
                        </p>
                      </div>

                      <div className={`${styles.borderT} ${styles.pt6}`}>
                        <h3 className={styles.subsectionTitle}>
                          How to change the email sender address
                        </h3>
                        <p className={styles.mb3}>
                          This is the email address that appears in the "From" field when evaluation reports are emailed to users.
                        </p>
                        
                        <ol className={styles.instructionsList}>
                          <li>
                            <strong>Go to Replit Integrations</strong>
                            <p className={styles.mt1}>Find and click on the Resend integration in your Replit project</p>
                          </li>
                          <li>
                            <strong>Update the "From Email" field</strong>
                            <p className={styles.mt1}>Enter your desired email sender address</p>
                          </li>
                          <li>
                            <strong>Restart the email server</strong>
                            <p className={styles.mt1}>The changes will take effect after restarting</p>
                          </li>
                        </ol>
                        <p className={`${styles.mt3} ${styles.textSm} ${styles.textGray600}`}>
                          <strong>Note:</strong> If using a custom domain, make sure it's verified in your <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className={styles.link}>Resend account</a> first.
                        </p>
                      </div>

                      <div className={`${styles.borderT} ${styles.pt6}`}>
                        <h3 className={styles.subsectionTitle}>
                          How to change AI models
                        </h3>
                        <p className={styles.mb3}>
                          Each prompt uses an AI model (like GPT-5 or Gemini 2.5 Pro) to generate text. Different models have different strengths - some are better at analysis, others at creative writing. You might want to change models to improve quality or reduce costs.
                        </p>
                        
                        <p className={`${styles.mb2} ${styles.fontMedium}`}>How to choose a model:</p>
                        <ol className={styles.instructionsList}>
                          <li>Go to <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" className={styles.link}>OpenRouter Models</a> and browse available models</li>
                          <li>Click on a model card to see its details</li>
                          <li>Copy the <strong>exact model name</strong> from the model card (e.g., <code className={styles.code}>openai/gpt-5</code> or <code className={styles.code}>google/gemini-2.5-pro</code>)</li>
                          <li>Click the <strong>⚙️ System Settings</strong> button in the admin page sidebar</li>
                          <li>Paste the model name into the appropriate field (Prompt 1, Prompt 2, or Report Template)</li>
                          <li>Click <strong>Save</strong> for that model</li>
                        </ol>

                        <p className={`${styles.noteBox} ${styles.blueNoteBox}`}>
                          💡 <strong>Tip:</strong> Each model card on OpenRouter shows the model's cost, speed, and capabilities to help you choose the right one for your needs.
                        </p>
                      </div>

                      <div className={`${styles.borderT} ${styles.pt6}`}>
                        <h3 className={styles.subsectionTitle}>
                          How to adjust temperature settings
                        </h3>
                        <p className={styles.mb3}>
                          Temperature controls how creative vs. predictable the AI is:
                        </p>
                        <ul className={`${styles.listDisc} ${styles.ml5} ${styles.spaceY1} ${styles.mb3}`}>
                          <li><strong>Lower values (0.0-0.3):</strong> More focused, consistent, and deterministic</li>
                          <li><strong>Medium values (0.4-0.7):</strong> Balanced creativity and consistency</li>
                          <li><strong>Higher values (0.8-1.0):</strong> More creative, varied, and unpredictable</li>
                        </ul>

                        <p className={`${styles.mb2} ${styles.fontMedium}`}>To change temperature: Ask Replit Agent to help</p>
                        <div className={styles.codeBlock}>
                          <div>"Set Prompt 1 temperature to 0.3"</div>
                          <div>"Change temperature for all prompts to 0.5"</div>
                          <div>"Set Report Template temperature to 0.7"</div>
                        </div>
                      </div>

                      <div className={`${styles.borderT} ${styles.pt6}`}>
                        <h3 className={styles.subsectionTitle}>
                          How to turn web search on or off
                        </h3>
                        <p className={styles.mb3}>
                          Web search allows the AI to look up information about similar programs and best practices from across the internet. This can make evaluation plans more informed and comprehensive, but it also makes processing slower and slightly more expensive.
                        </p>

                        <p className={`${styles.mb2} ${styles.fontMedium}`}>To change web search settings: Ask Replit Agent to help</p>
                        <div className={styles.codeBlock}>
                          <div>"Turn off web search for Prompt 1"</div>
                          <div>"Enable web search for all prompts"</div>
                          <div>"Disable web search for the Report Template"</div>
                        </div>

                        <p className={`${styles.noteBox} ${styles.blueNoteBox}`}>
                          💡 <strong>Default settings:</strong> Web search is turned on for the first two prompts (to gather context) and off for the report template (which uses already-gathered information).
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={styles.instructionSection}>
                    <h2 className={styles.sectionTitle}>
                      How to change your admin password
                    </h2>
                    <p className={styles.mb3}>
                      To change the password for accessing this admin interface, give Replit Agent the following instructions:
                    </p>
                    <div className={styles.codeBlock}>
                      "Change the ADMIN_PASSWORD secret to [your new password] and restart the Email Server workflow"
                    </div>
                    <p className={`${styles.textSm} ${styles.textGray600} ${styles.mb3}`}>
                      Replace <code className={styles.code}>[your new password]</code> with your desired password. Replit Agent will update the secret and restart the server for you.
                    </p>
                    <p className={styles.noteBox}>
                      <strong>Security Note:</strong> Your admin session uses secure, time-limited tokens that expire after 24 hours. Each login generates a unique session token, and logging out immediately invalidates your session.
                    </p>
                  </div>

                  <div className={styles.instructionSection}>
                    <h2 className={styles.sectionTitle}>
                      How to apply your changes
                    </h2>
                    <div className={`${styles.spaceY3} ${styles.textSm} ${styles.textGray700}`}>
                      <div className={`${styles.p3} ${styles.bgYellow50} ${styles.borderL4} ${styles.borderYellow400} ${styles.rounded}`}>
                        <p><strong>⚠️ Restart required:</strong> After changing any settings, ask Replit Agent to restart the application. Your changes won't work until the restart is complete.</p>
                      </div>
                      <div className={`${styles.p3} ${styles.bgBlue50} ${styles.borderL4} ${styles.borderBlue400} ${styles.rounded}`}>
                        <p><strong>📊 Check current settings:</strong> The Configuration panel on the left shows what's currently active - AI models, web search status, and email settings.</p>
                      </div>
                      <div className={`${styles.p3} ${styles.bgGreen50} ${styles.borderL4} ${styles.borderGreen400} ${styles.rounded}`}>
                        <p><strong>✨ Easiest method:</strong> For any change in these instructions, just ask Replit Agent in plain English. Example: "Turn off web search" or "Switch to Claude for all prompts"</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {showVersions && selectedPrompt && (
            <div className={styles.versionHistory}>
              <div className={styles.versionHistoryCard}>
                <h3 className={styles.versionHistoryTitle}>Version History</h3>
                <div className={styles.versionList}>
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className={`${styles.versionItem} ${version.version_number === selectedPrompt.current_version ? styles.currentVersion : ''}`}
                    >
                      <div className={styles.versionHeader}>
                        <div>
                          <div className={styles.versionNumber}>
                            Version {version.version_number}
                          </div>
                          <div className={styles.versionMeta}>
                            {new Date(version.created_at).toLocaleDateString('en-US', { timeZone: 'America/Toronto' })}
                          </div>
                          {version.change_notes && (
                            <div className={styles.versionNotes}>
                              {version.change_notes}
                            </div>
                          )}
                        </div>
                        {version.version_number !== selectedPrompt.current_version && (
                          <button
                            onClick={() => rollbackToVersion(version.version_number)}
                            className={styles.rollbackButton}
                            title="Rollback to this version"
                          >
                            <RotateCcw className={styles.icon} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromptAdmin;
