/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AlertCircle, Lock, ShieldAlert, FileQuestion, ServerCrash, HelpCircle, RefreshCw, ArrowLeft } from 'lucide-react';

interface ErrorPagesViewProps {
  onGoHome: () => void;
}

export function ErrorPagesView({ onGoHome }: ErrorPagesViewProps) {
  const [selectedError, setSelectedError] = useState<401 | 403 | 404 | 500 | 503>(404);

  const errors = {
    401: {
      title: '401 - Neautorizirani pristup',
      tag: 'Unauthorized',
      icon: <Lock className="h-12 w-12 text-amber-500" />,
      description: 'Sesija je istekla ili Vaš korisnički token nije ispravno prenesen s NIAS (e-Građani) sustava.',
      solution: 'Molimo Vas da ponovite prijavu na nacionalni portal e-upisa.'
    },
    403: {
      title: '403 - Pristup zabranjen',
      tag: 'Forbidden',
      icon: <ShieldAlert className="h-12 w-12 text-rose-500" />,
      description: 'Nemate potrebne ovlasti (RBAC permissions) za pregled ove stranice ili izmjenu ovog registra.',
      solution: 'Ukoliko smatrate da se radi o pogrešci, kontaktirajte školskog koordinatora ili MZO tehničku podršku.'
    },
    404: {
      title: '404 - Stranica nije pronađena',
      tag: 'Not Found',
      icon: <FileQuestion className="h-12 w-12 text-indigo-500" />,
      description: 'Tražena stranica ili upisna evidencija ne postoji na serveru.',
      solution: 'Provjerite upisanu URL adresu ili se vratite na početnu nadzornu ploču.'
    },
    500: {
      title: '500 - Interna greška servera',
      tag: 'Internal Server Error',
      icon: <ServerCrash className="h-12 w-12 text-rose-600" />,
      description: 'Došlo je do neočekivane pogreške na poslužitelju CARNET baze podataka.',
      solution: 'Pokrenuta je automatska dijagnostika sustava. Molimo Vas pokušajte ponovno za nekoliko trenutaka.'
    },
    503: {
      title: '503 - Usluga je privremeno nedostupna',
      tag: 'Service Unavailable',
      icon: <RefreshCw className="h-12 w-12 text-amber-600 animate-spin" />,
      description: 'Sustav je privremeno preopterećen zbog objave rezultata upisnog kruga ili se provodi održavanje.',
      solution: 'Sustav se automatski stabilizira. Molimo sačekajte i osvježite stranicu.'
    }
  };

  const active = errors[selectedError];

  return (
    <div className="space-y-6">
      
      {/* Selector banner */}
      <div className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-indigo-500" /> Simulator Grešaka (Playground)
          </h4>
          <p className="text-[10px] text-slate-400">Pregledajte kako se ponaša sustav kod različitih mrežnih ili autorizacijskih grešaka.</p>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(errors) as unknown as Array<401 | 403 | 404 | 500 | 503>).map((code) => (
            <button
              key={code}
              onClick={() => setSelectedError(code)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all border ${
                selectedError === code
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                  : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      </div>

      {/* Rendered Error Page */}
      <div className="p-8 sm:p-12 md:p-16 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-3xl shadow-xs text-center flex flex-col items-center justify-center space-y-6 animate-fade-in">
        
        {/* Visual Graphic Ring */}
        <div className="h-24 w-24 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center border-4 border-slate-100/50 dark:border-slate-800/50 shadow-inner relative">
          {active.icon}
          <div className="absolute -bottom-1 -right-1 px-2 py-0.5 bg-slate-800 text-white text-[9px] font-mono font-black rounded-full uppercase tracking-wider">
            {active.tag}
          </div>
        </div>

        {/* Text descriptions */}
        <div className="max-w-md space-y-3">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
            {active.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {active.description}
          </p>
          <div className="p-3 bg-indigo-50/50 dark:bg-slate-900 border border-indigo-100/30 dark:border-slate-800/80 rounded-xl text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            <span className="font-bold text-indigo-600 dark:text-indigo-400">Preporučeno rješenje:</span> {active.solution}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={() => {
              alert('Slanje tehničkog izvještaja simulirano. ID greške: ERR-' + Math.random().toString(36).substr(2, 9).toUpperCase());
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Prijavi grešku tehničkoj službi
          </button>
          
          <button
            onClick={onGoHome}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-indigo-500/10 flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Vrati se na početnu
          </button>
        </div>

        <div className="pt-6 border-t border-slate-100 dark:border-slate-900 w-full max-w-sm text-[10px] text-slate-400 flex justify-between items-center">
          <span>IP: 193.198.1.1</span>
          <span>Sustav: CARNET NIAS</span>
          <span>Vrijeme: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
