'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  User,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  AuthError,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<User | null>;
  signOutUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to Firebase Auth state changes
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        if (!isMounted) return;
        setUser(currentUser);
        setLoading(false);
      },
      (authErr) => {
        if (!isMounted) return;
        console.error('[AuthProvider] Auth state error:', authErr);
        setError(authErr.message);
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const clearError = () => setError(null);

  const signInWithGoogle = async (): Promise<User | null> => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      setLoading(false);
      return result.user;
    } catch (err: unknown) {
      setLoading(false);
      const authError = err as AuthError;
      console.warn('[AuthProvider] signInWithPopup code:', authError?.code);

      let friendlyMessage = 'Unable to sign in with Google. Please try again.';

      switch (authError?.code) {
        case 'auth/popup-closed-by-user':
          friendlyMessage = 'Sign-in window was closed before completing.';
          break;
        case 'auth/cancelled-popup-request':
          friendlyMessage = 'Sign-in request was cancelled.';
          break;
        case 'auth/popup-blocked':
          friendlyMessage = 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
          break;
        case 'auth/network-request-failed':
          friendlyMessage = 'Network error. Please check your internet connection and try again.';
          break;
        case 'auth/account-exists-with-different-credential':
          friendlyMessage = 'An account already exists with the same email address.';
          break;
        case 'auth/operation-not-allowed':
          friendlyMessage = 'Google sign-in is not enabled in Firebase console.';
          break;
        default:
          friendlyMessage = authError?.message || friendlyMessage;
          break;
      }

      setError(friendlyMessage);
      return null;
    }
  };

  const signOutUser = async (): Promise<void> => {
    try {
      await signOut(auth);
      setUser(null);
      setError(null);
    } catch (err: unknown) {
      console.error('[AuthProvider] signOut error:', err);
      const authError = err as AuthError;
      setError(authError?.message || 'Error signing out.');
    }
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      error,
      signInWithGoogle,
      signOutUser,
      clearError,
    }),
    [user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
