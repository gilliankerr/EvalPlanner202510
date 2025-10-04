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
  };
  prompt2: {
    model: string;
    temperature: number | null;
  };
  reportTemplate: {
    model: string;
    temperature: number | null;
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
  const API_URL = '/api';
  const ADMIN_API_KEY = 'dev-admin-key-change-in-production';

  useEffect(() => {
    const authenticated = sessionStorage.getItem('adminAuthenticated');
    if (authenticated === 'true') {
      setIsAuthenticated(true);
      fetchPrompts();
      fetchConfig();
    }
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
          'Authorization': `Bearer ${ADMIN_API_KEY}`
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
          'Authorization': `Bearer ${ADMIN_API_KEY}`
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
        setIsAuthenticated(true);
        sessionStorage.setItem('adminAuthenticated', 'true');
        setPassword('');
      } else {
        setPasswordError('Incorrect password. Please try again.');
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      setPasswordError('An error occurred. Please try again.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('adminAuthenticated');
    setPassword('');
    setPasswordError('');
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
                Prompt Management
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
                  </div>
                  <div className="border-t pt-3">
                    <div className="font-medium text-gray-700">Prompt 2 LLM:</div>
                    <div className="text-gray-600 mt-1">
                      {config.prompt2.model}
                      {config.prompt2.temperature !== null && ` (temp: ${config.prompt2.temperature})`}
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="font-medium text-gray-700">Report Template LLM:</div>
                    <div className="text-gray-600 mt-1">
                      {config.reportTemplate.model}
                      {config.reportTemplate.temperature !== null && ` (temp: ${config.reportTemplate.temperature})`}
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
              <div className="bg-white rounded-lg border p-12 text-center">
                <p className="text-gray-500">Select a prompt to edit</p>
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
