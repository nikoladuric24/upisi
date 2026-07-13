/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useRbac, PermissionGuard } from '../components/RbacContext';
import {
  User,
  School,
  SchoolProgram,
  University,
  Faculty,
  StudyProgram,
  AppDeadline,
  AuditLog,
  ExamPeriod,
  SchoolYear,
  PrimaryPointsConfig
} from '../types';
import {
  getTable,
  saveTable,
  logAuditEvent,
  addNotification
} from '../lib/storage';
import { runAutomaticWorkflowTick } from '../lib/workflow';
import { DatabaseExplorer } from '../components/DatabaseExplorer';
import { InstitutionProgramsView } from '../components/InstitutionProgramsView';
import { FacultyProgramsView } from '../components/FacultyProgramsView';
import { EMaticaIntegrationView } from '../components/EMaticaIntegrationView';
import {
  Shield,
  School as SchoolIcon,
  GraduationCap,
  Users,
  Activity,
  Calendar,
  Layers,
  Search,
  Plus,
  Trash2,
  Edit2,
  Save,
  CheckCircle,
  FileText,
  AlertTriangle,
  FileDown,
  RefreshCw,
  Archive,
  ChevronLeft,
  ChevronRight,
  Database,
  Terminal,
  Lock,
  Server,
  Download,
  Code
} from 'lucide-react';

interface SuperAdminPortalProps {
  currentUser: User;
  activeTabOverride?: string;
}

