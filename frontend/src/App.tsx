import { useState, useCallback, useEffect } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { useCloudStorage } from './hooks/useCloudStorage';
import { ConnectionList } from './components/ConnectionList';
import { ConnectionForm } from './components/ConnectionForm';
import { Terminal } from './components/Terminal';
import { Connection, ConnectionFormData } from './types';
import { api, createConnection } from './services/api';

type View = 'list' | 'form' | 'terminal';

function App() {
  const {
    isReady,
    initData,
    showBackButton,
    hideBackButton,
  } = useTelegram();

  const {
    connections,
    isLoading: isLoadingConnections,
    saveConnection,
    deleteConnection,
  } = useCloudStorage();

  const [currentView, setCurrentView] = useState<View>('list');
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle back button
  useEffect(() => {
    if (currentView !== 'list') {
      showBackButton(() => {
        if (currentView === 'terminal') {
          setActiveConnection(null);
        }
        if (currentView === 'form') {
          setEditingConnection(null);
        }
        setCurrentView('list');
      });
    } else {
      hideBackButton();
    }
  }, [currentView, showBackButton, hideBackButton]);

  const handleAddConnection = useCallback(() => {
    setEditingConnection(null);
    setCurrentView('form');
  }, []);

  const handleEditConnection = useCallback((connection: Connection) => {
    setEditingConnection(connection);
    setCurrentView('form');
  }, []);

  const handleDeleteConnection = useCallback(
    async (connection: Connection) => {
      if (window.confirm(`Delete connection "${connection.name}"?`)) {
        try {
          // Delete credentials from backend
          await api.deleteCredentials(connection.id, initData);
          // Delete metadata from cloud storage
          await deleteConnection(connection.id);
        } catch (err) {
          console.error('Failed to delete connection:', err);
          setError('Failed to delete connection');
        }
      }
    },
    [deleteConnection, initData]
  );

  const handleConnect = useCallback((connection: Connection) => {
    setActiveConnection(connection);
    setCurrentView('terminal');
  }, []);

  const handleSaveConnection = useCallback(
    async (formData: ConnectionFormData) => {
      setIsSaving(true);
      setError(null);

      try {
        let connectionToSave: Connection;

        if (editingConnection) {
          // Update existing connection
          connectionToSave = {
            ...editingConnection,
            name: formData.name,
            host: formData.host,
            port: formData.port,
            username: formData.username,
            type: formData.type,
            updatedAt: new Date().toISOString(),
          };
        } else {
          // Create new connection
          connectionToSave = createConnection(formData);
        }

        // Save credentials to backend if provided
        if (formData.password || formData.privateKey) {
          const credResult = await api.saveCredentials(
            connectionToSave.id,
            {
              password: formData.password,
              privateKey: formData.privateKey,
            },
            initData
          );

          if (!credResult.success) {
            throw new Error(credResult.error || 'Failed to save credentials');
          }
        }

        // Save connection metadata to cloud storage
        await saveConnection(connectionToSave);

        // Navigate back to list
        setEditingConnection(null);
        setCurrentView('list');
      } catch (err) {
        console.error('Failed to save connection:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to save connection'
        );
      } finally {
        setIsSaving(false);
      }
    },
    [editingConnection, saveConnection, initData]
  );

  const handleCancelForm = useCallback(() => {
    setEditingConnection(null);
    setCurrentView('list');
  }, []);

  const handleBackFromTerminal = useCallback(() => {
    setActiveConnection(null);
    setCurrentView('list');
  }, []);

  // Show loading state while Telegram SDK initializes
  if (!isReady) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
          color: 'var(--tg-theme-text-color, #000000)',
        }}
      >
        <span>Loading...</span>
      </div>
    );
  }

  // Show error if any
  if (error) {
    return (
      <div
        style={{
          padding: '20px',
          backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
          color: 'var(--tg-theme-text-color, #000000)',
        }}
      >
        <div
          style={{
            padding: '12px',
            backgroundColor: '#dc3545',
            color: '#ffffff',
            borderRadius: '8px',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
        <button
          onClick={() => setError(null)}
          style={{
            padding: '12px 24px',
            backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
            color: 'var(--tg-theme-button-text-color, #ffffff)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  // Render current view
  switch (currentView) {
    case 'form':
      return (
        <ConnectionForm
          connection={editingConnection}
          onSave={handleSaveConnection}
          onCancel={handleCancelForm}
          isLoading={isSaving}
        />
      );

    case 'terminal':
      if (!activeConnection) {
        setCurrentView('list');
        return null;
      }
      return (
        <Terminal
          connectionId={activeConnection.id}
          connectionName={activeConnection.name}
          initData={initData}
          onBack={handleBackFromTerminal}
        />
      );

    case 'list':
    default:
      return (
        <ConnectionList
          connections={connections}
          isLoading={isLoadingConnections}
          onConnect={handleConnect}
          onEdit={handleEditConnection}
          onDelete={handleDeleteConnection}
          onAdd={handleAddConnection}
        />
      );
  }
}

export default App;
