/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useRbac, PermissionGuard } from '../components/RbacContext';
import {
  User,
  University,
  Faculty,
  StudyProgram,
  UniversityApplicationChoice,
  Student
} from '../types';
import {
  getTable,
  saveTable,
  logAuditEvent,
  addNotification
} from '../lib/storage';
import {
  GraduationCap,
  Users,
  Sliders,
  CheckCircle,
  FileText,
  AlertTriangle,
  Plus,
  Save,
  Trash2,
  TrendingUp,
  Award,
  Search
} from 'lucide-react';

interface UniversityAdminPortalProps {
  currentUser: User;
  activeTabOverride?: string;
}

export function UniversityAdminPortal({ currentUser, activeTabOverride }: UniversityAdminPortalProps) {
  const { session, hasPermission, logRbacAction } = useRbac();

  // Database states
  const [universities, setUniversities] = useState<University[]>(() => getTable<University>('universities'));
  const [faculties, setFaculties] = useState<Faculty[]>(() => getTable<Faculty>('faculties'));
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>(() => getTable<StudyProgram>('study_programs'));
  const [univChoices, setUnivChoices] = useState<UniversityApplicationChoice[]>(() => getTable<UniversityApplicationChoice>('university_application_choices'));
  const [students, setStudents] = useState<Student[]>(() => getTable<Student>('students'));
  const [users, setUsers] = useState<User[]>(() => getTable<User>('users'));

  const [activeTab, setActiveTab] = useState<'programs' | 'applicants' | 'statistics'>(() => {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab');
    if (tabFromUrl === 'programs' || tabFromUrl === 'applicants' || tabFromUrl === 'statistics') {
      return tabFromUrl as any;
    }
    return 'programs';
  });

  const handleTabChange = (tab: 'programs' | 'applicants' | 'statistics') => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url.toString());
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tabFromUrl = params.get('tab');
      if (tabFromUrl === 'programs' || tabFromUrl === 'applicants' || tabFromUrl === 'statistics') {
        setActiveTab(tabFromUrl as any);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (activeTabOverride) {
      handleTabChange(activeTabOverride as any);
    }
  }, [activeTabOverride]);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Target Faculty for Stjepan Car (FER Zagrebačka) - dynamically derived or RLS enforced
  const facultyIdFromSession = session?.faculty_id || 'fac-1';
  const myFaculty = faculties.find(f => f.id === facultyIdFromSession) || faculties[0];
  
  // RLS-filtered study programs for current faculty
  const myPrograms = studyPrograms.filter(p => {
    return p.facultyId === myFaculty.id && hasPermission('universities.read', {
      facultyId: p.facultyId
    });
  });

  // Edit states
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [editQuota, setEditQuota] = useState(0);
  const [editMinThreshold, setEditMinThreshold] = useState(0);

  // Add study program states
  const [showAddProgram, setShowAddProgram] = useState(false);
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramQuota, setNewProgramQuota] = useState(100);
  const [newProgramThreshold, setNewProgramThreshold] = useState(600);

  const handleUpdateProgram = (progId: string) => {
    const updated = studyPrograms.map(p => 
      p.id === progId ? { ...p, quota: editQuota, minPointsThreshold: editMinThreshold } : p
    );
    setStudyPrograms(updated);
    saveTable('study_programs', updated);
    
    const prog = studyPrograms.find(p => p.id === progId);
    if (prog) {
      logAuditEvent(currentUser.id, currentUser.email, 'AZURIRANJE_STUDIJA', `Promijenjena kvota za ${prog.name} na ${editQuota}, prag na ${editMinThreshold}b.`);
      logRbacAction('schools.update', 'StudyProgram', `Quota: ${prog.quota}, MinPoints: ${prog.minPointsThreshold}`, `Quota: ${editQuota}, MinPoints: ${editMinThreshold}`);
    }
    setEditingProgramId(null);
  };

  const handleAddProgram = () => {
    if (!newProgramName) return;

    const newProg: StudyProgram = {
      id: `stud-${Date.now()}`,
      facultyId: myFaculty.id,
      name: newProgramName,
      quota: newProgramQuota,
      minPointsThreshold: newProgramThreshold,
      requiresMaturaMandatory: [
        { subjectId: 'ex-sub-2', minLevel: 'A', weightPercentage: 40 }, // Math A
        { subjectId: 'ex-sub-1', minLevel: 'B', weightPercentage: 30 }, // Hrv B
        { subjectId: 'ex-sub-3', minLevel: 'B', weightPercentage: 30 }  // Eng B
      ]
    };

    const updated = [...studyPrograms, newProg];
    setStudyPrograms(updated);
    saveTable('study_programs', updated);
    
    logAuditEvent(currentUser.id, currentUser.email, 'DODAVANJE_STUDIJA', `Dodan novi studij na FER: ${newProgramName} s kvotom ${newProgramQuota}`);
    logRbacAction('study_programs.update', 'StudyProgram', undefined, newProgramName);
    
    // Reset
    setNewProgramName('');
    setShowAddProgram(false);
  };

  const handleDeleteProgram = (progId: string) => {
    const updated = studyPrograms.filter(p => p.id !== progId);
    setStudyPrograms(updated);
    saveTable('study_programs', updated);
    logAuditEvent(currentUser.id, currentUser.email, 'BRISANJE_STUDIJA', `Obrisan studij ID: ${progId}`);
    logRbacAction('study_programs.update', 'StudyProgram', progId, undefined);
  };

  // Get all applicants for FER (choices with studyProgramId in FER programs)
  const ferProgramIds = myPrograms.map(p => p.id);
  const ferApplicants = univChoices.filter(choice => ferProgramIds.includes(choice.studyProgramId));

  return (
    <PermissionGuard permission="universities.read" isPage={true}>
      <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="p-6 bg-linear-to-r from-teal-600 to-indigo-700 dark:from-teal-950 dark:to-indigo-950 text-white rounded-3xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-teal-200">Sveučilišna Nadzorna Konzola</span>
          <h2 className="text-xl font-extrabold tracking-tight">Konzola Visokog Učilišta - FER Zagreb</h2>
          <p className="text-xs text-teal-100">Administrator: {currentUser.fullName} | Ustanova: Fakultet elektrotehnike i računarstva</p>
        </div>

        <div className="flex gap-4 text-xs bg-white/10 p-3.5 rounded-2xl border border-white/10">
          <div className="text-center">
            <p className="text-teal-200 text-[9px] uppercase font-bold">Aktivnih programa</p>
            <p className="text-amber-400 font-black text-sm">{myPrograms.length}</p>
          </div>
          <div className="border-l border-white/20 pl-4 text-center">
            <p className="text-teal-200 text-[9px] uppercase font-bold">Ukupno prijavljenih</p>
            <p className="text-amber-400 font-black text-sm">{ferApplicants.length}</p>
          </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
        {hasPermission('universities.read') && (
          <button
            type="button"
            onClick={() => handleTabChange('programs')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${activeTab === 'programs' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Studijski programi i kvote
          </button>
        )}
        {hasPermission('students.read') && (
          <button
            type="button"
            onClick={() => handleTabChange('applicants')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 ${activeTab === 'applicants' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <Users className="h-4 w-4" /> Kandidati i rang liste
          </button>
        )}
        {hasPermission('universities.read') && (
          <button
            type="button"
            onClick={() => handleTabChange('statistics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 ${activeTab === 'statistics' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <TrendingUp className="h-4 w-4" /> Analitika & Kvote
          </button>
        )}
      </div>

      {/* Main Portlet Content */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-xs">
        
        {/* PROGRAMS TAB */}
        {activeTab === 'programs' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Akreditirani preddiplomski studiji</h3>
                <p className="text-[10px] text-slate-400 mt-1">Definirajte slobodne upisne kvote, pragove bodova i težinske koeficijente državne mature.</p>
              </div>

              {hasPermission('study_programs.create', { facultyId: myFaculty.id }) && (
                <button
                  onClick={() => setShowAddProgram(!showAddProgram)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Dodaj studijski program
                </button>
              )}
            </div>

            {showAddProgram && (
              <div className="p-5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-4">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">Registracija novog smjera na FER-u</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Naziv studija</label>
                    <input
                      type="text"
                      placeholder="npr. Informacijska tehnologija"
                      value={newProgramName}
                      onChange={e => setNewProgramName(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Slobodna kvota</label>
                    <input
                      type="number"
                      value={newProgramQuota}
                      onChange={e => setNewProgramQuota(parseInt(e.target.value))}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Minimalni prag (b)</label>
                    <input
                      type="number"
                      value={newProgramThreshold}
                      onChange={e => setNewProgramThreshold(parseInt(e.target.value))}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddProgram(false)} className="px-3 py-1.5 text-xs text-slate-400">Odustani</button>
                  <button onClick={handleAddProgram} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs">Spremi smjer</button>
                </div>
              </div>
            )}

            {/* Program cards lists */}
            <div className="space-y-4">
              {myPrograms.map(prog => {
                const isEditing = editingProgramId === prog.id;
                const matchesCount = univChoices.filter(c => c.studyProgramId === prog.id).length;

                return (
                  <div key={prog.id} className="p-4 bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{prog.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-1">Fakultet elektrotehnike i računarstva (FER)</p>
                      
                      <div className="flex gap-4 mt-3 text-xs">
                        {isEditing ? (
                          <div className="flex gap-2 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 block uppercase">Kvota:</span>
                              <input type="number" value={editQuota} onChange={e => setEditQuota(parseInt(e.target.value))} className="p-1 border rounded bg-white dark:bg-slate-900 text-xs w-20" />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block uppercase">Prag:</span>
                              <input type="number" value={editMinThreshold} onChange={e => setEditMinThreshold(parseInt(e.target.value))} className="p-1 border rounded bg-white dark:bg-slate-900 text-xs w-20" />
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>
                              <span className="text-slate-400">Slobodna Kvota:</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300 ml-1">{prog.quota} mjesta</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Bodovni prag:</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300 ml-1">{prog.minPointsThreshold}b</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Ukupno prijavljenih:</span>
                              <span className="font-bold text-indigo-600 dark:text-indigo-400 ml-1">{matchesCount} kandidata</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button onClick={() => setEditingProgramId(null)} className="px-2.5 py-1 text-slate-400 text-xs">Odustani</button>
                          <button onClick={() => handleUpdateProgram(prog.id)} className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg text-xs flex items-center gap-1">
                            <Save className="h-3.5 w-3.5" /> Spremi
                          </button>
                        </>
                      ) : (
                        <>
                          {hasPermission('study_programs.update', { facultyId: myFaculty.id }) && (
                            <button
                              onClick={() => {
                                setEditingProgramId(prog.id);
                                setEditQuota(prog.quota);
                                setEditMinThreshold(prog.minPointsThreshold);
                              }}
                              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                            >
                              Uredi kvote
                            </button>
                          )}
                          {hasPermission('study_programs.update', { facultyId: myFaculty.id }) && (
                            <button
                              onClick={() => handleDeleteProgram(prog.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* APPLICANTS TAB */}
        {activeTab === 'applicants' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Privremeni poredak i rang liste kandidata</h3>
                <p className="text-[10px] text-slate-400 mt-1">Sustav u realnom vremenu važe ostvarene bodove državne mature i srednjoškolski prosjek.</p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pretraži kandidate po OIB-u ili imenu..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-1.5 w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-bold">
                    <th className="py-3 px-2">Kandidat</th>
                    <th className="py-3 px-2">OIB</th>
                    <th className="py-3 px-2">Prijavljeni smjer</th>
                    <th className="py-3 px-2">Izračunani bodovi</th>
                    <th className="py-3 px-2">Status liste</th>
                    <th className="py-3 px-2 text-right">Verifikacija upada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ferApplicants
                    .filter(app => {
                      const stud = students.find(s => s.id === app.applicationId.replace('app-', 'stud-'));
                      const uObj = users.find(u => u.id === stud?.userId);
                      return uObj?.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || stud?.oib.includes(searchQuery);
                    })
                    .map((applicant, index) => {
                      const stud = students.find(s => s.id === applicant.applicationId.replace('app-', 'stud-'));
                      const userObj = users.find(u => u.id === stud?.userId);
                      const programObj = studyPrograms.find(p => p.id === applicant.studyProgramId);

                      return (
                        <tr key={applicant.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                          <td className="py-3 px-2">
                            <span className="font-bold text-slate-800 dark:text-slate-100">{userObj?.fullName}</span>
                          </td>
                          <td className="py-3 px-2 text-slate-500 font-mono">{stud?.oib}</td>
                          <td className="py-3 px-2 text-slate-600 dark:text-slate-400 font-semibold">{programObj?.name}</td>
                          <td className="py-3 px-2 font-black text-slate-700 dark:text-slate-300">{applicant.pointsCalculated} / 1000b</td>
                          <td className="py-3 px-2">
                            <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 text-emerald-400">
                              {index === 0 ? 'PRVI PRIORITET' : 'DRUGI PRIORITET'}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-end gap-1">
                              <CheckCircle className="h-4 w-4" /> Unutar kvote
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STATISTICS TAB */}
        {activeTab === 'statistics' && (
          <div className="space-y-6">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Analitički prikaz popunjenosti kvota</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-widest">Kandidati s 1. prioritetom (FER Računarstvo)</h4>
                
                {/* Visual Bar represent */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>Popunjeno kvote (1. izbor):</span>
                    <span className="font-bold">182 / 250 mjesta</span>
                  </div>
                  <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-600" style={{ width: '72.8%' }} />
                  </div>
                  <p className="text-[10px] text-slate-400">FER Računarstvo ostaje najtraženiji tehnički smjer u Republici Hrvatskoj s 1.8 prijava po slobodnom mjestu.</p>
                </div>
              </div>

              <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-widest">Kandidati s 1. prioritetom (FER Elektrotehnika)</h4>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>Popunjeno kvote (1. izbor):</span>
                    <span className="font-bold">244 / 400 mjesta</span>
                  </div>
                  <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600" style={{ width: '61%' }} />
                  </div>
                  <p className="text-[10px] text-slate-400">Elektrotehnika bilježi stabilan upisni interes kandidata iz strukovnih i općih gimnazija.</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
    </PermissionGuard>
  );
}
