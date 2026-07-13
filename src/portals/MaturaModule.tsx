import React from 'react';
import { BookOpen, Plus, Printer, Download, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { ExamSubject, ExamPeriod, ExamRegistration, ExamResult, User } from '../types';
import { getTable, saveTable, logAuditEvent } from '../lib/storage';
import { WorkflowService } from '../lib/workflow';
import { useRbac } from '../components/RbacContext';

interface MaturaModuleProps {
  currentUser: User;
  currentStudent: any; // Using any for simplicity as in original
  examSubjects: ExamSubject[];
  examPeriods: ExamPeriod[];
  examRegistrations: ExamRegistration[];
  setExamRegistrations: (regs: ExamRegistration[]) => void;
  examResults: ExamResult[];
}

export function MaturaModule({
  currentUser,
  currentStudent,
  examSubjects,
  examPeriods,
  examRegistrations,
  setExamRegistrations,
  examResults
}: MaturaModuleProps) {
  const { logRbacAction } = useRbac();
  const [selectedSubjectId, setSelectedSubjectId] = React.useState('');
  const [selectedLevel, setSelectedLevel] = React.useState<'A' | 'B'>('A');
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);
  const [pdfReady, setPdfReady] = React.useState(false);

  const studentRegs = examRegistrations.filter(r => r.studentId === currentStudent.id && r.status === 'REGISTERED');

  const handleRegisterExam = () => {
    if (!selectedSubjectId) return;
    const isElective = examSubjects.find(s => s.id === selectedSubjectId)?.isElective;
    const levelToSearch = isElective ? 'N/A' : selectedLevel;
    const period = examPeriods.find(p => p.subjectId === selectedSubjectId && p.level === levelToSearch);

    if (!period) {
      alert('Za odabrani predmet i razinu nije pronađen ispitni termin.');
      return;
    }

    if (studentRegs.some(r => r.examPeriodId === period.id)) {
      alert('Ovaj ispit je već prijavljen.');
      return;
    }

    const newReg: ExamRegistration = {
      id: `reg-${Date.now()}`,
      studentId: currentStudent.id,
      examPeriodId: period.id,
      registeredAt: new Date().toISOString(),
      status: 'REGISTERED'
    };

    const updated = [...examRegistrations, newReg];
    setExamRegistrations(updated);
    saveTable('exam_registrations', updated);
    logAuditEvent(currentUser.id, currentUser.email, 'PRIJAVA_MATURE', `Prijavljen ispit mature: ${examSubjects.find(s => s.id === selectedSubjectId)?.name} (${levelToSearch})`);
    logRbacAction('PRIJAVA_MATURE', 'ExamRegistration', undefined, selectedSubjectId);
  };

  const handleCancelExam = (regId: string) => {
    const result = WorkflowService.executeExamTransition(
      regId,
      'NIJE PRIJAVLJEN',
      currentUser.id,
      currentUser.email,
      { deadlinePassed: false, hasValidGrades: true },
      'Učenik je odjavio ispit državne mature.'
    );

    if (result.success) {
      setExamRegistrations(getTable<ExamRegistration>('exam_registrations'));
      logRbacAction('ODJAVA_MATURE', 'ExamRegistration', regId, undefined);
    } else {
      alert(`Sustavno pravilo sprječava odjavu ispita mature: ${result.error}`);
    }
  };

  const handleChangeExamLevel = (regId: string, newLevel: 'A' | 'B') => {
    const reg = examRegistrations.find(r => r.id === regId);
    if (!reg) return;

    const currentPeriod = examPeriods.find(p => p.id === reg.examPeriodId);
    if (!currentPeriod) return;

    const targetPeriod = examPeriods.find(p => p.subjectId === currentPeriod.subjectId && p.level === newLevel);
    if (!targetPeriod) {
      alert('Nova razina ispita nije dostupna.');
      return;
    }

    const updated = examRegistrations.map(r => r.id === regId ? { ...r, examPeriodId: targetPeriod.id } : r);
    setExamRegistrations(updated);
    saveTable('exam_registrations', updated);
    const sub = examSubjects.find(s => s.id === currentPeriod.subjectId);
    logAuditEvent(currentUser.id, currentUser.email, 'PROMJENA_RAZINE_MATURE', `Promijenjena razina za ${sub?.name} na ${newLevel}`);
    logRbacAction('PROMJENA_RAZINE_MATURE', 'ExamRegistration', regId, newLevel);
  };

  const triggerPdfExport = () => {
    setIsGeneratingPdf(true);
    setPdfReady(false);
    setTimeout(() => {
      setIsGeneratingPdf(false);
      setPdfReady(true);
      logAuditEvent(currentUser.id, currentUser.email, 'PDF_EX_MATURA', 'Izvezen službeni ispis prijavljenih ispita i ocjena državne mature.');
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
        <h3 className="font-extrabold text-xs uppercase text-indigo-600 tracking-wider flex items-center gap-1.5">
          <BookOpen className="h-4 w-4" /> Prijava novog ispita državne mature
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Predmet mature</label>
            <select
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value)}
              className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100"
            >
              <option value="">Odaberi predmet...</option>
              {examSubjects.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name} {sub.isElective ? '(Izborni)' : '(Obvezni)'}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Razina ispita</label>
            <select
              value={selectedLevel}
              onChange={e => setSelectedLevel(e.target.value as any)}
              disabled={examSubjects.find(s => s.id === selectedSubjectId)?.isElective}
              className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 disabled:opacity-50"
            >
              <option value="A">Viša razina (A)</option>
              <option value="B">Osnovna razina (B)</option>
            </select>
          </div>

          <button
            onClick={handleRegisterExam}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Prijavi ispit
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="font-extrabold text-xs uppercase text-slate-400 tracking-wider">Moje prijave i postignuti rezultati</h4>
          <button
            onClick={triggerPdfExport}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[11px] font-bold flex items-center gap-1.5 hover:bg-slate-200 transition-all cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" /> Generiraj službenu potvrdu (PDF)
          </button>
        </div>

        {isGeneratingPdf && (
          <div className="p-4 bg-indigo-50 border border-indigo-150 text-indigo-800 text-xs rounded-xl animate-pulse">
            Kompajliranje podataka i generiranje službenog PDF ispisa državne mature s QR kodom...
          </div>
        )}

        {pdfReady && !isGeneratingPdf && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 text-xs rounded-xl flex justify-between items-center">
            <span>Službena potvrda o položenim ispitima državne mature je spremna za preuzimanje.</span>
            <a href="#" className="font-bold underline flex items-center gap-1"><Download className="h-3.5 w-3.5" /> Preuzmi potvrdu</a>
          </div>
        )}

        <div className="space-y-2">
          {studentRegs.map(reg => {
            const period = examPeriods.find(p => p.id === reg.examPeriodId);
            const subject = examSubjects.find(s => s.id === period?.subjectId);
            const result = examResults.find(r => r.examPeriodId === period?.id);

            return (
              <div key={reg.id} className="p-4 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs text-slate-800 dark:text-slate-100">{subject?.name}</span>
                    <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded-sm ${
                      period?.level === 'A' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 text-amber-400' :
                      period?.level === 'B' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 text-blue-400' :
                      'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      Razina: {period?.level}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Termin ispita: {period?.date} u {period?.time} sati</p>
                </div>

                <div className="flex items-center gap-4">
                  {result ? (
                    <div className="text-right">
                      <span className="text-[10px] text-emerald-600 font-bold block">Položeno (Ocjena: {result.grade})</span>
                      <span className="font-black text-sm text-slate-800 dark:text-slate-100">{result.scorePercentage}% | {result.pointsEarned} bodova</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {!subject?.isElective && (
                        <button
                          onClick={() => handleChangeExamLevel(reg.id, period?.level === 'A' ? 'B' : 'A')}
                          className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] text-indigo-600 dark:text-indigo-400 font-bold rounded-lg cursor-pointer"
                        >
                          Promijeni u {period?.level === 'A' ? 'B' : 'A'}
                        </button>
                      )}
                      <button
                        onClick={() => handleCancelExam(reg.id)}
                        className="px-2 py-1 bg-red-50 hover:bg-red-100 text-[10px] text-red-600 rounded-lg cursor-pointer"
                      >
                        Odjavi
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
