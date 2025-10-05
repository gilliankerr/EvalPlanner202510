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
                    disabled={saving || (editedContent === selectedPrompt.content && editedDisplayName === selectedPrompt.display_name)}
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
                    <div className="font-medium text-gray-700">{prompts.find(p => p.step_name === 'prompt1')?.display_name} LLM:</div>
                    <div className="text-gray-600 mt-1">
                      {config.prompt1.model}
                      {config.prompt1.temperature !== null && ` (temp: ${config.prompt1.temperature})`}
                    </div>
                    <div className="text-gray-600 text-sm mt-1">
                      🌐 Web search: {config.prompt1.webSearch ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="font-medium text-gray-700">{prompts.find(p => p.step_name === 'prompt2')?.display_name} LLM:</div>
                    <div className="text-gray-600 mt-1">
                      {config.prompt2.model}
                      {config.prompt2.temperature !== null && ` (temp: ${config.prompt2.temperature})`}
                    </div>
                    <div className="text-gray-600 text-sm mt-1">
                      🌐 Web search: {config.prompt2.webSearch ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="font-medium text-gray-700">{prompts.find(p => p.step_name === 'report_template')?.display_name} LLM:</div>
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
                  <p className="text-sm text-gray-500 mb-2">
                    Current Version: {selectedPrompt.current_version}
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Display Name</label>
                  <input
                    type="text"
                    value={editedDisplayName}
                    onChange={(e) => setEditedDisplayName(e.target.value)}
                    placeholder="Enter prompt display name..."
                    className="w-full px-3 py-2 border rounded-lg"
                  />
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
                  {/* How to edit prompts section */}
                  <div>
                    <h2 className="text-lg font-semibold mb-3" style={{ color: '#30302f' }}>
                      How to edit AI prompts
                    </h2>
                    <p className="mb-4">
                      Prompts are the instructions that tell the AI what to do when analyzing programs. You can customize these instructions to match your organization's evaluation approach.
                    </p>
                    
                    <p className="mb-2 font-medium">Step-by-step guide:</p>
                    <ol className="list-decimal ml-5 space-y-2 mb-4 text-sm">
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
                    
                    <p className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-900 text-sm">
                      ✅ <strong>Don't worry about breaking things:</strong> Every time you save, a complete backup is created automatically. You can always restore any previous version.
                    </p>
                  </div>

                  {/* How to change configuration section */}
                  <div className="border-t pt-6">
                    <h2 className="text-lg font-semibold mb-3" style={{ color: '#30302f' }}>
                      How to change system settings
                    </h2>
                    
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-semibold text-base mb-2" style={{ color: '#30302f' }}>
                          How to change the email sender address
                        </h3>
                        <p className="mb-3">
                          This is the email address that appears in the "From" field when evaluation reports are emailed to users.
                        </p>
                        
                        <ol className="list-decimal ml-5 space-y-2 text-sm">
                          <li>
                            <strong>Go to Replit Integrations</strong>
                            <p className="mt-1">Find and click on the Resend integration in your Replit project</p>
                          </li>
                          <li>
                            <strong>Update the "From Email" field</strong>
                            <p className="mt-1">Enter your desired email sender address</p>
                          </li>
                          <li>
                            <strong>Restart the email server</strong>
                            <p className="mt-1">The changes will take effect after restarting</p>
                          </li>
                        </ol>
                        <p className="mt-3 text-sm text-gray-600">
                          <strong>Note:</strong> If using a custom domain, make sure it's verified in your <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Resend account</a> first.
                        </p>
                      </div>

                      <div className="border-t pt-6">
                        <h3 className="font-semibold text-base mb-2" style={{ color: '#30302f' }}>
                          How to change AI models
                        </h3>
                        <p className="mb-3">
                          Each prompt uses an AI model (like GPT-5 or Claude) to generate text. Different models have different strengths - some are better at analysis, others at creative writing. You might want to change models to improve quality or reduce costs.
                        </p>
                        
                        <p className="mb-2 font-medium">Easiest method: Ask Replit Agent</p>
                        <div className="p-3 bg-gray-50 border border-gray-300 rounded-lg mb-4 font-mono text-sm space-y-1">
                          <div>"Use GPT-5 for all prompts"</div>
                          <div>"Switch {prompts.find(p => p.step_name === 'prompt1')?.display_name} to Claude 3.5 Sonnet"</div>
                          <div>"Change {prompts.find(p => p.step_name === 'report_template')?.display_name} to use GPT-4"</div>
                        </div>
                        
                        <p className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-sm">
                          <strong>What is "temperature"?</strong> This controls how creative vs. predictable the AI is. Lower values (like 0.3) make it more focused and consistent. Higher values (like 0.9) make it more creative and varied. Most prompts work well with the default setting.
                        </p>

                        <details className="text-sm">
                          <summary className="font-medium cursor-pointer text-gray-700 mb-2">Advanced: Technical details for each prompt</summary>
                          <div className="space-y-3 mt-3 ml-4 text-gray-600">
                            <div>
                              <h4 className="font-medium text-gray-900">{prompts.find(p => p.step_name === 'prompt1')?.display_name}</h4>
                              <p className="text-xs mt-1">Configuration settings:</p>
                              <ul className="list-disc ml-5 space-y-1 text-xs mt-1">
                                <li><code className="bg-gray-100 px-1 rounded">VITE_PROMPT1_MODEL</code> - Which AI model to use (examples: openai/gpt-5, anthropic/claude-3.5-sonnet)</li>
                                <li><code className="bg-gray-100 px-1 rounded">VITE_PROMPT1_TEMPERATURE</code> - Creativity level, 0.0 to 1.0 (optional)</li>
                              </ul>
                            </div>

                            <div>
                              <h4 className="font-medium text-gray-900">{prompts.find(p => p.step_name === 'prompt2')?.display_name}</h4>
                              <p className="text-xs mt-1">Configuration settings:</p>
                              <ul className="list-disc ml-5 space-y-1 text-xs mt-1">
                                <li><code className="bg-gray-100 px-1 rounded">VITE_PROMPT2_MODEL</code> - Which AI model to use</li>
                                <li><code className="bg-gray-100 px-1 rounded">VITE_PROMPT2_TEMPERATURE</code> - Creativity level (optional)</li>
                              </ul>
                            </div>

                            <div>
                              <h4 className="font-medium text-gray-900">{prompts.find(p => p.step_name === 'report_template')?.display_name}</h4>
                              <p className="text-xs mt-1">Configuration settings:</p>
                              <ul className="list-disc ml-5 space-y-1 text-xs mt-1">
                                <li><code className="bg-gray-100 px-1 rounded">VITE_REPORT_TEMPLATE_MODEL</code> - Which AI model to use</li>
                                <li><code className="bg-gray-100 px-1 rounded">VITE_REPORT_TEMPLATE_TEMPERATURE</code> - Creativity level (optional)</li>
                              </ul>
                            </div>
                          </div>
                        </details>

                        <p className="mt-4 text-gray-600 text-sm">
                          <strong>Note:</strong> All AI models are accessed through a service called OpenRouter. See the <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">full list of available models</a> if you want to explore options.
                        </p>
                      </div>

                      <div className="border-t pt-6">
                        <h3 className="font-semibold text-base mb-2" style={{ color: '#30302f' }}>
                          How to turn web search on or off
                        </h3>
                        <p className="mb-3">
                          Web search allows the AI to look up information about similar programs and best practices from across the internet. This can make evaluation plans more informed and comprehensive, but it also makes processing slower and slightly more expensive.
                        </p>

                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                          <h4 className="font-medium text-sm mb-2">Your current settings:</h4>
                          <ul className="space-y-1 text-sm">
                            <li>• <strong>{prompts.find(p => p.step_name === 'prompt1')?.display_name}:</strong> Web search is <strong className={config?.prompt1.webSearch ? 'text-green-700' : 'text-gray-600'}>{config?.prompt1.webSearch ? 'ON' : 'OFF'}</strong></li>
                            <li>• <strong>{prompts.find(p => p.step_name === 'prompt2')?.display_name}:</strong> Web search is <strong className={config?.prompt2.webSearch ? 'text-green-700' : 'text-gray-600'}>{config?.prompt2.webSearch ? 'ON' : 'OFF'}</strong></li>
                            <li>• <strong>{prompts.find(p => p.step_name === 'report_template')?.display_name}:</strong> Web search is <strong className={config?.reportTemplate.webSearch ? 'text-green-700' : 'text-gray-600'}>{config?.reportTemplate.webSearch ? 'ON' : 'OFF'}</strong></li>
                          </ul>
                        </div>

                        <p className="mb-2 font-medium">Easiest method: Ask Replit Agent</p>
                        <div className="p-3 bg-gray-50 border border-gray-300 rounded-lg mb-4 font-mono text-sm space-y-1">
                          <div>"Turn off web search for {prompts.find(p => p.step_name === 'prompt1')?.display_name}"</div>
                          <div>"Enable web search for {prompts.find(p => p.step_name === 'prompt2')?.display_name}"</div>
                          <div>"Turn on web search for all prompts"</div>
                        </div>

                        <details className="text-sm mb-3">
                          <summary className="font-medium cursor-pointer text-gray-700 mb-2">Advanced: Change settings manually</summary>
                          <p className="text-xs text-gray-600 mt-2 ml-4">
                            If you prefer to change settings yourself, ask Replit Agent to update these configuration variables:
                          </p>
                          <ul className="list-disc ml-8 space-y-1 text-xs text-gray-600 mt-2">
                            <li><code className="bg-gray-100 px-1 rounded">VITE_PROMPT1_WEB_SEARCH</code> for {prompts.find(p => p.step_name === 'prompt1')?.display_name}</li>
                            <li><code className="bg-gray-100 px-1 rounded">VITE_PROMPT2_WEB_SEARCH</code> for {prompts.find(p => p.step_name === 'prompt2')?.display_name}</li>
                            <li><code className="bg-gray-100 px-1 rounded">VITE_REPORT_TEMPLATE_WEB_SEARCH</code> for {prompts.find(p => p.step_name === 'report_template')?.display_name}</li>
                          </ul>
                          <p className="text-xs text-gray-600 mt-2 ml-4">Set each to either <code className="bg-gray-100 px-1 rounded">true</code> (on) or <code className="bg-gray-100 px-1 rounded">false</code> (off).</p>
                        </details>

                        <p className="text-gray-600 italic text-sm">
                          💡 <strong>Default settings:</strong> Web search is turned on for the first two prompts (to gather context) and off for the report template (which uses already-gathered information).
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

                  <div className="border-t pt-6">
                    <h2 className="text-lg font-semibold mb-3" style={{ color: '#30302f' }}>
                      How to apply your changes
                    </h2>
                    <div className="space-y-3 text-sm text-gray-700">
                      <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                        <p><strong>⚠️ Restart required:</strong> After changing any settings, ask Replit Agent to restart the application. Your changes won't work until the restart is complete.</p>
                      </div>
                      <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                        <p><strong>📊 Check current settings:</strong> The Configuration panel on the left shows what's currently active - AI models, web search status, and email settings.</p>
                      </div>
                      <div className="p-3 bg-green-50 border-l-4 border-green-400 rounded">
                        <p><strong>✨ Easiest method:</strong> For any change in these instructions, just ask Replit Agent in plain English. Example: "Turn off web search" or "Switch to Claude for all prompts"</p>
                      </div>
                    </div>
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
