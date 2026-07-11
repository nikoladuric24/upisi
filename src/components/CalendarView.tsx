/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Info, AlertTriangle, ShieldCheck } from 'lucide-react';
import { getTable } from '../lib/storage';
import { AppDeadline } from '../types';

export function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState('Lipanj 2026');
  const [selectedEvent, setSelectedEvent] = useState<AppDeadline | null>(() => {
    const deadlines = getTable<AppDeadline>('deadlines');
    return deadlines[0] || null;
  });

  const deadlines = getTable<AppDeadline>('deadlines');

  // Static mock calendar dates for June 2026 (starts on Monday)
  const juneDays = [
    { day: 1, isCurrentMonth: true, events: [] as AppDeadline[] },
    { day: 2, isCurrentMonth: true, events: [] },
    { day: 3, isCurrentMonth: true, events: [] },
    { day: 4, isCurrentMonth: true, events: [] },
    { day: 5, isCurrentMonth: true, events: [] },
    { day: 6, isCurrentMonth: true, events: [] },
    { day: 7, isCurrentMonth: true, events: [] },
    { day: 8, isCurrentMonth: true, events: [] },
    { day: 9, isCurrentMonth: true, events: [] },
    { day: 10, isCurrentMonth: true, events: [] },
    { day: 11, isCurrentMonth: true, events: [] },
    { day: 12, isCurrentMonth: true, events: [] },
    { day: 13, isCurrentMonth: true, events: [] },
    { day: 14, isCurrentMonth: true, events: [] },
    { day: 15, isCurrentMonth: true, events: [deadlines.find(d => d.type === 'SCHOOL_APPLICATIONS')].filter(Boolean) as AppDeadline[] },
    { day: 16, isCurrentMonth: true, events: [] },
    { day: 17, isCurrentMonth: true, events: [] },
    { day: 18, isCurrentMonth: true, events: [] },
    { day: 19, isCurrentMonth: true, events: [] },
    { day: 20, isCurrentMonth: true, events: [deadlines.find(d => d.type === 'UNIVERSITY_APPLICATIONS')].filter(Boolean) as AppDeadline[] },
    { day: 21, isCurrentMonth: true, events: [] },
    { day: 22, isCurrentMonth: true, events: [] },
    { day: 23, isCurrentMonth: true, events: [] },
    { day: 24, isCurrentMonth: true, events: [] },
    { day: 25, isCurrentMonth: true, events: [] },
    { day: 26, isCurrentMonth: true, events: [] },
    { day: 27, isCurrentMonth: true, events: [] },
    { day: 28, isCurrentMonth: true, events: [] },
    { day: 29, isCurrentMonth: true, events: [] },
    { day: 30, isCurrentMonth: true, events: [] },
    { day: 1, isCurrentMonth: false, events: [] },
    { day: 2, isCurrentMonth: false, events: [] },
    { day: 3, isCurrentMonth: false, events: [] },
    { day: 4, isCurrentMonth: false, events: [] },
    { day: 5, isCurrentMonth: false, events: [] }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Nacionalni kalendar e-Upisa & Rokovi
          </h3>
          <p className="text-xs text-slate-400">Službeni vremenski rokovi i hodogram aktivnosti propisani od strane Ministarstva znanosti i obrazovanja.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Calendar Grid - 8 cols */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
          
          {/* Calendar Controller */}
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{currentMonth}</h4>
            <div className="flex gap-1">
              <button className="p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:bg-slate-100 rounded-xl cursor-pointer">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button className="p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:bg-slate-100 rounded-xl cursor-pointer">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Days of the week header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-slate-400 tracking-wider">
            <span>Pon</span>
            <span>Uto</span>
            <span>Sri</span>
            <span>Čet</span>
            <span>Pet</span>
            <span>Sub</span>
            <span>Ned</span>
          </div>

          {/* Calendar Matrix */}
          <div className="grid grid-cols-7 gap-1">
            {juneDays.map((cell, idx) => {
              const hasEvents = cell.events.length > 0;
              const isSelected = selectedEvent && cell.events.some(e => e.id === selectedEvent.id);
              
              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (hasEvents) {
                      setSelectedEvent(cell.events[0]);
                    }
                  }}
                  className={`min-h-[72px] p-2 border border-slate-100/50 dark:border-slate-800/40 rounded-2xl flex flex-col justify-between transition-all relative ${
                    cell.isCurrentMonth ? 'bg-white dark:bg-slate-950' : 'bg-slate-50/40 dark:bg-slate-900/10 text-slate-300 dark:text-slate-700'
                  } ${hasEvents ? 'cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/10' : ''} ${
                    isSelected ? 'ring-2 ring-indigo-500' : ''
                  }`}
                >
                  <span className="text-[11px] font-bold">{cell.day}</span>
                  
                  {hasEvents && (
                    <div className="space-y-1">
                      {cell.events.map((evt) => (
                        <div
                          key={evt.id}
                          className={`text-[8px] font-bold px-1 py-0.5 rounded-xs truncate leading-none ${
                            evt.type === 'SCHOOL_APPLICATIONS'
                              ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                              : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {evt.title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Event Detail Panel - 4 cols */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 space-y-4">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
              <ShieldCheck className="h-4 w-4" /> Detalji odabranog roka
            </span>

            {selectedEvent ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                    selectedEvent.type === 'SREDNJE'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  }`}>
                    {selectedEvent.type === 'SREDNJE' ? 'Srednje Škole' : 'Visoko Obrazovanje'}
                  </span>
                  <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{selectedEvent.title}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{selectedEvent.description}</p>
                </div>

                <div className="p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Datum isteka:</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{selectedEvent.date}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-50 dark:border-slate-800/50">
                    <span className="text-slate-400 flex items-center gap-1"><Info className="h-3.5 w-3.5 text-indigo-500" /> Preostalo:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">4 dana, 12 sati</span>
                  </div>
                </div>

                <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex gap-2 items-start text-[10px] text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">Sustav automatski zaključava izmjene točno u 23:59 sati navedenog datuma. Kasnije prijave ili promjene prioriteta neće biti uvažene.</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <CalendarIcon className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-xs">Kliknite na označeni datum u kalendaru za pregled detalja roka.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
