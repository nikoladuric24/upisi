/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from '../types';
import { INITIAL_USERS } from '../data/mockData';
import { Shield, BookOpen, GraduationCap, Key, ArrowRight, Hash, Phone, MessageSquare, X } from 'lucide-react';
import { usePortal } from './PortalContext';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

type ActivationState = {
  token: string;
  email: string;
  message: string;
} | null;

const COUNTRIES = [
  { label: 'Hrvatska', code: '+385' },
  { label: 'Bosna i Hercegovina', code: '+387' },
  { label: 'Slovenija', code: '+386' },
  { label: 'Srbija', code: '+381' },
  { label: 'Crna Gora', code: '+382' },
  { label: 'Ostalo', code: '+' }
];

function normalizeEmailInput(value: string): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  return raw.includes('@') ? raw : `${raw}@skolehr.xyz`;
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showTestAccounts, setShowTestAccounts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activation, setActivation] = useState<ActivationState>(null);
  const [countryCode, setCountryCode] = useState('+385');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showResendHelp, setShowResendHelp] = useState(false);

  const { config, portalType, setPortalTypeOverride, isDevMode } = usePortal();
  const smsNumber = (import.meta as any).env?.VITE_ADMISSIONS_SMS_NUMBER || '(broj mobitela s kojeg se salje PIN)';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Molimo unesite korisnicko ime ili e-mail adresu.');
      return;
    }

    if (!password) {
      setError('Molimo unesite lozinku.');
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
        body: JSON.stringify({
          email: normalizeEmailInput(email),
          password,
          pin,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        setError(data.error || 'Prijava nije uspjela.');
        setLoading(false);
        return;
      }

      if (data.requiresPinSetup && data.activationToken) {
        setActivation({
          token: data.activationToken,
          email: normalizeEmailInput(email),
          message: data.message || 'Unesite broj mobitela za slanje PIN-a.'
        });
        setLoading(false);
        return;
      }

      onLogin(data.user);
    } catch {
      setError('Pogreska prilikom povezivanja s posluziteljem.');
      setLoading(false);
    }
  };

  const handleSendPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activation) return;

    if (!phoneNumber.trim()) {
      setError('Unesite broj mobitela.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/shared/auth/request-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activationToken: activation.token,
          countryCode,
          phoneNumber
        })
      });

      const data = await response.json();
      if (!response.ok || data.success === false) {
        setError(data.error || 'Slanje PIN-a nije uspjelo.');
        setLoading(false);
        return;
      }

      setActivation(null);
      setPin('');
      setPhoneNumber('');
      setError(data.message || 'PIN je poslan SMS porukom. Sada se prijavite s korisnickim imenom, lozinkom i PIN-om.');
    } catch {
      setError('Pogreska prilikom slanja PIN-a.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestLogin = async (user: User) => {
    setEmail(user.email);
    setPin('1234');
    setPassword('123456');
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/shared/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: user.email, password: '123456', pin: '1234' }),
      });

      const data = await response.json();
      if (!response.ok || data.success === false) {
        setError(data.error || 'Prijava nije uspjela.');
        setLoading(false);
        return;
      }

      setTimeout(() => {
        onLogin(data.user);
      }, 300);
    } catch {
      setError('Pogreska prilikom povezivanja s posluziteljem.');
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { label: 'Super Admin', bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
      case 'PRIMARY_ADMIN':
        return { label: 'Admin OS', bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' };
      case 'SECONDARY_ADMIN':
        return { label: 'Admin SS', bg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' };
      case 'PRIMARY_HOMEROOM_TEACHER':
        return { label: 'Razrednik OS', bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' };
      case 'SECONDARY_HOMEROOM_TEACHER':
        return { label: 'Razrednik SS', bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' };
      case 'PRIMARY_STUDENT':
        return { label: 'Ucenik OS', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' };
      case 'SECONDARY_STUDENT':
        return { label: 'Ucenik SS', bg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' };
      case 'UNIVERSITY_ADMIN':
        return { label: 'Visoko uciliste', bg: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' };
      default:
        return { label: role, bg: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' };
    }
  };

  const filteredUsers = INITIAL_USERS.filter(u => config.allowedRoles.includes(u.role));

  const brandGradient = config.portalType === 'FACULTY_ADMISSIONS'
    ? 'from-indigo-700 to-indigo-900 dark:from-indigo-950 dark:to-slate-900'
    : 'from-emerald-700 to-emerald-900 dark:from-emerald-950 dark:to-slate-900';

  const buttonColor = config.portalType === 'FACULTY_ADMISSIONS'
    ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10 hover:shadow-indigo-600/20'
    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10 hover:shadow-emerald-600/20';

  const resendText = portalType === 'FACULTY_ADMISSIONS'
    ? `Za ponovno izdavanje korisnickih podataka (PIN-a, TAN-a, a za osobe s elektronickim identitetom @nispvu.hr i korisnicke oznake i lozinke) potrebno je s broja mobilnoga telefona zavedenoga u sustavu poslati SMS poruku sadrzaja OPET:\n\n• iz RH na broj ${smsNumber}\n• iz BiH na broj ${smsNumber}\n• kandidati iz ostalih zemalja moraju se javiti Sredisnjemu prijavnom uredu.`
    : `Za ponovno izdavanje korisnickih podataka (PIN-a) potrebno je s broja mobilnoga telefona zavedenoga u sustavu poslati SMS poruku sadrzaja OPET:\n\n• iz RH na broj ${smsNumber}\n• iz BiH na broj ${smsNumber}\n• kandidati iz ostalih zemalja moraju se javiti Sredisnjemu prijavnom uredu.`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-300">
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
              Postani student
            </button>
            <button
              onClick={() => setPortalTypeOverride('SECONDARY_ADMISSIONS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                portalType === 'SECONDARY_ADMISSIONS'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              e-Srednje
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
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
                {config.description}. Pristup zasticenim dijelovima sustava zahtijeva AAI@EduHr prijavu.
              </p>
            </div>
          </div>

          <div className="relative mt-auto border-t border-white/10 pt-6 space-y-4">
            <div className="flex items-center gap-3 text-xs text-white/70">
              <div className="p-1 bg-amber-400/20 text-amber-400 rounded-md">
                <Shield className="h-4 w-4" />
              </div>
              <span>Sustav podlijeze NIAS i CARNET sigurnosnim standardima</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-7 flex flex-col gap-6">
          <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 flex-1 flex flex-col justify-center">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {activation ? 'Aktivacija pristupa' : 'Pristup portalu'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                {activation
                  ? 'Unesite broj mobitela na koji cemo poslati trajni cetveroznamenkasti PIN.'
                  : 'Prijavite se korisnickim imenom, lozinkom i PIN-om.'}
              </p>
            </div>

            {error && (
              <div className={`p-3 mb-4 border text-sm rounded-xl ${
                error.includes('poslan')
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400'
                  : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400'
              }`}>
                {error}
              </div>
            )}

            {activation ? (
              <form onSubmit={handleSendPin} className="space-y-4">
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-600 dark:text-slate-300">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">{activation.email}</div>
                  <div className="text-xs mt-1">{activation.message}</div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                    Drzava
                  </label>
                  <select
                    value={countryCode}
                    onChange={e => setCountryCode(e.target.value)}
                    disabled={loading}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                  >
                    {COUNTRIES.map(country => (
                      <option key={country.code} value={country.code}>
                        {country.label} ({country.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                    Broj mobitela
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3.5 text-slate-400">
                      <Phone className="h-5 w-5" />
                    </span>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value.replace(/[^\d\s-]/g, ''))}
                      placeholder="915828966"
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
                  {loading ? 'Slanje...' : 'Dalje'} <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActivation(null);
                    setError('');
                  }}
                  disabled={loading}
                  className="w-full text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Povratak na prijavu
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                    Korisnicko ime / e-mail
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3.5 text-slate-400">
                      <BookOpen className="h-5 w-5" />
                    </span>
                    <input
                      type="text"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="ime.prezime"
                      disabled={loading}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                    Lozinka
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3.5 text-slate-400">
                      <Key className="h-5 w-5" />
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Lozinka iz e-Dnevnika ili kod iz autentifikatora"
                      disabled={loading}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Ucenici unose e-Dnevnik lozinku. Djelatnici unose kod iz autentifikatora.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                    PIN
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3.5 text-slate-400">
                      <Hash className="h-5 w-5" />
                    </span>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={pin}
                      onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="Prva prijava ucenika: ostavite prazno"
                      disabled={loading}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Ucenici unose SMS PIN nakon aktivacije. Djelatnici unose interni PIN.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full mt-2 py-3.5 px-6 text-white font-semibold rounded-2xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${buttonColor}`}
                >
                  {loading ? 'Povezivanje...' : 'Prijavi se u sustav'} <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowResendHelp(true)}
                  className="w-full text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Zelim da mi se ponovno posalju korisnicki podaci
                </button>
              </form>
            )}
          </div>

          {showTestAccounts && isDevMode && (
            <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="h-4 w-4 text-indigo-500" />
                  Brzi testni pristup ({config.shortName.toUpperCase()})
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

      {showResendHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 p-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Ponovno izdavanje podataka</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{config.shortName}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowResendHelp(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {resendText}
              </p>
            </div>
            <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 p-5">
              <button
                type="button"
                onClick={() => setShowResendHelp(false)}
                className={`px-5 py-2.5 rounded-2xl text-sm font-semibold text-white ${buttonColor}`}
              >
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
