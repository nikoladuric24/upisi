import React from 'react';
import { Plus, Check, Search, GraduationCap, Users, Award, BookOpen, Lock, AlertCircle } from 'lucide-react';
import { StudyProgram, University, Faculty, UniversityApplication, UniversityApplicationChoice, User, ExamResult, ExamPeriod, ExamSubject, ExamRegistration } from '../types';
import { getTable, saveTable, logAuditEvent, calculateUniversityPoints } from '../lib/storage';
import { useRbac } from '../components/RbacContext';

interface StudyApplicationModuleProps {
  currentUser: User;
  currentStudent: any;
  currentApp: UniversityApplication;
  universities: University[];
  faculties: Faculty[];
  studyPrograms: StudyProgram[];
  univChoices: UniversityApplicationChoice[];
  setUnivChoices: (choices: UniversityApplicationChoice[]) => void;
  examResults: ExamResult[];
  examPeriods: ExamPeriod[];
}

export function StudyApplicationModule({
  currentUser,
  currentStudent,
  currentApp,
  universities,
  faculties,
  studyPrograms,
  univChoices,
  setUnivChoices,
  examResults,
  examPeriods
}: StudyApplicationModuleProps) {
  const { logRbacAction } = useRbac();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedUniversityId, setSelectedUniversityId] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 4;

  const examSubjects = React.useMemo(() => getTable<ExamSubject>('exam_subjects'), []);
  const examRegistrations = React.useMemo(() => getTable<ExamRegistration>('exam_registrations'), []);

  const studentChoices = React.useMemo(() => {
    return univChoices
      .filter(c => c.applicationId === currentApp.id)
      .sort((a, b) => a.priority - b.priority);
  }, [univChoices, currentApp.id]);

  const filteredStudies = React.useMemo(() => {
    return studyPrograms.filter(prog => {
      const faculty = faculties.find(f => f.id === prog.facultyId);
      const university = universities.find(u => u.id === faculty?.universityId);
      
      if (prog.isPublished === false || prog.isActive === false) return false;
      
      const matchesSearch = prog.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            faculty?.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesUni = selectedUniversityId ? university?.id === selectedUniversityId : true;
      return matchesSearch && matchesUni;
    });
  }, [studyPrograms, faculties, universities, searchQuery, selectedUniversityId]);

  const paginatedStudies = React.useMemo(() => {
    return filteredStudies.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredStudies, currentPage]);

  const totalPages = Math.ceil(filteredStudies.length / itemsPerPage);

  // Reset pagination on filter change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedUniversityId]);

  const handleAddStudyChoice = (prog: StudyProgram) => {
    if (currentApp.status === 'LOCKED') {
      alert('Vaša lista prioriteta je zaključana. Više ne možete dodavati nove studije.');
      return;
    }

    if (studentChoices.some(c => c.studyProgramId === prog.id)) {
      alert('Ovaj studijski program je već na Vašoj listi prioriteta.');
      return;
    }

    const points = calculateUniversityPoints(currentStudent, prog, examResults, examPeriods);
    
    const newChoice: UniversityApplicationChoice = {
      id: `uchoice-${Date.now()}`,
      applicationId: currentApp.id,
      studyProgramId: prog.id,
      priority: studentChoices.length + 1,
      pointsCalculated: points,
      estimatedStatus: points >= prog.minPointsThreshold ? 'UPADA' : 'ISPOD_PRAGA'
    };

    const updated = [...univChoices, newChoice];
    setUnivChoices(updated);
    saveTable('university_application_choices', updated);
    logAuditEvent(currentUser.id, currentUser.email, 'DODAN_STUDIJ', `Dodan studij ${prog.name} na listu prioriteta.`);
    logRbacAction('PRIJAVA_STUDIJA', 'UniversityApplicationChoice', undefined, prog.name);
  };

  const handleRemoveStudyChoice = (choiceId: string) => {
    if (currentApp.status === 'LOCKED') {
      alert('Vaša lista prioriteta je zaključana. Više ne možete uklanjati prijavljene studije.');
      return;
    }

    const updated = univChoices.filter(c => c.id !== choiceId);
    // Re-index priority
    const studentsOnly = updated.filter(c => c.applicationId === currentApp.id)
      .map((c, idx) => ({ ...c, priority: idx + 1 }));
    const others = updated.filter(c => c.applicationId !== currentApp.id);

    const finalized = [...others, ...studentsOnly];
    setUnivChoices(finalized);
    saveTable('university_application_choices', finalized);
    logAuditEvent(currentUser.id, currentUser.email, 'UKLONJEN_STUDIJ', 'Uklonjen studijski program s liste prioriteta.');
  };

  const isLocked = currentApp.status === 'LOCKED';

  return (
    <div className="space-y-6">
      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Pretraži studijske programe i fakultete..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
          />
        </div>
        <select
          value={selectedUniversityId}
          onChange={e => setSelectedUniversityId(e.target.value)}
          className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden"
        >
          <option value="">Sva sveučilišta</option>
          {universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {isLocked && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-150 dark:border-red-800 text-red-800 dark:text-red-400 text-xs rounded-xl flex items-center gap-2">
          <Lock className="h-4 w-4 shrink-0 text-red-500" />
          <span><strong>Lista je zaključana:</strong> Više ne možete mijenjati, prijavljivati niti odjavljivati studije u ovom roku.</span>
        </div>
      )}

      {/* Grid of studies */}
      {paginatedStudies.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-xs">
          Nema studijskih programa koji odgovaraju pretrazi.
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedStudies.map(prog => {
            const faculty = faculties.find(f => f.id === prog.facultyId);
            const choice = studentChoices.find(c => c.studyProgramId === prog.id);
            const calculatedPoints = calculateUniversityPoints(currentStudent, prog, examResults, examPeriods);

            return (
              <div
                key={prog.id}
                className={`p-5 bg-white dark:bg-slate-900 border rounded-2xl transition-all ${
                  choice 
                    ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/20 dark:bg-indigo-950/5' 
                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/30 px-2 py-0.5 rounded-md uppercase">
                        KOTA: {prog.quota} mjesta
                      </span>
                      {choice && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Check className="h-3 w-3" /> Prijavljeno (Prioritet: {choice.priority}.)
                        </span>
                      )}
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{prog.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4 shrink-0 text-slate-400" />
                      {faculty?.name}
                    </p>
                  </div>

                  {/* Right hand side stats / actions */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase">Vaš izračun</p>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100">{calculatedPoints} / 1000b</p>
                      <p className="text-[9px] text-slate-400">Min. prag: {prog.minPointsThreshold}b</p>
                    </div>

                    {choice ? (
                      <button
                        onClick={() => handleRemoveStudyChoice(choice.id)}
                        disabled={isLocked}
                        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 disabled:opacity-30 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/40 dark:text-red-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Odjavi se
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAddStudyChoice(prog)}
                        disabled={isLocked}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        Prijavi studij
                      </button>
                    )}
                  </div>
                </div>

                {/* Prereqs section */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <h5 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Preduvjeti državne mature (Bodovni udjeli):</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    {prog.requiresMaturaMandatory.map(req => {
                      const subject = examSubjects.find(s => s.id === req.subjectId);
                      // Check if registered
                      const isRegistered = examRegistrations.some(reg => {
                        const ep = examPeriods.find(period => period.id === reg.examPeriodId);
                        return ep && ep.subjectId === req.subjectId && (req.minLevel === 'N/A' || ep.level === req.minLevel);
                      });

                      return (
                        <div key={req.subjectId} className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-0.5 flex flex-col justify-between">
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">{subject?.name}</span>
                            <span className="text-[9px] font-extrabold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 px-1.5 rounded-sm">
                              {req.weightPercentage}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-1 text-[9px]">
                            <span className="text-slate-400">Min. {req.minLevel !== 'N/A' ? `razina ${req.minLevel}` : 'Izborni'}</span>
                            {isRegistered ? (
                              <span className="text-emerald-600 font-extrabold flex items-center gap-0.5">✔ Prijavljen</span>
                            ) : (
                              <span className="text-amber-600 font-extrabold flex items-center gap-0.5">✖ Neprijavljen</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 dark:bg-slate-800 disabled:opacity-40 rounded-lg text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            Prethodna
          </button>
          <span className="text-[11px] text-slate-500 font-medium">Stranica {currentPage} od {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 dark:bg-slate-800 disabled:opacity-40 rounded-lg text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            Sljedeća
          </button>
        </div>
      )}
    </div>
  );
}
