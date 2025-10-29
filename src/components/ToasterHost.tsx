import React from 'react';
import { Toaster } from 'react-hot-toast';

const ToasterHost: React.FC = () => (
  <Toaster position="bottom-right" toastOptions={{
    style: { background: 'rgba(0,0,0,.85)', color: '#fff', borderRadius: 10, border: '1px solid rgba(255,255,255,.14)' }
  }} />
);
export default ToasterHost;
