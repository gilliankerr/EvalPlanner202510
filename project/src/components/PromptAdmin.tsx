import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, History, RotateCcw, Check, LogOut } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';

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
}

interface PromptAdminProps {
  onBack: () => void;
}

const PromptAdmin: React.FC<PromptAdminProps> = ({ onBack }) => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [editedContent, setEditedContent] = useState<string | undefined>('');
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
  const API_URL = '/api';

  useEffect(() => {
    sessionStorage.removeItem('adminAuthenticated');
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPrompts();
      fetchConfig();
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8fafc' }}>
        <div className="bg-white rounded-lg border p-8 w-full max-w-md">
          <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: '#30302f' }}>
            Admin Authentication Required
          </h2>
          <form onSubmit={verifyPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#30302f' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            {passwordError && (
              <div className="text-red-600 text-sm">
                {passwordError}
              </div>
            )}
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-lg text-white font-medium"
              style={{ backgroundColor: '#0085ca' }}
            >
              Access Admin Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <div className="border-b" style={{ backgroundColor: 'white' }}>
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold" style={{ color: '#30302f' }}>
                Administration
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              {selectedPrompt && (
                <>
                  {saveSuccess && (
                    <div className="flex items-center space-x-2 text-green-600">
                      <Check className="h-5 w-5" />
                      <span>Saved successfully!</span>
                    </div>
                  )}
                  <button
                    onClick={() => setShowVersions(!showVersions)}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg border hover:bg-gray-50"
                  >
                    <History className="h-4 w-4" />
                    <span>Version History</span>
                  </button>
                  <button
                    onClick={savePrompt}
                    disabled={saving || editedContent === selectedPrompt.content}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white disabled:opacity-50"
                    style={{ backgroundColor: '#0085ca' }}
                  >
                    <Save className="h-4 w-4" />
                    <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg border hover:bg-gray-50"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Prompt List */}
          <div className="col-span-3">
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold mb-4" style={{ color: '#30302f' }}>
                Admin Options
              </h2>
              <div className="space-y-2">
                {/* Instructions button */}
                <button
                  onClick={() => setSelectedPrompt(null)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    !selectedPrompt
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-sm">📖 Instructions</div>
                  <div className="text-xs text-gray-500 mt-1">
                    View help and guides
                  </div>
                </button>
                
                {/* Prompts list */}
                {prompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    onClick={() => selectPrompt(prompt)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedPrompt?.id === prompt.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-sm">{prompt.display_name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Version {prompt.current_version}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Configuration Section */}
            <div className="bg-white rounded-lg border p-4 mt-4">
              <h2 className="font-semibold mb-4" style={{ color: '#30302f' }}>
                Configuration
              </h2>
              {config ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="font-medium text-gray-700">Sent-from email address:</div>
                    <div className="text-gray-600 mt-1">{config.emailFromAddress}</div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="font-medium text-gray-700">Prompt 1 LLM:</div>
                    <div className="text-gray-600 mt-1">
                      {config.prompt1.model}
                      {config.prompt1.temperature !== null && ` (temp: ${config.prompt1.temperature})`}
                    </div>
                    <div className="text-gray-600 text-sm mt-1">
                      🌐 Web search: {config.prompt1.webSearch ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="font-medium text-gray-700">Prompt 2 LLM:</div>
                    <div className="text-gray-600 mt-1">
                      {config.prompt2.model}
                      {config.prompt2.temperature !== null && ` (temp: ${config.prompt2.temperature})`}
                    </div>
                    <div className="text-gray-600 text-sm mt-1">
                      🌐 Web search: {config.prompt2.webSearch ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="font-medium text-gray-700">Report Template LLM:</div>
                    <div className="text-gray-600 mt-1">
                      {config.reportTemplate.model}
                      {config.reportTemplate.temperature !== null && ` (temp: ${config.reportTemplate.temperature})`}
                    </div>
                    <div className="text-gray-600 text-sm mt-1">
                      🌐 Web search: {config.reportTemplate.webSearch ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Loading configuration...</div>
              )}
            </div>
          </div>

          {/* Editor */}
          <div className={showVersions ? 'col-span-6' : 'col-span-9'}>
            {selectedPrompt ? (
              <div className="bg-white rounded-lg border p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold" style={{ color: '#30302f' }}>
                    {selectedPrompt.display_name}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Current Version: {selectedPrompt.current_version}
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Change Notes (Optional)</label>
                  <input
                    type="text"
                    value={changeNotes}
                    onChange={(e) => setChangeNotes(e.target.value)}
                    placeholder="Describe what you changed..."
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Prompt Content (Markdown)</label>
                  <div data-color-mode="light">
                    {/* @ts-ignore - MDEditor type incompatibility with React types */}
                    <MDEditor
                      value={editedContent}
                      onChange={setEditedContent}
                      height={500}
                      preview="edit"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border p-6">
                <h1 className="text-2xl font-bold mb-6" style={{ color: '#30302f' }}>
                  Instructions
                </h1>
                
                <div className="space-y-8 text-sm text-gray-700">
                  {/* How to change prompts section */}
                  <div>
                    <h2 className="text-lg font-semibold mb-3" style={{ color: '#30302f' }}>
                      How to change prompts
                    </h2>
                    <p className="mb-3">
                      To edit the AI prompts used in the evaluation planning process:
                    </p>
                    <ol className="list-decimal ml-5 space-y-2">
                      <li>
                        <strong>Select a prompt:</strong> Click on any prompt from the list on the left sidebar (Prompt 1, Prompt 2, Report Template, or Email Delivery Template).
                      </li>
                      <li>
                        <strong>Edit the content:</strong> Use the markdown editor to modify the prompt text. You can use template variables like <code className="bg-gray-100 px-1 rounded">{'{{programName}}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{{organizationName}}'}</code>, etc.
                      </li>
                      <li>
                        <strong>Add change notes (optional):</strong> Enter a brief description of your changes in the "Change Notes" field to track modifications.
                      </li>
                      <li>
                        <strong>Save your changes:</strong> Click the "Save Changes" button at the top of the editor.
                      </li>
                      <li>
                        <strong>Version history:</strong> Click "Show Versions" to view previous versions of the prompt. You can rollback to any previous version by clicking the rollback icon next to that version.
                      </li>
                    </ol>
                    <p className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                      <strong>Note:</strong> All changes are automatically versioned. Each save creates a new version that can be restored later if needed.
                    </p>
                  </div>

                  {/* How to change configuration section */}
                  <div className="border-t pt-6">
                    <h2 className="text-lg font-semibold mb-3" style={{ color: '#30302f' }}>
                      How to change configuration
                    </h2>
                    
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-semibold text-base mb-2" style={{ color: '#30302f' }}>
                          Changing the sent-from email address
                        </h3>
                        <p className="mb-2">
                          To change the email address used for sending evaluation reports:
                        </p>
                        <ol className="list-decimal ml-5 space-y-2">
                          <li>
                            <strong>Using the default domain ({config ? config.emailFromAddress.split('@')[1] : 'current domain'}):</strong> Set the <code className="bg-gray-100 px-1 rounded">RESEND_FROM_EMAIL</code> environment variable to your desired address (e.g., <code className="bg-gray-100 px-1 rounded">reports@{config ? config.emailFromAddress.split('@')[1] : 'yourdomain.com'}</code>).
                          </li>
                          <li>
                            <strong>Using a custom domain:</strong>
                            <ul className="list-disc ml-5 mt-2 space-y-1">
                              <li>Add and verify your domain in your <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Resend dashboard</a></li>
                              <li>Add the required DNS records (MX, TXT, CNAME) to your domain's DNS settings</li>
                              <li>Wait for DNS propagation (typically 15-60 minutes)</li>
                              <li>Set <code className="bg-gray-100 px-1 rounded">RESEND_FROM_EMAIL</code> to your verified domain address</li>
                            </ul>
                          </li>
                        </ol>
                        <p className="mt-2 text-gray-600 italic">
                          Note: The Resend connector in this project automatically manages API keys and handles rotation.
                        </p>
                      </div>

                      <div className="border-t pt-6">
                        <h3 className="font-semibold text-base mb-2" style={{ color: '#30302f' }}>
                          Changing LLM models and settings
                        </h3>
                        <p className="mb-3">
                          Configure AI models for each prompt using environment variables. All models use OpenRouter for routing to different providers.
                        </p>
                        
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-1">Prompt 1 - Program Model Analysis</h4>
                            <p className="text-sm text-gray-600 mb-2">Controls the LLM used for analyzing program models and identifying key terms, goals, and target populations.</p>
                            <ul className="list-disc ml-5 space-y-1 text-sm">
                              <li><code className="bg-gray-100 px-1 rounded">VITE_STEP3_MODEL</code> - Model identifier (e.g., <code className="bg-gray-100 px-1 rounded">openai/gpt-5</code>, <code className="bg-gray-100 px-1 rounded">anthropic/claude-3.5-sonnet</code>)</li>
                              <li><code className="bg-gray-100 px-1 rounded">VITE_STEP3_TEMPERATURE</code> - Temperature value (0.0 to 2.0, optional)</li>
                            </ul>
                          </div>

                          <div>
                            <h4 className="font-medium mb-1">Prompt 2 - Evaluation Framework</h4>
                            <p className="text-sm text-gray-600 mb-2">Controls the LLM used for generating the evaluation framework and methodology.</p>
                            <ul className="list-disc ml-5 space-y-1 text-sm">
                              <li><code className="bg-gray-100 px-1 rounded">VITE_STEP4_MODEL</code> - Model identifier</li>
                              <li><code className="bg-gray-100 px-1 rounded">VITE_STEP4_TEMPERATURE</code> - Temperature value (optional)</li>
                            </ul>
                          </div>

                          <div>
                            <h4 className="font-medium mb-1">Report Template - Evaluation Plan Generation</h4>
                            <p className="text-sm text-gray-600 mb-2">Controls the LLM used for creating the comprehensive evaluation plan document.</p>
                            <ul className="list-disc ml-5 space-y-1 text-sm">
                              <li><code className="bg-gray-100 px-1 rounded">VITE_STEP5_MODEL</code> - Model identifier</li>
                              <li><code className="bg-gray-100 px-1 rounded">VITE_STEP5_TEMPERATURE</code> - Temperature value (optional)</li>
                            </ul>
                          </div>
                        </div>

                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                          <p className="text-blue-900">
                            <strong>Note:</strong> Environment variable names use legacy "STEP3/4/5" identifiers for backward compatibility. They correspond to "Prompt 1", "Prompt 2", and "Report Template" respectively in the current UI.
                          </p>
                        </div>

                        <p className="mt-4 text-gray-600 italic text-sm">
                          <strong>API Key:</strong> The OpenRouter API key is managed via <code className="bg-gray-100 px-1 rounded">VITE_OPENROUTER_API_KEY</code> environment variable. All models route through OpenRouter, so only this single API key is needed. See <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">openrouter.ai/models</a> for complete list of available LLMs.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* How to change your admin password section */}
                  <div className="border-t pt-6">
                    <h2 className="text-lg font-semibold mb-3" style={{ color: '#30302f' }}>
                      How to change your admin password
                    </h2>
                    <p className="mb-3">
                      To change the password for accessing this admin interface, give Replit Agent the following instructions:
                    </p>
                    <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg mb-3 font-mono text-sm">
                      "Change the ADMIN_PASSWORD secret to [your new password] and restart the Email Server workflow"
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Replace <code className="bg-gray-100 px-1 rounded">[your new password]</code> with your desired password. Replit Agent will update the secret and restart the server for you.
                    </p>
                    <p className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-900">
                      <strong>Security Note:</strong> Your admin session uses secure, time-limited tokens that expire after 24 hours. Each login generates a unique session token, and logging out immediately invalidates your session.
                    </p>
                  </div>

                  <div className="border-t pt-4 text-xs text-gray-500">
                    <p>💡 <strong>Tip:</strong> After changing environment variables, restart the application for changes to take effect. The current configuration values are displayed in the Configuration box on the left.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Version History */}
          {showVersions && selectedPrompt && (
            <div className="col-span-3">
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold mb-4">Version History</h3>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="p-3 border rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            Version {version.version_number}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(version.created_at).toLocaleDateString()}
                          </div>
                          {version.change_notes && (
                            <div className="text-xs text-gray-600 mt-2">
                              {version.change_notes}
                            </div>
                          )}
                        </div>
                        {version.version_number !== selectedPrompt.current_version && (
                          <button
                            onClick={() => rollbackToVersion(version.version_number)}
                            className="ml-2 p-1 rounded hover:bg-gray-100"
                            title="Rollback to this version"
                          >
                            <RotateCcw className="h-4 w-4 text-gray-600" />
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
