import React from 'react';
import { useStore } from './store/useStore';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';

function App() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);

  return (
    <>
      {isAuthenticated ? <Dashboard /> : <Login />}
    </>
  );
}

export default App;
