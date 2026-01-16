import { useCallback, useRef, useState, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebSocketMessage } from '../types';

interface UseTerminalOptions {
  connectionId: string;
  initData: string | null;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
}

interface UseTerminalReturn {
  terminalRef: React.RefObject<HTMLDivElement>;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  sendInput: (data: string) => void;
  resize: () => void;
}

export function useTerminal({
  connectionId,
  initData,
  onConnected,
  onDisconnected,
  onError,
}: UseTerminalOptions): UseTerminalReturn {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store callbacks in refs to avoid dependency changes
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  const onErrorRef = useRef(onError);

  // Keep refs updated
  useEffect(() => {
    onConnectedRef.current = onConnected;
    onDisconnectedRef.current = onDisconnected;
    onErrorRef.current = onError;
  }, [onConnected, onDisconnected, onError]);

  // Connection state machine to prevent duplicate connections
  const connectionStateRef = useRef<'idle' | 'connecting' | 'connected' | 'disconnecting'>('idle');

  // Track connection instance to ignore stale WebSocket callbacks
  const connectionInstanceRef = useRef(0);

  const initTerminal = useCallback(() => {
    if (!terminalRef.current || terminalInstance.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        cursorAccent: '#1e1e1e',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
      scrollback: 10000,
      convertEol: true,
    });

    fitAddon.current = new FitAddon();
    terminal.loadAddon(fitAddon.current);

    const webLinksAddon = new WebLinksAddon();
    terminal.loadAddon(webLinksAddon);

    terminal.open(terminalRef.current);
    fitAddon.current.fit();

    terminalInstance.current = terminal;

    return terminal;
  }, []);

  const connect = useCallback(() => {
    // Connection state guard to prevent duplicate connections
    if (connectionStateRef.current !== 'idle') {
      console.log(`Connection blocked: state is ${connectionStateRef.current}`);
      return;
    }
    connectionStateRef.current = 'connecting';

    // Increment instance ID to invalidate any pending callbacks from previous connections
    const currentInstance = ++connectionInstanceRef.current;

    setIsConnecting(true);
    setError(null);

    // Wait for DOM to be ready if ref is not attached
    if (!terminalRef.current) {
      setTimeout(() => {
        if (terminalRef.current) {
          connectionStateRef.current = 'idle'; // Reset state before retry
          connect();
        } else {
          connectionStateRef.current = 'idle';
          setIsConnecting(false);
          setError('Terminal container not found');
        }
      }, 100);
      return;
    }

    const terminal = initTerminal();
    if (!terminal) {
      // Terminal might already be initialized, try to reuse
      if (terminalInstance.current) {
        // Continue with existing terminal
      } else {
        connectionStateRef.current = 'idle';
        setIsConnecting(false);
        setError('Failed to initialize terminal');
        return;
      }
    }

    const term = terminal || terminalInstance.current;
    if (!term) {
      connectionStateRef.current = 'idle';
      setIsConnecting(false);
      setError('Terminal not available');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal?connectionId=${connectionId}${initData ? `&initData=${encodeURIComponent(initData)}` : ''}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      term.writeln('Connecting to server...\r\n');

      // Get terminal dimensions
      const dimensions = fitAddon.current?.proposeDimensions();

      // Send connect message with connectionId and terminal size
      ws.send(
        JSON.stringify({
          type: 'connect',
          connectionId: parseInt(connectionId, 10),
          cols: dimensions?.cols || 80,
          rows: dimensions?.rows || 24,
        })
      );
    };

    ws.onmessage = (event) => {
      // Ignore messages from stale connections
      if (currentInstance !== connectionInstanceRef.current) return;

      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'connected':
            connectionStateRef.current = 'connected';
            setIsConnecting(false);
            setIsConnected(true);
            onConnectedRef.current?.();
            break;

          case 'output':
            if (message.data) {
              term.write(message.data);
            }
            break;

          case 'error':
            connectionStateRef.current = 'idle';
            setIsConnecting(false);
            setIsConnected(false);
            setError(message.error || 'Connection error');
            term.writeln(`\r\n\x1b[31mError: ${message.error}\x1b[0m\r\n`);
            onErrorRef.current?.(message.error || 'Connection error');
            break;

          case 'disconnected':
            connectionStateRef.current = 'idle';
            setIsConnected(false);
            term.writeln('\r\n\x1b[33mConnection closed.\x1b[0m\r\n');
            onDisconnectedRef.current?.();
            break;
        }
      } catch {
        // Plain text data (raw terminal output)
        if (currentInstance === connectionInstanceRef.current) {
          term.write(event.data);
        }
      }
    };

    ws.onerror = () => {
      // Ignore errors from stale connections
      if (currentInstance !== connectionInstanceRef.current) return;

      connectionStateRef.current = 'idle';
      setIsConnecting(false);
      setIsConnected(false);
      setError('WebSocket connection error');
      term.writeln('\r\n\x1b[31mConnection error.\x1b[0m\r\n');
    };

    ws.onclose = () => {
      // Ignore close events from stale connections
      if (currentInstance !== connectionInstanceRef.current) return;

      connectionStateRef.current = 'idle';
      setIsConnecting(false);
      setIsConnected(false);
      onDisconnectedRef.current?.();
    };

    // Handle terminal input
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });
  }, [connectionId, initData, initTerminal]); // Removed callback props - using refs instead

  const disconnect = useCallback(() => {
    if (connectionStateRef.current === 'idle' || connectionStateRef.current === 'disconnecting') {
      return;
    }
    connectionStateRef.current = 'disconnecting';

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    connectionStateRef.current = 'idle';
  }, []);

  const sendInput = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data }));
    }
  }, []);

  const resize = useCallback(() => {
    if (fitAddon.current && terminalInstance.current) {
      fitAddon.current.fit();

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const dimensions = fitAddon.current.proposeDimensions();
        if (dimensions) {
          wsRef.current.send(
            JSON.stringify({
              type: 'resize',
              cols: dimensions.cols,
              rows: dimensions.rows,
            })
          );
        }
      }
    }
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      resize();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [resize]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
      if (terminalInstance.current) {
        terminalInstance.current.dispose();
        terminalInstance.current = null;
      }
    };
  }, [disconnect]);

  return {
    terminalRef: terminalRef as React.RefObject<HTMLDivElement>,
    isConnecting,
    isConnected,
    error,
    connect,
    disconnect,
    sendInput,
    resize,
  };
}
