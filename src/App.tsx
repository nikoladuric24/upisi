/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { User, AppNotification } from './types';
import {
  initDatabase,
  getCurrentUser,
  setCurrentUser,
  getTable,
  saveTable,
  logAuditEvent,
  addNotification
} from './lib/storage';
import { ThemeProvider, useTheme } from './components/ThemeContext';
import { AuthScreen } from './components/AuthScreen';
import { SuperAdminPortal } from './portals/SuperAdminPortal';
import { PrimarySchoolPortal } from './portals/PrimarySchoolPortal';
import { SecondarySchoolPortal } from './portals/SecondarySchoolPortal';
import { UniversityAdminPortal } from './portals/UniversityAdminPortal';
import { RbacProvider, useRbac } from './components/RbacContext';
import { PortalProvider, usePortal } from './components/PortalContext';
import { TimeoutManager } from './components/TimeoutManager';

// Import our custom crafted UI components
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ProfileView } from './components/ProfileView';
import { CalendarView } from './components/CalendarView';
import { ErrorPagesView } from './components/ErrorPagesView';
import { DatabaseExplorer } from './components/DatabaseExplorer';
import { GlobalSearchOverlay } from './components/GlobalSearchOverlay';
import { DetailViewModal } from './components/DetailViewModal';

import {
  GraduationCap,
  Bell,
  Sun,
  Moon,
  LogOut,
  UserCheck,
  ShieldAlert,
  Calendar,
  Layers,
  School,
  AlertCircle,
  FileText,
  Clock
} from 'lucide-react';

interface AppContentProps {
  user: User | null;
  setUser: (user: User | null) => void;
}

