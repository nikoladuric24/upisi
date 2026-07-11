/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { X, Calendar, User, FileText, School, GraduationCap, Award, HelpCircle, Lock, Unlock, Download, ShieldCheck } from 'lucide-react';
import { getTable } from '../lib/storage';
import { AuditLog } from '../types';

interface DetailViewModalProps {
  type: 'student' | 'teacher' | 'school' | 'faculty' | 'program' | 'document' | null;
  id: string | null;
  itemData?: any; // fallback/cached object
  onClose: () => void;
}

export function DetailViewModal({ type, id, itemData, onClose }: DetailViewModalProps) {
  if (!type || !id) return null;

  // Let's retrieve from local tables if possible, otherwise use itemData
  let data = itemData;
  const auditLogs = getTable<AuditLog>('audit_logs').filter(
    log => log.details?.includes(id) || log.action.includes(id)
  );

  if (type === 'student') {
    const students = getTable<any>('students');
    const users = getTable<any>('users');
    const match = students.find((s: any) => s.id === id);
    if (match) {
      const user = users.find((u: any) => u.id === match.userId);
      data = { ...match, fullName: user?.fullName, email: user?.email };
    }
  } else if (type === 'school') {
    const schools = getTable<any>('schools');
    const match = schools.find((s: any) => s.id === id);
    if (match) data = match;
  } else if (type === 'document') {
    const docs = getTable<any>('documents');
    const match = docs.find((d: any) => d.id === id);
    if (match) data = match;
  }

  const renderContent = () => {
    switch (type) {
      case 'student':
        return (
          <div className="space-y-5 text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="h-12 w-12 bg-indigo-100 dark:bg-indigo-950/40 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">
                {data?.fullName?.split(' ').map((n: string) => n[0]).join('') || 'UC'}
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{data?.fullName || 'Ime Kandidata'}</h4>
                <p className="text-[10px] text-slate-400">OIB: {data?.oib || '12345678901'} • ID: {id}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Datum rođenja</span>
                <span className="font-semibold">{data?.dateOfBirth || '2008-01-01'}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">E-mail adresa</span>
                <span className="font-mono text-[11px] truncate block">{data?.email || 'kandidat@e-upisi.hr'}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Razred / Odjeljenje</span>
                <span className="font-semibold">{data?.classId || '8.A'}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Zdravstvene poteškoće</span>
                <span className="font-semibold text-rose-500">{data?.healthConditions || 'Nema'}</span>
              </div>
            </div>

            {/* School Grade metrics */}
            <div className="space-y-2">
              <h5 className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Prosjek ocjena po razredima</h5>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-slate-50 dark:bg-slate-800/20 p-2.5 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <p className="text-[9px] text-slate-400 uppercase font-bold">5. razred</p>
                  <p className="font-mono font-bold text-slate-800 dark:text-slate-100 mt-1">{data?.gradeAverage5?.toFixed(2) || '5.00'}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/20 p-2.5 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <p className="text-[9px] text-slate-400 uppercase font-bold">6. razred</p>
                  <p className="font-mono font-bold text-slate-800 dark:text-slate-100 mt-1">{data?.gradeAverage6?.toFixed(2) || '5.00'}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/20 p-2.5 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <p className="text-[9px] text-slate-400 uppercase font-bold">7. razred</p>
                  <p className="font-mono font-bold text-slate-800 dark:text-slate-100 mt-1">{data?.gradeAverage7?.toFixed(2) || '5.00'}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/20 p-2.5 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <p className="text-[9px] text-slate-400 uppercase font-bold">8. razred</p>
                  <p className="font-mono font-bold text-slate-800 dark:text-slate-100 mt-1">{data?.gradeAverage8?.toFixed(2) || '5.00'}</p>
                </div>
              </div>
            </div>

            {/* Additional points */}
            <div className="p-4 bg-amber-500/5 dark:bg-amber-400/5 border border-amber-500/10 dark:border-amber-400/10 rounded-2xl flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Dodatni bodovi i natjecanja</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{data?.socialPointsReason || 'Nema upisanih dodatnih bodova s natjecanja.'}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-black text-amber-600 dark:text-amber-400">+{data?.competitionsPoints || 0}b</span>
              </div>
            </div>
          </div>
        );

      case 'school':
        return (
          <div className="space-y-4 text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="h-12 w-12 bg-emerald-100 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <School className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{data?.name || 'Naziv ustanove'}</h4>
                <p className="text-[10px] text-slate-400">OIB: {data?.oib || 'N/A'} • Tip: {data?.type || 'SREDNJA'}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">MZO Šifra</span>
                  <span className="font-semibold font-mono">{data?.mzoCode || 'N/A'}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Grad</span>
                  <span className="font-semibold">{data?.cityId === 'city-1' ? 'Zagreb' : 'Split'}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Adresa</span>
                  <span className="font-semibold">{data?.address || 'N/A'}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Status sustava</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">AKTIVAN</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'document':
        return (
          <div className="space-y-4 text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="h-12 w-12 bg-rose-100 dark:bg-rose-950/40 rounded-2xl flex items-center justify-center text-rose-600 dark:text-rose-400">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{data?.name || 'Dokument'}</h4>
                <p className="text-[10px] text-slate-400">ID: {id} • Svrha: {data?.purpose}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Veličina datoteke</span>
                <span className="font-semibold font-mono">{data?.fileSize || '1.1 MB'}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Tip datoteke</span>
                <span className="font-semibold font-mono">{data?.fileType || 'application/pdf'}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Verificiran</span>
                <span className={`font-semibold ${data?.status === 'VERIFIED' || data?.status === 'ODOBREN' ? 'text-emerald-600' : 'text-amber-500'}`}>
                  {data?.status || 'ČEKA VERIFIKACIJU'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Datum predaje</span>
                <span className="font-semibold">{data?.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'Danas'}</span>
              </div>
            </div>

            {/* Simulating Document Download */}
            <button
              onClick={() => {
                alert(`Preuzimanje datoteke ${data?.name || 'Dokument'} uspješno simulirano.`);
              }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5"
            >
              <Download className="h-4 w-4" /> Preuzmi izvornu PDF datoteku
            </button>
          </div>
        );

      case 'program':
        return (
          <div className="space-y-4 text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="h-12 w-12 bg-amber-100 dark:bg-amber-950/40 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{data?.name || 'Program'}</h4>
                <p className="text-[10px] text-slate-400">ID: {id} • Slobodna upisna kvota</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Kapacitet (Kvota)</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400">{data?.quota || 100} kandidata</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Prošlogodišnji prag</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400">{data?.minPointsThreshold || data?.prevYearThreshold || 75.0} bodova</span>
              </div>
            </div>
          </div>
        );

      default:
        return <p className="text-xs text-slate-400">Nema specifikacije prikaza za ovu vrstu entiteta.</p>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex justify-end transition-all animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-950 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col">
        
        {/* Header drawer */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
          <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Nacionalni Službeni Preglednik
          </span>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {renderContent()}

          {/* Connected Audit logs / History */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h5 className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Povijest sustavnih promjena (Audit)
            </h5>
            {auditLogs.length === 0 ? (
              <p className="text-[10px] text-slate-400 italic">Nema zabilježenih transakcijskih promjena za ovaj entitet.</p>
            ) : (
              <div className="relative border-l border-slate-100 dark:border-slate-800 pl-4 ml-2 space-y-3 py-1">
                {auditLogs.slice(0, 3).map((log) => (
                  <div key={log.id} className="relative text-[11px] leading-relaxed">
                    <div className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-950" />
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block">{log.action}</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">{log.userEmail} • {new Date(log.createdAt).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 text-center flex justify-between items-center">
          <span>Klasifikacija: Službeno</span>
          <span>EduPortal Hrvatska © 2026</span>
        </div>
      </div>
    </div>
  );
}
