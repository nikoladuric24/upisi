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
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);

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

  // Initialize DB and Load User
  useEffect(() => {
    initDatabase();
    const loggedUser = getCurrentUser();
    setUser(loggedUser);
    if (loggedUser) {
      setNotifications(getTable<AppNotification>('notifications').filter(n => n.userId === loggedUser.id));
    }
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
    // Security log for audit:
    logRbacAction('Uspješna prijava', 'AAI@EduHr Autentifikacija', undefined, `Korisnik ${newUser.fullName} prijavljen s ulogom ${newUser.role}`);
  };

  const handleLogout = () => {
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

  // Switch role helper for simulator testing
  const handleSimulateUser = (simUser: User) => {
    setCurrentUser(simUser);
    setUser(simUser);
    reloadSession(simUser);
    setActivePage('dashboard');
    setPortalTabOverride('');
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

  // Route/Portal Guard Resolver based on RBAC
  const renderActivePortal = () => {
    if (!session) return null;

    if (session.roles.includes('SUPER_ADMIN')) {
      return <SuperAdminPortal currentUser={user!} activeTabOverride={portalTabOverride} />;
    } else if (
      session.roles.includes('PRIMARY_ADMIN') ||
      session.roles.includes('PRIMARY_HOMROOM_TEACHER') || // support typo check
      session.roles.includes('PRIMARY_HOMEROOM_TEACHER') ||
      session.roles.includes('PRIMARY_STUDENT')
    ) {
      return <PrimarySchoolPortal currentUser={user!} activeTabOverride={portalTabOverride} />;
    } else if (
      session.roles.includes('SECONDARY_ADMIN') ||
      session.roles.includes('SECONDARY_HOMROOM_TEACHER') || // support typo check
      session.roles.includes('SECONDARY_HOMEROOM_TEACHER') ||
      session.roles.includes('SECONDARY_STUDENT')
    ) {
      return <SecondarySchoolPortal currentUser={user!} activeTabOverride={portalTabOverride} />;
    } else if (session.roles.includes('UNIVERSITY_ADMIN')) {
      return <UniversityAdminPortal currentUser={user!} activeTabOverride={portalTabOverride} />;
    } else {
      return (
        <div className="p-8 text-center bg-red-50 text-red-800 rounded-3xl border border-red-200">
          <ShieldAlert className="h-12 w-12 mx-auto text-red-600 mb-2" />
          <h3 className="font-bold">Greška u autorizaciji (RBAC)</h3>
          <p className="text-xs mt-1">Vaš korisnički račun nema definirane ovlasti u sustavu EduPortal Hrvatska.</p>
        </div>
      );
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

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-300 flex flex-col font-sans">
      
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
                  EduPortal Simulator
                </h3>
                
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                  Aplikacija koristi strogi <strong>Role-Based Access Control (RBAC)</strong>. Zamijenite ulogu jednim klikom kako biste isprobali rute i portale iz različitih perspektiva.
                </p>

                <div className="space-y-2">
                  {[
                    { id: 'usr-admin', name: 'Nikola Đurić', role: 'SUPER_ADMIN', desc: 'Sistemski nadzor' },
                    { id: 'usr-prim-stud', name: 'Luka Marić', role: 'PRIMARY_STUDENT', desc: 'Kandidat 8. r. (e-Upisi)' },
                    { id: 'usr-prim-teach', name: 'Marko Horvat', role: 'PRIMARY_HOMEROOM_TEACHER', desc: 'Razrednik 8.A' },
                    { id: 'usr-sec-stud', name: 'Ivan Jurić', role: 'SECONDARY_STUDENT', desc: 'Maturant (Postani Student)' },
                    { id: 'usr-sec-teach', name: 'Petra Novak', role: 'SECONDARY_HOMEROOM_TEACHER', desc: 'Razrednik 4.A' },
                    { id: 'usr-uni-admin', name: 'Prof. Stjepan Car', role: 'UNIVERSITY_ADMIN', desc: 'Ured za upise (FER)' }
                  ].map(sim => (
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

              {/* Quick Croatian Info Card */}
              <div className="p-5 bg-linear-to-br from-indigo-50 to-purple-50 dark:from-slate-900 dark:to-slate-900 border border-indigo-100/50 dark:border-slate-800 rounded-3xl space-y-3">
                <h4 className="font-bold text-xs text-indigo-900 dark:text-indigo-300">Tehničke napomene</h4>
                <div className="space-y-2 text-[11px] text-indigo-950/80 dark:text-slate-400 leading-relaxed">
                  <p>✔ <strong>PostgreSQL Baza:</strong> Simulirana relacijska arhitektura s tablicama i brzim ažuriranjima.</p>
                  <p>✔ <strong>Row-Level Security (RLS):</strong> Korisnik vidi isključivo svoje ocjene, prijave i dokumente.</p>
                  <p>✔ <strong>MD3 standardi:</strong> Prilagodljiv dizajn, meki obrubi i light/dark varijante.</p>
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

  useEffect(() => {
    initDatabase();
    setUser(getCurrentUser());
  }, []);

  return (
    <ThemeProvider>
      <RbacProvider currentUser={user}>
        <AppContent user={user} setUser={setUser} />
      </RbacProvider>
    </ThemeProvider>
  );
}
