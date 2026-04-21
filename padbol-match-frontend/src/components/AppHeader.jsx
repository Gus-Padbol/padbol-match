import React from 'react';

const AppHeader = ({ title }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '60px',
      background: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      borderBottom: '1px solid rgba(255,255,255,0.08)'
    }}>
      
      {/* Logo */}
      <img 
        src="/logo-padbol-match.png" 
        alt="Padbol Match"
        style={{
          position: 'absolute',
          left: '16px',
          width: '32px'
        }}
      />

      {/* Title */}
      <h3 style={{
        color: '#fff',
        fontSize: '16px',
        fontWeight: '600',
        margin: 0
      }}>
        {title}
      </h3>
    </div>
  );
};

export default AppHeader;
