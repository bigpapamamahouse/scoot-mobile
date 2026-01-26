import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { checkAuthStatus } from '../api/auth';
import { UsersAPI } from '../api';

interface AuthState {
  isChecking: boolean;
  isAuthenticated: boolean;
  needsTermsAcceptance: boolean;
}

interface AuthContextType extends AuthState {
  recheckAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provides initial auth check state to the app.
 * This allows the splash screen to stay visible until auth is fully determined.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isChecking: true,
    isAuthenticated: false,
    needsTermsAcceptance: false,
  });

  const checkAuth = useCallback(async () => {
    setState(prev => ({ ...prev, isChecking: true }));

    try {
      const isAuthenticated = await checkAuthStatus();

      if (isAuthenticated) {
        const user = await UsersAPI.me();
        const needsTerms = !(user as any)?.termsAccepted;

        setState({
          isChecking: false,
          isAuthenticated: true,
          needsTermsAcceptance: needsTerms,
        });
      } else {
        setState({
          isChecking: false,
          isAuthenticated: false,
          needsTermsAcceptance: false,
        });
      }
    } catch (error) {
      setState({
        isChecking: false,
        isAuthenticated: false,
        needsTermsAcceptance: false,
      });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const contextValue = React.useMemo(
    () => ({ ...state, recheckAuth: checkAuth }),
    [state, checkAuth]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
