import { useEffect, useCallback, useRef } from 'react';
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
    sendInput,
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

  // Stabilize connect/disconnect refs to avoid useEffect re-runs
  const connectRef = useRef(connect);
  const disconnectRef = useRef(disconnect);

  useEffect(() => {
    connectRef.current = connect;
    disconnectRef.current = disconnect;
  }, [connect, disconnect]);

  useEffect(() => {
    connectRef.current();
    return () => {
      disconnectRef.current();
    };
  }, []); // Empty deps - runs only on mount/unmount

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
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)',
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

      {/* Special keys row */}
      {isConnected && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: '#2d2d2d',
            borderTop: '1px solid #404040',
          }}
        >
          <button
            onClick={() => sendInput('\x1b[D')}
            style={{
              width: '48px',
              height: '40px',
              backgroundColor: '#404040',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Left arrow"
          >
            ←
          </button>
          <button
            onClick={() => sendInput('\x1b[B')}
            style={{
              width: '48px',
              height: '40px',
              backgroundColor: '#404040',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Down arrow"
          >
            ↓
          </button>
          <button
            onClick={() => sendInput('\x1b[A')}
            style={{
              width: '48px',
              height: '40px',
              backgroundColor: '#404040',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Up arrow"
          >
            ↑
          </button>
          <button
            onClick={() => sendInput('\x1b[C')}
            style={{
              width: '48px',
              height: '40px',
              backgroundColor: '#404040',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Right arrow"
          >
            →
          </button>
        </div>
      )}

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
