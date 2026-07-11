/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, Lock, Bell, Moon, Sun, Shield, FileText, CheckCircle, Smartphone } from 'lucide-react';
import { useTheme } from './ThemeContext';
import { User as UserType, AppDocument } from '../types';
import { getTable, logAuditEvent } from '../lib/storage';

interface ProfileViewProps {
  currentUser: UserType;
}

export function ProfileView({ currentUser }: ProfileViewProps) {
  const { theme, toggleTheme } = useTheme();
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [passError, setPassError] = useState('');

  // Notifications state
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(false);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [deadlineReminders, setDeadlineReminders] = useState(true);
  const [notifSuccess, setNotifSuccess] = useState(false);

  // Loaded documents & applications
  const documents = getTable<AppDocument>('documents').filter(d => d.userId === currentUser.id);

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPassSuccess('');
    setPassError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPassError('Sva polja su obavezna.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError('Nova lozinka i potvrda se ne podudaraju.');
      return;
    }

    if (newPassword.length < 6) {
      setPassError('Nova lozinka mora imati najmanje 6 znakova.');
      return;
    }

    // Success simulation
    setPassSuccess('Lozinka je uspješno promijenjena u nacionalnom NIAS sustavu.');
    logAuditEvent(currentUser.id, currentUser.email, 'PROMJENA_LOZINKE', 'Korisnik je uspješno ažurirao svoju lozinku.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSaveNotifications = () => {
    setNotifSuccess(true);
    logAuditEvent(currentUser.id, currentUser.email, 'POSTAVKE_OBAVIJESTI', 'Ažurirane postavke kanala obavještavanja.');
    setTimeout(() => setNotifSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      
      {/* Dynamic profile header card */}
      <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl flex flex-col sm:flex-row items-center gap-4">
        <div className="h-16 w-16 bg-indigo-600 text-white dark:bg-indigo-950/40 dark:text-indigo-400 rounded-full flex items-center justify-center font-black text-lg shadow-md">
          {currentUser.fullName.split(' ').map(n => n[0]).join('')}
        </div>
        <div className="space-y-1 text-center sm:text-left flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">{currentUser.fullName}</h3>
            <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-[9px] font-black uppercase tracking-wider rounded-md self-center">
              {currentUser.role}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono">{currentUser.email}</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1">
            <CheckCircle className="h-4 w-4" /> NIAS Vjerodostojnica
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Profile Settings Left Column */}
        <div className="space-y-6">
          
          {/* Change Password Form */}
          <form onSubmit={handlePasswordChange} className="p-6 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-3xl space-y-4">
            <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Lock className="h-4.5 w-4.5 text-indigo-500" /> Promjena lozinke
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">Sigurnost Vašeg računa povezana je s CARNET / NIAS protokolima. Lozinka mora sadržavati slova i brojke.</p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Trenutna lozinka</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Nova lozinka</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Potvrdite lozinku</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => confirmPassword ? setConfirmPassword(e.target.value) : setConfirmPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs"
                />
              </div>
            </div>

            {passSuccess && <p className="text-[11px] font-bold text-emerald-600">{passSuccess}</p>}
            {passError && <p className="text-[11px] font-bold text-rose-500">{passError}</p>}

            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Spremi izmjene lozinke
            </button>
          </form>

          {/* Theme customizer */}
          <div className="p-6 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-3xl space-y-4">
            <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Sun className="h-4.5 w-4.5 text-indigo-500" /> Izbor vizualne teme
            </h4>
            <p className="text-[11px] text-slate-400">Prilagodite izgled sučelja. Sustav podržava automatsko usklađivanje s operativnim sustavom.</p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={toggleTheme}
                className={`p-4 border rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                  theme === 'light'
                    ? 'border-indigo-600 bg-indigo-50/20 text-indigo-600'
                    : 'border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <Sun className="h-5 w-5" />
                <span className="text-xs font-bold">Svijetla tema</span>
              </button>

              <button
                onClick={toggleTheme}
                className={`p-4 border rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                  theme === 'dark'
                    ? 'border-indigo-600 bg-indigo-50/20 text-indigo-400'
                    : 'border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <Moon className="h-5 w-5" />
                <span className="text-xs font-bold">Tamna tema</span>
              </button>
            </div>
          </div>
        </div>

        {/* Profile Settings Right Column */}
        <div className="space-y-6">
          
          {/* Notifications config */}
          <div className="p-6 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-3xl space-y-4">
            <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Bell className="h-4.5 w-4.5 text-indigo-500" /> Postavke nacionalnih obavijesti
            </h4>
            <p className="text-[11px] text-slate-400">Označite kanale preko kojih želite primati važne obavijesti o rokovima, upisima i prigovorima.</p>

            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3 justify-between">
                <div>
                  <span className="text-xs font-bold block text-slate-700 dark:text-slate-200">E-mail obavijesti</span>
                  <p className="text-[10px] text-slate-400">Slanje službenih odluka i prigovora na e-adresu.</p>
                </div>
                <input
                  type="checkbox"
                  checked={emailNotifs}
                  onChange={e => setEmailNotifs(e.target.checked)}
                  className="accent-indigo-600 h-4 w-4"
                />
              </div>

              <div className="flex items-start gap-3 justify-between pt-3 border-t border-slate-50 dark:border-slate-800/40">
                <div>
                  <span className="text-xs font-bold block text-slate-700 dark:text-slate-200">SMS Obavijesti (CARNET)</span>
                  <p className="text-[10px] text-slate-400">Primanje hitnih obavijesti na mobilni telefon kod promjena na listi prioriteta.</p>
                </div>
                <input
                  type="checkbox"
                  checked={smsNotifs}
                  onChange={e => setSmsNotifs(e.target.checked)}
                  className="accent-indigo-600 h-4 w-4"
                />
              </div>

              <div className="flex items-start gap-3 justify-between pt-3 border-t border-slate-50 dark:border-slate-800/40">
                <div>
                  <span className="text-xs font-bold block text-slate-700 dark:text-slate-200">Push obavijesti u pregledniku</span>
                  <p className="text-[10px] text-slate-400">Instant obavijesti unutar portala e-Upisi.</p>
                </div>
                <input
                  type="checkbox"
                  checked={pushNotifs}
                  onChange={e => setPushNotifs(e.target.checked)}
                  className="accent-indigo-600 h-4 w-4"
                />
              </div>

              <div className="flex items-start gap-3 justify-between pt-3 border-t border-slate-50 dark:border-slate-800/40">
                <div>
                  <span className="text-xs font-bold block text-slate-700 dark:text-slate-200">Podsjetnici na rokove</span>
                  <p className="text-[10px] text-slate-400">Slanje upozorenja 48 sati prije zaključavanja lista.</p>
                </div>
                <input
                  type="checkbox"
                  checked={deadlineReminders}
                  onChange={e => setDeadlineReminders(e.target.checked)}
                  className="accent-indigo-600 h-4 w-4"
                />
              </div>
            </div>

            {notifSuccess && (
              <p className="text-[11px] font-bold text-emerald-600">Sve postavke obavijesti su uspješno ažurirane.</p>
            )}

            <button
              onClick={handleSaveNotifications}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Spremi postavke obavijesti
            </button>
          </div>

          {/* Uploaded Documents List summary */}
          <div className="p-6 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-3xl space-y-4">
            <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-indigo-500" /> Moji predani dokumenti
            </h4>
            <p className="text-[11px] text-slate-400">Prikaz svih potvrda i diploma koje ste priložili u sustav.</p>

            {documents.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Niste priložili nijedan dokument.</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold">{doc.name}</p>
                      <span className="text-[9px] text-slate-400 uppercase">{doc.purpose}</span>
                    </div>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-sm ${
                      doc.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                    }`}>
                      {doc.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
