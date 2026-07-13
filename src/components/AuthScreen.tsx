/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from '../types';
import { INITIAL_USERS } from '../data/mockData';
import { Shield, BookOpen, GraduationCap, School, Key, ArrowRight } from 'lucide-react';
import { usePortal } from './PortalContext';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showTestAccounts, setShowTestAccounts] = useState(true);
  const [loading, setLoading] = useState(false);

  const { config, portalType, setPortalTypeOverride, isDevMode } = usePortal();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Molimo unesite e-mail adresu.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/shared/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Prijava nije uspjela.');
        setLoading(false);
        return;
      }

      const data = await response.json();
      onLogin(data.user);
    } catch (err: any) {
      setError('Pogreška prilikom povezivanja s poslužiteljem.');
      setLoading(false);
    }
  };

  const handleTestLogin = async (user: User) => {
    setEmail(user.email);
    setPassword('••••••••');
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch('/api/shared/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: user.email }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Prijava nije uspjela.');
        setLoading(false);
        return;
      }

      const data = await response.json();
      setTimeout(() => {
        onLogin(data.user);
      }, 300);
    } catch (err: any) {
      setError('Pogreška prilikom povezivanja s poslužiteljem.');
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { label: 'Super Admin', bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
      case 'PRIMARY_ADMIN':
        return { label: 'Ravnatelj OŠ', bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' };
      case 'SECONDARY_ADMIN':
        return { label: 'Ravnatelj SŠ', bg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' };
      case 'PRIMARY_HOMEROOM_TEACHER':
        return { label: 'Razrednik OŠ', bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' };
      case 'SECONDARY_HOMEROOM_TEACHER':
        return { label: 'Razrednik SŠ', bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' };
      case 'PRIMARY_STUDENT':
        return { label: 'Učenik OŠ', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' };
      case 'SECONDARY_STUDENT':
        return { label: 'Učenik SŠ (Matura)', bg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' };
      case 'UNIVERSITY_ADMIN':
        return { label: 'Visoko učilište', bg: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' };
      default:
        return { label: role, bg: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' };
    }
  };

  // Filter accounts allowed on this portal
  const filteredUsers = INITIAL_USERS.filter(u => config.allowedRoles.includes(u.role));

  const brandGradient = config.portalType === 'FACULTY_ADMISSIONS'
    ? 'from-indigo-700 to-indigo-900 dark:from-indigo-950 dark:to-slate-900'
    : 'from-emerald-700 to-emerald-900 dark:from-emerald-950 dark:to-slate-900';

  const buttonColor = config.portalType === 'FACULTY_ADMISSIONS'
    ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10 hover:shadow-indigo-600/20'
    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10 hover:shadow-emerald-600/20';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-300">
      
      {/* Dev Mode Domain Switcher Banner */}
      {isDevMode && (
        <div className="w-full max-w-6xl mb-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              [DEVELOPMENT SWITCHER] Odaberite domenu / portal za testiranje:
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPortalTypeOverride('FACULTY_ADMISSIONS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                portalType === 'FACULTY_ADMISSIONS'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Postani student (Državna Matura)
            </button>
            <button
              onClick={() => setPortalTypeOverride('SECONDARY_ADMISSIONS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                portalType === 'SECONDARY_ADMISSIONS'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              e-Srednja (Upis Srednje)
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
        
        {/* Left Side: Brand & Concept */}
        <div className={`md:col-span-5 flex flex-col justify-between p-8 bg-gradient-to-br ${brandGradient} text-white rounded-3xl shadow-xl relative overflow-hidden`}>
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
          
          <div className="relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl">
                <GraduationCap className="h-8 w-8 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{config.shortName}</h1>
                <p className="text-xs text-white/70">Republika Hrvatska</p>
              </div>
            </div>

            <div className="space-y-6 my-8 animate-fade-in">
              <h2 className="text-3xl font-extrabold tracking-tight leading-tight">
                {config.name}
              </h2>
              <p className="text-white/80 leading-relaxed text-sm">
                {config.description}. Pristup zaštićenim dijelovima sustava zahtijeva izričitu AAI@EduHr prijavu.
              </p>
            </div>
          </div>

          <div className="relative mt-auto border-t border-white/10 pt-6 space-y-4">
            <div className="flex items-center gap-3 text-xs text-white/70">
              <div className="p-1 bg-amber-400/20 text-amber-400 rounded-md">
                <Shield className="h-4 w-4" />
              </div>
              <span>Sustav podliježe NIAS i CARNET sigurnosnim standardima</span>
            </div>
          </div>
        </div>

        {/* Right Side: Login & Quick Access */}
        <div className="md:col-span-7 flex flex-col gap-6">
          {/* Main Credentials Login Card */}
          <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 flex-1 flex flex-col justify-center">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Pristup portalu</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Prijavite se koristeći elektronički identitet iz sustava AAI@EduHr.
              </p>
            </div>

            {error && (
              <div className="p-3 mb-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Korisničko ime / E-mail (AAI@EduHr)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-slate-400">
                    <BookOpen className="h-5 w-5" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ime.prezime@skole.hr"
                    disabled={loading}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Zaporka
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-slate-400">
                    <Key className="h-5 w-5" />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full mt-2 py-3.5 px-6 text-white font-semibold rounded-2xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${buttonColor}`}
              >
                {loading ? 'Povezivanje...' : 'Prijavi se u sustav'} <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* Test Access Accounts Panel */}
          {showTestAccounts && (
            <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="h-4 w-4 text-indigo-500" />
                  BRZI TESTNI PRISTUP ({config.shortName.toUpperCase()})
                </h4>
                <button
                  onClick={() => setShowTestAccounts(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  Sakrij
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                Prijavite se s ulogom koja je dozvoljena za portal <strong>{config.shortName}</strong>:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {filteredUsers.map(user => {
                  const badge = getRoleBadge(user.role);
                  return (
                    <button
                      key={user.id}
                      onClick={() => handleTestLogin(user)}
                      disabled={loading}
                      className="flex flex-col text-left p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-800 hover:border-slate-200 transition-all cursor-pointer group disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between w-full gap-2 mb-1">
                        <span className="font-bold text-xs text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                          {user.fullName}
                        </span>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                        {user.email}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
