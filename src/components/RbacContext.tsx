import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { Session, createSessionForUser, checkPermission, Permission, logSecurityAudit } from '../lib/rbac';
import { ShieldAlert, Lock } from 'lucide-react';

interface RbacContextType {
  session: Session | null;
  hasPermission: (permission: Permission, resourceContext?: {
    schoolId?: string;
    facultyId?: string;
    classId?: string;
    studentId?: string;
    userId?: string;
  }) => boolean;
  logRbacAction: (
    action: string,
    objectName: string,
    oldValue?: string,
    newValue?: string,
    result?: 'SUCCESS' | 'DENIED'
  ) => void;
  reloadSession: (user: User) => void;
  clearSession: () => void;
}

const RbacContext = createContext<RbacContextType | undefined>(undefined);

export function RbacProvider({ children, currentUser, onLogout }: {
  children: React.ReactNode;
  currentUser: User | null;
  onLogout?: () => void;
}) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (currentUser) {
      const newSession = createSessionForUser(currentUser);
      setSession(newSession);
    } else {
      setSession(null);
    }
  }, [currentUser]);

  const hasPermission = useCallback(
    (permission: Permission, resourceContext?: any) => {
      if (!session) return false;
      return checkPermission(session, permission, resourceContext);
    },
    [session]
  );

  const logRbacAction = (
    action: string,
    objectName: string,
    oldValue?: string,
    newValue?: string,
    result: 'SUCCESS' | 'DENIED' = 'SUCCESS'
  ) => {
    if (!session) return;
    logSecurityAudit(session, action, objectName, oldValue, newValue, result);
  };

  const reloadSession = (user: User) => {
    const newSession = createSessionForUser(user);
    setSession(newSession);
  };

  const clearSession = () => {
    setSession(null);
  };

  return (
    <RbacContext.Provider value={{ session, hasPermission, logRbacAction, reloadSession, clearSession }}>
      {children}
    </RbacContext.Provider>
  );
}

export function useRbac() {
  const context = useContext(RbacContext);
  if (!context) {
    throw new Error('useRbac must be used within an RbacProvider');
  }
  return context;
}

interface GuardProps {
  permission: Permission;
  resourceContext?: {
    schoolId?: string;
    facultyId?: string;
    classId?: string;
    studentId?: string;
    userId?: string;
  };
  fallback?: React.ReactNode;
  children: React.ReactNode;
  isPage?: boolean;
}

export function PermissionGuard({ permission, resourceContext, fallback, children, isPage = false }: GuardProps) {
  const { hasPermission, logRbacAction, session } = useRbac();
  const allowed = hasPermission(permission, resourceContext);

  useEffect(() => {
    if (session && !allowed && isPage) {
      logRbacAction('Pristup blokiran', `Dozvola: ${permission}`, undefined, undefined, 'DENIED');
    }
  }, [allowed, session, permission, isPage]);

  if (allowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (isPage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 rounded-3xl mt-6 transition-all animate-fade-in">
        <div className="p-4 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-2xl mb-4 relative">
          <ShieldAlert className="h-10 w-10 animate-bounce" />
          <Lock className="h-4 w-4 absolute bottom-2 right-2 text-red-700 dark:text-red-300" />
        </div>
        <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 tracking-tight">
          403 - Nemate ovlasti za pristup.
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-2 leading-relaxed">
          Ova akcija, modul ili stranica zahtijeva posebnu sigurnosnu dozvolu (<code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-red-600">{permission}</code>) i podliježe Row-Level Security (RLS) politikama zaštite podataka.
        </p>
        <div className="flex items-center gap-2 mt-5 text-[10px] text-slate-400 font-mono">
          <span>Korisnik: {session?.fullName}</span>
          <span>•</span>
          <span>Uloga: {session?.roles.join(', ')}</span>
        </div>
      </div>
    );
  }

  return null;
}
