/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  User,
  Student,
  ExamSubject,
  ExamPeriod,
  ExamRegistration,
  ExamResult,
  University,
  Faculty,
  StudyProgram,
  SchoolProgram,
  UniversityApplicationChoice,
  UniversityApplication
} from '../types';
import {
  getTable,
  saveTable,
  logAuditEvent,
  addNotification,
  calculateUniversityPoints
} from '../lib/storage';
import { WorkflowService } from '../lib/workflow';
import { useRbac } from '../components/RbacContext';
import { InstitutionProgramsView } from '../components/InstitutionProgramsView';
import { MaturaModule } from './MaturaModule';
import { StudyApplicationModule } from './StudyApplicationModule';
import {
  BookOpen,
  Calendar,
  Layers,
  GraduationCap,
  Award,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Lock,
  Printer,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  Settings,
  HelpCircle,
  Search
} from 'lucide-react';

interface SecondarySchoolPortalProps {
  currentUser: User;
  activeTabOverride?: string;
}

export function SecondarySchoolPortal({ currentUser, activeTabOverride }: SecondarySchoolPortalProps) {
  const { session, hasPermission, logRbacAction } = useRbac();

  // Database states
  const [students, setStudents] = useState<Student[]>(() => getTable<Student>('students'));
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>(() => getTable<ExamSubject>('exam_subjects'));
  const [examPeriods, setExamPeriods] = useState<ExamPeriod[]>(() => getTable<ExamPeriod>('exam_periods'));
  const [examRegistrations, setExamRegistrations] = useState<ExamRegistration[]>(() => getTable<ExamRegistration>('exam_registrations'));
  const [examResults, setExamResults] = useState<ExamResult[]>(() => getTable<ExamResult>('exam_results'));
  
  const [universities, setUniversities] = useState<University[]>(() => getTable<University>('universities'));
  const [faculties, setFaculties] = useState<Faculty[]>(() => getTable<Faculty>('faculties'));
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>(() => getTable<StudyProgram>('study_programs'));
  const [schoolPrograms, setSchoolPrograms] = useState<SchoolProgram[]>(() => getTable<SchoolProgram>('school_programs'));
  
  const [univApps, setUnivApps] = useState<UniversityApplication[]>(() => getTable<UniversityApplication>('university_applications'));
  const [univChoices, setUnivChoices] = useState<UniversityApplicationChoice[]>(() => getTable<UniversityApplicationChoice>('university_application_choices'));

  // Determine current student context (Ivan Jurić: usr-sec-stud / stud-ivan)
  const currentStudent = students.find(s => s.userId === currentUser.id) || students[1];
  const currentApp = univApps.find(a => a.studentId === currentStudent.id) || { id: 'app-ivan', studentId: currentStudent.id, status: 'SUBMITTED' };

  // Perspective roles
  const isStudent = session?.roles.includes('SECONDARY_STUDENT') || currentUser.role === 'SECONDARY_STUDENT';
  const isTeacherOrAdmin = session?.roles.includes('SECONDARY_HOMEROOM_TEACHER') || session?.roles.includes('SECONDARY_ADMIN') || currentUser.role === 'SECONDARY_HOMEROOM_TEACHER' || currentUser.role === 'SECONDARY_ADMIN';

  const [activeTab, setActiveTab] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab');
    if (tabFromUrl) return tabFromUrl;
    return isStudent ? 'matura' : 'nastavnik';
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url.toString());
  };

  React.useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tabFromUrl = params.get('tab');
      if (tabFromUrl) {
        setActiveTab(tabFromUrl);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  React.useEffect(() => {
    if (activeTabOverride) {
      handleTabChange(activeTabOverride);
    }
  }, [activeTabOverride]);

  // Synchronize database state with persistent backend endpoints
  React.useEffect(() => {
    const fetchMaturaBackendData = async () => {
      try {
        // 1. Fetch real sessions and map to examPeriods
        const resSessions = await fetch('/api/matura/sessions');
        if (resSessions.ok) {
          const sessionsData = await resSessions.json();
          const mappedPeriods = sessionsData.map((s: any) => ({
            id: s.id,
            name: `Ispit - ${s.subject_id} (${s.level})`,
            subjectId: s.subject_id,
            academicYear: '2026./2027.',
            level: s.level,
            date: s.exam_date,
            time: s.start_time,
            durationMinutes: s.duration_minutes,
            isRegistrationOpen: s.status === 'ACTIVE'
          }));
          setExamPeriods(mappedPeriods);
        }

        // 2. Fetch registrations and results based on user role
        if (isTeacherOrAdmin) {
          const resRegs = await fetch('/api/matura/registrations-admin');
          if (resRegs.ok) {
            const regsData = await resRegs.json();
            const mappedRegs = regsData.map((r: any) => ({
              id: r.id,
              studentId: r.student_id,
              examPeriodId: r.exam_session_id,
              registeredAt: r.registered_at,
              status: r.registration_status === 'REGISTERED' ? 'REGISTERED' as const : 'CANCELLED' as const,
              _subjectName: r.subjectName,
              _level: r.level
            }));
            setExamRegistrations(mappedRegs);
          }

          const resResults = await fetch('/api/matura/results-admin');
          if (resResults.ok) {
            const resultsData = await resResults.json();
            const mappedResults = resultsData.map((r: any) => ({
              id: r.id,
              studentId: r.student_id || r.studentId,
              examPeriodId: r.examPeriodId,
              pointsEarned: r.points_earned,
              maximumPoints: r.maximum_points,
              scorePercentage: r.percentage,
              grade: r.grade,
              outcome: r.outcome,
              status: r.result_status,
              _subjectName: r.subjectName
            }));
            setExamResults(mappedResults);
          }
        } else if (isStudent && currentStudent) {
          const resRegs = await fetch(`/api/matura/registrations?studentId=${currentStudent.id}`);
          if (resRegs.ok) {
            const regsData = await resRegs.json();
            const mappedRegs = regsData.map((r: any) => ({
              id: r.id,
              studentId: r.studentId,
              examPeriodId: r.examSessionId,
              registeredAt: r.registeredAt,
              status: r.status === 'REGISTERED' ? 'REGISTERED' as const : 'CANCELLED' as const,
              _subjectName: r.subject?.officialName,
              _level: r.level
            }));
            setExamRegistrations(mappedRegs);
          }

          const resResults = await fetch(`/api/matura/results?studentId=${currentStudent.id}`);
          if (resResults.ok) {
            const resultsData = await resResults.json();
            const mappedResults = resultsData.map((r: any) => ({
              id: r.id,
              studentId: r.studentId,
              examPeriodId: r.examRegistrationId,
              pointsEarned: r.pointsEarned,
              maximumPoints: r.maximumPoints,
              scorePercentage: r.scorePercentage,
              grade: r.grade,
              outcome: r.outcome,
              status: r.resultStatus,
              _subjectName: r.subject?.officialName
            }));
            setExamResults(mappedResults);
          }
        }
      } catch (err) {
        console.error("Greška pri sinkronizaciji podataka s backendom mature:", err);
      }
    };

    fetchMaturaBackendData();
  }, [isTeacherOrAdmin, isStudent, currentStudent?.id]);

  // Dynamic tab switcher to prevent showing unauthorized tab
  React.useEffect(() => {
    if (!session) return;

    const allowedTabs: string[] = [];

    if (hasPermission('matura.read')) {
      allowedTabs.push('matura');
    }

    if (hasPermission('study_programs.read')) {
      allowedTabs.push('fakulteti');
    }

    if (hasPermission('applications.read')) {
      allowedTabs.push('prioriteti');
    }

    if (
      isTeacherOrAdmin &&
      hasPermission('students.read')
    ) {
      allowedTabs.push('nastavnik');
    }

    if (
      session.roles.includes('SECONDARY_ADMIN') &&
      session.school_id &&
      hasPermission('school_programs.read', {
        schoolId: session.school_id
      })
    ) {
      allowedTabs.push('programi');
    }

    if (
      allowedTabs.length > 0 &&
      !allowedTabs.includes(activeTab)
    ) {
      handleTabChange(allowedTabs[0]);
    }
  }, [
    session,
    activeTab,
    hasPermission,
    isTeacherOrAdmin
  ]);

  // Matura registration states
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<'A' | 'B'>('A');

  // University search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUniversityId, setSelectedUniversityId] = useState('');

  // PDF / Excel Generation Simulation State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [excelReady, setExcelReady] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Filter study programs
  const filteredStudies = studyPrograms.filter(prog => {
    const faculty = faculties.find(f => f.id === prog.facultyId);
    const university = universities.find(u => u.id === faculty?.universityId);
    
    if (isStudent && (prog.isPublished === false || prog.isActive === false)) return false;

    const matchesSearch = prog.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          faculty?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesUni = selectedUniversityId ? university?.id === selectedUniversityId : true;
    return matchesSearch && matchesUni;
  });

  const paginatedStudies = filteredStudies.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredStudies.length / itemsPerPage);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedUniversityId]);

  // Get Ivan's current registrations
  const studentRegs = examRegistrations.filter(r => r.studentId === currentStudent.id && r.status === 'REGISTERED');

  // Get Ivan's current university choices
  const studentChoices = univChoices
    .filter(c => c.applicationId === currentApp.id)
    .sort((a, b) => a.priority - b.priority);

  // Handle Registering a State Matura Exam
  const handleRegisterExam = () => {
    if (!selectedSubjectId) return;

    // Find exam period
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
      {
        deadlinePassed: false,
        hasValidGrades: true
      },
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

  // Add University study choice
  const handleAddStudyChoice = (prog: StudyProgram) => {
    if (studentChoices.some(c => c.studyProgramId === prog.id)) {
      alert('Ovaj studijski program je već na Vašoj listi prioriteta.');
      return;
    }
    if (studentChoices.length >= 10) {
      alert('Možete prijaviti maksimalno 10 studijskih programa.');
      return;
    }

    // Calculate Ivan's points for this faculty
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
    const updated = univChoices.filter(c => c.id !== choiceId);
    // Re-index priority
    const studentsOnly = updated.filter(c => c.applicationId === currentApp.id)
      .map((c, idx) => ({ ...c, priority: idx + 1 }));
    const others = updated.filter(c => c.applicationId !== currentApp.id);

    const finalized = [...others, ...studentsOnly];
    setUnivChoices(finalized);
    saveTable('university_application_choices', finalized);
    logAuditEvent(currentUser.id, currentUser.email, 'UKLONJEN_STUDIJ', 'Uklonjen studijski program s liste prioriteta.');
    logRbacAction('ODJAVA_STUDIJA', 'UniversityApplicationChoice', choiceId, undefined);
  };

  const handleMoveStudyUp = (index: number) => {
    if (index === 0) return;
    const reordered = [...studentChoices];
    const temp = reordered[index];
    reordered[index] = reordered[index - 1];
    reordered[index - 1] = temp;

    const updated = univChoices.filter(c => c.applicationId !== currentApp.id);
    const merged = [...updated, ...reordered.map((c, i) => ({ ...c, priority: i + 1 }))];

    setUnivChoices(merged);
    saveTable('university_application_choices', merged);
  };

  const handleMoveStudyDown = (index: number) => {
    if (index === studentChoices.length - 1) return;
    const reordered = [...studentChoices];
    const temp = reordered[index];
    reordered[index] = reordered[index + 1];
    reordered[index + 1] = temp;

    const updated = univChoices.filter(c => c.applicationId !== currentApp.id);
    const merged = [...updated, ...reordered.map((c, i) => ({ ...c, priority: i + 1 }))];

    setUnivChoices(merged);
    saveTable('university_application_choices', merged);
  };

  // PDF Export simulation
  const triggerPdfExport = () => {
    setIsGeneratingPdf(true);
    setPdfReady(false);
    setTimeout(() => {
      setIsGeneratingPdf(false);
      setPdfReady(true);
      logAuditEvent(currentUser.id, currentUser.email, 'PDF_EX_MATURA', 'Izvezen službeni ispis prijavljenih ispita i ocjena državne mature.');
    }, 2000);
  };

  const triggerExcelExport = () => {
    setIsGeneratingExcel(true);
    setExcelReady(false);
    setTimeout(() => {
      setIsGeneratingExcel(false);
      setExcelReady(true);
      logAuditEvent(currentUser.id, currentUser.email, 'EXCEL_EX_STUDIJI', 'Izvezena lista prioriteta studijskih programa u Excel formatu.');
    }, 1800);
  };

  const handleLockList = () => {
    const updatedApps = univApps.map(a => {
      if (a.id === currentApp.id) {
        return { ...a, status: 'LOCKED' as any };
      }
      return a;
    });
    setUnivApps(updatedApps);
    saveTable('university_applications', updatedApps);
    logAuditEvent(currentUser.id, currentUser.email, 'ZAKLJUCAVANJE_LISTE_FAKULTETA', `Kandidat je zaključao svoju listu prioriteta studijskih programa (ID: ${currentApp.id}).`);
    addNotification(currentStudent.userId, 'Lista prioriteta zaključana', 'Zaključali ste listu prioriteta studijskih programa. Promjene više nisu dopuštene bez odobrenja razrednika.', 'INFO');
  };

  const handleUnlockUniversityList = async (appId: string) => {
    const reason = prompt('Unesite razlog za otključavanje liste prioriteta (min. 10 znakova):');
    if (!reason || reason.trim().length < 10) {
      alert('Razlog mora imati barem 10 znakova.');
      return;
    }

    try {
      const response = await fetch(`/api/university-applications/${appId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          requestorId: currentUser.id,
          requestorRole: currentUser.role
        })
      });

      const data = await response.json();
      if (!response.ok) {
        alert(`Greška: ${data.error}`);
        return;
      }

      // Update local storage and state directly to keep UI synchronized
      const updatedApps = univApps.map(a => a.id === appId ? { ...a, status: 'SUBMITTED' as any } : a);
      setUnivApps(updatedApps);
      saveTable('university_applications', updatedApps);
      
      const app = univApps.find(a => a.id === appId);
      if (app) {
        addNotification(app.studentId, 'Lista prioriteta otključana', 'Vaša lista prioriteta studija je otključana od strane razrednika. Razlog: ' + reason, 'ALERT');
      }

      alert(data.message);
    } catch (err) {
      alert('Greška pri komunikaciji sa serverom.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Dynamic Header Card */}
      <div className="p-6 bg-linear-to-r from-purple-600 to-indigo-600 dark:from-purple-950 dark:to-indigo-950 text-white rounded-3xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-purple-200">Postani-Student.hr Modul</span>
          <h2 className="text-xl font-extrabold tracking-tight">Srednjoškolski portal i Državna matura</h2>
          <p className="text-xs text-purple-100">
            {isStudent ? `Kandidat: ${currentUser.fullName} | Razred: 4.A (MIOC) | OIB: ${currentStudent?.oib}` : `Uloga: ${currentUser.role} | Gimnazijski sustav`}
          </p>
        </div>

         {isStudent && (
          <div className="flex gap-4 text-xs bg-white/10 p-3.5 rounded-2xl border border-white/10 items-center">
            <div className="text-center">
              <p className="text-purple-200 text-[9px] uppercase font-bold">Prijavljeno ispita</p>
              <p className="text-amber-400 font-black text-sm">{studentRegs.length}</p>
            </div>
            <div className="border-l border-white/20 pl-4 text-center">
              <p className="text-purple-200 text-[9px] uppercase font-bold">Max Izračun (FER)</p>
              <p className="text-amber-400 font-black text-sm">
                {studentChoices[0] ? studentChoices[0].pointsCalculated : '842.5'} / 1000b
              </p>
            </div>
            <div className="border-l border-white/20 pl-4 text-center">
              <p className="text-purple-200 text-[9px] uppercase font-bold">Status liste</p>
              <p className={`font-black text-[10px] px-1.5 py-0.5 rounded-md mt-0.5 uppercase ${
                currentApp.status === 'LOCKED' ? 'bg-red-500/30 text-red-200' : 'bg-emerald-500/30 text-emerald-200'
              }`}>
                {currentApp.status === 'LOCKED' ? 'ZAKLJUČANO' : 'U TIJEKU'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs list */}
      <div className="flex gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
        {hasPermission('matura.read') && (
          <button
            type="button"
            onClick={() => handleTabChange('matura')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${activeTab === 'matura' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Državna matura & ispiti
          </button>
        )}
        {hasPermission('study_programs.read') && (
          <button
            type="button"
            onClick={() => handleTabChange('fakulteti')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 ${activeTab === 'fakulteti' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <GraduationCap className="h-4 w-4" /> Prijava studijskih programa
          </button>
        )}
        {hasPermission('applications.read') && (
          <button
            type="button"
            onClick={() => handleTabChange('prioriteti')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 ${activeTab === 'prioriteti' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <Layers className="h-4 w-4" /> Moja lista prioriteta ({studentChoices.length})
          </button>
        )}
        {isTeacherOrAdmin && hasPermission('students.read') && (
          <button
            type="button"
            onClick={() => handleTabChange('nastavnik')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${activeTab === 'nastavnik' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Pregled razreda i rezultata mature
          </button>
        )}
        {session?.roles.includes('SECONDARY_ADMIN') && session?.school_id && hasPermission('school_programs.read', { schoolId: session?.school_id }) && (
          <button
            type="button"
            onClick={() => handleTabChange('programi')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 ${activeTab === 'programi' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Programi
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-xs">
        
        {/* TAB: DRŽAVNA MATURA */}
        {activeTab === 'matura' && (
          <MaturaModule
            currentUser={currentUser}
            currentStudent={currentStudent}
            examSubjects={examSubjects}
            examPeriods={examPeriods}
            examRegistrations={examRegistrations}
            setExamRegistrations={setExamRegistrations}
            examResults={examResults}
            setExamResults={setExamResults}
          />
        )}

        {/* TAB: UNIVERSITY SEARCH */}
        {activeTab === 'fakulteti' && (
          <StudyApplicationModule
            currentUser={currentUser}
            currentStudent={currentStudent}
            currentApp={currentApp}
            universities={universities}
            faculties={faculties}
            studyPrograms={studyPrograms}
            univChoices={univChoices}
            setUnivChoices={setUnivChoices}
            examResults={examResults}
            examPeriods={examPeriods}
            examRegistrations={examRegistrations}
          />
        )}

        {/* TAB: PRIORITETI */}
        {activeTab === 'prioriteti' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Lista prioriteta studijskih programa (Postani Student)</h3>
                <p className="text-[10px] text-slate-400 mt-1">Lista je strukturirana po načelu prvenstva izbora. Prvi studij na listi je vaš primarni izbor.</p>
              </div>

              <button
                onClick={triggerExcelExport}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[11px] font-bold flex items-center gap-1.5 hover:bg-slate-200 transition-all cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Izvezi listu prioriteta (Excel)
              </button>
            </div>

            {isGeneratingExcel && (
              <div className="p-4 bg-indigo-50 border border-indigo-150 text-indigo-800 text-xs rounded-xl animate-pulse">
                Generiranje i eksportiranje popisa prijavljenih studija, bodova i simulacijskih pozicija u Excel tablicu...
              </div>
            )}

            {excelReady && !isGeneratingExcel && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 text-xs rounded-xl flex justify-between items-center">
                <span>Tablica s prijavama i simulacijskim izračunom je izvezena.</span>
                <a href="#" className="font-bold underline flex items-center gap-1"><Download className="h-3.5 w-3.5" /> Preuzmi tablicu (XLSX)</a>
              </div>
            )}

            {currentApp.status === 'LOCKED' ? (
              <div className="p-4 bg-red-50 dark:bg-red-950/25 border border-red-200 dark:border-red-800/80 rounded-2xl flex items-start gap-3">
                <Lock className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-red-800 dark:text-red-400">Vaša lista prioriteta studija je ZAKLJUČANA</p>
                  <p className="text-[10px] text-red-700 dark:text-red-500 leading-relaxed">
                    Uspješno ste zaključali i fiksirali odabir studijskih programa. Bilo kakve naknadne promjene ili reizbori 
                    nisu dopušteni bez pismenog zahtjeva i otključavanja od strane vašeg razrednika (homeroom teacher).
                  </p>
                </div>
              </div>
            ) : (
              studentChoices.length > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1 max-w-xl">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-400">Lista prioriteta je trenutno otključana (UTIJEKU)</p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-500 leading-relaxed">
                      Kada ste potpuno sigurni u redoslijed i odabir svojih fakulteta, obavezno zaključajte listu. 
                      Nakon zaključavanja, redoslijed je fiksiran i poslan na verifikaciju.
                    </p>
                  </div>
                  <button
                    onClick={handleLockList}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
                  >
                    <Lock className="h-3.5 w-3.5" /> Zaključaj listu
                  </button>
                </div>
              )
            )}

            {studentChoices.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <p className="text-slate-400 text-sm">Nemate niti jedan prijavljeni studijski program.</p>
                <button type="button"
                  onClick={() => handleTabChange('fakulteti')} className="text-indigo-600 hover:underline text-xs font-bold">
                  Pretraži visokoškolske studije i prijavi se
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {studentChoices.map((choice, index) => {
                  const study = studyPrograms.find(p => p.id === choice.studyProgramId);
                  const faculty = faculties.find(f => f.id === study?.facultyId);
                  
                  // Ivan's specific simulation rankings:
                  // 1st choice (FER Computer Science) -> Ivan is 42nd of 250 (UPADA)
                  // 2nd choice (FESB Split) -> Ivan is 12th of 120 (UPADA)
                  const simulationRank = index === 0 ? 42 : 12;
                  const isLocked = currentApp.status === 'LOCKED';

                  return (
                    <div
                      key={choice.id}
                      className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                          index === 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}>
                          {index + 1}
                        </div>

                        <div>
                          <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">{study?.name}</h4>
                          <p className="text-[10px] text-slate-400">{faculty?.name}</p>
                          <div className="flex gap-2.5 mt-1.5 items-center flex-wrap">
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.2 rounded-xs">
                              Ostvareni bodovi: {choice.pointsCalculated}b
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                              Pozicija: {simulationRank}. na listi (kvota {study?.quota})
                            </span>
                            <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 text-emerald-400 px-2 py-0.5 rounded-full">
                              UPADA (Zeleno svjetlo)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleMoveStudyUp(index)}
                          disabled={isLocked || index === 0}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-md disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleMoveStudyDown(index)}
                          disabled={isLocked || index === studentChoices.length - 1}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-md disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveStudyChoice(choice.id)}
                          disabled={isLocked}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md disabled:opacity-25 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* NASTAVNIK / ADMIN PERSPECTIVE */}
        {activeTab === 'nastavnik' && (
          <div className="space-y-6">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Nadzorna ploča nastavnika - SŠ XV. Gimnazija (Petra Novak 4.A)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Kao razrednik ili administrator srednje škole, možete provjeriti prijavljene ispite državne mature svojih maturanata, 
              njihove ostvarene bodove na maturi, te pratiti verifikacijske liste fakulteta.
            </p>

            <div className="space-y-3">
              {students.filter(stud => hasPermission('students.read', {
                schoolId: stud.schoolId,
                classId: stud.classId,
                studentId: stud.id,
                userId: stud.userId
              })).map(stud => {
                const userObj = getTable<User>('users').find(u => u.id === stud.userId);
                const regs = examRegistrations.filter(r => r.studentId === stud.id && r.status === 'REGISTERED');
                const choicesCount = univChoices.filter(c => c.applicationId === `app-${stud.id.split('-')[1]}`).length;

                return (
                  <div key={stud.id} className="p-4 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div>
                        <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">{userObj?.fullName}</h4>
                        <p className="text-[10px] text-slate-400">OIB: {stud.oib} | Maturant 2026</p>
                      </div>
                      <span className="bg-purple-100 text-purple-800 dark:bg-purple-950/30 text-[9px] font-black px-2.5 py-0.5 rounded-full">
                        {choicesCount} studija prijavljeno
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="font-bold text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">Prijavljeni ispiti mature ({regs.length})</p>
                        <div className="space-y-1">
                          {regs.map(r => {
                            const p = examPeriods.find(ep => ep.id === r.examPeriodId);
                            const s = examSubjects.find(sub => sub.id === p?.subjectId);
                            const name = s?.name || (r as any)._subjectName;
                            const lvl = p?.level || (r as any)._level;
                            return (
                              <p key={r.id} className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                • {name} ({lvl && lvl !== 'N/A' && lvl !== 'SINGLE' ? `Razina ${lvl}` : 'Izborni'})
                              </p>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <p className="font-bold text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">Ocjene iz ispita državne mature</p>
                        <div className="space-y-1">
                          {examResults.filter(res => res.studentId === stud.id).map(res => {
                            const p = examPeriods.find(ep => ep.id === res.examPeriodId);
                            const s = examSubjects.find(sub => sub.id === p?.subjectId);
                            const name = s?.name || (res as any)._subjectName;
                            return (
                              <p key={res.id} className="text-[10px] flex justify-between text-slate-700 dark:text-slate-300">
                                <span>{name}:</span>
                                <span className="font-bold">Ocjena {res.grade} ({res.scorePercentage}%) - {res.pointsEarned}b</span>
                              </p>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                      <div className="flex items-center">
                        <span className="text-[10px] text-slate-400 font-bold uppercase mr-1.5">Status liste prioriteta:</span>
                        {(() => {
                          const studAppId = `app-${stud.id.split('-')[1]}`;
                          const studApp = univApps.find(a => a.studentId === stud.id || a.id === studAppId);
                          const isLocked = studApp?.status === 'LOCKED';
                          return (
                            <span className={`font-black text-[9px] uppercase px-2 py-0.5 rounded-full ${
                              isLocked ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                            }`}>
                              {isLocked ? 'ZAKLJUČANO' : 'U TIJEKU'}
                            </span>
                          );
                        })()}
                      </div>
                      {(() => {
                        const studAppId = `app-${stud.id.split('-')[1]}`;
                        const studApp = univApps.find(a => a.studentId === stud.id || a.id === studAppId);
                        const isLocked = studApp?.status === 'LOCKED';
                        if (isLocked) {
                          return (
                            <button
                              onClick={() => handleUnlockUniversityList(studApp ? studApp.id : studAppId)}
                              className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-400 rounded-lg text-[10px] font-black transition-colors cursor-pointer flex items-center gap-1"
                            >
                              Otključaj listu prioriteta
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PROGRAMI TAB (Secondary Admin) */}
        {activeTab === 'programi' && session?.school_id && (
          <div className="space-y-6">
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
              <InstitutionProgramsView
                institutionId={session.school_id}
                institutionType="SECONDARY"
                programs={schoolPrograms.filter(p => p.schoolId === session.school_id)}
                onSave={(p) => {
                  const updated = [...schoolPrograms.filter(pr => pr.id !== p.id), p];
                  setSchoolPrograms(updated);
                  saveTable('school_programs', updated);
                  logAuditEvent(currentUser.id, currentUser.email, 'AZURIRANJE_PROGRAMA', `Ažuriran program ${p.name}`);
                }}
                onDelete={(id) => {
                  const updated = schoolPrograms.filter(p => p.id !== id);
                  setSchoolPrograms(updated);
                  saveTable('school_programs', updated);
                  logAuditEvent(currentUser.id, currentUser.email, 'BRISANJE_PROGRAMA', `Obrisan program ID: ${id}`);
                }}
                onBack={() => handleTabChange('nastavnik')}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