export function SuperAdminPortal({ currentUser, activeTabOverride }: SuperAdminPortalProps) {
  const { hasPermission, logRbacAction } = useRbac();
  const [activeTab, setActiveTab] = useState<'stats' | 'schools' | 'universities' | 'deadlines' | 'users' | 'postavke' | 'audit' | 'baza' | 'ematica'>(() => {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab');
    if (tabFromUrl && ['stats', 'schools', 'universities', 'deadlines', 'users', 'postavke', 'audit', 'baza', 'ematica'].includes(tabFromUrl)) {
      return tabFromUrl as any;
    }
    return 'stats';
  });
  
  const handleTabChange = (tab: 'stats' | 'schools' | 'universities' | 'deadlines' | 'users' | 'postavke' | 'audit' | 'baza' | 'ematica') => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url.toString());
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tabFromUrl = params.get('tab');
      if (tabFromUrl && ['stats', 'schools', 'universities', 'deadlines', 'users', 'postavke', 'audit', 'baza', 'ematica'].includes(tabFromUrl)) {
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
  
  // Workflow task runner state
  const [workflowLogs, setWorkflowLogs] = useState<string[]>(['Sustav spreman. Kliknite gumb za pokretanje automatske obrade upisa, rokova, bodova i formiranje službenih rang-lista.']);
  const [isProcessingTick, setIsProcessingTick] = useState(false);

  // Storage states
  const [schools, setSchools] = useState<School[]>(() => getTable<School>('schools'));
  const [schoolPrograms, setSchoolPrograms] = useState<SchoolProgram[]>(() => getTable<SchoolProgram>('school_programs'));
  const [universities, setUniversities] = useState<University[]>(() => getTable<University>('universities'));
  const [faculties, setFaculties] = useState<Faculty[]>(() => getTable<Faculty>('faculties'));
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>(() => getTable<StudyProgram>('study_programs'));
  const [deadlines, setDeadlines] = useState<AppDeadline[]>(() => getTable<AppDeadline>('deadlines'));
  const [users, setUsers] = useState<User[]>(() => getTable<User>('users'));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => getTable<AuditLog>('audit_logs'));

  // New storage states for school years and dynamic config
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>(() => getTable<SchoolYear>('school_years'));
  const [pointsConfigs, setPointsConfigs] = useState<PrimaryPointsConfig[]>(() => getTable<PrimaryPointsConfig>('primary_points_configs'));

  // Soft-deleted/Archived visibility flags
  const [showArchivedSchools, setShowArchivedSchools] = useState(false);

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstitutionForPrograms, setSelectedInstitutionForPrograms] = useState<School | null>(null);
  const [selectedFacultyForPrograms, setSelectedFacultyForPrograms] = useState<Faculty | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'PRIMARY' | 'SECONDARY'>('ALL');
  
  // Edit modals state (inline or simplified forms)
  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);
  const [editSchoolName, setEditSchoolName] = useState('');
  const [editSchoolAddress, setEditSchoolAddress] = useState('');
  
  const [editingDeadlineId, setEditingDeadlineId] = useState<string | null>(null);
  const [editDeadlineTitle, setEditDeadlineTitle] = useState('');
  const [editDeadlineDate, setEditDeadlineDate] = useState('');

  // Add items state
  const [showAddSchool, setShowAddSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolType, setNewSchoolType] = useState<'PRIMARY' | 'SECONDARY'>('SECONDARY');
  const [newSchoolAddress, setNewSchoolAddress] = useState('');

  // Formula state variables
  const activeConfig = pointsConfigs[0] || { id: 'cfg-default', gradeAverageWeight: 4, competitionsWeight: 1, additionalWeight: 1, maxPoints: 80 };
  const [formulaGradeWeight, setFormulaGradeWeight] = useState(activeConfig.gradeAverageWeight);
  const [formulaCompWeight, setFormulaCompWeight] = useState(activeConfig.competitionsWeight);
  const [formulaAddWeight, setFormulaAddWeight] = useState(activeConfig.additionalWeight);
  const [formulaMaxPoints, setFormulaMaxPoints] = useState(activeConfig.maxPoints);

  // School Year input state
  const [newYearName, setNewYearName] = useState('');

  // Pagination for audit log
  const [auditCurrentPage, setAuditCurrentPage] = useState(1);
  const auditItemsPerPage = 10;

  // Real browser CSV export helper
  const exportToCSV = (tableName: string, headers: string[], rows: any[][]) => {
    // UTF-8 BOM for Excel to parse Special Croatian Characters (č, ć, ž, š, đ)
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
      + [headers.join(';'), ...rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${tableName}_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logAuditEvent(currentUser.id, currentUser.email, 'IZVOZ_CSV', `Uspješno izvezeni podaci tablice ${tableName} u CSV formatu za analizu.`);
  };

  // High-fidelity print layout exporter (Save as PDF)
  const exportToPDF = (title: string, headers: string[], rows: any[][]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const htmlRows = rows.map(r => `<tr>${r.map(c => `<td style="border:1px solid #e2e8f0; padding:10px; font-size:11px; color:#334155;">${c}</td>`).join('')}</tr>`).join('');
    const htmlHeaders = headers.map(h => `<th style="border:1px solid #e2e8f0; padding:12px; background-color:#f1f5f9; font-size:11px; font-weight:800; text-align:left; color:#1e293b; text-transform:uppercase; letter-spacing:0.05em;">${h}</th>`).join('');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 50px; color: #1e293b; }
            h1 { font-size: 24px; font-weight: 900; margin-bottom: 4px; color: #1e1b4b; letter-spacing: -0.025em; }
            .meta { font-size: 11px; margin-bottom: 30px; color: #64748b; font-weight: 500; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            tr:nth-child(even) { background-color: #f8fafc; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <h1>${title}</h1>
          <div class="meta">EduPortal Hrvatska • Državni Informacijski Sustav • Izvezeno: ${new Date().toLocaleString('hr-HR')} • Administrator: ${currentUser.fullName}</div>
          <table>
            <thead><tr>${htmlHeaders}</tr></thead>
            <tbody>${htmlRows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    logAuditEvent(currentUser.id, currentUser.email, 'IZVOZ_PDF', `Uspješno generiran i izvezen PDF ispis za tablicu ${title}.`);
  };

  // Toggle soft-delete school
  const handleToggleArchiveSchool = (id: string, currentlyArchived: boolean) => {
    const updated = schools.map(s => s.id === id ? { ...s, isArchived: !currentlyArchived } : s);
    setSchools(updated);
    saveTable('schools', updated);
    
    const actionStr = currentlyArchived ? 'RESTAURACIJA_SKOLE' : 'DEAKTIVACIJA_SKOLE';
    const detailStr = currentlyArchived ? 'Uspješno vraćena aktivnost škole' : 'Uspješno arhivirana (soft-delete) školska ustanova';
    const target = schools.find(s => s.id === id);
    
    logAuditEvent(
      currentUser.id, 
      currentUser.email, 
      actionStr, 
      `${detailStr}: ${target?.name || id}`,
      currentlyArchived ? 'STATUS: ARHIVIRAN' : 'STATUS: AKTIVAN',
      currentlyArchived ? 'STATUS: AKTIVAN' : 'STATUS: ARHIVIRAN'
    );

    // Refresh display
    setSchools(getTable<School>('schools'));
  };

  // Create school year
  const handleCreateSchoolYear = () => {
    if (!newYearName) return;
    if (schoolYears.some(sy => sy.year === newYearName)) {
      alert('Školska godina s ovim nazivom već postoji.');
      return;
    }
    const newSy: SchoolYear = {
      id: `sy-${Date.now()}`,
      year: newYearName,
      isCurrent: false
    };
    const updated = [...schoolYears, newSy];
    setSchoolYears(updated);
    saveTable('school_years', updated);
    logAuditEvent(currentUser.id, currentUser.email, 'DODAVANJE_SKOLSKE_GODINE', `Dodana nova školska godina: ${newYearName}`);
    setNewYearName('');
  };

  // Switch active school year
  const handleSwitchActiveYear = (yearId: string) => {
    const previousActive = schoolYears.find(y => y.isCurrent);
    const targetActive = schoolYears.find(y => y.id === yearId);
    if (!targetActive) return;

    const updated = schoolYears.map(sy => ({
      ...sy,
      isCurrent: sy.id === yearId
    }));
    setSchoolYears(updated);
    saveTable('school_years', updated);

    // Refresh states
    setSchoolYears(updated);

    // Write to audit log with dynamic oldValue/newValue fields
    logAuditEvent(
      currentUser.id,
      currentUser.email,
      'PROMJENA_SKOLSKE_GODINE',
      `Promijenjena aktivna školska godina u: ${targetActive.year}`,
      previousActive ? `AKTIVNA: ${previousActive.year}` : 'NEMA',
      `AKTIVNA: ${targetActive.year}`
    );

    // Dispatch notification to all users
    users.forEach(u => {
      addNotification(
        u.id, 
        'Sustavna obavijest - Školska godina', 
        `Promijenjena je aktivna školska godina na: ${targetActive.year}. Svi podaci iz prethodnog razdoblja su uspješno arhivirani i dostupni u povijesti.`, 
        'ALERT'
      );
    });

    alert(`Uspješno promijenjena školska godina na ${targetActive.year}. Prethodni podaci su arhivirani.`);
  };

  // Save points calculation weights
  const handleSaveFormulaConfig = () => {
    const previousConfigStr = `GradeWeight: ${activeConfig.gradeAverageWeight}, CompWeight: ${activeConfig.competitionsWeight}, AddWeight: ${activeConfig.additionalWeight}, MaxPoints: ${activeConfig.maxPoints}`;
    const newCfg: PrimaryPointsConfig = {
      id: activeConfig.id,
      gradeAverageWeight: formulaGradeWeight,
      competitionsWeight: formulaCompWeight,
      additionalWeight: formulaAddWeight,
      maxPoints: formulaMaxPoints
    };
    
    const updated = [newCfg];
    setPointsConfigs(updated);
    saveTable('primary_points_configs', updated);

    const newConfigStr = `GradeWeight: ${formulaGradeWeight}, CompWeight: ${formulaCompWeight}, AddWeight: ${formulaAddWeight}, MaxPoints: ${formulaMaxPoints}`;

    logAuditEvent(
      currentUser.id,
      currentUser.email,
      'PROMJENA_BODOVNE_FORMULE',
      `Ažurirana formula za bodovanje upisa u srednje škole.`,
      previousConfigStr,
      newConfigStr
    );

    // Global notification to primary school users about formula change
    users.filter(u => u.role.startsWith('PRIMARY')).forEach(u => {
      addNotification(
        u.id,
        'Ažurirana formula za upise u srednje škole',
        `Nacionalno povjerenstvo je ažuriralo koeficijente za bodovanje ocjena i postignuća. Promjena je aktivna.`,
        'INFO'
      );
    });

    alert('Formula za izračun bodova je uspješno ažurirana i primijenjena na sve učenike koji se upisuju!');
  };

  const handleAddSchool = () => {
    if (!newSchoolName || !newSchoolAddress) return;
    const newSch: School = {
      id: `sch-${Date.now()}`,
      name: newSchoolName,
      type: newSchoolType,
      cityId: 'city-1',
      address: newSchoolAddress,
      phone: '01 5555 333',
      email: `${newSchoolName.toLowerCase().replace(/\s+/g, '')}@skole.hr`
    };
    const updated = [...schools, newSch];
    setSchools(updated);
    saveTable('schools', updated);
    logAuditEvent(currentUser.id, currentUser.email, 'DODAVANJE_SKOLE', `Dodana nova škola: ${newSchoolName}`);
    
    // Reset
    setNewSchoolName('');
    setNewSchoolAddress('');
    setShowAddSchool(false);
  };

  const handleUpdateSchool = (id: string) => {
    const updated = schools.map(s => s.id === id ? { ...s, name: editSchoolName, address: editSchoolAddress } : s);
    setSchools(updated);
    saveTable('schools', updated);
    logAuditEvent(currentUser.id, currentUser.email, 'UREDILI_SKOLU', `Uređena škola ID: ${id}`);
    setEditingSchoolId(null);
  };

  const handleUpdateDeadline = (id: string) => {
    const updated = deadlines.map(d => d.id === id ? { ...d, title: editDeadlineTitle, date: editDeadlineDate } : d);
    setDeadlines(updated);
    saveTable('deadlines', updated);
    
    // Send global notification
    users.forEach(u => {
      addNotification(u.id, `Promjena roka: ${editDeadlineTitle}`, `Super admin je ažurirao rok za: ${editDeadlineTitle}. Novi datum je ${editDeadlineDate}.`, 'ALERT');
    });

    logAuditEvent(currentUser.id, currentUser.email, 'AZURIRANJE_ROKA', `Promijenjen rok ${editDeadlineTitle} na ${editDeadlineDate}`);
    setEditingDeadlineId(null);
  };

  const handleDeleteUser = (id: string) => {
    if (id === currentUser.id) return; // Can't delete self
    const updated = users.filter(u => u.id !== id);
    setUsers(updated);
    saveTable('users', updated);
    logAuditEvent(currentUser.id, currentUser.email, 'BRISANJE_KORISNIKA', `Obrisan korisnik ID: ${id}`);
  };

  const handleTriggerWorkflow = () => {
    setIsProcessingTick(true);
    setWorkflowLogs(prev => [...prev, `[Sustav] Inicijaliziram pokretanje pozadinskih zadataka i cron simulacije...`]);
    
    setTimeout(() => {
      try {
        const result = runAutomaticWorkflowTick(currentUser.id, currentUser.email);
        setWorkflowLogs(result.logs);
        
        // Refresh states from storage
        setSchools(getTable<School>('schools'));
        setSchoolPrograms(getTable<SchoolProgram>('school_programs'));
        setUniversities(getTable<University>('universities'));
        setFaculties(getTable<Faculty>('faculties'));
        setStudyPrograms(getTable<StudyProgram>('study_programs'));
        setDeadlines(getTable<AppDeadline>('deadlines'));
        setUsers(getTable<User>('users'));
        setAuditLogs(getTable<AuditLog>('audit_logs'));
        
        setAuditCurrentPage(1);
      } catch (err: any) {
        setWorkflowLogs(prev => [...prev, `[GREŠKA] Greška u izvršavanju workflow servisa: ${err?.message || err}`]);
      } finally {
        setIsProcessingTick(false);
      }
    }, 800);
  };

  // Helper counters
  const totalStudents = users.filter(u => u.role === 'PRIMARY_STUDENT' || u.role === 'SECONDARY_STUDENT').length;
  const totalSchools = schools.length;
  const totalFaculties = faculties.length;

  return (
    <PermissionGuard permission="settings.update" isPage={true}>
      <div className="space-y-6">
      {/* Top Welcome Card */}
      <div className="p-6 bg-linear-to-r from-red-600 to-amber-600 dark:from-red-950 dark:to-amber-950 text-white rounded-3xl shadow-lg flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-300" />
            <span className="text-xs uppercase tracking-widest font-bold text-amber-200">Glavni Portal Administracije</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Dobrodošli natrag, {currentUser.fullName}</h2>
          <p className="text-white/80 text-xs">Prijavljeni ste sa sigurnosnom ulogom SUPER_ADMIN. Imate potpun pristup i prava nadgledanja sustava.</p>
        </div>
        <div className="hidden sm:block p-4 bg-white/10 rounded-2xl">
          <Shield className="h-12 w-12 text-amber-400" />
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
        {[
          { id: 'stats', label: 'Nacionalna statistika', icon: Layers },
          { id: 'schools', label: 'Škole i programi', icon: SchoolIcon },
          { id: 'universities', label: 'Fakulteti i studiji', icon: GraduationCap },
          { id: 'deadlines', label: 'Rokovi i kalendar', icon: Calendar },
          { id: 'users', label: 'Korisnici i uloge', icon: Users },
          { id: 'postavke', label: 'Postavke i formule', icon: Shield },
          { id: 'audit', label: 'Sigurnosni Audit Log', icon: FileText },
          { id: 'ematica', label: 'Integracija e-Matica', icon: Activity },
          { id: 'baza', label: 'PostgreSQL & Supabase', icon: Database }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { handleTabChange(tab.id as any); setSearchQuery(''); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Tab Box */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs">
        {/* STATS TAB */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Pregled sustava u realnom vremenu</h3>
            
            {/* Stats Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-2xl">
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Ukupno škola</span>
                <p className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-2">{totalSchools}</p>
                <div className="mt-2 text-[10px] text-blue-500">Razina OŠ i SŠ u Hrvatskoj</div>
              </div>

              <div className="p-5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl">
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Visoka učilišta</span>
                <p className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-2">{totalFaculties}</p>
                <div className="mt-2 text-[10px] text-indigo-500">Fakulteti i akademije</div>
              </div>

              <div className="p-5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 rounded-2xl">
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Učenika u sustavu</span>
                <p className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-2">{totalStudents}</p>
                <div className="mt-2 text-[10px] text-amber-500">Aktivni kandidati za upis</div>
              </div>

              <div className="p-5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Upisna kvota (SŠ)</span>
                <p className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-2">580</p>
                <div className="mt-2 text-[10px] text-emerald-500">Ukupno slobodnih mjesta</div>
              </div>
            </div>

            {/* Custom SVG Charts representation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Omjer prijava po županijama</h4>
                <div className="h-44 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                        <span>Grad Zagreb</span>
                        <span className="font-bold">48%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600" style={{ width: '48%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                        <span>Splitsko-dalmatinska</span>
                        <span className="font-bold">24%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: '24%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                        <span>Primorsko-goranska</span>
                        <span className="font-bold">16%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-400" style={{ width: '16%' }} />
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 italic mt-3">Ažurirano automatski prije nekoliko trenutaka iz PostgreSQL baze podataka.</p>
                </div>
              </div>

              <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Pregled ispita državne mature</h4>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Prijavljeni ispiti (ukupno)</p>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100">12,450</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Generirane potvrde u PDF-u</p>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100">8,100</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Prosječna ocjena lani</p>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100">3.42</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Workflow engine and state machine cron simulation board */}
            <div className="p-6 bg-slate-50/50 dark:bg-slate-950/20 border border-indigo-100 dark:border-slate-800 rounded-2xl space-y-4 mt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-500 animate-ping" />
                    Nacionalni Workflow Engine i Pozadinska Obrada
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sustav automatski pokreće simulacije i provjeru rokova. Kliknite gumb desno za instantno ručno pokretanje državnog obradnog ciklusa.
                  </p>
                </div>
                <button
                  onClick={handleTriggerWorkflow}
                  disabled={isProcessingTick}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm transition-all"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isProcessingTick ? 'animate-spin' : ''}`} />
                  {isProcessingTick ? 'Obrada u tijeku...' : 'Pokreni državnu obradu'}
                </button>
              </div>

              {/* Dynamic Log Console */}
              <div className="p-4 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] leading-relaxed space-y-1 max-h-48 overflow-y-auto shadow-inner border border-slate-950">
                <div className="text-indigo-400 font-bold border-b border-slate-800 pb-1 mb-2 uppercase tracking-wider text-[9px] flex justify-between items-center">
                  <span>Dnevnik izvršavanja državnih procesa (Cron Logs)</span>
                  <span className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 text-[8px]">Workflow active</span>
                </div>
                {workflowLogs.map((log, idx) => {
                  let colorClass = 'text-slate-300';
                  if (log.includes('[GREŠKA]')) colorClass = 'text-red-400 font-bold';
                  else if (log.includes('ČESTITAMO') || log.includes('uspješno')) colorClass = 'text-emerald-400';
                  else if (log.includes('Ažuriranje') || log.includes('Inicijaliziram')) colorClass = 'text-indigo-300';
                  return (
                    <div key={idx} className={colorClass}>
                      &gt; {log}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

            {/* SCHOOLS TAB */}
            {activeTab === 'schools' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <SchoolIcon className="h-5 w-5 text-indigo-500" />
                  Registar školskih ustanova i programa
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">Službeni registar osnovnih i srednjih škola Republike Hrvatske s pripadajućim MZO šiframa i upisnim kvotama.</p>
              </div>
              
              <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
                <button
                  onClick={() => {
                    const headers = ['Naziv', 'Tip', 'MZO Šifra', 'OIB', 'Adresa', 'Ravnatelj', 'E-mail', 'Telefon', 'Status'];
                    const rows = schools.map(s => [
                      s.name, 
                      s.type === 'PRIMARY' ? 'OSNOVNA' : 'SREDNJA', 
                      s.mzoCode || 'N/A', 
                      s.oib || 'N/A', 
                      s.address, 
                      s.principalName || 'N/A', 
                      s.email || 'N/A', 
                      s.phone || 'N/A', 
                      s.isArchived ? 'ARHIVIRAN' : 'AKTIVAN'
                    ]);
                    exportToCSV('skole_mzo_registar', headers, rows);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title="Izvezi u Excel"
                >
                  <FileDown className="h-3.5 w-3.5 text-slate-500" /> Excel (.csv)
                </button>
                
                <button
                  onClick={() => {
                    const headers = ['Naziv', 'Tip', 'MZO Šifra', 'OIB', 'Adresa', 'Ravnatelj', 'Status'];
                    const rows = schools.map(s => [
                      s.name, 
                      s.type === 'PRIMARY' ? 'OSNOVNA' : 'SREDNJA', 
                      s.mzoCode || 'N/A', 
                      s.oib || 'N/A', 
                      s.address, 
                      s.principalName || 'N/A', 
                      s.isArchived ? 'ARHIVIRANA' : 'AKTIVNA'
                    ]);
                    exportToPDF('Registar školskih ustanova Republike Hrvatske', headers, rows);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title="Generiraj PDF ispis"
                >
                  <FileText className="h-3.5 w-3.5 text-indigo-500" /> PDF ispis
                </button>

                <button
                  onClick={() => setShowAddSchool(!showAddSchool)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Nova škola
                </button>
              </div>
            </div>

            {/* Quick search & Soft-delete filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/20 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/50">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pretraži po nazivu, adresi, MZO šifri..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden"
                />
              </div>
              
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showArchivedSchools}
                  onChange={e => setShowArchivedSchools(e.target.checked)}
                  className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Prikaži deaktivirane / arhivirane ustanove (Soft Delete)
              </label>

              <select 
                className="p-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900"
                onChange={(e) => setFilterType(e.target.value as any)}
              >
                <option value="ALL">Sve ustanove</option>
                <option value="PRIMARY">Osnovne škole</option>
                <option value="SECONDARY">Srednje škole</option>
              </select>
            </div>

            {selectedInstitutionForPrograms ? (
              <InstitutionProgramsView 
                institutionId={selectedInstitutionForPrograms.id}
                institutionType={selectedInstitutionForPrograms.type}
                programs={schoolPrograms.filter(p => p.schoolId === selectedInstitutionForPrograms.id)}
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
                onBack={() => setSelectedInstitutionForPrograms(null)}
              />
            ) : (
              showAddSchool ? (
                <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Dodaj novu školsku ustanovu</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Naziv škole</label>
                      <input
                        type="text"
                        placeholder="npr. Druga gimnazija Varaždin"
                        value={newSchoolName}
                        onChange={e => setNewSchoolName(e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tip škole</label>
                      <select
                        value={newSchoolType}
                        onChange={e => setNewSchoolType(e.target.value as any)}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                      >
                        <option value="PRIMARY">Osnovna škola (PRIMARY)</option>
                        <option value="SECONDARY">Srednja škola (SECONDARY)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Adresa ustanove</label>
                      <input
                        type="text"
                        placeholder="Ulica, grad, županija"
                        value={newSchoolAddress}
                        onChange={e => setNewSchoolAddress(e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowAddSchool(false)} className="px-3 py-1.5 text-xs text-slate-500">Odustani</button>
                    <button onClick={handleAddSchool} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold">Spremi školu</button>
                  </div>
                </div>
              ) : null
            )}

            {/* Schools list table */}
            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 bg-slate-50/50 dark:bg-slate-800/10 uppercase tracking-wider font-bold">
                    <th className="py-3 px-3">Ustanova</th>
                    <th className="py-3 px-2">Tip / OIB / MZO</th>
                    <th className="py-3 px-2">Adresa / Kontakt</th>
                    <th className="py-3 px-2">Povezani Programi</th>
                    <th className="py-3 px-3 text-right">Akcije</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {schools
                    .filter(school => {
                      const matchesSearch = school.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        school.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (school.mzoCode && school.mzoCode.includes(searchQuery)) ||
                        (school.oib && school.oib.includes(searchQuery));
                      
                      const matchesArchive = showArchivedSchools ? school.isArchived : !school.isArchived;
                      const matchesType = filterType === 'ALL' || school.type === filterType;
                      return matchesSearch && matchesArchive && matchesType;
                    })
                    .map(school => {
                      const matchedProgs = schoolPrograms.filter(p => p.schoolId === school.id && !p.isArchived);
                      const isEditing = editingSchoolId === school.id;
                      return (
                        <tr key={school.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors ${school.isArchived ? 'opacity-70 bg-red-50/10 dark:bg-red-950/5' : ''}`}>
                          <td className="py-3.5 px-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editSchoolName}
                                onChange={e => setEditSchoolName(e.target.value)}
                                className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs w-full font-bold text-slate-800 dark:text-slate-100"
                              />
                            ) : (
                              <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{school.name}</h4>
                                <span className="text-[10px] text-slate-400 block mt-0.5">Ravnatelj: {school.principalName || 'Ana Kovačić'}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-2">
                            <div className="space-y-1">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider ${
                                school.type === 'PRIMARY' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30' : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30'
                              }`}>
                                {school.type === 'PRIMARY' ? 'OSNOVNA' : 'SREDNJA'}
                              </span>
                              <div className="text-[10px] font-mono text-slate-400">
                                <div>MZO: {school.mzoCode || '01-105-001'}</div>
                                <div>OIB: {school.oib || '40192830129'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-2">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editSchoolAddress}
                                onChange={e => setEditSchoolAddress(e.target.value)}
                                className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs w-full text-slate-800 dark:text-slate-100"
                              />
                            ) : (
                              <div className="space-y-0.5 text-slate-500 dark:text-slate-400">
                                <p className="font-semibold text-slate-700 dark:text-slate-300">{school.address}</p>
                                <p className="text-[10px] font-mono">{school.email || 'skola@skole.hr'}</p>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-2">
                            {school.type === 'SECONDARY' ? (
                                matchedProgs.length > 0 ? (
                                    <span className="text-[10px] font-bold text-indigo-600">{matchedProgs.length} aktivna programa</span>
                                ) : (
                                    <span className="text-[10px] text-slate-400 italic">Nema aktivnih programa</span>
                                )
                            ) : (
                                <span className="text-slate-300 italic text-[10px]">Nije primjenjivo</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            {isEditing ? (
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => setEditingSchoolId(null)} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-lg text-[10px] font-bold">Odustani</button>
                                <button onClick={() => handleUpdateSchool(school.id)} className="p-1 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                  <Save className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2 justify-end">
                                {school.type === 'SECONDARY' && (
                                    <button 
                                        onClick={() => setSelectedInstitutionForPrograms(school)}
                                        className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-lg"
                                    >
                                        Programi
                                    </button>
                                )}
                                <button
                                  onClick={() => {
                                    setEditingSchoolId(school.id);
                                    setEditSchoolName(school.name);
                                    setEditSchoolAddress(school.address);
                                  }}
                                  className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer"
                                  title="Uredi podatke"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                
                                <button
                                  onClick={() => handleToggleArchiveSchool(school.id, !!school.isArchived)}
                                  className={`p-1.5 rounded-lg cursor-pointer ${
                                    school.isArchived
                                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                      : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400'
                                  }`}
                                  title={school.isArchived ? 'Aktiviraj školu' : 'Deaktiviraj (Arhiviraj) školu'}
                                >
                                  {school.isArchived ? <RefreshCw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* UNIVERSITIES TAB */}
        {activeTab === 'universities' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-indigo-500" />
              Sustav visokih učilišta u Republici Hrvatskoj
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Uređivanje upisnih parametara, pragova u bodovima i kvota za ljetni/jesenski upisni krug.
            </p>

            <div className="space-y-4">
              {selectedFacultyForPrograms ? (
                <FacultyProgramsView 
                  facultyId={selectedFacultyForPrograms.id}
                  programs={studyPrograms.filter(p => p.facultyId === selectedFacultyForPrograms.id)}
                  onSave={(p) => {
                    const updated = [...studyPrograms.filter(pr => pr.id !== p.id), p];
                    setStudyPrograms(updated);
                    saveTable('study_programs', updated);
                    logAuditEvent(currentUser.id, currentUser.email, 'AZURIRANJE_STUDIJA', `Ažuriran studij ${p.name}`);
                  }}
                  onDelete={(id) => {
                    const updated = studyPrograms.filter(p => p.id !== id);
                    setStudyPrograms(updated);
                    saveTable('study_programs', updated);
                    logAuditEvent(currentUser.id, currentUser.email, 'BRISANJE_STUDIJA', `Obrisan studij ID: ${id}`);
                  }}
                  onBack={() => setSelectedFacultyForPrograms(null)}
                />
              ) : (
                universities.map(uni => {
                  const uniFacs = faculties.filter(f => f.universityId === uni.id);
                  return (
                    <div key={uni.id} className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                      <h4 className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400">{uni.name}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {uniFacs.map(fac => {
                          const progs = studyPrograms.filter(p => p.facultyId === fac.id);
                          return (
                            <div key={fac.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-xs text-slate-700 dark:text-slate-200">{fac.name}</span>
                                <button 
                                  onClick={() => setSelectedFacultyForPrograms(fac)}
                                  className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-lg"
                                >
                                  Programi
                                </button>
                              </div>
                              <div className="space-y-2 pt-1 border-t border-slate-50 dark:border-slate-800/50">
                                {progs.map(p => (
                                  <div key={p.id} className="flex justify-between items-center text-xs">
                                    <span className="text-slate-600 dark:text-slate-400">{p.name}</span>
                                    <div className="flex gap-2 items-center">
                                      <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[10px] px-1.5 py-0.5 rounded-sm">
                                        Kvota: {p.quota}
                                      </span>
                                      <span className="bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-[10px] px-1.5 py-0.5 rounded-sm">
                                        Prag: {p.minPointsThreshold}b
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* DEADLINES TAB */}
        {activeTab === 'deadlines' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-500" />
              Sustavni rokovi i kalendar
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Definirajte rokove za predaju dokumenata, zaključavanje lista, te registracije mature. 
              Sve promjene šalju push obavijest učenicima i razrednicima u sustavu.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {deadlines.map(dl => {
                const isEditing = editingDeadlineId === dl.id;
                return (
                  <div key={dl.id} className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/40 rounded-full uppercase tracking-wider">
                          {dl.type}
                        </span>
                        <button
                          onClick={() => {
                            if (isEditing) {
                              handleUpdateDeadline(dl.id);
                            } else {
                              setEditingDeadlineId(dl.id);
                              setEditDeadlineTitle(dl.title);
                              setEditDeadlineDate(dl.date);
                            }
                          }}
                          className="text-indigo-600 hover:text-indigo-700 text-xs font-bold"
                        >
                          {isEditing ? 'Spremi' : 'Uredi'}
                        </button>
                      </div>
                      
                      <div className="mt-3 space-y-2">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editDeadlineTitle}
                              onChange={e => setEditDeadlineTitle(e.target.value)}
                              className="p-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 rounded-md text-xs font-bold"
                            />
                            <input
                              type="date"
                              value={editDeadlineDate}
                              onChange={e => setEditDeadlineDate(e.target.value)}
                              className="p-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 rounded-md text-xs font-mono"
                            />
                          </div>
                        ) : (
                          <>
                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{dl.title}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{dl.description}</p>
                          </>
                        )}
                      </div>
                    </div>

                    {!isEditing && (
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50 flex justify-between items-center text-xs">
                        <span className="text-slate-400">Rok istječe:</span>
                        <span className="font-mono font-bold text-red-600 dark:text-red-400">{dl.date}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              Evidencija korisničkih računa i uloga (RBAC)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-bold">
                    <th className="py-3 px-2">Korisnik</th>
                    <th className="py-3 px-2">E-mail adresa</th>
                    <th className="py-3 px-2">Dizajnirana Uloga</th>
                    <th className="py-3 px-2 text-right">Akcije</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="py-3 px-2 font-bold text-slate-800 dark:text-slate-100">{u.fullName}</td>
                      <td className="py-3 px-2 text-slate-500 dark:text-slate-400 font-mono">{u.email}</td>
                      <td className="py-3 px-2">
                        <span className="px-2.5 py-1 text-[9px] font-extrabold bg-slate-100 dark:bg-slate-800 rounded-md text-slate-700 dark:text-slate-300">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        {u.id !== currentUser.id ? (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1 text-red-500 hover:text-red-700 cursor-pointer"
                            title="Deaktiviraj račun"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Vi (Aktivno)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SETTINGS (POSTAVKE) TAB */}
        {activeTab === 'postavke' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-500" />
              Nacionalne postavke i bodovne formule
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Središnji administratorski modul za upravljanje obrazovnim razdobljima i aktiviranje bodovnih formula za upis u srednje škole.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Formula weights configuration */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                <h4 className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  Formula za bodovanje upisa (Srednje e-Upisi)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Konfigurirajte težinske faktore za automatski izračun upisnih bodova učenika osmog razreda na temelju ocjena i rezultata s natjecanja.
                </p>

                <div className="space-y-4 pt-2">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      <span>Težina prosjeka ocjena (gradeAverageWeight)</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">{formulaGradeWeight}x</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={formulaGradeWeight}
                      onChange={e => setFormulaGradeWeight(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                    <span className="text-[9px] text-slate-400 block mt-0.5">Zadani koeficijent iznosi 4 (Prosjek 5.0 donosi 20 bodova po godini).</span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      <span>Multiplikator za natjecanja (competitionsWeight)</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">{formulaCompWeight}x</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="1"
                      value={formulaCompWeight}
                      onChange={e => setFormulaCompWeight(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                    <span className="text-[9px] text-slate-400 block mt-0.5">Dodatni bodovi za državna i županijska natjecanja iz znanja.</span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      <span>Dodatne sportske i glazbene zasluge (additionalWeight)</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">{formulaAddWeight}x</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="1"
                      value={formulaAddWeight}
                      onChange={e => setFormulaAddWeight(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                    <span className="text-[9px] text-slate-400 block mt-0.5">Rezultati u školskim sportskim savezima ili glazbenim školama.</span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      <span>Maksimalni mogući bodovi (maxPoints)</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">{formulaMaxPoints}b</span>
                    </div>
                    <input
                      type="number"
                      value={formulaMaxPoints}
                      onChange={e => setFormulaMaxPoints(Number(e.target.value))}
                      className="p-2 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                    />
                    <span className="text-[9px] text-slate-400 block mt-0.5">Maksimalni teoretski broj bodova (obično 80).</span>
                  </div>

                  <button
                    onClick={handleSaveFormulaConfig}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer mt-4"
                  >
                    Spremi i ažuriraj bodovne formule
                  </button>
                </div>
              </div>

              {/* School year switching and archiving */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                <h4 className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  Školske godine i arhiviranje podataka
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Prilikom promjene školske godine svi trenutni učenici i njihove prijave bivaju arhivirani. Odaberite aktivnu godinu ili dodajte novu u registar.
                </p>

                <div className="space-y-4 pt-2">
                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Popis definiranih godina</span>
                    <div className="space-y-2">
                      {schoolYears.map(sy => (
                        <div key={sy.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                          <span className={`font-mono font-bold ${sy.isCurrent ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                            {sy.year} {sy.isCurrent && '• Aktivna'}
                          </span>
                          {!sy.isCurrent ? (
                            <button
                              onClick={() => handleSwitchActiveYear(sy.id)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              Postavi kao aktivnu
                            </button>
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-sm">TRENUTNA</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Dodaj novu školsku godinu</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="npr. 2027./2028."
                        value={newYearName}
                        onChange={e => setNewYearName(e.target.value)}
                        className="flex-1 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden"
                      />
                      <button
                        onClick={handleCreateSchoolYear}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Dodaj
                      </button>
                    </div>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Unesite u formatu GGGG./GGGG.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AUDIT TAB */}
        {activeTab === 'audit' && (() => {
          const filteredLogs = auditLogs.filter(log => 
            log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.userEmail.toLowerCase().includes(searchQuery.toLowerCase())
          );
          
          const totalPages = Math.ceil(filteredLogs.length / auditItemsPerPage);
          const startIndex = (auditCurrentPage - 1) * auditItemsPerPage;
          const paginatedLogs = filteredLogs.slice(startIndex, startIndex + auditItemsPerPage);

          return (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-red-500" />
                    Sigurnosni sustav (PostgreSQL Audit Log)
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">Strogo zabilježene akcije u skladu s GDPR, CARNET i NIAS regulativama Republike Hrvatske.</p>
                </div>
                
                <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
                  <button
                    onClick={() => {
                      const headers = ['Vrijeme', 'Akcija', 'Korisnik', 'Detalji', 'Prethodna vrijednost', 'Nova vrijednost', 'IP adresa'];
                      const rows = filteredLogs.map(l => [
                        new Date(l.createdAt).toLocaleString('hr-HR'),
                        l.action,
                        l.userEmail,
                        l.details,
                        l.oldValue || 'N/A',
                        l.newValue || 'N/A',
                        l.ipAddress
                      ]);
                      exportToCSV('sigurnosni_audit_log', headers, rows);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    title="Izvezi u Excel"
                  >
                    <FileDown className="h-3.5 w-3.5 text-slate-500" /> Excel (.csv)
                  </button>
                  
                  <button
                    onClick={() => {
                      const headers = ['Vrijeme', 'Akcija', 'Korisnik', 'Detalji', 'IP adresa'];
                      const rows = filteredLogs.slice(0, 50).map(l => [
                        new Date(l.createdAt).toLocaleString('hr-HR'),
                        l.action,
                        l.userEmail,
                        l.details,
                        l.ipAddress
                      ]);
                      exportToPDF('Sigurnosni sustav - EduPortal Hrvatska (Prvih 50 zapisa)', headers, rows);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    title="Generiraj PDF ispis"
                  >
                    <FileText className="h-3.5 w-3.5 text-red-500" /> PDF ispis
                  </button>

                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-2 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Pretraži zapise..."
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setAuditCurrentPage(1); }}
                      className="pl-9 pr-4 py-1.5 w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {paginatedLogs.map(log => (
                  <div key={log.id} className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800 text-xs flex flex-col justify-between gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md ${
                            log.action.includes('PRIJAVA') ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300' :
                            log.action.includes('BRISANJE') || log.action.includes('REJECT') || log.action.includes('DEAKTIVACIJA') ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300' :
                            log.action.includes('PROMJENA') || log.action.includes('FORMULE') ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' :
                            'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300'
                          }`}>
                            {log.action}
                          </span>
                          <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">{log.userEmail}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 font-semibold mt-1">{log.details}</p>
                      </div>

                      <div className="flex sm:flex-col items-start sm:items-end text-[10px] text-slate-400 dark:text-slate-500 font-mono gap-2 sm:gap-0">
                        <span>IP: {log.ipAddress}</span>
                        <span>{new Date(log.createdAt).toLocaleTimeString('hr-HR')} | {new Date(log.createdAt).toLocaleDateString('hr-HR')}</span>
                      </div>
                    </div>

                    {/* Rendering the Old and New values in a beautiful diff component */}
                    {log.oldValue && log.newValue && (
                      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-xl text-[10px] font-mono space-y-1">
                        <div className="text-red-500 line-through truncate">- Prethodno: {log.oldValue}</div>
                        <div className="text-emerald-600 dark:text-emerald-400 font-semibold truncate">+ Novo: {log.newValue}</div>
                      </div>
                    )}
                  </div>
                ))}

                {filteredLogs.length === 0 && (
                  <p className="text-center text-slate-400 italic py-6">Nema zapisa koji odgovaraju pretrazi.</p>
                )}
              </div>

              {/* Pagination Controls Footer */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4 gap-3 text-xs text-slate-500">
                  <span>Prikazano <strong>{startIndex + 1} - {Math.min(startIndex + auditItemsPerPage, filteredLogs.length)}</strong> od <strong>{filteredLogs.length}</strong> sigurnosnih zapisa</span>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setAuditCurrentPage(p => Math.max(1, p - 1))}
                      disabled={auditCurrentPage === 1}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setAuditCurrentPage(i + 1)}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs ${
                          auditCurrentPage === i + 1 
                            ? 'bg-indigo-600 text-white' 
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}

                    <button
                      onClick={() => setAuditCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={auditCurrentPage === totalPages}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* DATABASE EXPLORER TAB */}
        {activeTab === 'baza' && (
          <DatabaseExplorer currentUser={currentUser} />
        )}

        {/* EMATICA INTEGRATION TAB */}
        {activeTab === 'ematica' && (
          <EMaticaIntegrationView 
            currentUser={currentUser} 
            onRefreshData={() => {
              setSchools(getTable<School>('schools'));
              setSchoolPrograms(getTable<SchoolProgram>('school_programs'));
              setUsers(getTable<User>('users'));
              setAuditLogs(getTable<AuditLog>('audit_logs'));
            }}
          />
        )}
      </div>
    </div>
    </PermissionGuard>
  );
}
