/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Bell, Search, Calendar, GraduationCap, Sun, Moon, LogOut, ShieldCheck, Clock, CheckCircle } from 'lucide-react';
import { User, AppNotification } from '../types';
import { useTheme } from './ThemeContext';

interface HeaderProps {
  currentUser: User;
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onLogout: () => void;
  onOpenSearch: () => void;
  onPageChange: (page: string) => void;
}

export function Header({
  currentUser,
  notifications,
  onMarkRead,
  onLogout,
  onOpenSearch,
  onPageChange
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  const unreadCount = notifications.filter(n => !n.isRead).length;
  
  const displayedNotifications = notifFilter === 'ALL'
    ? notifications
    : notifications.filter(n => !n.isRead);

  // Dynamic institution text based on role
  const getInstitutionText = () => {
    switch (currentUser.role) {
      case 'SUPER_ADMIN':
        return 'Ministarstvo znanosti i obrazovanja (MZO)';
      case 'PRIMARY_STUDENT':
      case 'PRIMARY_HOMEROOM_TEACHER':
      case 'PRIMARY_ADMIN':
        return 'Osnovna škola Nikole Tesle, Zagreb';
      case 'SECONDARY_STUDENT':
      case 'SECONDARY_HOMEROOM_TEACHER':
      case 'SECONDARY_ADMIN':
        return 'V. Gimnazija, Zagreb';
      case 'UNIVERSITY_ADMIN':
        return 'Fakultet elektrotehnike i računarstva (FER)';
      default:
        return 'Agencija za odgoj i obrazovanje (AZOO)';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Left branding and dynamic institution */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => onPageChange('dashboard')}
            className="p-2 bg-indigo-600 text-white rounded-xl shadow-md cursor-pointer hover:scale-105 transition-all"
            aria-label="EduPortal Početna"
          >
            <GraduationCap className="h-5.5 w-5.5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm sm:text-base tracking-tight text-slate-800 dark:text-slate-100">
                EduPortal Hrvatska
              </span>
              <span className="hidden sm:inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/50 rounded-sm">
                RH
              </span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-400 block font-medium">
              {getInstitutionText()}
            </span>
          </div>
        </div>

        {/* Global Search shortcut block */}
        <div className="hidden md:flex flex-1 max-w-sm">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center gap-2.5 px-3 py-2 bg-slate-50 dark:bg-slate-950/50 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl text-left text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs transition-all cursor-pointer hover:border-slate-300 dark:hover:border-slate-700"
          >
            <Search className="h-4 w-4 text-indigo-500 shrink-0" />
            <span>Pretraži sustav (škole, upise)...</span>
            <kbd className="ml-auto font-mono text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 rounded-sm">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          
          {/* Mobile search trigger */}
          <button
            onClick={onOpenSearch}
            className="p-2 md:hidden hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl transition-all cursor-pointer"
            aria-label="Pretraži"
          >
            <Search className="h-4.5 w-4.5" />
          </button>

          {/* National School Year Badge */}
          <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 rounded-lg border border-slate-200/40 dark:border-slate-800/60">
            <Clock className="h-3.5 w-3.5 text-indigo-500" />
            Šk. god: 2026./2027.
          </span>

          {/* Calendar Navigation Page shortcut */}
          <button
            onClick={() => onPageChange('calendar')}
            className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all cursor-pointer"
            title="Sustavni kalendar i rokovi"
          >
            <Calendar className="h-4.5 w-4.5" />
          </button>

          {/* Notifications center bell */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all relative cursor-pointer"
              aria-label="Obavijesti"
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-3.5 w-3.5 bg-rose-500 text-white font-bold text-[8px] rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Drawer */}
            {showDropdown && (
              <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-2xl p-4 z-50 space-y-3 animate-fade-in">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Nacionalni Centar Obavijesti
                  </span>
                  
                  {/* Filters read/unread */}
                  <div className="flex gap-1 text-[9px] font-bold">
                    <button
                      onClick={() => setNotifFilter('ALL')}
                      className={`px-1.5 py-0.5 rounded-sm ${notifFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Sve
                    </button>
                    <button
                      onClick={() => setNotifFilter('UNREAD')}
                      className={`px-1.5 py-0.5 rounded-sm ${notifFilter === 'UNREAD' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Nepročitano
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {displayedNotifications.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-6">Nema novih obavijesti.</p>
                  ) : (
                    displayedNotifications.map(n => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-2xl border text-xs leading-relaxed transition-all ${
                          n.isRead
                            ? 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800 text-slate-500'
                            : 'bg-indigo-50/20 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-950/60'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-1">
                          <span className={`font-bold ${n.isRead ? 'text-slate-700 dark:text-slate-300' : 'text-slate-800 dark:text-slate-100'}`}>
                            {n.title}
                          </span>
                          {!n.isRead && (
                            <button
                              onClick={() => {
                                onMarkRead(n.id);
                              }}
                              className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                            >
                              Označi pročitano
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] mt-1 text-slate-500 dark:text-slate-400 leading-normal">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Theme switcher toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-amber-500 rounded-xl transition-all cursor-pointer"
            aria-label="Promijeni temu"
          >
            {theme === 'dark' ? <Sun className="h-4.5 w-4.5 text-amber-400" /> : <Moon className="h-4.5 w-4.5" />}
          </button>

          {/* Logout exit button */}
          <button
            onClick={onLogout}
            className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/10 text-rose-500 rounded-xl transition-all cursor-pointer"
            title="Odjava iz e-Upisa"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>

          {/* Avatar and name on desktop */}
          <div
            onClick={() => onPageChange('profile')}
            className="hidden sm:flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-3.5 cursor-pointer hover:opacity-85 transition-all"
            title="Korisnički profil"
          >
            <div className="h-8 w-8 rounded-full bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
              {currentUser.fullName.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="text-left hidden lg:block">
              <span className="text-xs font-black block text-slate-800 dark:text-slate-200">
                {currentUser.fullName}
              </span>
              <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest block">
                {currentUser.role.replace('_', ' ')}
              </span>
            </div>
          </div>

        </div>

      </div>
    </header>
  );
}
