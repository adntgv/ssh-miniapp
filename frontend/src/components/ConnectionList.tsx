import React from 'react';
import { Connection } from '../types';
import { Layout, buttonStyles, cardStyles } from './Layout';

interface ConnectionListProps {
  connections: Connection[];
  isLoading: boolean;
  onConnect: (connection: Connection) => void;
  onEdit: (connection: Connection) => void;
  onDelete: (connection: Connection) => void;
  onAdd: () => void;
}

export function ConnectionList({
  connections,
  isLoading,
  onConnect,
  onEdit,
  onDelete,
  onAdd,
}: ConnectionListProps) {
  if (isLoading) {
    return (
      <Layout title="Connections">
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '200px',
          }}
        >
          <span style={{ color: 'var(--tg-theme-hint-color, #999999)' }}>
            Loading connections...
          </span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="SSH/Mosh Connections">
      <div style={{ padding: '16px' }}>
        {connections.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
            }}
          >
            <div
              style={{
                fontSize: '48px',
                marginBottom: '16px',
              }}
            >
              &#128421;
            </div>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 600,
                marginBottom: '8px',
                color: 'var(--tg-theme-text-color, #000000)',
              }}
            >
              No connections yet
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--tg-theme-hint-color, #999999)',
                marginBottom: '24px',
              }}
            >
              Add your first SSH or Mosh connection to get started.
            </p>
            <button onClick={onAdd} style={buttonStyles.primary}>
              Add Connection
            </button>
          </div>
        ) : (
          <>
            {connections.map((connection) => (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                onConnect={() => onConnect(connection)}
                onEdit={() => onEdit(connection)}
                onDelete={() => onDelete(connection)}
              />
            ))}

            <div style={{ marginTop: '16px' }}>
              <button onClick={onAdd} style={buttonStyles.primary}>
                Add Connection
              </button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

interface ConnectionCardProps {
  connection: Connection;
  onConnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ConnectionCard({
  connection,
  onConnect,
  onEdit,
  onDelete,
}: ConnectionCardProps) {
  const [showActions, setShowActions] = React.useState(false);

  return (
    <div
      style={{
        ...cardStyles.card,
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div
          onClick={onConnect}
          style={{
            cursor: 'pointer',
            flex: 1,
          }}
        >
          <div style={cardStyles.title}>{connection.name}</div>
          <div style={cardStyles.subtitle}>
            {connection.username}@{connection.host}:{connection.port}
          </div>
          <div
            style={{
              marginTop: '8px',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 500,
                backgroundColor:
                  connection.type === 'ssh' ? '#e3f2fd' : '#f3e5f5',
                color: connection.type === 'ssh' ? '#1976d2' : '#7b1fa2',
              }}
            >
              {connection.type.toUpperCase()}
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowActions(!showActions)}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px',
            cursor: 'pointer',
            fontSize: '20px',
            color: 'var(--tg-theme-hint-color, #999999)',
          }}
        >
          &#8942;
        </button>
      </div>

      {showActions && (
        <div
          style={{
            position: 'absolute',
            right: '8px',
            top: '48px',
            backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            zIndex: 10,
          }}
        >
          <button
            onClick={() => {
              setShowActions(false);
              onConnect();
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 24px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              textAlign: 'left',
              color: 'var(--tg-theme-text-color, #000000)',
            }}
          >
            Connect
          </button>
          <button
            onClick={() => {
              setShowActions(false);
              onEdit();
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 24px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              textAlign: 'left',
              color: 'var(--tg-theme-text-color, #000000)',
            }}
          >
            Edit
          </button>
          <button
            onClick={() => {
              setShowActions(false);
              onDelete();
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 24px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              textAlign: 'left',
              color: '#dc3545',
            }}
          >
            Delete
          </button>
        </div>
      )}

      <div style={{ marginTop: '12px' }}>
        <button
          onClick={onConnect}
          style={{
            ...buttonStyles.primary,
            padding: '10px 16px',
            fontSize: '14px',
          }}
        >
          Connect
        </button>
      </div>
    </div>
  );
}
