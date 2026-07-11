/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from '../types';
import { INITIAL_USERS } from '../data/mockData';
import { Shield, BookOpen, GraduationCap, School, Key, ArrowRight } from 'lucide-react';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showTestAccounts, setShowTestAccounts] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Molimo unesite e-mail adresu.');
      return;
    }

    const foundUser = INITIAL_USERS.find(
      u => u.email.toLowerCase().trim() === email.toLowerCase().trim()
    );

    if (foundUser) {
      onLogin(foundUser);
    } else {
      setError('Korisnik s ovim e-mailom nije pronađen u EduPortal bazi.');
    }
  };

  const handleTestLogin = (user: User) => {
    setEmail(user.email);
    setPassword('••••••••');
    setError('');
    // Slight delay for animation effect
    setTimeout(() => {
      onLogin(user);
    }, 400);
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-300">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
        
        {/* Left Side: Brand & Concept */}
        <div className="md:col-span-5 flex flex-col justify-between p-8 bg-linear-to-br from-indigo-700 to-indigo-900 dark:from-indigo-950 dark:to-slate-900 text-white rounded-3xl shadow-xl relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
          
          <div className="relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl">
                <GraduationCap className="h-8 w-8 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">EduPortal</h1>
                <p className="text-xs text-indigo-200">Republika Hrvatska</p>
              </div>
            </div>

            <div className="space-y-6 my-8">
              <h2 className="text-3xl font-extrabold tracking-tight leading-tight">
                Jedinstveni sustav za upise i maturu
              </h2>
              <p className="text-indigo-100/90 leading-relaxed text-sm">
                EduPortal Hrvatska objedinjuje i modernizira procese upisa u osnovne i srednje škole, 
                polaganje državne mature te prijavu studijskih programa na visokim učilištima.
              </p>
            </div>
          </div>

          <div className="relative mt-auto border-t border-white/10 pt-6 space-y-4">
            <div className="flex items-center gap-3 text-xs text-indigo-200">
              <div className="p-1 bg-amber-400/20 text-amber-400 rounded-md">
                <Shield className="h-4 w-4" />
              </div>
              <span>Sustav podliježe NIAS sigurnosnim standardima</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-center text-xs">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="text-amber-400 font-bold text-lg">srednje.e-upisi</p>
                <p className="text-indigo-200 text-[10px]">Srednjoškolski modul</p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="text-amber-400 font-bold text-lg">Postani Student</p>
                <p className="text-indigo-200 text-[10px]">Visokoškolski modul</p>
              </div>
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
                Prijavite se koristeći elektronički identitet iz sustava AAI@EduHr ili registrirani e-mail.
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
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                Prijavi se u sustav <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* Test Access Accounts Panel */}
          {showTestAccounts && (
            <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="h-4 w-4 text-indigo-500" />
                  BRZI TESTNI PRISTUP (SIMULATOR ULOGA)
                </h4>
                <button
                  onClick={() => setShowTestAccounts(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  Sakrij
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                Prijavite se trenutno s bilo kojom od predefiniranih sigurnosnih uloga (RBAC) u Hrvatskoj. 
                Sustav će automatski učitati ulogu, identificirati školu ili fakultet i dodijeliti točne ovlasti.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {INITIAL_USERS.map(user => {
                  const badge = getRoleBadge(user.role);
                  return (
                    <button
                      key={user.id}
                      onClick={() => handleTestLogin(user)}
                      className="flex flex-col text-left p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/20 border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all cursor-pointer group"
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
