import { useEffect, useCallback } from 'react';
import '@xterm/xterm/css/xterm.css';
import { useTerminal } from '../hooks/useTerminal';
import { buttonStyles } from './Layout';

interface TerminalProps {
  connectionId: string;
  connectionName: string;
  initData: string | null;
  onBack: () => void;
}

export function Terminal({
  connectionId,
  connectionName,
  initData,
  onBack,
}: TerminalProps) {
  const {
    terminalRef,
    isConnecting,
    isConnected,
    error,
    connect,
    disconnect,
    resize,
  } = useTerminal({
    connectionId,
    initData,
    onConnected: () => {
      console.log('Terminal connected');
    },
    onDisconnected: () => {
      console.log('Terminal disconnected');
    },
    onError: (err) => {
      console.error('Terminal error:', err);
    },
  });

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  useEffect(() => {
    // Resize terminal after mount
    const timer = setTimeout(() => {
      resize();
    }, 100);
    return () => clearTimeout(timer);
  }, [resize]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    onBack();
  }, [disconnect, onBack]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#1e1e1e',
      }}
    >
      {/* Terminal header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          backgroundColor: '#2d2d2d',
          borderBottom: '1px solid #404040',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleDisconnect}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '4px 8px',
              fontSize: '14px',
            }}
          >
            &larr; Back
          </button>
          <span
            style={{
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            {connectionName}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isConnecting && (
            <span style={{ color: '#ffc107', fontSize: '12px' }}>
              Connecting...
            </span>
          )}
          {isConnected && (
            <span style={{ color: '#28a745', fontSize: '12px' }}>
              Connected
            </span>
          )}
          {!isConnecting && !isConnected && (
            <span style={{ color: '#dc3545', fontSize: '12px' }}>
              Disconnected
            </span>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#dc3545',
            color: '#ffffff',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {/* Terminal container */}
      <div
        ref={terminalRef}
        style={{
          flex: 1,
          padding: '4px',
          overflow: 'hidden',
        }}
      />

      {/* Reconnect button when disconnected */}
      {!isConnecting && !isConnected && (
        <div style={{ padding: '12px' }}>
          <button
            onClick={connect}
            style={{
              ...buttonStyles.primary,
              backgroundColor: '#28a745',
            }}
          >
            Reconnect
          </button>
        </div>
      )}
    </div>
  );
}
