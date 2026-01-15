import { useCallback, useState, useEffect } from 'react';
import { postEvent } from '@telegram-apps/sdk';
import { Connection } from '../types';

const CONNECTIONS_KEY = 'ssh_connections';

interface UseCloudStorageReturn {
  connections: Connection[];
  isLoading: boolean;
  error: string | null;
  saveConnection: (connection: Connection) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  getConnection: (id: string) => Connection | undefined;
  refreshConnections: () => Promise<void>;
}

// Helper to invoke cloud storage methods via postEvent
async function cloudStorageGet(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    const requestId = `cs_get_${Date.now()}`;

    const handler = (event: MessageEvent) => {
      if (event.data?.eventType === 'cloud_storage_data_received' &&
          event.data?.eventData?.req_id === requestId) {
        window.removeEventListener('message', handler);
        const values = event.data.eventData.values || {};
        resolve(values[key] || null);
      }
    };

    window.addEventListener('message', handler);

    try {
      postEvent('web_app_invoke_custom_method', {
        req_id: requestId,
        method: 'getStorageValues',
        params: { keys: [key] }
      });
    } catch {
      window.removeEventListener('message', handler);
      resolve(null);
    }

    // Timeout after 3 seconds
    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(null);
    }, 3000);
  });
}

async function cloudStorageSet(key: string, value: string): Promise<boolean> {
  return new Promise((resolve) => {
    const requestId = `cs_set_${Date.now()}`;

    const handler = (event: MessageEvent) => {
      if (event.data?.eventType === 'custom_method_invoked' &&
          event.data?.eventData?.req_id === requestId) {
        window.removeEventListener('message', handler);
        resolve(true);
      }
    };

    window.addEventListener('message', handler);

    try {
      postEvent('web_app_invoke_custom_method', {
        req_id: requestId,
        method: 'saveStorageValue',
        params: { key, value }
      });
    } catch {
      window.removeEventListener('message', handler);
      resolve(false);
    }

    // Timeout after 3 seconds
    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(false);
    }, 3000);
  });
}

export function useCloudStorage(): UseCloudStorageReturn {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try cloud storage first
      const data = await cloudStorageGet(CONNECTIONS_KEY);
      if (data) {
        const parsed = JSON.parse(data) as Connection[];
        setConnections(parsed);
        setIsLoading(false);
        return;
      }

      // Fallback to localStorage for development
      const localData = localStorage.getItem(CONNECTIONS_KEY);
      if (localData) {
        setConnections(JSON.parse(localData));
      } else {
        setConnections([]);
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
      setError('Failed to load connections');
      // Try localStorage fallback
      try {
        const data = localStorage.getItem(CONNECTIONS_KEY);
        if (data) {
          setConnections(JSON.parse(data));
        }
      } catch {
        // Ignore fallback errors
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const saveConnections = useCallback(async (newConnections: Connection[]) => {
    const data = JSON.stringify(newConnections);

    // Always save to localStorage as backup
    localStorage.setItem(CONNECTIONS_KEY, data);

    // Try to save to cloud storage
    await cloudStorageSet(CONNECTIONS_KEY, data);

    setConnections(newConnections);
  }, []);

  const saveConnection = useCallback(
    async (connection: Connection) => {
      const existingIndex = connections.findIndex((c) => c.id === connection.id);
      let newConnections: Connection[];

      if (existingIndex >= 0) {
        newConnections = [...connections];
        newConnections[existingIndex] = {
          ...connection,
          updatedAt: new Date().toISOString(),
        };
      } else {
        newConnections = [
          ...connections,
          {
            ...connection,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      }

      await saveConnections(newConnections);
    },
    [connections, saveConnections]
  );

  const deleteConnection = useCallback(
    async (id: string) => {
      const newConnections = connections.filter((c) => c.id !== id);
      await saveConnections(newConnections);
    },
    [connections, saveConnections]
  );

  const getConnection = useCallback(
    (id: string) => {
      return connections.find((c) => c.id === id);
    },
    [connections]
  );

  return {
    connections,
    isLoading,
    error,
    saveConnection,
    deleteConnection,
    getConnection,
    refreshConnections: loadConnections,
  };
}
