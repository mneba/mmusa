'use client';

// lib/AuthContext.js
import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Criar ou atualizar perfil do usuário no Firestore
  const createUserProfile = async (user, additionalData = {}) => {
    if (!user) return null;

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Criar novo perfil
      const profileData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || additionalData.displayName || '',
        photoURL: user.photoURL || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...additionalData
      };

      await setDoc(userRef, profileData);
      return profileData;
    } else {
      // Atualizar último acesso
      await setDoc(userRef, { 
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      }, { merge: true });
      return userSnap.data();
    }
  };

  // Buscar perfil do usuário
  const fetchUserProfile = async (uid) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserProfile(userSnap.data());
        return userSnap.data();
      }
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  // Observar mudanças no estado de autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        await fetchUserProfile(user.uid);
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Login com email e senha
  const login = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await createUserProfile(result.user);
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: getErrorMessage(error.code) };
    }
  };

  // Cadastro com email e senha
  const signup = async (email, password, displayName) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Atualizar nome do usuário
      if (displayName) {
        await updateProfile(result.user, { displayName });
      }
      
      await createUserProfile(result.user, { displayName });
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: getErrorMessage(error.code) };
    }
  };

  // Login com Google
  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await createUserProfile(result.user);
      return { success: true, user: result.user };
    } catch (error) {
      // Usuário fechou o popup
      if (error.code === 'auth/popup-closed-by-user') {
        return { success: false, error: null };
      }
      return { success: false, error: getErrorMessage(error.code) };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Recuperar senha
  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error.code) };
    }
  };

  // Converter códigos de erro do Firebase para mensagens amigáveis
  const getErrorMessage = (code) => {
    const messages = {
      'auth/email-already-in-use': 'This email is already registered. Try logging in.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/operation-not-allowed': 'This login method is not enabled.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Check your connection.',
      'auth/popup-blocked': 'Popup was blocked. Please allow popups.',
      'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.'
    };
    return messages[code] || 'An unexpected error occurred. Please try again.';
  };

  const value = {
    user,
    userProfile,
    loading,
    login,
    signup,
    loginWithGoogle,
    logout,
    resetPassword,
    fetchUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
