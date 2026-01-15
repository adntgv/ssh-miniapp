import { useState, useEffect, FormEvent } from 'react';
import { Connection, ConnectionFormData } from '../types';
import { Layout, buttonStyles, inputStyles } from './Layout';

interface ConnectionFormProps {
  connection?: Connection | null;
  onSave: (data: ConnectionFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConnectionForm({
  connection,
  onSave,
  onCancel,
  isLoading = false,
}: ConnectionFormProps) {
  const [formData, setFormData] = useState<ConnectionFormData>({
    name: '',
    host: '',
    port: 22,
    username: '',
    password: '',
    privateKey: '',
    type: 'ssh',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ConnectionFormData, string>>>({});
  const [authMethod, setAuthMethod] = useState<'password' | 'key'>('password');

  useEffect(() => {
    if (connection) {
      setFormData({
        name: connection.name,
        host: connection.host,
        port: connection.port,
        username: connection.username,
        password: '',
        privateKey: '',
        type: connection.type,
      });
    }
  }, [connection]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ConnectionFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.host.trim()) {
      newErrors.host = 'Host is required';
    }

    if (!formData.port || formData.port < 1 || formData.port > 65535) {
      newErrors.port = 'Port must be between 1 and 65535';
    }

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    // Only require credentials for new connections
    if (!connection) {
      if (authMethod === 'password' && !formData.password?.trim()) {
        newErrors.password = 'Password is required';
      }
      if (authMethod === 'key' && !formData.privateKey?.trim()) {
        newErrors.privateKey = 'Private key is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const dataToSave: ConnectionFormData = {
      ...formData,
      password: authMethod === 'password' ? formData.password : undefined,
      privateKey: authMethod === 'key' ? formData.privateKey : undefined,
    };

    await onSave(dataToSave);
  };

  const handleChange = (
    field: keyof ConnectionFormData,
    value: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const isEditing = !!connection;

  return (
    <Layout title={isEditing ? 'Edit Connection' : 'New Connection'}>
      <form onSubmit={handleSubmit} style={{ padding: '16px' }}>
        {/* Connection Name */}
        <div style={inputStyles.container}>
          <label style={inputStyles.label}>Connection Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="My Server"
            style={{
              ...inputStyles.input,
              borderColor: errors.name ? '#dc3545' : undefined,
            }}
          />
          {errors.name && <div style={inputStyles.error}>{errors.name}</div>}
        </div>

        {/* Connection Type */}
        <div style={inputStyles.container}>
          <label style={inputStyles.label}>Connection Type</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleChange('type', 'ssh')}
              style={{
                flex: 1,
                padding: '12px',
                border: '1px solid',
                borderColor:
                  formData.type === 'ssh'
                    ? 'var(--tg-theme-button-color, #2481cc)'
                    : 'var(--tg-theme-hint-color, #e0e0e0)',
                borderRadius: '8px',
                backgroundColor:
                  formData.type === 'ssh'
                    ? 'var(--tg-theme-button-color, #2481cc)'
                    : 'transparent',
                color:
                  formData.type === 'ssh'
                    ? 'var(--tg-theme-button-text-color, #ffffff)'
                    : 'var(--tg-theme-text-color, #000000)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              SSH
            </button>
            <button
              type="button"
              onClick={() => handleChange('type', 'mosh')}
              style={{
                flex: 1,
                padding: '12px',
                border: '1px solid',
                borderColor:
                  formData.type === 'mosh'
                    ? 'var(--tg-theme-button-color, #2481cc)'
                    : 'var(--tg-theme-hint-color, #e0e0e0)',
                borderRadius: '8px',
                backgroundColor:
                  formData.type === 'mosh'
                    ? 'var(--tg-theme-button-color, #2481cc)'
                    : 'transparent',
                color:
                  formData.type === 'mosh'
                    ? 'var(--tg-theme-button-text-color, #ffffff)'
                    : 'var(--tg-theme-text-color, #000000)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              Mosh
            </button>
          </div>
          <div style={inputStyles.hint}>
            {formData.type === 'ssh'
              ? 'Standard SSH connection'
              : 'Mobile-optimized connection with better latency handling'}
          </div>
        </div>

        {/* Host */}
        <div style={inputStyles.container}>
          <label style={inputStyles.label}>Host</label>
          <input
            type="text"
            value={formData.host}
            onChange={(e) => handleChange('host', e.target.value)}
            placeholder="example.com or 192.168.1.1"
            style={{
              ...inputStyles.input,
              borderColor: errors.host ? '#dc3545' : undefined,
            }}
          />
          {errors.host && <div style={inputStyles.error}>{errors.host}</div>}
        </div>

        {/* Port */}
        <div style={inputStyles.container}>
          <label style={inputStyles.label}>Port</label>
          <input
            type="number"
            value={formData.port}
            onChange={(e) => handleChange('port', parseInt(e.target.value) || 22)}
            min={1}
            max={65535}
            style={{
              ...inputStyles.input,
              borderColor: errors.port ? '#dc3545' : undefined,
            }}
          />
          {errors.port && <div style={inputStyles.error}>{errors.port}</div>}
          <div style={inputStyles.hint}>
            Default: 22 for SSH
          </div>
        </div>

        {/* Username */}
        <div style={inputStyles.container}>
          <label style={inputStyles.label}>Username</label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => handleChange('username', e.target.value)}
            placeholder="root"
            autoCapitalize="off"
            autoCorrect="off"
            style={{
              ...inputStyles.input,
              borderColor: errors.username ? '#dc3545' : undefined,
            }}
          />
          {errors.username && (
            <div style={inputStyles.error}>{errors.username}</div>
          )}
        </div>

        {/* Authentication Method */}
        <div style={inputStyles.container}>
          <label style={inputStyles.label}>Authentication</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setAuthMethod('password')}
              style={{
                flex: 1,
                padding: '12px',
                border: '1px solid',
                borderColor:
                  authMethod === 'password'
                    ? 'var(--tg-theme-button-color, #2481cc)'
                    : 'var(--tg-theme-hint-color, #e0e0e0)',
                borderRadius: '8px',
                backgroundColor:
                  authMethod === 'password'
                    ? 'var(--tg-theme-button-color, #2481cc)'
                    : 'transparent',
                color:
                  authMethod === 'password'
                    ? 'var(--tg-theme-button-text-color, #ffffff)'
                    : 'var(--tg-theme-text-color, #000000)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod('key')}
              style={{
                flex: 1,
                padding: '12px',
                border: '1px solid',
                borderColor:
                  authMethod === 'key'
                    ? 'var(--tg-theme-button-color, #2481cc)'
                    : 'var(--tg-theme-hint-color, #e0e0e0)',
                borderRadius: '8px',
                backgroundColor:
                  authMethod === 'key'
                    ? 'var(--tg-theme-button-color, #2481cc)'
                    : 'transparent',
                color:
                  authMethod === 'key'
                    ? 'var(--tg-theme-button-text-color, #ffffff)'
                    : 'var(--tg-theme-text-color, #000000)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              Private Key
            </button>
          </div>
        </div>

        {/* Password */}
        {authMethod === 'password' && (
          <div style={inputStyles.container}>
            <label style={inputStyles.label}>
              Password {isEditing && '(leave empty to keep current)'}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder={isEditing ? '********' : 'Enter password'}
              style={{
                ...inputStyles.input,
                borderColor: errors.password ? '#dc3545' : undefined,
              }}
            />
            {errors.password && (
              <div style={inputStyles.error}>{errors.password}</div>
            )}
            <div style={inputStyles.hint}>
              Credentials are encrypted and stored securely on the server.
            </div>
          </div>
        )}

        {/* Private Key */}
        {authMethod === 'key' && (
          <div style={inputStyles.container}>
            <label style={inputStyles.label}>
              Private Key {isEditing && '(leave empty to keep current)'}
            </label>
            <textarea
              value={formData.privateKey}
              onChange={(e) => handleChange('privateKey', e.target.value)}
              placeholder={
                isEditing
                  ? 'Paste new private key to update'
                  : '-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----'
              }
              rows={6}
              style={{
                ...inputStyles.input,
                resize: 'vertical',
                fontFamily: 'monospace',
                fontSize: '12px',
                borderColor: errors.privateKey ? '#dc3545' : undefined,
              }}
            />
            {errors.privateKey && (
              <div style={inputStyles.error}>{errors.privateKey}</div>
            )}
            <div style={inputStyles.hint}>
              Paste your private key (PEM format). It will be encrypted before
              storage.
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={buttonStyles.secondary}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              ...buttonStyles.primary,
              opacity: isLoading ? 0.7 : 1,
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : isEditing ? 'Update' : 'Save'}
          </button>
        </div>
      </form>
    </Layout>
  );
}
