/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import {
  LayoutDashboard,
  Search,
  ListOrdered,
  GraduationCap,
  Users,
  Calendar,
  Shield,
  Database,
  Activity,
  AlertTriangle,
  Settings,
  Menu,
  ChevronLeft,
  ChevronRight,
  Lock,
  BookOpen,
  FileText
} from 'lucide-react';
import { useRbac } from './RbacContext';
import { User } from '../types';

interface SidebarProps {
  currentUser: User;
  activePage: string; // 'dashboard' | 'calendar' | 'profile' | 'error-pages' | 'database' | etc.
  onPageChange: (page: string, portalTab?: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export function Sidebar({
  currentUser,
  activePage,
  onPageChange,
  isCollapsed,
  setIsCollapsed
}: SidebarProps) {
  const { session, hasPermission } = useRbac();
  const [menuSearch, setMenuSearch] = useState('');

  // Define all possible sidebar items
  const menuGroups = [
    {
      group: 'Nacionalni Moduli',
      items: [
        {
          id: 'dashboard',
          portalTab: 'stats',
          label: 'Nadzorna ploča',
          icon: <LayoutDashboard className="h-4.5 w-4.5 shrink-0" />,
          roles: [] // visible to all
        },
        // Super Admin specific portal tabs
        {
          id: 'dashboard-schools',
          portalTab: 'schools',
          label: 'Registar škola',
          icon: <BookOpen className="h-4.5 w-4.5 shrink-0" />,
          roles: ['SUPER_ADMIN']
        },
        {
          id: 'dashboard-universities',
          portalTab: 'universities',
          label: 'Registar fakulteta',
          icon: <GraduationCap className="h-4.5 w-4.5 shrink-0" />,
          roles: ['SUPER_ADMIN']
        },
        {
          id: 'dashboard-deadlines',
          portalTab: 'deadlines',
          label: 'Sustavni rokovi',
          icon: <Calendar className="h-4.5 w-4.5 shrink-0" />,
          roles: ['SUPER_ADMIN']
        },
        {
          id: 'dashboard-users',
          portalTab: 'users',
          label: 'Evidencija korisnika',
          icon: <Users className="h-4.5 w-4.5 shrink-0" />,
          roles: ['SUPER_ADMIN']
        },
        {
          id: 'dashboard-postavke',
          portalTab: 'postavke',
          label: 'Bodovne formule',
          icon: <Settings className="h-4.5 w-4.5 shrink-0" />,
          roles: ['SUPER_ADMIN']
        },
        // Primary Student portal tabs
        {
          id: 'dashboard-pretraga',
          portalTab: 'pretraga',
          label: 'Pretraga škola',
          icon: <Search className="h-4.5 w-4.5 shrink-0" />,
          roles: ['PRIMARY_STUDENT']
        },
        {
          id: 'dashboard-zelje',
          portalTab: 'zelje',
          label: 'Lista želja',
          icon: <ListOrdered className="h-4.5 w-4.5 shrink-0" />,
          roles: ['PRIMARY_STUDENT']
        },
        {
          id: 'dashboard-bodovi',
          portalTab: 'bodovi',
          label: 'Izračun bodova',
          icon: <Activity className="h-4.5 w-4.5 shrink-0" />,
          roles: ['PRIMARY_STUDENT']
        },
        {
          id: 'dashboard-dokumenti',
          portalTab: 'dokumenti',
          label: 'Moji dokumenti',
          icon: <FileText className="h-4.5 w-4.5 shrink-0" />,
          roles: ['PRIMARY_STUDENT']
        },
        // Primary Teacher/Admin portal tabs
        {
          id: 'dashboard-verifikacija',
          portalTab: 'verifikacija',
          label: 'Registar učenika',
          icon: <Users className="h-4.5 w-4.5 shrink-0" />,
          roles: ['PRIMARY_HOMEROOM_TEACHER', 'PRIMARY_ADMIN']
        },
        // Secondary Student portal tabs
        {
          id: 'dashboard-matura',
          portalTab: 'matura',
          label: 'Prijava mature',
          icon: <FileText className="h-4.5 w-4.5 shrink-0" />,
          roles: ['SECONDARY_STUDENT']
        },
        {
          id: 'dashboard-fakulteti',
          portalTab: 'fakulteti',
          label: 'Pretraga studija',
          icon: <Search className="h-4.5 w-4.5 shrink-0" />,
          roles: ['SECONDARY_STUDENT']
        },
        {
          id: 'dashboard-izbori',
          portalTab: 'prioriteti',
          label: 'Prioriteti studija',
          icon: <ListOrdered className="h-4.5 w-4.5 shrink-0" />,
          roles: ['SECONDARY_STUDENT']
        },
        // Secondary Teacher/Admin portal tabs
        {
          id: 'dashboard-nastavnik',
          portalTab: 'nastavnik',
          label: 'Učenici i mature',
          icon: <Users className="h-4.5 w-4.5 shrink-0" />,
          roles: ['SECONDARY_HOMEROOM_TEACHER', 'SECONDARY_ADMIN']
        },
        // University Admin portal tabs
        {
          id: 'dashboard-programs',
          portalTab: 'programs',
          label: 'Studiji i kvote',
          icon: <BookOpen className="h-4.5 w-4.5 shrink-0" />,
          roles: ['UNIVERSITY_ADMIN']
        },
        {
          id: 'dashboard-applicants',
          portalTab: 'applicants',
          label: 'Rang liste kandidata',
          icon: <Users className="h-4.5 w-4.5 shrink-0" />,
          roles: ['UNIVERSITY_ADMIN']
        },
        {
          id: 'dashboard-statistics',
          portalTab: 'statistics',
          label: 'Upisna analitika',
          icon: <Activity className="h-4.5 w-4.5 shrink-0" />,
          roles: ['UNIVERSITY_ADMIN']
        }
      ]
    },
    {
      group: 'Sustavni Alati',
      items: [
        {
          id: 'calendar',
          portalTab: '',
          label: 'Službeni kalendar',
          icon: <Calendar className="h-4.5 w-4.5 shrink-0" />,
          roles: []
        },
        {
          id: 'database',
          portalTab: '',
          label: 'Baza podataka',
          icon: <Database className="h-4.5 w-4.5 shrink-0" />,
          roles: ['SUPER_ADMIN']
        },
        {
          id: 'dashboard-audit',
          portalTab: 'audit',
          label: 'Sigurnosni logovi',
          icon: <Shield className="h-4.5 w-4.5 shrink-0" />,
          roles: ['SUPER_ADMIN']
        },
        {
          id: 'error-pages',
          portalTab: '',
          label: 'Simulator grešaka',
          icon: <AlertTriangle className="h-4.5 w-4.5 shrink-0" />,
          roles: []
        }
      ]
    },
    {
      group: 'Korisnički Profil',
      items: [
        {
          id: 'profile',
          portalTab: '',
          label: 'Moje postavke',
          icon: <Settings className="h-4.5 w-4.5 shrink-0" />,
          roles: []
        }
      ]
    }
  ];

  // Helper to check if item is visible to user
  const isItemVisible = (item: any) => {
    if (item.roles.length === 0) return true;
    return item.roles.some((r: string) => currentUser.role === r || session?.roles.includes(r));
  };

  return (
    <aside
      className={`bg-white dark:bg-slate-900 border-r border-slate-200/60 dark:border-slate-800/60 flex flex-col transition-all duration-300 shrink-0 h-full ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
      aria-label="Glavni izbornik"
    >
      {/* Sidebar Header Toggle */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/10">
        {!isCollapsed && (
          <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest truncate">
            Navigacijski panel
          </span>
        )}
        <button type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg ml-auto transition-all cursor-pointer"
          aria-label={isCollapsed ? 'Proširi izbornik' : 'Sakrij izbornik'}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Internal Menu Search */}
      {!isCollapsed && (
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Pretraži izbornik..."
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 pl-8 pr-3 py-1.5 text-[11px] rounded-xl placeholder-slate-400 text-slate-700 dark:text-slate-200 focus:outline-hidden"
            />
          </div>
        </div>
      )}

      {/* Sidebar Links list */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {menuGroups.map((group, gIdx) => {
          // Filter items based on user role and query
          const visibleItems = group.items.filter((item) => {
            const matchesRole = isItemVisible(item);
            const matchesQuery = item.label.toLowerCase().includes(menuSearch.toLowerCase());
            return matchesRole && matchesQuery;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={gIdx} className="space-y-1">
              {!isCollapsed && (
                <span className="px-3 text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                  {group.group}
                </span>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isPortalPage = item.id.startsWith('dashboard-');
                  const targetPageId = isPortalPage ? 'dashboard' : item.id;
                  
                  const currentPortalTab =
                    new URLSearchParams(window.location.search).get('tab');
                  const isActive =
                    activePage === targetPageId &&
                    (!isPortalPage || currentPortalTab === item.portalTab);

                  return (
                    <button type="button"
                      key={item.id}
                      onClick={() => onPageChange(targetPageId, item.portalTab)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer relative ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {item.icon}
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer credits in Sidebar */}
      {!isCollapsed && (
        <div className="p-3 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800 text-[9px] text-slate-400 text-center">
          <span>EduPortal v3.2 (MZO)</span>
        </div>
      )}
    </aside>
  );
}
