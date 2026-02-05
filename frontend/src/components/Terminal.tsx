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
    isScrolledUp,
    connect,
    disconnect,
    sendInput,
    resize,
    scrollPages,
    scrollToBottom,
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
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div
          ref={terminalRef}
          style={{
            height: '100%',
            padding: '4px',
            overflow: 'hidden',
          }}
        />
        {/* Scroll to bottom floating button */}
        {isScrolledUp && isConnected && (
          <button
            onClick={scrollToBottom}
            style={{
              position: 'absolute',
              bottom: '12px',
              right: '12px',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(64, 64, 64, 0.85)',
              border: '1px solid #606060',
              color: '#ffffff',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              backdropFilter: 'blur(4px)',
            }}
            aria-label="Scroll to bottom"
          >
            &#8595;
          </button>
        )}
      </div>

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
            onClick={() => scrollPages(-1)}
            style={{
              width: '48px',
              height: '40px',
              backgroundColor: '#404040',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Page up"
          >
            PgUp
          </button>
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
          <button
            onClick={() => scrollPages(1)}
            style={{
              width: '48px',
              height: '40px',
              backgroundColor: '#404040',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Page down"
          >
            PgDn
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
