import React from 'react';
import { BookOpen, Plus, Printer, Download, Trash2, ShieldAlert, CheckCircle, RefreshCw, AlertCircle, Info, Calendar, Clock, GraduationCap } from 'lucide-react';
import { ExamSubject, ExamPeriod, ExamRegistration, ExamResult, User } from '../types';
import { getTable, saveTable, logAuditEvent } from '../lib/storage';
import { useRbac } from '../components/RbacContext';

interface MaturaModuleProps {
  currentUser: User;
  currentStudent: any;
  examSubjects: ExamSubject[];
  examPeriods: ExamPeriod[];
  examRegistrations: ExamRegistration[];
  setExamRegistrations: (regs: ExamRegistration[]) => void;
  examResults: ExamResult[];
  setExamResults?: (res: ExamResult[]) => void;
}

export function MaturaModule({
  currentUser,
  currentStudent,
  examSubjects,
  examPeriods,
  examRegistrations,
  setExamRegistrations,
  examResults,
  setExamResults
}: MaturaModuleProps) {
  const { logRbacAction } = useRbac();

  // State loaded from e-Matica integration API
  const [availableMandatory, setAvailableMandatory] = React.useState<any[]>([]);
  const [availableElective, setAvailableElective] = React.useState<any[]>([]);
  const [eligibility, setEligibility] = React.useState<any | null>(null);
  const [backendRegs, setBackendRegs] = React.useState<any[]>([]);
  const [backendResults, setBackendResults] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Separate forms for Obvezni and Izborni parts
  const [showAddMandatory, setShowAddMandatory] = React.useState(false);
  const [showAddElective, setShowAddElective] = React.useState(false);

  // Form states
  const [selectedSubjectId, setSelectedSubjectId] = React.useState('');
  const [selectedLevel, setSelectedLevel] = React.useState<'' | 'A' | 'B' | 'SINGLE'>('');

  // PDF Export simulation
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);
  const [pdfReady, setPdfReady] = React.useState(false);

  // Helper to map our backend registrations and results to parent schema so other UI modules stay perfectly synchronized
  const synchronizeClientState = (regsFromBackend: any[], resultsFromBackend: any[]) => {
    const mappedRegs = regsFromBackend.map(br => {
      return {
        id: br.id,
        studentId: currentStudent.id,
        examPeriodId: br.examSessionId,
        registeredAt: br.registeredAt,
        status: br.status === 'REGISTERED' ? 'REGISTERED' as const : 'CANCELLED' as const
      };
    });
    setExamRegistrations(mappedRegs);
    saveTable('exam_registrations', mappedRegs);

    if (setExamResults) {
      const mappedResults = resultsFromBackend.map(r => {
        return {
          id: r.id,
          studentId: currentStudent.id,
          examPeriodId: r.examRegistrationId,
          pointsEarned: r.pointsEarned,
          maximumPoints: r.maximumPoints,
          scorePercentage: r.scorePercentage,
          grade: r.grade,
          outcome: r.outcome,
          status: r.resultStatus
        };
      });
      setExamResults(mappedResults);
      saveTable('exam_results', mappedResults);
    }
  };

  const loadMaturaData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch available exams from e-Matica
      const resAvailable = await fetch(`/api/matura/available-exams?studentId=${currentStudent.id}`);
      if (!resAvailable.ok) {
        const errJson = await resAvailable.json();
        throw new Error(errJson.error || "Došlo je do pogreške pri povezivanju s e-Maticom.");
      }
      const dataAvailable = await resAvailable.json();
      setAvailableMandatory(dataAvailable.mandatory || []);
      setAvailableElective(dataAvailable.elective || []);
      setEligibility(dataAvailable.eligibility || null);

      // 2. Fetch registrations
      const resRegs = await fetch(`/api/matura/registrations?studentId=${currentStudent.id}`);
      if (!resRegs.ok) {
        throw new Error("Došlo je do pogreške pri dohvaćanju popisa Vaših prijava.");
      }
      const dataRegs = await resRegs.json();
      setBackendRegs(dataRegs);

      // 3. Fetch results
      let dataResults: any[] = [];
      const resResults = await fetch(`/api/matura/results?studentId=${currentStudent.id}`);
      if (resResults.ok) {
        dataResults = await resResults.json();
        setBackendResults(dataResults);
      }

      // 4. Synchronize with parent/local storage
      synchronizeClientState(dataRegs, dataResults);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Neuspjelo dohvaćanje integracijskih podataka s e-Matice.");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadMaturaData();
  }, [currentStudent.id]);

  // Handle subject changes: dynamically set or reset levels
  const handleSubjectChange = (subjectId: string, part: 'MANDATORY' | 'ELECTIVE') => {
    setSelectedSubjectId(subjectId);
    if (!subjectId) {
      setSelectedLevel('');
      return;
    }

    const list = part === 'MANDATORY' ? availableMandatory : availableElective;
    const selectedSub = list.find(s => s.id === subjectId);

    if (selectedSub) {
      if (!selectedSub.hasLevels) {
        setSelectedLevel('SINGLE');
      } else {
        setSelectedLevel(''); // Enforce student to explicitly pick level (no pre-selected A/B)
      }
    }
  };

  const handleRegisterExam = async () => {
    if (!selectedSubjectId || !selectedLevel) return;

    const list = [...availableMandatory, ...availableElective];
    const sub = list.find(s => s.id === selectedSubjectId);
    if (!sub) return;

    try {
      const response = await fetch('/api/matura/register-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: currentStudent.id,
          subjectId: selectedSubjectId,
          level: selectedLevel
        })
      });

      const result = await response.json();
      if (!response.ok) {
        alert(result.error || "Prijavljivanje ispita nije uspjelo.");
        return;
      }

      // Audit and log actions
      logAuditEvent(currentUser.id, currentUser.email, 'PRIJAVA_MATURE', `Uspješna prijava ispita mature: ${sub.officialName} (${selectedLevel})`);
      logRbacAction('PRIJAVA_MATURE', 'ExamRegistration', undefined, sub.officialName);

      // Reset form
      setSelectedSubjectId('');
      setSelectedLevel('');
      setShowAddMandatory(false);
      setShowAddElective(false);

      // Reload
      await loadMaturaData();
    } catch (err: any) {
      alert("Mrežna greška: " + err.message);
    }
  };

  const handleCancelExam = async (regId: string, subjectName: string) => {
    if (!confirm(`Jeste li sigurni da želite odjaviti ispit: ${subjectName}?`)) {
      return;
    }

    try {
      const response = await fetch('/api/matura/cancel-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: regId })
      });

      if (!response.ok) {
        const result = await response.json();
        alert(result.error || "Odjava ispita nije uspjela.");
        return;
      }

      logAuditEvent(currentUser.id, currentUser.email, 'ODJAVA_MATURE', `Uspješno odjavljen ispit mature: ${subjectName}`);
      logRbacAction('ODJAVA_MATURE', 'ExamRegistration', regId, undefined);

      await loadMaturaData();
    } catch (err: any) {
      alert("Mrežna greška: " + err.message);
    }
  };

  const handleChangeExamLevel = async (regId: string, subjectName: string, targetLevel: 'A' | 'B') => {
    try {
      const response = await fetch('/api/matura/change-level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: regId, newLevel: targetLevel })
      });

      if (!response.ok) {
        const result = await response.json();
        alert(result.error || "Izmjena razine ispita nije uspjela.");
        return;
      }

      logAuditEvent(currentUser.id, currentUser.email, 'PROMJENA_RAZINE_MATURE', `Promijenjena razina ispita za ${subjectName} u ${targetLevel}`);
      logRbacAction('PROMJENA_RAZINE_MATURE', 'ExamRegistration', regId, targetLevel);

      await loadMaturaData();
    } catch (err: any) {
      alert("Mrežna greška: " + err.message);
    }
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Učitavanje podataka iz e-Matice...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-2xl space-y-4">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-red-600 shrink-0" />
          <div>
            <h3 className="font-extrabold text-sm text-red-800 dark:text-red-400">Pogreška integracije e-Matica</h3>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1">{errorMsg}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadMaturaData}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Pokušaj ponovno
          </button>
        </div>
      </div>
    );
  }

  // Filter out already registered subjects from selection dropdowns
  const isRegisteredSubject = (subjectId: string) => {
    return backendRegs.some(r => r.subjectId === subjectId);
  };

  const filteredMandatorySelect = availableMandatory.filter(sub => !isRegisteredSubject(sub.id));
  const filteredElectiveSelect = availableElective.filter(sub => !isRegisteredSubject(sub.id));

  // Separate active registrations for UI sections
  const mandatoryRegs = backendRegs.filter(r => r.subject?.examPart === 'MANDATORY');
  const electiveRegs = backendRegs.filter(r => r.subject?.examPart === 'ELECTIVE' || r.subject?.examPart === 'MINORITY');

  return (
    <div className="space-y-6">
      {/* 1. e-Matica Student Verification Profile Card */}
      {eligibility && (
        <div className="p-5 bg-indigo-50/40 dark:bg-slate-900/40 border border-indigo-100 dark:border-slate-800 rounded-3xl space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Verificirani podaci iz e-Matice
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100">
                {currentUser.fullName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Učenik: <strong className="text-slate-700 dark:text-slate-300">{eligibility.gradeLevel}. razred</strong> ({eligibility.classSection}) — <strong>{eligibility.schoolName}</strong>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Program: <strong className="text-slate-700 dark:text-slate-300">{eligibility.programName}</strong>
              </p>
            </div>
            
            <div className="text-right shrink-0 p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xs">
              <p className="text-[9px] uppercase font-bold text-slate-400">Izvor sinkronizacije</p>
              <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">Sustav e-Matica MZO</p>
              <p className="text-[9px] text-slate-400 mt-1">Ažurirano: {new Date(eligibility.lastSyncedAt).toLocaleTimeString()}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-indigo-100/60 dark:border-slate-800 space-y-2">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-indigo-500" /> Sinkronizirani jezici i klasični profili:
            </p>
            <div className="flex flex-wrap gap-2">
              {eligibility.foreignLanguages.map((lang: any, idx: number) => (
                <div key={idx} className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300">
                  🛡 <strong>{lang.name}</strong> ({lang.order === 'FIRST' ? '1. strani jezik' : '2. strani jezik'}) — {lang.durationYears}g učenja
                </div>
              ))}
              {eligibility.isClassicalGymnasium && (
                <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 text-amber-800 dark:text-amber-400 rounded-xl text-xs font-bold">
                  🏛 Klasična gimnazija (Učenik ima pravo prijave Latinskog/Grčkog)
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. OBVEZNI DIO DRŽAVNE MATURE */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold">1</span>
              Obvezni dio državne mature
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 ml-8">
              Prijavite ispite koji su preduvjet za polaganje srednjoškolskog obrazovanja ili uvjet studijskih programa.
            </p>
          </div>
          <button
            onClick={() => {
              setShowAddMandatory(!showAddMandatory);
              setShowAddElective(false);
              setSelectedSubjectId('');
              setSelectedLevel('');
            }}
            className="ml-8 sm:ml-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Dodaj obvezni ispit
          </button>
        </div>

        {/* Inline Add Form for Mandatory Part */}
        {showAddMandatory && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
            <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Prijava obveznog ispita</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Predmet mature</label>
                <select
                  value={selectedSubjectId}
                  onChange={e => handleSubjectChange(e.target.value, 'MANDATORY')}
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                >
                  <option value="">Odaberi predmet...</option>
                  {filteredMandatorySelect.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.officialName} {sub.isForeignLanguage ? '(Strani jezik)' : ''} {sub.isClassicalLanguage ? '(Klasični jezik)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Razina ispita</label>
                {selectedSubjectId ? (
                  (() => {
                    const sub = availableMandatory.find(s => s.id === selectedSubjectId);
                    if (!sub?.hasLevels) {
                      return (
                        <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs rounded-xl border border-slate-200 dark:border-slate-800">
                          Jedinstvena razina (SINGLE)
                        </div>
                      );
                    } else {
                      return (
                        <select
                          value={selectedLevel}
                          onChange={e => setSelectedLevel(e.target.value as any)}
                          className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                        >
                          <option value="">Odaberi razinu...</option>
                          <option value="A">Viša razina (A)</option>
                          <option value="B">Osnovna razina (B)</option>
                        </select>
                      );
                    }
                  })()
                ) : (
                  <select disabled className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400 disabled:opacity-60">
                    <option value="">Prvo odaberi predmet...</option>
                  </select>
                )}
              </div>

              <button
                onClick={handleRegisterExam}
                disabled={!selectedSubjectId || !selectedLevel}
                className="py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Prijavi ispit
              </button>
            </div>
          </div>
        )}

        {/* Mandatory Registered Exams Table */}
        <div className="space-y-2.5">
          {mandatoryRegs.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              Nema prijavljenih obveznih ispita.
            </div>
          ) : (
            mandatoryRegs.map(reg => {
              const result = backendResults.find(r => r.examRegistrationId === reg.id);

              return (
                <div key={reg.id} className="p-4 bg-slate-50/50 dark:bg-slate-850/40 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100">{reg.subject?.officialName}</span>
                      <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md uppercase tracking-wider ${
                        reg.level === 'A' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900' :
                        reg.level === 'B' ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-450 border border-sky-100 dark:border-sky-900' :
                        'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        Razina: {reg.level}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {reg.date}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {reg.time} sati</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {result ? (
                      <div className="text-right">
                        <span className="text-[10px] text-emerald-600 font-extrabold block">✔ Položeno (Ocjena: {result.grade})</span>
                        <span className="font-black text-xs text-slate-800 dark:text-slate-100">{result.scorePercentage}% | {result.pointsEarned} bodova</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {reg.subject?.hasLevels && (
                          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                            <button
                              onClick={() => handleChangeExamLevel(reg.id, reg.subject?.officialName, 'A')}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold transition-all ${
                                reg.level === 'A' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs' : 'text-slate-400 hover:text-slate-700'
                              }`}
                            >
                              Viša (A)
                            </button>
                            <button
                              onClick={() => handleChangeExamLevel(reg.id, reg.subject?.officialName, 'B')}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold transition-all ${
                                reg.level === 'B' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs' : 'text-slate-400 hover:text-slate-700'
                              }`}
                            >
                              Osnovna (B)
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => handleCancelExam(reg.id, reg.subject?.officialName)}
                          className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-600 rounded-xl transition-all cursor-pointer"
                          title="Odjavi ispit"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. IZBORNI DIO DRŽAVNE MATURE */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold">2</span>
              Izborni dio državne mature
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 ml-8">
              Prijavite dodatne predmete (Biologija, Fizika, Informatika, Povijest, Kemija...) koji Vam donose bodove za upis na fakultete.
            </p>
          </div>
          <button
            onClick={() => {
              setShowAddElective(!showAddElective);
              setShowAddMandatory(false);
              setSelectedSubjectId('');
              setSelectedLevel('');
            }}
            className="ml-8 sm:ml-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Dodaj izborni ispit
          </button>
        </div>

        {/* Inline Add Form for Elective Part */}
        {showAddElective && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
            <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Prijava izbornog ispita</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Predmet mature</label>
                <select
                  value={selectedSubjectId}
                  onChange={e => handleSubjectChange(e.target.value, 'ELECTIVE')}
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                >
                  <option value="">Odaberi predmet...</option>
                  {filteredElectiveSelect.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.officialName} {sub.isMinorityLanguage ? '(Jezik manjine)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Razina ispita</label>
                <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs rounded-xl border border-slate-250 dark:border-slate-850">
                  Jedinstvena razina (SINGLE)
                </div>
              </div>

              <button
                onClick={handleRegisterExam}
                disabled={!selectedSubjectId || !selectedLevel}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-250 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Prijavi ispit
              </button>
            </div>
          </div>
        )}

        {/* Elective Registered Exams Table */}
        <div className="space-y-2.5">
          {electiveRegs.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              Nema prijavljenih izbornih ispita.
            </div>
          ) : (
            electiveRegs.map(reg => {
              const result = backendResults.find(r => r.examRegistrationId === reg.id);

              return (
                <div key={reg.id} className="p-4 bg-slate-50/50 dark:bg-slate-850/40 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100">{reg.subject?.officialName}</span>
                      <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                        Izborni (SINGLE)
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {reg.date}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {reg.time} sati</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {result ? (
                      <div className="text-right">
                        <span className="text-[10px] text-emerald-600 font-extrabold block">✔ Položeno (Ocjena: {result.grade})</span>
                        <span className="font-black text-xs text-slate-800 dark:text-slate-100">{result.scorePercentage}% | {result.pointsEarned} bodova</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCancelExam(reg.id, reg.subject?.officialName)}
                        className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-600 rounded-xl transition-all cursor-pointer"
                        title="Odjavi ispit"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 4. EXPORT CONFIRMATION PANEL */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Potvrda i ispis prijava</h4>
          <button
            onClick={triggerPdfExport}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4" /> Generiraj prijavni list (PDF)
          </button>
        </div>

        {isGeneratingPdf && (
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-150 dark:border-indigo-850 text-indigo-800 dark:text-indigo-400 text-xs rounded-xl animate-pulse flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
            <span>Kompajliranje podataka i generiranje službenog PDF ispisa državne mature s QR kodom...</span>
          </div>
        )}

        {pdfReady && !isGeneratingPdf && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 text-xs rounded-xl flex justify-between items-center gap-4">
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
              Službena potvrda o položenim ispitima državne mature je spremna za preuzimanje.
            </span>
            <a href="#" className="font-bold underline flex items-center gap-1 shrink-0"><Download className="h-4 w-4" /> Preuzmi potvrdu</a>
          </div>
        )}
      </div>
    </div>
  );
}