function AppContent({ user, setUser }: AppContentProps) {
  const { theme, toggleTheme } = useTheme();
  const { session, hasPermission, reloadSession, logRbacAction, clearSession } = useRbac();
  const { config, portalType } = usePortal();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation states
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [portalTabOverride, setPortalTabOverride] = useState<string>('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Search & Detail drawers states
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [detailType, setDetailType] = useState<'student' | 'teacher' | 'school' | 'faculty' | 'program' | 'document' | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any>(undefined);

  // Keyboard shortcut Ctrl+K listener for global search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize DB and Verify Session on mount
  useEffect(() => {
    initDatabase();
    
    const checkSession = async () => {
      try {
        // Force logout on opening the portal to ensure user is logged out and must explicitly login
        await fetch('/api/shared/auth/logout', { method: 'POST' });
        setCurrentUser(null);
        setUser(null);
        clearSession();
      } catch (err) {
        // Safe fallback
        setCurrentUser(null);
        setUser(null);
        clearSession();
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  // Update notifications when user changes
  useEffect(() => {
    if (user) {
      setNotifications(getTable<AppNotification>('notifications').filter(n => n.userId === user.id));
    } else {
      setNotifications([]);
    }
  }, [user]);

  const handleLogin = (newUser: User) => {
    setCurrentUser(newUser);
    setUser(newUser);
    reloadSession(newUser);
    logRbacAction('Uspješna prijava', 'AAI@EduHr Autentifikacija', undefined, `Korisnik ${newUser.fullName} prijavljen s ulogom ${newUser.role}`);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/shared/auth/logout', { method: 'POST' });
    } catch (e) {}

    if (user) {
      logRbacAction('Odjava', 'AAI@EduHr Autentifikacija', `Uloga: ${user.role}`);
      logAuditEvent(user.id, user.email, 'ODJAVA', `Korisnik ${user.fullName} se uspješno odjavio iz sustava.`);
    }
    setCurrentUser(null);
    setUser(null);
    clearSession();
    setActivePage('dashboard');
    setPortalTabOverride('');
  };

  const handleMarkNotificationRead = (id: string) => {
    const allNotifs = getTable<AppNotification>('notifications');
    const updated = allNotifs.map(n => n.id === id ? { ...n, isRead: true } : n);
    saveTable('notifications', updated);
    if (user) {
      setNotifications(updated.filter(n => n.userId === user.id));
    }
  };

  // Switch role helper for simulator testing (also logs in via backend to be secure!)
  const handleSimulateUser = async (simUser: User) => {
    try {
      const response = await fetch('/api/shared/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: simUser.email })
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
        setUser(data.user);
        reloadSession(data.user);
        setActivePage('dashboard');
        setPortalTabOverride('');
      } else {
        const data = await response.json();
        alert(data.error || 'Simulacija nije uspjela.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handler for sidebar pages and deep-linking tabs
  const handlePageChangeFromSidebar = (page: string, portalTab?: string) => {
    setActivePage(page);
    if (portalTab) {
      setPortalTabOverride(portalTab);
    } else {
      setPortalTabOverride('');
    }
  };

  // Open detailed drawers for search items or list items
  const handleOpenDetail = (type: 'student' | 'teacher' | 'school' | 'faculty' | 'program' | 'document', id: string, data?: any) => {
    setDetailType(type);
    setDetailId(id);
    setDetailData(data);
  };

  const handleCloseDetail = () => {
    setDetailType(null);
    setDetailId(null);
    setDetailData(undefined);
  };

  // Route/Portal Guard Resolver based on RBAC and Domain Split
  const renderActivePortal = () => {
    if (!session || !user) return null;

    // Check if current user is allowed on this portal type
    const isAllowed = config.allowedRoles.includes(user.role);
    if (!isAllowed) {
      return (
        <div className="p-8 text-center bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 rounded-3xl border border-red-200 dark:border-red-900/40">
          <ShieldAlert className="h-12 w-12 mx-auto text-red-600 mb-2 animate-bounce" />
          <h3 className="font-bold">Nedopušten pristup</h3>
          <p className="text-xs mt-1">Vaša uloga ({user.role}) nema ovlasti za rad na portalu <strong>{config.name}</strong>.</p>
          <p className="text-[10px] text-slate-400 mt-2">Molimo prijavite se s odgovarajućim korisničkim računom.</p>
        </div>
      );
    }

    if (user.role === 'SUPER_ADMIN') {
      return <SuperAdminPortal currentUser={user} activeTabOverride={portalTabOverride} />;
    }

    if (portalType === 'FACULTY_ADMISSIONS') {
      if (user.role === 'UNIVERSITY_ADMIN') {
        return <UniversityAdminPortal currentUser={user} activeTabOverride={portalTabOverride} />;
      }
      // High school students, teachers, and admins
      return <SecondarySchoolPortal currentUser={user} activeTabOverride={portalTabOverride} />;
    } else {
      // SECONDARY_ADMISSIONS
      if (user.role === 'PRIMARY_STUDENT' || user.role === 'PRIMARY_HOMEROOM_TEACHER' || user.role === 'PRIMARY_ADMIN') {
        return <PrimarySchoolPortal currentUser={user} activeTabOverride={portalTabOverride} />;
      }
      // Secondary school admins who receive applications
      return <SecondarySchoolPortal currentUser={user} activeTabOverride={portalTabOverride} />;
    }
  };

  const renderActivePage = () => {
    switch (activePage) {
      case 'dashboard':
        return renderActivePortal();
      case 'calendar':
        return <CalendarView />;
      case 'profile':
        return <ProfileView currentUser={user!} />;
      case 'error-pages':
        return <ErrorPagesView onGoHome={() => setActivePage('dashboard')} />;
      case 'database':
        return <DatabaseExplorer currentUser={user!} />;
      default:
        return renderActivePortal();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <GraduationCap className="h-12 w-12 text-indigo-600 animate-bounce" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">EduPortal: Provjera sigurnosne sesije...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-300 flex flex-col font-sans">
      
      {/* Session Inactivity Timeout Modal Manager */}
      <TimeoutManager user={user} onLogout={handleLogout} />

      {/* Global Search Overlay Modal */}
      <GlobalSearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectDetail={handleOpenDetail}
      />

      {/* Detail view Modal Drawer */}
      <DetailViewModal
        type={detailType}
        id={detailId}
        itemData={detailData}
        onClose={handleCloseDetail}
      />

      {/* Unified Top Header Bar */}
      <Header
        currentUser={user}
        notifications={notifications}
        onMarkRead={handleMarkNotificationRead}
        onLogout={handleLogout}
        onOpenSearch={() => setIsSearchOpen(true)}
        onPageChange={(page) => {
          setActivePage(page);
          setPortalTabOverride('');
        }}
      />

      {/* Main Layout Grid with Collapsible Sidebar and Main Content workspace */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Lijevi Sidebar component */}
        <Sidebar
          currentUser={user}
          activePage={activePage}
          onPageChange={handlePageChangeFromSidebar}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />

        {/* Dynamic content workspace */}
        <div className="flex-1 overflow-y-auto">
          <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left 9-cols: Current page workspace view */}
            <section className="lg:col-span-9 space-y-6">
              {renderActivePage()}
            </section>

            {/* Right 3-cols: Live Interactive Role Switcher / Simulator Panel */}
            <aside className="lg:col-span-3 space-y-5">
              
              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl shadow-xs">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 mb-3 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-indigo-500" />
                  Brza izmjena uloge
                </h3>
                
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                  Sustav koristi strogi <strong>Role-Based Access Control (RBAC)</strong>. Odaberite ulogu dopuštenu na ovom portalu:
                </p>

                <div className="space-y-2">
                  {[
                    { id: 'usr-admin', name: 'Nikola Đurić', role: 'SUPER_ADMIN', desc: 'Sistemski nadzor' },
                    { id: 'usr-prim-stud', name: 'Luka Marić', role: 'PRIMARY_STUDENT', desc: 'Kandidat 8. r. (e-Upisi)' },
                    { id: 'usr-prim-teach', name: 'Marko Horvat', role: 'PRIMARY_HOMEROOM_TEACHER', desc: 'Razrednik 8.A' },
                    { id: 'usr-sec-stud', name: 'Ivan Jurić', role: 'SECONDARY_STUDENT', desc: 'Maturant (Postani Student)' },
                    { id: 'usr-sec-teach', name: 'Petra Novak', role: 'SECONDARY_HOMEROOM_TEACHER', desc: 'Razrednik 4.A' },
                    { id: 'usr-uni-admin', name: 'Prof. Stjepan Car', role: 'UNIVERSITY_ADMIN', desc: 'Ured za upise (FER)' }
                  ]
                  .filter(sim => config.allowedRoles.includes(sim.role))
                  .map(sim => (
                    <button
                      key={sim.id}
                      onClick={() => handleSimulateUser({
                        id: sim.id,
                        email: `${sim.name.toLowerCase().replace(/\s+/g, '')}@skole.hr`,
                        fullName: sim.name,
                        role: sim.role as any,
                        createdAt: new Date().toISOString()
                      })}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all text-xs flex flex-col cursor-pointer ${
                        user.role === sim.role
                          ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-400 dark:border-indigo-800'
                          : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 border-slate-100 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{sim.name}</span>
                        {user.role === sim.role && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5">{sim.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Permission-Based Navigation Links */}
              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl shadow-xs space-y-3 animate-fade-in">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-emerald-500" />
                  Dozvoljene Akcije (RBAC)
                </h4>
                <div className="space-y-1.5">
                  {hasPermission('users.read') && (
                    <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 py-1 px-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" /> Upravljanje korisnicima i ulogama
                    </div>
                  )}
                  {hasPermission('schools.update') && (
                    <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 py-1 px-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Uređivanje upisnih kvota
                    </div>
                  )}
                  {hasPermission('grades.update') && (
                    <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 py-1 px-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Zaključavanje & ažuriranje ocjena
                    </div>
                  )}
                  {hasPermission('matura.register') && (
                    <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 py-1 px-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Prijava ispita državne mature
                    </div>
                  )}
                  {hasPermission('applications.update') && (
                    <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 py-1 px-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500" /> Uređivanje liste prioriteta
                    </div>
                  )}
                  {hasPermission('audit.read') && (
                    <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 py-1 px-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-600" /> Pristup sigurnosnom audit logu
                    </div>
                  )}
                </div>
              </div>

              {/* Brand and Domain Info Card */}
              <div className="p-5 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-slate-900/60 dark:to-slate-900/60 border border-indigo-100/30 dark:border-slate-800 rounded-3xl space-y-3">
                <h4 className="font-bold text-xs text-indigo-900 dark:text-indigo-300">Aktivna domena</h4>
                <div className="space-y-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  <p>✔ <strong>Naziv:</strong> {config.name}</p>
                  <p>✔ <strong>Modul:</strong> {config.portalType === 'FACULTY_ADMISSIONS' ? 'Nacionalni visokoškolski' : 'Nacionalni srednjoškolski'}</p>
                  <p>✔ <strong>Sigurnost:</strong> Kolačići vezani isključivo uz aktivnu domenu (host-only).</p>
                </div>
              </div>

            </aside>

          </main>
        </div>

      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-[10px] text-slate-400 border-t border-slate-200/50 dark:border-slate-800/50 mt-auto bg-white dark:bg-slate-950 transition-colors">
        <p>© 2026 EduPortal Hrvatska. Sva prava pridržana. Razvijeno u skladu s CARNET, NIAS i AZOO standardima.</p>
      </footer>

    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  return (
    <PortalProvider>
      <ThemeProvider>
        <RbacProvider currentUser={user}>
          <AppContent user={user} setUser={setUser} />
        </RbacProvider>
      </ThemeProvider>
    </PortalProvider>
  );
}
