/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { PortalType } from '../types';

export interface PortalConfig {
  portalType: PortalType;
  name: string;
  shortName: string;
  description: string;
  primaryColor: string;
  allowedRoles: string[];
}

interface PortalContextType {
  portalType: PortalType;
  config: PortalConfig;
  setPortalTypeOverride: (type: PortalType) => void;
  isDevMode: boolean;
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

const PORTAL_CONFIGS: Record<PortalType, PortalConfig> = {
  FACULTY_ADMISSIONS: {
    portalType: 'FACULTY_ADMISSIONS',
    name: 'Postani student',
    shortName: 'Postani Student',
    description: 'Nacionalni portal za državnu maturu i upis na fakultete',
    primaryColor: 'indigo',
    allowedRoles: ['SECONDARY_STUDENT', 'SECONDARY_HOMEROOM_TEACHER', 'SECONDARY_ADMIN', 'UNIVERSITY_ADMIN', 'SUPER_ADMIN']
  },
  SECONDARY_ADMISSIONS: {
    portalType: 'SECONDARY_ADMISSIONS',
    name: 'e-Srednja',
    shortName: 'e-Srednja',
    description: 'Jedinstveni portal za upis učenika u srednje škole',
    primaryColor: 'emerald',
    allowedRoles: ['PRIMARY_STUDENT', 'PRIMARY_HOMEROOM_TEACHER', 'PRIMARY_ADMIN', 'SECONDARY_ADMIN', 'SUPER_ADMIN']
  }
};

export function resolvePortalFromHost(hostname: string): PortalType {
  const cleanHost = hostname.toLowerCase().split(':')[0].replace(/\.$/, '');
  
  if (cleanHost === 'postani-student.skolehr.xyz') {
    return 'FACULTY_ADMISSIONS';
  }
  if (cleanHost === 'upisi-u-srednje.skolehr.xyz') {
    return 'SECONDARY_ADMISSIONS';
  }

  // Development override
  const saved = localStorage.getItem('dev_portal_type_override');
  if (saved === 'FACULTY_ADMISSIONS' || saved === 'SECONDARY_ADMISSIONS') {
    return saved;
  }

  return 'FACULTY_ADMISSIONS';
}

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [portalType, setPortalType] = useState<PortalType>('FACULTY_ADMISSIONS');

  const isDevMode = window.location.hostname.includes('localhost') || 
                    window.location.hostname.includes('127.0.0.1') || 
                    window.location.hostname.includes('run.app') || 
                    window.location.hostname.includes('stackblitz') ||
                    window.location.hostname.includes('webcontainer');

  useEffect(() => {
    const resolved = resolvePortalFromHost(window.location.hostname);
    setPortalType(resolved);
  }, []);

  const setPortalTypeOverride = (type: PortalType) => {
    localStorage.setItem('dev_portal_type_override', type);
    setPortalType(type);
    window.location.reload();
  };

  const config = PORTAL_CONFIGS[portalType];

  return (
    <PortalContext.Provider value={{ portalType, config, setPortalTypeOverride, isDevMode }}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('usePortal must be used within a PortalProvider');
  }
  return context;
}
