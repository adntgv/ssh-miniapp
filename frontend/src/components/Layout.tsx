import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showHeader?: boolean;
}

export function Layout({ children, title, showHeader = true }: LayoutProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
        color: 'var(--tg-theme-text-color, #000000)',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)',
      }}
    >
      {showHeader && title && (
        <header
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--tg-theme-hint-color, #e0e0e0)',
            backgroundColor: 'var(--tg-theme-secondary-bg-color, #f8f8f8)',
          }}
        >
          <h1
            style={{
              fontSize: '18px',
              fontWeight: 600,
              margin: 0,
            }}
          >
            {title}
          </h1>
        </header>
      )}
      <main
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </main>
    </div>
  );
}

// Common button styles
export const buttonStyles = {
  primary: {
    backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
    color: 'var(--tg-theme-button-text-color, #ffffff)',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
    width: '100%',
    transition: 'opacity 0.2s',
  } as React.CSSProperties,
  secondary: {
    backgroundColor: 'transparent',
    color: 'var(--tg-theme-link-color, #2481cc)',
    border: '1px solid var(--tg-theme-link-color, #2481cc)',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
    width: '100%',
    transition: 'opacity 0.2s',
  } as React.CSSProperties,
  danger: {
    backgroundColor: '#dc3545',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
    width: '100%',
    transition: 'opacity 0.2s',
  } as React.CSSProperties,
};

// Common input styles
export const inputStyles = {
  container: {
    marginBottom: '16px',
  } as React.CSSProperties,
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--tg-theme-text-color, #000000)',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    border: '1px solid var(--tg-theme-hint-color, #e0e0e0)',
    borderRadius: '8px',
    backgroundColor: 'var(--tg-theme-secondary-bg-color, #f8f8f8)',
    color: 'var(--tg-theme-text-color, #000000)',
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  select: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    border: '1px solid var(--tg-theme-hint-color, #e0e0e0)',
    borderRadius: '8px',
    backgroundColor: 'var(--tg-theme-secondary-bg-color, #f8f8f8)',
    color: 'var(--tg-theme-text-color, #000000)',
    outline: 'none',
    boxSizing: 'border-box' as const,
    appearance: 'none' as const,
    cursor: 'pointer',
  } as React.CSSProperties,
  hint: {
    fontSize: '12px',
    color: 'var(--tg-theme-hint-color, #999999)',
    marginTop: '4px',
  } as React.CSSProperties,
  error: {
    fontSize: '12px',
    color: '#dc3545',
    marginTop: '4px',
  } as React.CSSProperties,
};

// Card styles
export const cardStyles = {
  card: {
    backgroundColor: 'var(--tg-theme-secondary-bg-color, #f8f8f8)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
  } as React.CSSProperties,
  title: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '8px',
    color: 'var(--tg-theme-text-color, #000000)',
  } as React.CSSProperties,
  subtitle: {
    fontSize: '14px',
    color: 'var(--tg-theme-hint-color, #999999)',
  } as React.CSSProperties,
};
