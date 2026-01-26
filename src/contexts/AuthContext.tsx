import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { checkAuthStatus } from '../api/auth';
import { UsersAPI } from '../api';

interface AuthState {
  isChecking: boolean;
  isAuthenticated: boolean;
  needsTermsAcceptance: boolean;
}

interface AuthResult {
  isAuthenticated: boolean;
  needsTermsAcceptance: boolean;
}

interface AuthContextType extends AuthState {
  recheckAuth: () => Promise<AuthResult>;
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

  const checkAuth = useCallback(async (): Promise<AuthResult> => {
    setState(prev => ({ ...prev, isChecking: true }));

    try {
      const isAuthenticated = await checkAuthStatus();

      if (isAuthenticated) {
        const user = await UsersAPI.me();
        const needsTerms = !(user as any)?.termsAccepted;

        const result = {
          isAuthenticated: true,
          needsTermsAcceptance: needsTerms,
        };
        setState({ ...result, isChecking: false });
        return result;
      } else {
        const result = {
          isAuthenticated: false,
          needsTermsAcceptance: false,
        };
        setState({ ...result, isChecking: false });
        return result;
      }
    } catch (error) {
      const result = {
        isAuthenticated: false,
        needsTermsAcceptance: false,
      };
      setState({ ...result, isChecking: false });
      return result;
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
