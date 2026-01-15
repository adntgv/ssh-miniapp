import { ApiResponse, ConnectionFormData, Connection } from '../types';

const API_BASE = '/api';

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  initData?: string | null
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || `HTTP error ${response.status}`,
      };
    }

    return {
      success: true,
      data: data as T,
    };
  } catch (error) {
    console.error('API request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export const api = {
  // Connection credentials management
  saveCredentials: async (
    connectionId: string,
    credentials: { password?: string; privateKey?: string },
    initData?: string | null
  ): Promise<ApiResponse<void>> => {
    return request<void>(
      `/connections/${connectionId}/credentials`,
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      },
      initData
    );
  },

  deleteCredentials: async (
    connectionId: string,
    initData?: string | null
  ): Promise<ApiResponse<void>> => {
    return request<void>(
      `/connections/${connectionId}/credentials`,
      {
        method: 'DELETE',
      },
      initData
    );
  },

  // Test connection
  testConnection: async (
    connectionData: ConnectionFormData,
    initData?: string | null
  ): Promise<ApiResponse<{ success: boolean; message: string }>> => {
    return request<{ success: boolean; message: string }>(
      '/connections/test',
      {
        method: 'POST',
        body: JSON.stringify(connectionData),
      },
      initData
    );
  },

  // Create a new terminal session
  createSession: async (
    connectionId: string,
    initData?: string | null
  ): Promise<ApiResponse<{ sessionId: string }>> => {
    return request<{ sessionId: string }>(
      '/sessions',
      {
        method: 'POST',
        body: JSON.stringify({ connectionId }),
      },
      initData
    );
  },

  // Get session status
  getSession: async (
    sessionId: string,
    initData?: string | null
  ): Promise<ApiResponse<{ status: string; connectionId: string }>> => {
    return request<{ status: string; connectionId: string }>(
      `/sessions/${sessionId}`,
      {
        method: 'GET',
      },
      initData
    );
  },

  // Close session
  closeSession: async (
    sessionId: string,
    initData?: string | null
  ): Promise<ApiResponse<void>> => {
    return request<void>(
      `/sessions/${sessionId}`,
      {
        method: 'DELETE',
      },
      initData
    );
  },

  // Health check
  healthCheck: async (): Promise<ApiResponse<{ status: string }>> => {
    return request<{ status: string }>('/health', {
      method: 'GET',
    });
  },

  // Get user info
  getUserInfo: async (
    initData?: string | null
  ): Promise<ApiResponse<{ userId: number; username?: string }>> => {
    return request<{ userId: number; username?: string }>(
      '/user',
      {
        method: 'GET',
      },
      initData
    );
  },
};

// Helper to generate unique connection IDs
export function generateConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper to create a new connection object
export function createConnection(formData: ConnectionFormData): Connection {
  const now = new Date().toISOString();
  return {
    id: generateConnectionId(),
    name: formData.name,
    host: formData.host,
    port: formData.port,
    username: formData.username,
    type: formData.type,
    createdAt: now,
    updatedAt: now,
  };
}
