/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

interface TimeoutManagerProps {
  user: any;
  onLogout: () => void;
}

export function TimeoutManager({ user, onLogout }: TimeoutManagerProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(300);

  const lastActivityRef = useRef<number>(Date.now());
  const countdownTimerRef = useRef<any>(null);

  const resetActivity = () => {
    lastActivityRef.current = Date.now();
  };

  useEffect(() => {
    if (!user) return;

    window.addEventListener('mousemove', resetActivity);
    window.addEventListener('keydown', resetActivity);
    window.addEventListener('click', resetActivity);

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const fortyMinutesMs = 40 * 60 * 1000;
      const fortyFiveMinutesMs = 45 * 60 * 1000;

      if (elapsed >= fortyFiveMinutesMs) {
        clearInterval(interval);
        handleAutomaticLogout();
      } else if (elapsed >= fortyMinutesMs && !showWarning) {
        setShowWarning(true);
        const remaining = Math.max(0, Math.floor((fortyFiveMinutesMs - elapsed) / 1000));
        setSecondsRemaining(remaining);
      }
    }, 5000);

    return () => {
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('keydown', resetActivity);
      window.removeEventListener('click', resetActivity);
      clearInterval(interval);
    };
  }, [user, showWarning]);

  useEffect(() => {
    if (showWarning) {
      countdownTimerRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current);
            handleAutomaticLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    }

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [showWarning]);

  const handleAutomaticLogout = async () => {
    setShowWarning(false);
    try {
      await fetch('/api/shared/auth/logout', { method: 'POST' });
    } catch (e) {}
    onLogout();
  };

  const handleKeepAlive = async () => {
    try {
      const res = await fetch('/api/shared/auth/keep-alive', { method: 'POST' });
      if (res.ok) {
        setShowWarning(false);
        resetActivity();
      } else {
        handleAutomaticLogout();
      }
    } catch (err) {
      handleAutomaticLogout();
    }
  };

  if (!showWarning) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in">
      <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-w-md w-full text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-amber-50 dark:bg-amber-950/40 rounded-2xl flex items-center justify-center text-amber-500 animate-pulse">
          <Clock className="h-6 w-6" />
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Upozorenje o isteku sesije</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Zbog sigurnosti i zaštite osobnih podataka iz e-Matice, vaša sesija će automatski isteći za:
          </p>
        </div>

        <div className="py-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <span className="text-4xl font-extrabold font-mono text-amber-600 dark:text-amber-500 tracking-tight animate-pulse">
            {timeFormatted}
          </span>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={handleAutomaticLogout}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Odjavi se odmah
          </button>
          <button
            onClick={handleKeepAlive}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
          >
            Nastavi s radom
          </button>
        </div>
      </div>
    </div>
  );
}
