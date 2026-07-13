/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  User,
  Student,
  School,
  SchoolProgram,
  AppDocument,
  SchoolApplicationChoice,
  SchoolApplication
} from '../types';
import {
  getTable,
  saveTable,
  logAuditEvent,
  addNotification,
  calculatePrimarySchoolPoints
} from '../lib/storage';
import { WorkflowService } from '../lib/workflow';
import { useRbac } from '../components/RbacContext';
import {
  GraduationCap,
  Calculator,
  Search,
  ListOrdered,
  Upload,
  CheckCircle,
  FileText,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Lock,
  UserCheck,
  Award,
  Filter,
  Check,
  X
} from 'lucide-react';

interface PrimarySchoolPortalProps {
  currentUser: User;
  activeTabOverride?: string;
}

export function PrimarySchoolPortal({ currentUser, activeTabOverride }: PrimarySchoolPortalProps) {
  const { session, hasPermission, logRbacAction } = useRbac();

  // Database states
  const [students, setStudents] = useState<Student[]>(() => getTable<Student>('students'));
  const [schools, setSchools] = useState<School[]>(() => getTable<School>('schools'));
  const [schoolPrograms, setSchoolPrograms] = useState<SchoolProgram[]>(() => getTable<SchoolProgram>('school_programs'));
  const [documents, setDocuments] = useState<AppDocument[]>(() => getTable<AppDocument>('documents'));
  const [schoolApps, setSchoolApps] = useState<SchoolApplication[]>(() => getTable<SchoolApplication>('school_applications'));
  const [schoolChoices, setSchoolChoices] = useState<SchoolApplicationChoice[]>(() => getTable<SchoolApplicationChoice>('school_application_choices'));

  // Student perspective states (Luka Marić: usr-prim-stud / stud-luka)
  const currentStudent = students.find(s => s.userId === currentUser.id) || students[0];
  const currentApp = schoolApps.find(a => a.studentId === currentStudent.id) || { id: 'app-luka', studentId: currentStudent.id, status: 'DRAFT' };
  
  // Tabs based on roles
  const isStudent = session?.roles.includes('PRIMARY_STUDENT') || currentUser.role === 'PRIMARY_STUDENT';
  const isTeacherOrAdmin = session?.roles.includes('PRIMARY_HOMEROOM_TEACHER') || session?.roles.includes('PRIMARY_ADMIN') || currentUser.role === 'PRIMARY_HOMEROOM_TEACHER' || currentUser.role === 'PRIMARY_ADMIN';

  const [activeTab, setActiveTab] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab');
    if (tabFromUrl) return tabFromUrl;
    return isStudent ? 'pretraga' : 'verifikacija';
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

  // Automatic tab switcher to prevent showing unauthorized empty tab
  React.useEffect(() => {
    const allowedTabs: string[] = [];
    if (hasPermission('schools.read')) allowedTabs.push('pretraga');
    if (hasPermission('applications.update')) allowedTabs.push('zelje');
    if (hasPermission('grades.read')) allowedTabs.push('bodovi');
    if (hasPermission('documents.read')) allowedTabs.push('dokumenti');
    if (hasPermission('students.read')) allowedTabs.push('verifikacija');

    if (!allowedTabs.includes(activeTab) && allowedTabs.length > 0) {
      handleTabChange(allowedTabs[0]);
    }
  }, [session, activeTab, hasPermission]);

  // Search filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Document upload state
  const [uploadPurpose, setUploadPurpose] = useState<'ZDRAVSTVENA_POTVRDA' | 'DODATNI_BODOVI' | 'OSTALO'>('DODATNI_BODOVI');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState('');

  // Edit Grades State (Teacher perspective)
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editAvg5, setEditAvg5] = useState(5.0);
  const [editAvg8, setEditAvg8] = useState(5.0);
  const [editCompetitions, setEditCompetitions] = useState(0);

  // Document Verification Reject state
  const [rejectionReasonId, setRejectionReasonId] = useState<string | null>(null);
  const [rejectionText, setRejectionText] = useState('');

  // Filter Secondary Schools Programs
  const filteredPrograms = schoolPrograms.filter(p => {
    const parentSchool = schools.find(s => s.id === p.schoolId);
    // Ensure parent school is active and not archived
    if (!parentSchool || parentSchool.type !== 'SECONDARY' || parentSchool.isArchived || !parentSchool.isActive) return false;
    
    // Students only see published and active programs
    if (isStudent && (p.isPublished === false || p.isActive === false)) return false;
    
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          parentSchool.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCity = selectedCity ? parentSchool.cityId === selectedCity : true;
    return matchesSearch && matchesCity;
  });

  const paginatedPrograms = filteredPrograms.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredPrograms.length / itemsPerPage);

  // Reset pagination when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCity]);

  // Luka's Selected choices list
  const lukaChoices = schoolChoices
    .filter(c => c.applicationId === currentApp.id)
    .sort((a, b) => a.priority - b.priority);

  // Add school program to Luka's wishlist
  const handleAddChoice = (program: SchoolProgram) => {
    if (lukaChoices.some(c => c.programId === program.id)) {
      alert('Ovaj program je već na Vašoj listi želja.');
      return;
    }
    if (lukaChoices.length >= 6) {
      alert('Možete odabrati maksimalno 6 srednjoškolskih programa.');
      return;
    }

    const calculatedPoints = calculatePrimarySchoolPoints(currentStudent, program);
    const prevYearThreshold = program.prevYearThreshold;
    const estimatedStatus = calculatedPoints >= prevYearThreshold ? 'UPADA' : 'NE_UPADA';

    const newChoice: SchoolApplicationChoice = {
      id: `choice-${Date.now()}`,
      applicationId: currentApp.id,
      programId: program.id,
      priority: lukaChoices.length + 1,
      pointsCalculated: calculatedPoints,
      estimatedStatus
    };

    const updated = [...schoolChoices, newChoice];
    setSchoolChoices(updated);
    saveTable('school_application_choices', updated);
    logAuditEvent(currentUser.id, currentUser.email, 'DODAN_IZBOR', `Dodan program ${program.name} na listu želja.`);
  };

  const handleRemoveChoice = (choiceId: string) => {
    const updated = schoolChoices.filter(c => c.id !== choiceId);
    // Re-index priority
    const lukasOnly = updated.filter(c => c.applicationId === currentApp.id)
      .map((c, idx) => ({ ...c, priority: idx + 1 }));
    const others = updated.filter(c => c.applicationId !== currentApp.id);
    
    const finalized = [...others, ...lukasOnly];
    setSchoolChoices(finalized);
    saveTable('school_application_choices', finalized);
    logAuditEvent(currentUser.id, currentUser.email, 'UKLONJEN_IZBOR', 'Uklonjen program s liste želja.');
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const reordered = [...lukaChoices];
    const temp = reordered[index];
    reordered[index] = reordered[index - 1];
    reordered[index - 1] = temp;

    // Apply priority numbers
    const updated = schoolChoices.filter(c => c.applicationId !== currentApp.id);
    const merged = [...updated, ...reordered.map((c, i) => ({ ...c, priority: i + 1 }))];
    
    setSchoolChoices(merged);
    saveTable('school_application_choices', merged);
  };

  const handleMoveDown = (index: number) => {
    if (index === lukaChoices.length - 1) return;
    const reordered = [...lukaChoices];
    const temp = reordered[index];
    reordered[index] = reordered[index + 1];
    reordered[index + 1] = temp;

    // Apply priority
    const updated = schoolChoices.filter(c => c.applicationId !== currentApp.id);
    const merged = [...updated, ...reordered.map((c, i) => ({ ...c, priority: i + 1 }))];

    setSchoolChoices(merged);
    saveTable('school_application_choices', merged);
  };

  const handleLockList = () => {
    const hasPendingDocs = documents.some(d => d.userId === currentUser.id && d.status === 'PENDING');
    const result = WorkflowService.executeSchoolAppTransition(
      currentApp.id,
      'ZAKLJUČANA',
      currentUser.id,
      currentUser.email,
      {
        choicesCount: lukaChoices.length,
        hasPendingDocs,
        hasGradesVerified: currentStudent.gradeAverage5 > 0,
        deadlinePassed: false
      },
      'Učenik je zaključao svoju listu želja.'
    );

    if (result.success) {
      setSchoolApps(getTable<SchoolApplication>('school_applications'));
    } else {
      alert(`Sustavno pravilo sprječava zaključavanje: ${result.error}`);
    }
  };

  // Document upload simulation
  const handleFileUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFileName) return;

    const newDoc: AppDocument = {
      id: `doc-${Date.now()}`,
      userId: currentUser.id,
      name: uploadedFileName.endsWith('.pdf') ? uploadedFileName : `${uploadedFileName}.pdf`,
      fileType: 'application/pdf',
      fileSize: '1.1 MB',
      purpose: uploadPurpose,
      status: 'PENDING',
      fileUrl: '#',
      createdAt: new Date().toISOString()
    };

    const updated = [newDoc, ...documents];
    setDocuments(updated);
    saveTable('documents', updated);
    logAuditEvent(currentUser.id, currentUser.email, 'PREDAJA_DOKUMENTA', `Učitan dokument ${newDoc.name} u svrhu ${uploadPurpose}`);
    
    setUploadedFileName('');
    setUploadSuccessMsg('Dokument je uspješno učitan i čeka provjeru administratora/razrednika.');
    setTimeout(() => setUploadSuccessMsg(''), 5000);
  };

  // Teacher actions: Unlock list
  const handleUnlockList = async (appId: string) => {
    const reason = prompt('Unesite razlog za otključavanje liste (min. 10 znakova):');
    if (!reason || reason.trim().length < 10) {
      alert('Razlog mora imati barem 10 znakova.');
      return;
    }

    try {
      const response = await fetch(`/api/school-applications/${appId}/unlock`, {
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

      // Update mock storage directly to keep UI synchronized
      const updatedApps = schoolApps.map(a => a.id === appId ? { ...a, status: 'DRAFT' as any } : a);
      setSchoolApps(updatedApps);
      saveTable('school_applications', updatedApps);
      
      const app = schoolApps.find(a => a.id === appId);
      if (app) {
        addNotification(app.studentId, 'Prijava otključana', 'Vaša prijava je otključana od strane razrednika. Razlog: ' + reason, 'ALERT');
      }

      alert(data.message);
    } catch (err) {
      alert('Greška pri komunikaciji sa serverom.');
    }
  };

  // Teacher actions: Verify document
  const handleVerifyDoc = (docId: string, status: 'VERIFIED' | 'REJECTED') => {
    const nextStatus = status === 'VERIFIED' ? 'ODOBREN' : 'ODBIJEN';
    const result = WorkflowService.executeDocumentTransition(
      docId,
      nextStatus,
      currentUser.id,
      currentUser.email,
      {
        hasValidFile: true,
        verifierRole: currentUser.role
      },
      status === 'REJECTED' ? rejectionText : 'Dokument verificiran i odobren od strane razrednika.'
    );

    if (result.success) {
      setDocuments(getTable<AppDocument>('documents'));
    } else {
      alert(`Sustavno pravilo workflowa sprječava promjenu statusa dokumenta: ${result.error}`);
    }

    setRejectionReasonId(null);
    setRejectionText('');
  };

  // Teacher actions: Save student grades
  const handleSaveGrades = (studentId: string) => {
    const updated = students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          gradeAverage5: editAvg5,
          gradeAverage8: editAvg8,
          competitionsPoints: editCompetitions
        };
      }
      return s;
    });
    setStudents(updated);
    saveTable('students', updated);
    
    const targetStud = students.find(s => s.id === studentId);
    if (targetStud) {
      logAuditEvent(currentUser.id, currentUser.email, 'AZURIRANJE_OCJENA', `Ažurirane ocjene za učenika OIB: ${targetStud.oib}`);
      addNotification(targetStud.userId, 'Ocjene ažurirane', 'Razrednik je ažurirao Vaše ocjene iz osnovne škole u sustavu e-upisi.', 'INFO');
    }
    
    setEditingStudentId(null);
  };

  return (
    <div className="space-y-6">
      
      {/* Dynamic Portal Header Card */}
      <div className="p-6 bg-linear-to-r from-blue-600 to-indigo-600 dark:from-blue-950 dark:to-indigo-950 text-white rounded-3xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-blue-200">srednje.e-upisi.hr Modul</span>
          <h2 className="text-xl font-extrabold tracking-tight">Portal osnovnog obrazovanja i e-Upisa</h2>
          <p className="text-xs text-blue-100">
            {isStudent ? `Kandidat: ${currentUser.fullName} | OIB: ${currentStudent?.oib}` : `Uloga: ${currentUser.role} | Škola: OŠ Nikole Tesle`}
          </p>
        </div>

        {isStudent && (
          <div className="flex gap-3 text-xs bg-white/10 p-3 rounded-2xl border border-white/10">
            <div className="text-center">
              <p className="text-blue-200 text-[9px] uppercase font-bold">Bodovni prosjek</p>
              <p className="text-amber-400 font-black text-sm">
                {((currentStudent.gradeAverage5 + currentStudent.gradeAverage6 + currentStudent.gradeAverage7 + currentStudent.gradeAverage8) * 4 + currentStudent.competitionsPoints + currentStudent.additionalPoints).toFixed(2)}b
              </p>
            </div>
            <div className="border-l border-white/20 pl-3 text-center">
              <p className="text-blue-200 text-[9px] uppercase font-bold">Status liste</p>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                currentApp.status === 'LOCKED' ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {currentApp.status === 'LOCKED' ? 'ZAKLJUČANO' : 'U TIJEKU'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs Row */}
      <div className="flex gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
        {hasPermission('schools.read') && (
          <button
            type="button"
            onClick={() => handleTabChange('pretraga')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${activeTab === 'pretraga' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Pretraživanje škola
          </button>
        )}
        {hasPermission('applications.update') && (
          <button
            type="button"
            onClick={() => handleTabChange('zelje')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 ${activeTab === 'zelje' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <ListOrdered className="h-4 w-4" /> Moja lista želja ({lukaChoices.length}/6)
          </button>
        )}
        {hasPermission('grades.read') && (
          <button
            type="button"
            onClick={() => handleTabChange('bodovi')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 ${activeTab === 'bodovi' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <Calculator className="h-4 w-4" /> Izračun bodova
          </button>
        )}
        {hasPermission('documents.read') && (
          <button
            type="button"
            onClick={() => handleTabChange('dokumenti')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 ${activeTab === 'dokumenti' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <Upload className="h-4 w-4" /> Dokumenti i potvrde
          </button>
        )}
        {hasPermission('students.read') && (
          <button
            type="button"
            onClick={() => handleTabChange('verifikacija')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${activeTab === 'verifikacija' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Učenici i dokumenti
          </button>
        )}
      </div>

      {/* Main Portlet Body */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-xs">
        
        {/* STUDENT TAB: PRETRAGA */}
        {activeTab === 'pretraga' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pretraži smjerove i gimnazije u Hrvatskoj (npr. MIOC, računalstvo)..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden"
                />
              </div>
              
              <div className="flex gap-2">
                <select
                  value={selectedCity}
                  onChange={e => setSelectedCity(e.target.value)}
                  className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden"
                >
                  <option value="">Svi gradovi</option>
                  <option value="city-1">Zagreb</option>
                  <option value="city-2">Split</option>
                  <option value="city-3">Rijeka</option>
                  <option value="city-6">Varaždin</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedPrograms.length === 0 ? (
                <div className="col-span-1 md:col-span-2 text-center py-10 text-slate-500 text-sm">
                  Nema programa koji odgovaraju odabranim kriterijima.
                </div>
              ) : (
                paginatedPrograms.map(prog => {
                  const school = schools.find(s => s.id === prog.schoolId);
                  const isSelected = lukaChoices.some(c => c.programId === prog.id);
                  return (
                    <div key={prog.id} className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-900 transition-all">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-sm">
                            Trajanje: {prog.durationYears} g.
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Kvota: {prog.quota} učenika</span>
                        </div>
                        
                        <div className="mt-2 space-y-1">
                          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{prog.name}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{school?.name}</p>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] border-t border-slate-100 dark:border-slate-800/50 pt-2.5">
                          <div>
                            <p className="text-slate-400 uppercase">Prošlogodišnji prag:</p>
                            <p className="font-bold text-slate-700 dark:text-slate-200">{prog.prevYearThreshold} bodova</p>
                          </div>
                          <div>
                            <p className="text-slate-400 uppercase">Minimalni prag:</p>
                            <p className="font-bold text-slate-700 dark:text-slate-200">{prog.minPointsThreshold} bodova</p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddChoice(prog)}
                        disabled={isSelected || currentApp.status === 'LOCKED'}
                        className={`mt-4 w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isSelected 
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            : currentApp.status === 'LOCKED'
                            ? 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-500 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                      >
                        {isSelected ? 'Dodano na listu' : <><Plus className="h-4 w-4" /> Dodaj na listu želja</>}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4 mt-6">
                <p className="text-xs text-slate-500">Pronađeno: {filteredPrograms.length} programa</p>
                <div className="flex gap-2">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                  >
                    Prethodna
                  </button>
                  <span className="text-xs text-slate-500 flex items-center px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                  >
                    Sljedeća
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STUDENT TAB: ZELJE */}
        {activeTab === 'zelje' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Prioritetna lista srednjoškolskih programa</h3>
                <p className="text-[10px] text-slate-400 mt-1">Prvi program na listi je vaš primarni izbor (Zlatni prioritet). Pomaknite prioritete pomoću kontrola.</p>
              </div>

              {currentApp.status !== 'LOCKED' && (
                <button
                  onClick={handleLockList}
                  disabled={lukaChoices.length === 0}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="h-4 w-4" /> Zaključaj listu želja
                </button>
              )}
            </div>

            {lukaChoices.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <p className="text-slate-400 text-sm">Vaša lista želja je trenutno prazna.</p>
                <button type="button"
            onClick={() => handleTabChange('pretraga')} className="text-indigo-600 hover:underline text-xs font-bold">
                  Pretraži programe i dodaj ih na listu
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {lukaChoices.map((choice, index) => {
                  const program = schoolPrograms.find(p => p.id === choice.programId);
                  const school = schools.find(s => s.id === program?.schoolId);
                  const meetsPrevThreshold = choice.pointsCalculated >= (program?.prevYearThreshold || 0);

                  return (
                    <div
                      key={choice.id}
                      className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
                        currentApp.status === 'LOCKED' 
                          ? 'bg-slate-50 dark:bg-slate-800/20 border-slate-200' 
                          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {/* Priority indicator circle */}
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                          index === 0 
                            ? 'bg-amber-500 text-white' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}>
                          {index + 1}
                        </div>
                        
                        <div>
                          <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">{program?.name}</h4>
                          <p className="text-[10px] text-slate-400">{school?.name}</p>
                          <div className="flex gap-2 mt-1 items-center">
                            <span className="text-[10px] text-slate-500 font-bold">Bodovi: {choice.pointsCalculated}b</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-xs ${
                              meetsPrevThreshold ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 text-emerald-400' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 text-rose-400'
                            }`}>
                              {meetsPrevThreshold ? 'SIGURAN UPAD (Iznad praga)' : 'NA RUBU (Ispod prošlogodišnjeg praga)'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex gap-1">
                        {currentApp.status !== 'LOCKED' && (
                          <>
                            <button
                              onClick={() => handleMoveUp(index)}
                              disabled={index === 0}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-md disabled:opacity-20 cursor-pointer"
                              title="Pomakni gore"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleMoveDown(index)}
                              disabled={index === lukaChoices.length - 1}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-md disabled:opacity-20 cursor-pointer"
                              title="Pomakni dolje"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveChoice(choice.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md cursor-pointer"
                              title="Ukloni izbor"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {currentApp.status === 'LOCKED' && (
                          <span className="p-1 text-slate-300 dark:text-slate-700 flex items-center gap-1 text-[10px]">
                            <Lock className="h-3 w-3" /> Potvrđeno
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STUDENT TAB: BODOVI */}
        {activeTab === 'bodovi' && (
          <div className="space-y-6">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Proračun bodova iz osnovne škole</h3>
            
            <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-extrabold text-xs text-indigo-600 uppercase tracking-wider">Godišnji školski prosjeci (5-8 razred)</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">5. razred prosjek</span>
                    <span className="font-bold">{currentStudent.gradeAverage5.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">6. razred prosjek</span>
                    <span className="font-bold">{currentStudent.gradeAverage6.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">7. razred prosjek</span>
                    <span className="font-bold">{currentStudent.gradeAverage7.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">8. razred prosjek</span>
                    <span className="font-bold">{currentStudent.gradeAverage8.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-extrabold text-xs text-indigo-600 uppercase tracking-wider font-bold">Dodatni bodovi i natjecanja</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Bodovi s državnih natjecanja</span>
                    <span className="font-bold text-amber-600">+{currentStudent.competitionsPoints} bodova</span>
                  </div>
                  <div className="flex justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Socijalni / zdravstveni uvjeti</span>
                    <span className="font-bold text-emerald-600">+{currentStudent.additionalPoints} bodova</span>
                  </div>
                  {currentStudent.socialPointsReason && (
                    <p className="text-[10px] text-slate-400 italic">Razlog dodatnih bodova: {currentStudent.socialPointsReason}</p>
                  )}
                </div>

                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Ukupno bodova za upis:</span>
                  <p className="text-3xl font-black text-indigo-700 dark:text-indigo-300 mt-1">
                    {((currentStudent.gradeAverage5 + currentStudent.gradeAverage6 + currentStudent.gradeAverage7 + currentStudent.gradeAverage8) * 4 + currentStudent.competitionsPoints + currentStudent.additionalPoints).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STUDENT TAB: DOKUMENTI */}
        {activeTab === 'dokumenti' && (
          <div className="space-y-6">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Dokumenti za verifikaciju i bodovne pogodnosti</h3>
            
            {uploadSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl">
                {uploadSuccessMsg}
              </div>
            )}

            <form onSubmit={handleFileUpload} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Namjena dokumenta</label>
                <select
                  value={uploadPurpose}
                  onChange={e => setUploadPurpose(e.target.value as any)}
                  className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                >
                  <option value="DODATNI_BODOVI">Potvrda o natjecanjima (sport / znanost)</option>
                  <option value="ZDRAVSTVENA_POTVRDA">Zdravstveni uvjeti / invalidska rješenja</option>
                  <option value="OSTALO">Ostali dokumenti (domovnica, rodni list)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Naziv PDF datoteke</label>
                <input
                  type="text"
                  placeholder="npr. Potvrda_Zupanijsko.pdf"
                  value={uploadedFileName}
                  onChange={e => setUploadedFileName(e.target.value)}
                  className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="h-4 w-4" /> Učitaj i pošalji
              </button>
            </form>

            <div className="space-y-2">
              <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-300">Učitani i poslani dokumenti</h4>
              <div className="space-y-2">
                {documents.filter(d => d.userId === currentUser.id).map(doc => (
                  <div key={doc.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-indigo-500" />
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{doc.name}</p>
                        <p className="text-[10px] text-slate-400">Namjena: {doc.purpose} | Velor: {doc.fileSize}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-full ${
                        doc.status === 'VERIFIED' ? 'bg-green-100 text-green-800 dark:bg-green-950/40 text-green-400' :
                        doc.status === 'REJECTED' ? 'bg-red-100 text-red-800 dark:bg-red-950/40 text-red-400' :
                        'bg-amber-100 text-amber-800 dark:bg-amber-950/40 text-amber-400'
                      }`}>
                        {doc.status === 'VERIFIED' ? 'ODOBRENO' : doc.status === 'REJECTED' ? 'ODBIJENO' : 'NA PROVJERI'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TEACHER/ADMIN TAB: VERIFIKACIJA UČENIKA */}
        {activeTab === 'verifikacija' && (
          <div className="space-y-6">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Administracija razreda i pregled dokumenata (Marko Horvat 8.A)</h3>

            {/* List of pupils in the teacher's class */}
            <div className="space-y-4">
              {students.filter(stud => hasPermission('students.read', {
                schoolId: stud.schoolId,
                classId: stud.classId,
                studentId: stud.id,
                userId: stud.userId
              })).map(stud => {
                const isEditing = editingStudentId === stud.id;
                const studUser = getTable<User>('users').find(u => u.id === stud.userId);
                const studChoices = schoolChoices.filter(c => c.applicationId === `app-${stud.id.split('-')[1]}`);
                const studDocs = documents.filter(d => d.userId === stud.userId);

                return (
                  <div key={stud.id} className="p-5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                      <div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{studUser?.fullName}</h4>
                        <p className="text-[10px] text-slate-400">OIB: {stud.oib} | Datum rođenja: {stud.dateOfBirth}</p>
                      </div>

                      {hasPermission('grades.update', {
                        schoolId: stud.schoolId,
                        classId: stud.classId,
                        studentId: stud.id,
                        userId: stud.userId
                      }) ? (
                        <button
                          onClick={() => {
                            if (isEditing) {
                              handleSaveGrades(stud.id);
                            } else {
                              setEditingStudentId(stud.id);
                              setEditAvg5(stud.gradeAverage5);
                              setEditAvg8(stud.gradeAverage8);
                              setEditCompetitions(stud.competitionsPoints);
                            }
                          }}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          {isEditing ? 'Spremi ocjene' : 'Ažuriraj ocjene'}
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
                          <Lock className="h-3 w-3" /> Zaključano (Nema ovlasti)
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      {/* Grades values */}
                      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50 space-y-2">
                        <span className="font-bold text-[10px] text-slate-400 uppercase">Prosjeci razreda</span>
                        {isEditing ? (
                          <div className="space-y-2">
                            <div>
                              <span className="text-[10px] text-slate-400">5. razred:</span>
                              <input type="number" step="0.01" value={editAvg5} onChange={e => setEditAvg5(parseFloat(e.target.value))} className="w-full p-1 border text-xs" />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400">8. razred:</span>
                              <input type="number" step="0.01" value={editAvg8} onChange={e => setEditAvg8(parseFloat(e.target.value))} className="w-full p-1 border text-xs" />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400">Natjecanja:</span>
                              <input type="number" value={editCompetitions} onChange={e => setEditCompetitions(parseInt(e.target.value))} className="w-full p-1 border text-xs" />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="flex justify-between"><span>5. razred:</span> <span className="font-bold">{stud.gradeAverage5.toFixed(2)}</span></p>
                            <p className="flex justify-between"><span>6. razred:</span> <span className="font-bold">{stud.gradeAverage6.toFixed(2)}</span></p>
                            <p className="flex justify-between"><span>7. razred:</span> <span className="font-bold">{stud.gradeAverage7.toFixed(2)}</span></p>
                            <p className="flex justify-between"><span>8. razred:</span> <span className="font-bold">{stud.gradeAverage8.toFixed(2)}</span></p>
                            <p className="flex justify-between border-t border-slate-50 pt-1"><span>Natjecanja:</span> <span className="font-bold text-amber-600">+{stud.competitionsPoints}b</span></p>
                          </div>
                        )}
                      </div>

                      {/* Choices wishlist */}
                      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50">
                        <span className="font-bold text-[10px] text-slate-400 uppercase">Lista želja ({studChoices.length})</span>
                        <div className="space-y-1.5 mt-2">
                          {studChoices.map(c => {
                            const program = schoolPrograms.find(p => p.id === c.programId);
                            return (
                              <p key={c.id} className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">
                                {c.priority}. {program?.name} ({c.pointsCalculated}b)
                              </p>
                            );
                          })}
                        </div>
                        {(() => {
                          const app = schoolApps.find(a => a.studentId === stud.id);
                          if (app && app.status === 'LOCKED') {
                            return (
                              <button
                                onClick={() => handleUnlockList(app.id)}
                                className="mt-2 w-full py-1.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/40 dark:hover:bg-red-900/60 dark:text-red-400 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                              >
                                Otključaj listu
                              </button>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* Uploaded documents verification block */}
                      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50 space-y-2">
                        <span className="font-bold text-[10px] text-slate-400 uppercase">Dokumenti za odobrenje</span>
                        <div className="space-y-1.5 mt-1">
                          {studDocs.map(doc => (
                            <div key={doc.id} className="border-b border-slate-50 dark:border-slate-800 pb-1.5 last:border-none">
                              <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200">{doc.name}</p>
                              <div className="flex gap-2 mt-1">
                                {doc.status === 'PENDING' ? (
                                  <>
                                    <button
                                      onClick={() => handleVerifyDoc(doc.id, 'VERIFIED')}
                                      className="px-2 py-0.5 bg-emerald-600 text-white rounded-md text-[9px] cursor-pointer"
                                    >
                                      Odobri
                                    </button>
                                    <button
                                      onClick={() => setRejectionReasonId(doc.id)}
                                      className="px-2 py-0.5 bg-red-600 text-white rounded-md text-[9px] cursor-pointer"
                                    >
                                      Odbij
                                    </button>
                                  </>
                                ) : (
                                  <span className={`text-[9px] font-bold ${doc.status === 'VERIFIED' ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {doc.status === 'VERIFIED' ? 'VERIFICIRANO' : 'ODBIJENO'}
                                  </span>
                                )}
                              </div>

                              {rejectionReasonId === doc.id && (
                                <div className="mt-1.5 space-y-1">
                                  <input
                                    type="text"
                                    placeholder="Razlog odbijanja..."
                                    value={rejectionText}
                                    onChange={e => setRejectionText(e.target.value)}
                                    className="p-1 border text-[9px] w-full bg-slate-50 rounded-sm"
                                  />
                                  <button onClick={() => handleVerifyDoc(doc.id, 'REJECTED')} className="px-2 py-0.5 bg-slate-800 text-white rounded-sm text-[9px]">Potvrdi odbijanje</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
