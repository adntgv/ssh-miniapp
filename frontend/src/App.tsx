import { useState, useCallback, useEffect } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { ConnectionList } from './components/ConnectionList';
import { ConnectionForm } from './components/ConnectionForm';
import { Terminal } from './components/Terminal';
import { Connection, ConnectionFormData } from './types';
import { api } from './services/api';

type View = 'list' | 'form' | 'terminal';

function App() {
  const {
    isReady,
    initData,
    showBackButton,
    hideBackButton,
  } = useTelegram();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [currentView, setCurrentView] = useState<View>('list');
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load connections from backend
  const loadConnections = useCallback(async () => {
    if (!initData) return;

    setIsLoadingConnections(true);
    try {
      const result = await api.listConnections(initData);
      if (result.success && result.data) {
        // Convert backend connections to frontend format
        const frontendConnections: Connection[] = result.data.connections.map((c) => ({
          id: String(c.id),
          name: c.name,
          host: c.host,
          port: c.port,
          username: c.username,
          type: c.useMosh ? 'mosh' : 'ssh',
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }));
        setConnections(frontendConnections);
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
    } finally {
      setIsLoadingConnections(false);
    }
  }, [initData]);

  useEffect(() => {
    if (isReady && initData) {
      loadConnections();
    }
  }, [isReady, initData, loadConnections]);

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
          const result = await api.deleteConnection(parseInt(connection.id, 10), initData);
          if (result.success) {
            await loadConnections();
          } else {
            throw new Error(result.error || 'Failed to delete');
          }
        } catch (err) {
          console.error('Failed to delete connection:', err);
          setError('Failed to delete connection');
        }
      }
    },
    [initData, loadConnections]
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
        let result;

        if (editingConnection) {
          // Update existing connection
          result = await api.updateConnection(
            parseInt(editingConnection.id, 10),
            formData,
            initData
          );
        } else {
          // Create new connection
          result = await api.createConnection(formData, initData);
        }

        if (!result.success) {
          throw new Error(result.error || 'Failed to save connection');
        }

        // Reload connections from backend
        await loadConnections();

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
    [editingConnection, initData, loadConnections]
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
