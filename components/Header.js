'use client';

// components/Header.js
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function Header({ title, subtitle }) {
  const { user, userProfile, logout } = useAuth();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const displayName = userProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <header className="bg-gray-800 border-b border-gray-700 p-4">
      <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-400">{title || '📞 Lead AI'}</h1>
          {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
        </div>
        
        <div className="flex items-center gap-4">
          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-3 bg-gray-700 hover:bg-gray-600 rounded-xl px-4 py-2 transition-colors"
            >
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={displayName}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center text-sm font-medium">
                  {initials}
                </div>
              )}
              <span className="text-sm font-medium hidden sm:block">{displayName}</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${showMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Dropdown Menu */}
            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-700">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                    <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        router.push('/settings');
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 transition-colors flex items-center gap-2"
                    >
                      <span>⚙️</span> Settings
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 transition-colors flex items-center gap-2"
                    >
                      <span>🚪</span> Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
