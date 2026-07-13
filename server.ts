import express from "express";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { createServer as createViteServer } from "vite";

// Define TypeScript interfaces for our server-side storage & sync
interface EMaticaStudent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  oib: string;
  dateOfBirth: string;
  schoolId: string;
  programId: string;
  classId: string;
  gradeLevel: number;
  schoolYear: string;
  status: 'ACTIVE' | 'INACTIVE';
  enrollmentYear: number;
  expectedGraduationYear: number;
  isFinalYear: boolean;
  hasGraduated: boolean;
  graduationDate: string | null;
  language: string;
  minorityProgram: string | null;
  version: number;
  updatedAt: string;
}

interface EMaticaSubject {
  id: string;
  name: string;
  code: string;
  isElective: boolean;
  durationYears: number;
  grade: number;
  foreignLanguageOrder?: 'FIRST' | 'SECOND' | null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ==========================================
  // CENTRAL PORTAL RESOLVER & SESSION ENGINE
  // ==========================================
  interface BackendSession {
    id: string;
    userId: string;
    portalType: "FACULTY_ADMISSIONS" | "SECONDARY_ADMISSIONS";
    host: string;
    createdAt: string;
    lastActivityAt: string;
    expiresAt: string;
  }

  const BACKEND_USERS = [
    { id: 'usr-admin', email: 'nikoladuric025@gmail.com', fullName: 'Nikola Đurić', role: 'SUPER_ADMIN', createdAt: '2026-07-11T08:59:00Z' },
    { id: 'usr-prim-admin', email: 'skola.prim@skole.hr', fullName: 'Ana Kovač (Ravnatelj OŠ)', role: 'PRIMARY_ADMIN', createdAt: '2026-07-11T08:59:00Z' },
    { id: 'usr-prim-teach', email: 'razrednik.prim@skole.hr', fullName: 'Marko Horvat (Razrednik 8.A)', role: 'PRIMARY_HOMEROOM_TEACHER', createdAt: '2026-07-11T08:59:00Z' },
    { id: 'usr-prim-stud', email: 'ucenik.prim@skole.hr', fullName: 'Luka Marić (Učenik 8.razred)', role: 'PRIMARY_STUDENT', createdAt: '2026-07-11T08:59:00Z' },
    { id: 'usr-sec-admin', email: 'skola.sec@skole.hr', fullName: 'Ivan Babić (Admin Gimnazije)', role: 'SECONDARY_ADMIN', createdAt: '2026-07-11T08:59:00Z' },
    { id: 'usr-sec-teach', email: 'razrednik.sec@skole.hr', fullName: 'Petra Novak (Razrednik 4.A)', role: 'SECONDARY_HOMEROOM_TEACHER', createdAt: '2026-07-11T08:59:00Z' },
    { id: 'usr-sec-stud', email: 'ucenik.sec@skole.hr', fullName: 'Ivan Jurić (Učenik 4.razred)', role: 'SECONDARY_STUDENT', createdAt: '2026-07-11T08:59:00Z' },
    { id: 'usr-uni-admin', email: 'fer@unizg.hr', fullName: 'Prof. dr. sc. Stjepan Car (Admin FER-a)', role: 'UNIVERSITY_ADMIN', createdAt: '2026-07-11T08:59:00Z' }
  ];

  const backendSessions = new Map<string, BackendSession>();

  function resolvePortalFromHost(hostname: string): "FACULTY_ADMISSIONS" | "SECONDARY_ADMISSIONS" {
    const cleanHost = hostname.toLowerCase().split(':')[0].replace(/\.$/, '');
    
    if (cleanHost === 'postani-student.skolehr.xyz') {
      return 'FACULTY_ADMISSIONS';
    }
    if (cleanHost === 'e-srednja.skolehr.xyz') {
      return 'SECONDARY_ADMISSIONS';
    }

    // Development/preview mode detection
    const isDev = process.env.NODE_ENV !== "production" ||
                  cleanHost.includes('localhost') ||
                  cleanHost.includes('127.0.0.1') ||
                  cleanHost.includes('run.app') ||
                  cleanHost.includes('stackblitz') ||
                  cleanHost.includes('webcontainer');

    if (isDev) {
      // Allow override from headers or environment variable
      const envType = process.env.LOCAL_PORTAL_TYPE;
      if (envType === 'FACULTY_ADMISSIONS' || envType === 'SECONDARY_ADMISSIONS') {
        return envType;
      }
      return 'FACULTY_ADMISSIONS';
    }

    throw new Error(`Nepoznata domena: ${cleanHost}. Pristup odbijen.`);
  }

  const getSessionToken = (req: express.Request): string | null => {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const parts = cookie.trim().split('=');
      const key = parts[0];
      const value = parts.slice(1).join('=');
      if (key) acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    return cookies['session_token'] || null;
  };

  const requireSession = (allowedPortals: ("FACULTY_ADMISSIONS" | "SECONDARY_ADMISSIONS")[], allowedRoles?: string[]) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      let portalType: "FACULTY_ADMISSIONS" | "SECONDARY_ADMISSIONS";
      const hostHeader = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
      try {
        portalType = resolvePortalFromHost(hostHeader);
      } catch (err: any) {
        return res.status(400).json({ error: "Konfiguracijska pogreška: nepoznat host zahtjeva." });
      }

      if (!allowedPortals.includes(portalType)) {
        return res.status(403).json({ error: `Pristup odbijen: Ova akcija ne pripada portalu ${portalType === 'FACULTY_ADMISSIONS' ? 'Postani student' : 'e-Srednja'}.` });
      }

      const token = getSessionToken(req);
      if (!token) {
        return res.status(401).json({ error: "Zahtjev zahtijeva prijavu." });
      }

      const session = backendSessions.get(token);
      if (!session) {
        return res.status(401).json({ error: "Nevažeća ili istekla sesija." });
      }

      if (session.portalType !== portalType) {
        return res.status(401).json({ error: "Sesija ne pripada trenutnoj domeni." });
      }

      if (Date.now() > new Date(session.expiresAt).getTime()) {
        backendSessions.delete(token);
        res.setHeader('Set-Cookie', 'session_token=; Path=/; HttpOnly; Max-Age=0');
        return res.status(401).json({ error: "Sesija je istekla." });
      }

      session.lastActivityAt = new Date().toISOString();
      session.expiresAt = new Date(Date.now() + 45 * 60 * 1000).toISOString();

      const user = BACKEND_USERS.find(u => u.id === session.userId);
      if (!user) {
        return res.status(401).json({ error: "Korisnik iz sesije nije pronađen." });
      }

      if (allowedRoles && !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: "Nemate ovlasti za ovu akciju." });
      }

      (req as any).user = user;
      (req as any).sessionToken = token;
      (req as any).portalType = portalType;
      next();
    };
  };

  // ==========================================
  // SHARED AUTHENTICATION ENDPOINTS
  // ==========================================

  // POST /api/shared/auth/login
  app.post("/api/shared/auth/login", (req, res) => {
    const { email } = req.body;
    
    let portalType: "FACULTY_ADMISSIONS" | "SECONDARY_ADMISSIONS";
    const hostHeader = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    try {
      portalType = resolvePortalFromHost(hostHeader);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }

    const user = BACKEND_USERS.find(u => u.email.toLowerCase().trim() === email?.toLowerCase().trim());
    if (!user) {
      return res.status(400).json({ error: "Korisnik s ovim e-mailom nije pronađen u EduPortal bazi." });
    }

    let isRoleAllowed = false;
    if (portalType === 'FACULTY_ADMISSIONS') {
      const allowedRoles = ['SECONDARY_STUDENT', 'SECONDARY_HOMEROOM_TEACHER', 'SECONDARY_ADMIN', 'UNIVERSITY_ADMIN', 'SUPER_ADMIN'];
      isRoleAllowed = allowedRoles.includes(user.role);
    } else {
      const allowedRoles = ['PRIMARY_STUDENT', 'PRIMARY_HOMEROOM_TEACHER', 'PRIMARY_ADMIN', 'SECONDARY_ADMIN', 'SUPER_ADMIN'];
      isRoleAllowed = allowedRoles.includes(user.role);
    }

    if (!isRoleAllowed) {
      return res.status(403).json({ 
        error: `Pristup odbijen: Korisnik s ulogom ${user.role} nema pravo pristupa portalu ${portalType === 'FACULTY_ADMISSIONS' ? 'Postani student' : 'e-Srednja'}.` 
      });
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const newSession: BackendSession = {
      id: "sess-" + crypto.randomBytes(8).toString('hex'),
      userId: user.id,
      portalType,
      host: hostHeader,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(now + 45 * 60 * 1000).toISOString()
    };

    backendSessions.set(sessionToken, newSession);

    res.setHeader('Set-Cookie', `session_token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);

    return res.status(200).json({
      success: true,
      user,
      portalType,
      message: `Uspješna prijava na portal.`
    });
  });

  // GET /api/shared/auth/session
  app.get("/api/shared/auth/session", (req, res) => {
    let portalType: "FACULTY_ADMISSIONS" | "SECONDARY_ADMISSIONS";
    const hostHeader = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    try {
      portalType = resolvePortalFromHost(hostHeader);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }

    const token = getSessionToken(req);
    if (!token) {
      return res.status(401).json({ error: "Nema aktivne sesije." });
    }

    const session = backendSessions.get(token);
    if (!session) {
      return res.status(401).json({ error: "Sesija ne postoji." });
    }

    if (session.portalType !== portalType) {
      return res.status(401).json({ error: "Sesija ne odgovara trenutnom portalu." });
    }

    if (Date.now() > new Date(session.expiresAt).getTime()) {
      backendSessions.delete(token);
      res.setHeader('Set-Cookie', 'session_token=; Path=/; HttpOnly; Max-Age=0');
      return res.status(401).json({ error: "Sesija je istekla." });
    }

    session.lastActivityAt = new Date().toISOString();
    session.expiresAt = new Date(Date.now() + 45 * 60 * 1000).toISOString();

    const user = BACKEND_USERS.find(u => u.id === session.userId);
    if (!user) {
      return res.status(401).json({ error: "Korisnik iz sesije ne postoji." });
    }

    return res.status(200).json({
      success: true,
      user,
      portalType,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
        lastActivityAt: session.lastActivityAt
      }
    });
  });

  // POST /api/shared/auth/logout
  app.post("/api/shared/auth/logout", (req, res) => {
    const token = getSessionToken(req);
    if (token) {
      backendSessions.delete(token);
    }
    res.setHeader('Set-Cookie', 'session_token=; Path=/; HttpOnly; Max-Age=0');
    return res.status(200).json({ success: true, message: "Uspješna odjava." });
  });

  // POST /api/shared/auth/keep-alive
  app.post("/api/shared/auth/keep-alive", (req, res) => {
    const token = getSessionToken(req);
    if (!token) {
      return res.status(401).json({ error: "Nema aktivne sesije." });
    }

    const session = backendSessions.get(token);
    if (!session) {
      return res.status(401).json({ error: "Sesija ne postoji." });
    }

    session.lastActivityAt = new Date().toISOString();
    session.expiresAt = new Date(Date.now() + 45 * 60 * 1000).toISOString();

    return res.status(200).json({
      success: true,
      expiresAt: session.expiresAt
    });
  });

  // In-memory audit and nonce logs
  const auditLogs: any[] = [];
  const usedNonces = new Set<string>();
  
  // Integration health and server settings
  let ematicaOnline = true;
  let ematicaTokenStore = {
    accessToken: "secure-ematica-token-2026",
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  };

  // ==========================================
  // E-MATICA SIMULATED DATABASE STATE
  // ==========================================
  const ematicaDb = {
    schools: [
      { id: 'ext-sch-1', code: '01-204-001', name: 'OŠ Nikole Tesle', type: 'PRIMARY', address: 'Kopernikova ulica 14, Zagreb', cityId: 'city-1', countyId: 'zup-1', status: 'ACTIVE' },
      { id: 'ext-sch-2', code: '02-101-042', name: 'OŠ Manuš', type: 'PRIMARY', address: 'Vukovarska 11, Split', cityId: 'city-2', countyId: 'zup-2', status: 'ACTIVE' },
      { id: 'ext-sch-3', code: '03-512-003', name: 'OŠ Pećine', type: 'PRIMARY', address: 'Janka Polića Kamova 32, Rijeka', cityId: 'city-3', countyId: 'zup-3', status: 'ACTIVE' },
      { id: 'ext-sch-4', code: '01-105-001', name: 'XV. Gimnazija (MIOC)', type: 'SECONDARY', address: 'Jordanovac ul. 8, Zagreb', cityId: 'city-1', countyId: 'zup-1', status: 'ACTIVE' },
      { id: 'ext-sch-5', code: '02-105-001', name: 'I. Gimnazija Split', type: 'SECONDARY', address: 'Ruđera Boškovića 37, Split', cityId: 'city-2', countyId: 'zup-2', status: 'ACTIVE' },
      { id: 'ext-sch-9', code: '01-105-002', name: 'V. Gimnazija Zagreb', type: 'SECONDARY', address: 'Trg Republike Hrvatske 9, Zagreb', cityId: 'city-1', countyId: 'zup-1', status: 'ACTIVE' }
    ],
    programs: [
      { id: 'ext-prog-1', code: 'pmg-mioc', name: 'Prirodoslovno-matematička gimnazija (IBM program)', durationYears: 4, type: 'GIMNAZIJA', level: 'SECONDARY', schoolId: 'ext-sch-4', status: 'ACTIVE' },
      { id: 'ext-prog-3', code: 'pmg-split', name: 'Prirodoslovno-matematička gimnazija', durationYears: 4, type: 'GIMNAZIJA', level: 'SECONDARY', schoolId: 'ext-sch-5', status: 'ACTIVE' },
      { id: 'ext-prog-6', code: 'tech-rac', name: 'Tehničar za računalstvo', durationYears: 4, type: 'STRUKOVNA', level: 'SECONDARY', schoolId: 'ext-sch-4', status: 'ACTIVE' },
      { id: 'ext-prog-8', code: 'med-sestra', name: 'Medicinska sestra / tehničar opće njege', durationYears: 5, type: 'STRUKOVNA', level: 'SECONDARY', schoolId: 'ext-sch-8', status: 'ACTIVE' },
      { id: 'ext-prog-prim', code: 'prim-os', name: 'Osnovnoškolsko obrazovanje', durationYears: 8, type: 'OSNOVNA', level: 'PRIMARY', schoolId: 'ext-sch-1', status: 'ACTIVE' },
      { id: 'ext-prog-pecine', code: 'prim-os-pecine', name: 'Osnovnoškolsko obrazovanje (Pećine)', durationYears: 8, type: 'OSNOVNA', level: 'PRIMARY', schoolId: 'ext-sch-3', status: 'ACTIVE' },
      { id: 'ext-prog-v-gim', code: 'opca-gim', name: 'Opća gimnazija', durationYears: 4, type: 'GIMNAZIJA', level: 'SECONDARY', schoolId: 'ext-sch-9', status: 'ACTIVE' }
    ],
    classes: [
      { id: 'ext-cls-8a', name: '8.A', gradeLevel: 8, schoolId: 'ext-sch-1', programId: 'ext-prog-prim', schoolYearId: 'sy-2026', status: 'ACTIVE' },
      { id: 'ext-cls-8a-pecine', name: '8.A', gradeLevel: 8, schoolId: 'ext-sch-3', programId: 'ext-prog-pecine', schoolYearId: 'sy-2026', status: 'ACTIVE' },
      { id: 'ext-cls-4a', name: '4.A', gradeLevel: 12, schoolId: 'ext-sch-4', programId: 'ext-prog-1', schoolYearId: 'sy-2026', status: 'ACTIVE' },
      { id: 'ext-cls-4a-vgim', name: '4.A', gradeLevel: 12, schoolId: 'ext-sch-9', programId: 'ext-prog-v-gim', schoolYearId: 'sy-2026', status: 'ACTIVE' }
    ],
    students: [
      {
        id: 'ext-luka',
        firstName: 'Luka',
        lastName: 'Marić',
        email: 'ucenik.prim@skole.hr',
        oib: '12345678901',
        dateOfBirth: '2011-04-12',
        schoolId: 'ext-sch-1',
        programId: 'ext-prog-prim',
        classId: 'ext-cls-8a',
        gradeLevel: 8,
        schoolYear: '2026./2027.',
        status: 'ACTIVE',
        enrollmentYear: 2018,
        expectedGraduationYear: 2026,
        isFinalYear: true,
        hasGraduated: true,
        graduationDate: '2026-06-15',
        language: 'hr',
        minorityProgram: null,
        version: 1,
        updatedAt: '2026-06-15T12:00:00Z'
      },
      {
        id: 'ext-ivan',
        firstName: 'Ivan',
        lastName: 'Jurić',
        email: 'ucenik.sec@skole.hr',
        oib: '98765432109',
        dateOfBirth: '2007-09-25',
        schoolId: 'ext-sch-4',
        programId: 'ext-prog-1',
        classId: 'ext-cls-4a',
        gradeLevel: 12,
        schoolYear: '2026./2027.',
        status: 'ACTIVE',
        enrollmentYear: 2022,
        expectedGraduationYear: 2026,
        isFinalYear: true,
        hasGraduated: true,
        graduationDate: '2026-06-25',
        language: 'hr',
        minorityProgram: null,
        version: 1,
        updatedAt: '2026-06-25T12:00:00Z'
      },
      {
        id: 'ext-ana', // Test 1 student (not pre-existing in EduPortal)
        firstName: 'Ana',
        lastName: 'Horvat',
        email: 'ana.horvat@skole.hr',
        oib: '55555555555',
        dateOfBirth: '2011-08-14',
        schoolId: 'ext-sch-3', // OŠ Pećine
        programId: 'ext-prog-pecine',
        classId: 'ext-cls-8a-pecine',
        gradeLevel: 8,
        schoolYear: '2026./2027.',
        status: 'ACTIVE',
        enrollmentYear: 2018,
        expectedGraduationYear: 2026,
        isFinalYear: true,
        hasGraduated: true,
        graduationDate: '2026-06-15',
        language: 'hr',
        minorityProgram: null,
        version: 1,
        updatedAt: '2026-06-15T12:00:00Z'
      },
      {
        id: 'ext-marko-1', // Test 11 duplicate name pupil
        firstName: 'Marko',
        lastName: 'Galić',
        email: 'marko1@skole.hr',
        oib: '11111111111',
        dateOfBirth: '2011-01-10',
        schoolId: 'ext-sch-1',
        programId: 'ext-prog-prim',
        classId: 'ext-cls-8a',
        gradeLevel: 8,
        schoolYear: '2026./2027.',
        status: 'ACTIVE',
        enrollmentYear: 2018,
        expectedGraduationYear: 2026,
        isFinalYear: true,
        hasGraduated: true,
        graduationDate: '2026-06-15',
        language: 'hr',
        minorityProgram: null,
        version: 1,
        updatedAt: '2026-06-15T12:00:00Z'
      },
      {
        id: 'ext-marko-2', // Test 11 duplicate name pupil
        firstName: 'Marko',
        lastName: 'Galić',
        email: 'marko2@skole.hr',
        oib: '22222222222',
        dateOfBirth: '2011-05-20',
        schoolId: 'ext-sch-1',
        programId: 'ext-prog-prim',
        classId: 'ext-cls-8a',
        gradeLevel: 8,
        schoolYear: '2026./2027.',
        status: 'ACTIVE',
        enrollmentYear: 2018,
        expectedGraduationYear: 2026,
        isFinalYear: true,
        hasGraduated: true,
        graduationDate: '2026-06-15',
        language: 'hr',
        minorityProgram: null,
        version: 1,
        updatedAt: '2026-06-15T12:00:00Z'
      },
      {
        id: 'ext-karlo', // Test 14 inactive pupil
        firstName: 'Karlo',
        lastName: 'Vidović',
        email: 'karlo@skole.hr',
        oib: '33333333333',
        dateOfBirth: '2011-11-11',
        schoolId: 'ext-sch-1',
        programId: 'ext-prog-prim',
        classId: 'ext-cls-8a',
        gradeLevel: 8,
        schoolYear: '2026./2027.',
        status: 'INACTIVE', // INACTIVE student
        enrollmentYear: 2018,
        expectedGraduationYear: 2026,
        isFinalYear: true,
        hasGraduated: false,
        graduationDate: null,
        language: 'hr',
        minorityProgram: null,
        version: 1,
        updatedAt: '2026-06-15T12:00:00Z'
      },
      {
        id: 'ext-petra', // Test 8 transferred student
        firstName: 'Petra',
        lastName: 'Babić',
        email: 'petra@skole.hr',
        oib: '44444444444',
        dateOfBirth: '2007-03-03',
        schoolId: 'ext-sch-4', // Starts at XV. Gimnazija (MIOC)
        programId: 'ext-prog-1',
        classId: 'ext-cls-4a',
        gradeLevel: 12,
        schoolYear: '2026./2027.',
        status: 'ACTIVE',
        enrollmentYear: 2022,
        expectedGraduationYear: 2026,
        isFinalYear: true,
        hasGraduated: true,
        graduationDate: '2026-06-25',
        language: 'hr',
        minorityProgram: null,
        version: 1,
        updatedAt: '2026-06-25T12:00:00Z'
      }
    ] as EMaticaStudent[],
    educationHistory: {
      'ext-luka': [
        { schoolId: 'ext-sch-1', programId: 'ext-prog-prim', classId: 'ext-cls-8a', schoolYear: '2026./2027.', gradeLevel: 8, status: 'ENROLLED', startDate: '2026-09-01', endDate: '2027-06-15' }
      ],
      'ext-ivan': [
        { schoolId: 'ext-sch-4', programId: 'ext-prog-1', classId: 'ext-cls-4a', schoolYear: '2026./2027.', gradeLevel: 12, status: 'GRADUATED', startDate: '2026-09-01', endDate: '2027-06-25' }
      ],
      'ext-ana': [
        { schoolId: 'ext-sch-3', programId: 'ext-prog-pecine', classId: 'ext-cls-8a-pecine', schoolYear: '2026./2027.', gradeLevel: 8, status: 'GRADUATED', startDate: '2026-09-01', endDate: '2027-06-15' }
      ],
      'ext-marko-1': [
        { schoolId: 'ext-sch-1', programId: 'ext-prog-prim', classId: 'ext-cls-8a', schoolYear: '2026./2027.', gradeLevel: 8, status: 'GRADUATED', startDate: '2026-09-01', endDate: '2027-06-15' }
      ],
      'ext-marko-2': [
        { schoolId: 'ext-sch-1', programId: 'ext-prog-prim', classId: 'ext-cls-8a', schoolYear: '2026./2027.', gradeLevel: 8, status: 'GRADUATED', startDate: '2026-09-01', endDate: '2027-06-15' }
      ],
      'ext-karlo': [
        { schoolId: 'ext-sch-1', programId: 'ext-prog-prim', classId: 'ext-cls-8a', schoolYear: '2026./2027.', gradeLevel: 8, status: 'WITHDRAWN', startDate: '2026-09-01', endDate: '2027-01-15' }
      ],
      'ext-petra': [
        { schoolId: 'ext-sch-4', programId: 'ext-prog-1', classId: 'ext-cls-4a', schoolYear: '2026./2027.', gradeLevel: 12, status: 'TRANSFERRED', startDate: '2026-09-01', endDate: '2027-02-01' },
        { schoolId: 'ext-sch-9', programId: 'ext-prog-v-gim', classId: 'ext-cls-4a-vgim', schoolYear: '2026./2027.', gradeLevel: 12, status: 'GRADUATED', startDate: '2027-02-02', endDate: '2027-06-25' }
      ]
    } as Record<string, any[]>,
    subjects: {
      'ext-luka': [
        { id: 'ext-sub-hrv', name: 'Hrvatski jezik', code: 'HRV', isElective: false, durationYears: 8, grade: 5 },
        { id: 'ext-sub-mat', name: 'Matematika', code: 'MAT', isElective: false, durationYears: 8, grade: 5 },
        { id: 'ext-sub-eng', name: 'Engleski jezik', code: 'ENG', isElective: false, foreignLanguageOrder: 'FIRST', durationYears: 8, grade: 5 }
      ],
      'ext-ivan': [
        { id: 'ext-sub-hrv', name: 'Hrvatski jezik', code: 'HRV', isElective: false, durationYears: 4, grade: 5 },
        { id: 'ext-sub-mat', name: 'Matematika', code: 'MAT', isElective: false, durationYears: 4, grade: 5 },
        { id: 'ext-sub-eng', name: 'Engleski jezik – 1. strani jezik', code: 'ENG', isElective: false, foreignLanguageOrder: 'FIRST', durationYears: 8, grade: 5 }, // Test 3
        { id: 'ext-sub-njem', name: 'Njemački jezik', code: 'DEU', isElective: true, foreignLanguageOrder: 'SECOND', durationYears: 2, grade: 4 }, // Test 4
        { id: 'ext-sub-fiz', name: 'Fizika', code: 'PHY', isElective: true, durationYears: 4, grade: 5 },
        { id: 'ext-sub-inf', name: 'Informatika', code: 'INF', isElective: true, durationYears: 4, grade: 5 }
      ],
      'ext-ana': [
        { id: 'ext-sub-hrv', name: 'Hrvatski jezik', code: 'HRV', isElective: false, durationYears: 8, grade: 5 },
        { id: 'ext-sub-mat', name: 'Matematika', code: 'MAT', isElective: false, durationYears: 8, grade: 5 },
        { id: 'ext-sub-eng', name: 'Engleski jezik', code: 'ENG', isElective: false, foreignLanguageOrder: 'FIRST', durationYears: 8, grade: 5 },
        { id: 'ext-sub-fiz', name: 'Fizika', code: 'PHY', isElective: false, durationYears: 2, grade: 4 },
        { id: 'ext-sub-kem', name: 'Kemija', code: 'CHE', isElective: false, durationYears: 2, grade: 4 },
        { id: 'ext-sub-bio', name: 'Biologija', code: 'BIO', isElective: false, durationYears: 4, grade: 5 }
      ],
      'ext-marko-1': [
        { id: 'ext-sub-hrv', name: 'Hrvatski jezik', code: 'HRV', isElective: false, durationYears: 8, grade: 4 },
        { id: 'ext-sub-mat', name: 'Matematika', code: 'MAT', isElective: false, durationYears: 8, grade: 4 }
      ],
      'ext-marko-2': [
        { id: 'ext-sub-hrv', name: 'Hrvatski jezik', code: 'HRV', isElective: false, durationYears: 8, grade: 5 },
        { id: 'ext-sub-mat', name: 'Matematika', code: 'MAT', isElective: false, durationYears: 8, grade: 5 }
      ],
      'ext-karlo': [
        { id: 'ext-sub-hrv', name: 'Hrvatski jezik', code: 'HRV', isElective: false, durationYears: 8, grade: 2 }
      ],
      'ext-petra': [
        { id: 'ext-sub-hrv', name: 'Hrvatski jezik', code: 'HRV', isElective: false, durationYears: 4, grade: 5 },
        { id: 'ext-sub-mat', name: 'Matematika', code: 'MAT', isElective: false, durationYears: 4, grade: 4 }
      ]
    } as Record<string, EMaticaSubject[]>,
    changes: [
      { id: "chg-1", entityType: "student", entityId: "ext-ivan", changeType: "updated", occurredAt: new Date().toISOString(), version: 2 }
    ] as any[]
  };

  // ==========================================
  // MIDDLEWARE FOR SERVER-TO-SERVER SECURITY
  // ==========================================
  const verifyEMaticaAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!ematicaOnline) {
      return res.status(503).json({ error: "Servis e-Matica je privremeno nedostupan." });
    }

    const authHeader = req.headers.authorization;
    const clientId = req.headers['x-integration-client-id'] as string;
    const timestamp = req.headers['x-integration-timestamp'] as string;
    const nonce = req.headers['x-integration-nonce'] as string;
    const signature = req.headers['x-integration-signature'] as string;

    const validClientId = 'eduportal_mzo_client';
    const secret = 'secure_mzo_ematica_secret_key_2026';

    // 1. Check OAuth 2.0 Token (e.g. Bearer token-XYZ)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token === ematicaTokenStore.accessToken && Date.now() < ematicaTokenStore.expiresAt) {
        return next();
      }
    }

    // 2. Check HMAC Signature (Test 10)
    if (clientId && timestamp && nonce && signature) {
      if (clientId !== validClientId) {
        return res.status(403).json({ error: 'Nevažeći klijentski identifikator.' });
      }

      // Check clock skew (max 5 minutes)
      const reqTime = new Date(timestamp).getTime();
      const now = Date.now();
      if (isNaN(reqTime) || Math.abs(now - reqTime) > 5 * 60 * 1000) {
        return res.status(401).json({ error: 'Zahtjev je istekao (vremenska oznaka je prestara).' });
      }

      // Verify nonce reuse
      if (usedNonces.has(nonce)) {
        return res.status(401).json({ error: 'Zahtjev odbijen: replay napad (Request ID je već iskorišten).' });
      }
      usedNonces.add(nonce);
      if (usedNonces.size > 1000) usedNonces.clear();

      // Recreate HMAC signature
      const expectedSignature = crypto.createHmac('sha256', secret)
        .update(`${timestamp}:${nonce}:${clientId}`)
        .digest('hex');

      if (signature === expectedSignature) {
        return next();
      } else {
        return res.status(401).json({ error: 'Nevažeći sigurnosni potpis.' });
      }
    }

    return res.status(401).json({ error: 'Nedostaju vjerodajnice ili potpis za serversku integraciju.' });
  };

  // ==========================================
  // E-MATICA INTEGRATION API ENDPOINTS (SECTION 5)
  // ==========================================

  // OAuth 2.0 token endpoint
  app.post("/api/integrations/eduportal/oauth/token", (req, res) => {
    const { grant_type, client_id, client_secret } = req.body;
    if (client_id === "eduportal_mzo_client" && client_secret === "secure_mzo_ematica_secret_key_2026") {
      ematicaTokenStore.accessToken = "secure-ematica-token-" + crypto.randomBytes(8).toString("hex");
      ematicaTokenStore.expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
      return res.status(200).json({
        access_token: ematicaTokenStore.accessToken,
        token_type: "Bearer",
        expires_in: 3600
      });
    }
    return res.status(400).json({ error: "invalid_client_credentials" });
  });

  app.get("/api/integrations/eduportal/schools", verifyEMaticaAuth, (req, res) => {
    res.json(ematicaDb.schools);
  });

  app.get("/api/integrations/eduportal/programs", verifyEMaticaAuth, (req, res) => {
    res.json(ematicaDb.programs);
  });

  app.get("/api/integrations/eduportal/classes", verifyEMaticaAuth, (req, res) => {
    res.json(ematicaDb.classes);
  });

  app.get("/api/integrations/eduportal/students", verifyEMaticaAuth, (req, res) => {
    let list = [...ematicaDb.students];
    const { schoolId, gradeLevel, updatedSince, status } = req.query;

    if (schoolId) list = list.filter(s => s.schoolId === schoolId);
    if (gradeLevel) list = list.filter(s => s.gradeLevel === parseInt(gradeLevel as string));
    if (status) list = list.filter(s => s.status === status);
    if (updatedSince) {
      const sinceDate = new Date(updatedSince as string).getTime();
      list = list.filter(s => new Date(s.updatedAt).getTime() > sinceDate);
    }

    res.json(list);
  });

  app.get("/api/integrations/eduportal/students/:externalStudentId", verifyEMaticaAuth, (req, res) => {
    const student = ematicaDb.students.find(s => s.id === req.params.externalStudentId);
    if (!student) return res.status(404).json({ error: "Učenik nije pronađen u e-Matici." });
    res.json(student);
  });

  app.get("/api/integrations/eduportal/students/:externalStudentId/education-history", verifyEMaticaAuth, (req, res) => {
    const history = ematicaDb.educationHistory[req.params.externalStudentId] || [];
    res.json(history);
  });

  app.get("/api/integrations/eduportal/students/:externalStudentId/subjects", verifyEMaticaAuth, (req, res) => {
    const list = ematicaDb.subjects[req.params.externalStudentId] || [];
    res.json(list);
  });

  app.get("/api/integrations/eduportal/students/:externalStudentId/grades", verifyEMaticaAuth, (req, res) => {
    const list = ematicaDb.subjects[req.params.externalStudentId] || [];
    const grades = list.map(sub => ({
      id: "grd-" + sub.id,
      studentId: req.params.externalStudentId,
      subjectId: sub.id,
      subjectName: sub.name,
      subjectCode: sub.code,
      gradeValue: sub.grade,
      isElective: sub.isElective,
      isFirstLanguage: sub.foreignLanguageOrder === 'FIRST',
      isSecondLanguage: sub.foreignLanguageOrder === 'SECOND',
      durationYears: sub.durationYears,
      status: 'FINALIZED'
    }));
    res.json(grades);
  });

  app.get("/api/integrations/eduportal/changes", verifyEMaticaAuth, (req, res) => {
    const { after } = req.query;
    let list = [...ematicaDb.changes];
    if (after) {
      const afterTime = new Date(after as string).getTime();
      list = list.filter(c => new Date(c.occurredAt).getTime() > afterTime);
    }
    res.json(list);
  });

  // ==========================================
  // E-MATICA SIMULATION MANAGEMENT FOR TESTING
  // ==========================================
  app.get("/api/integrations/ematica-simulation/state", (req, res) => {
    res.json({
      ematicaOnline,
      schools: ematicaDb.schools,
      programs: ematicaDb.programs,
      classes: ematicaDb.classes,
      students: ematicaDb.students,
      subjects: ematicaDb.subjects,
      educationHistory: ematicaDb.educationHistory
    });
  });

  app.post("/api/integrations/ematica-simulation/toggle-online", (req, res) => {
    ematicaOnline = !ematicaOnline;
    res.json({ ematicaOnline, message: ematicaOnline ? "e-Matica je sada ONLINE." : "e-Matica je sada OFFLINE." });
  });

  app.post("/api/integrations/ematica-simulation/student/update-grade", (req, res) => {
    const { studentId, subjectCode, grade } = req.body;
    const studentSubjects = ematicaDb.subjects[studentId];
    if (!studentSubjects) return res.status(404).json({ error: "Učenik nije pronađen." });

    const subject = studentSubjects.find(s => s.code === subjectCode);
    if (!subject) return res.status(404).json({ error: "Predmet nije pronađen." });

    const oldGrade = subject.grade;
    subject.grade = parseInt(grade);
    
    // Increment version
    const studentObj = ematicaDb.students.find(s => s.id === studentId);
    if (studentObj) {
      studentObj.version++;
      studentObj.updatedAt = new Date().toISOString();
    }

    // Add change log entry
    const changeId = "chg-" + Date.now();
    ematicaDb.changes.push({
      id: changeId,
      entityType: "student",
      entityId: studentId,
      changeType: "updated",
      occurredAt: new Date().toISOString(),
      version: studentObj ? studentObj.version : 2
    });

    res.json({ success: true, oldGrade, newGrade: subject.grade, message: `Ocjena za ${subject.name} uspješno izmijenjena na ${grade} u e-Matici.` });
  });

  app.post("/api/integrations/ematica-simulation/student/change-school", (req, res) => {
    const { studentId, schoolId, programId, classId } = req.body;
    const studentObj = ematicaDb.students.find(s => s.id === studentId);
    if (!studentObj) return res.status(404).json({ error: "Učenik nije pronađen." });

    const oldSchool = studentObj.schoolId;
    const oldProgram = studentObj.programId;

    studentObj.schoolId = schoolId;
    studentObj.programId = programId;
    studentObj.classId = classId;
    studentObj.version++;
    studentObj.updatedAt = new Date().toISOString();

    // Append to education history
    const history = ematicaDb.educationHistory[studentId] || [];
    history.push({
      schoolId,
      programId,
      classId,
      schoolYear: '2026./2027.',
      gradeLevel: studentObj.gradeLevel,
      status: 'ENROLLED',
      startDate: new Date().toISOString().split('T')[0],
      endDate: null
    });
    ematicaDb.educationHistory[studentId] = history;

    // Add change log
    ematicaDb.changes.push({
      id: "chg-" + Date.now(),
      entityType: "student",
      entityId: studentId,
      changeType: "transferred",
      occurredAt: new Date().toISOString(),
      version: studentObj.version
    });

    res.json({ success: true, oldSchool, oldProgram, newSchool: schoolId, newProgram: programId, message: "Učenik je uspješno promijenio školu i program u e-Matici." });
  });

  app.post("/api/integrations/ematica-simulation/student/deactivate", (req, res) => {
    const { studentId } = req.body;
    const studentObj = ematicaDb.students.find(s => s.id === studentId);
    if (!studentObj) return res.status(404).json({ error: "Učenik nije pronađen." });

    studentObj.status = 'INACTIVE';
    studentObj.version++;
    studentObj.updatedAt = new Date().toISOString();

    ematicaDb.changes.push({
      id: "chg-" + Date.now(),
      entityType: "student",
      entityId: studentId,
      changeType: "deactivated",
      occurredAt: new Date().toISOString(),
      version: studentObj.version
    });

    res.json({ success: true, message: "Učenik označen kao neaktivan u e-Matici." });
  });

  app.post("/api/integrations/ematica-simulation/student/add-subject", (req, res) => {
    const { studentId, name, code, grade } = req.body;
    const studentSubjects = ematicaDb.subjects[studentId];
    if (!studentSubjects) return res.status(404).json({ error: "Učenik nije pronađen." });

    studentSubjects.push({
      id: "ext-sub-" + code.toLowerCase(),
      name,
      code,
      isElective: true,
      durationYears: 1,
      grade: parseInt(grade)
    });

    const studentObj = ematicaDb.students.find(s => s.id === studentId);
    if (studentObj) {
      studentObj.version++;
      studentObj.updatedAt = new Date().toISOString();
    }

    res.json({ success: true, message: `Dodatni nepoznati predmet '${name}' dodan učeniku u e-Matici.` });
  });

  // Simulation Webhook Trigger (Section 14)
  app.post("/api/integrations/ematica-simulation/trigger-webhook", async (req, res) => {
    const { eventType, entityId, eventId: customEventId } = req.body;
    
    const eventId = customEventId || ("evt-" + crypto.randomBytes(8).toString("hex"));
    const occurredAt = new Date().toISOString();

    const payload = {
      event_id: eventId,
      event_type: eventType,
      occurred_at: occurredAt,
      entity_id: entityId,
      entity_version: "v" + (Date.now() % 1000),
      minimal_data: {
        externalStudentId: entityId,
        reason: "Simulirani webhook događaj iz e-Matice"
      }
    };

    // Sign using webhook secret (HMAC SHA256)
    const webhookSecret = 'secure_mzo_ematica_webhook_key_2026';
    const signature = crypto.createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    // Send actual HTTP POST request to EduPortal webhook endpoint
    try {
      const response = await fetch(`http://localhost:${PORT}/api/integrations/eduportal/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ematica-Signature': signature
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (response.ok) {
        res.json({ success: true, eventId, response: result, message: `Webhook '${eventType}' uspješno odaslan i obrađen.` });
      } else {
        res.status(response.status).json({ success: false, error: result.error, message: `EduPortal je odbio webhook: ${result.error}` });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message, message: "Greška pri mrežnom slanju webhooka." });
    }
  });


  // ==========================================
  // EDUPORTAL INTEGRATION SERVER COMPONENT
  // ==========================================

  // Subject normalization function (Section 8)
  function normalizeSubjectName(name: string, code?: string): string {
    const n = name.toLowerCase().trim();
    if (code === 'ENG' || n.includes('engleski')) {
      if (n.includes('književnost')) return 'Engleski jezik i književnost';
      return 'Engleski jezik';
    }
    if (code === 'HRV' || n.includes('hrvatski')) {
      return 'Hrvatski jezik';
    }
    if (code === 'MAT' || n.includes('matematika')) {
      return 'Matematika';
    }
    if (code === 'DEU' || n.includes('njemački') || n.includes('njemacki')) {
      if (n.includes('književnost')) return 'Njemački jezik i književnost';
      return 'Njemački jezik';
    }
    if (code === 'ITA' || n.includes('talijanski')) {
      if (n.includes('književnost')) return 'Talijanski jezik i književnost';
      return 'Talijanski jezik';
    }
    if (code === 'PHY' || n.includes('fizika')) return 'Fizika';
    if (code === 'INF' || n.includes('informatika')) return 'Informatika';
    if (code === 'CHE' || n.includes('kemija')) return 'Kemija';
    if (code === 'BIO' || n.includes('biologija')) return 'Biologija';
    
    return name;
  }

  // Webhook Receiver on EduPortal (Section 14 & 15)
  // We maintain a list of processed webhook events in-memory on the backend to avoid DB dependencies during webhook tests.
  // In our database, these are stored in `integration_events`. We simulate this perfectly.
  const processedEventIds = new Set<string>();

  app.post("/api/integrations/eduportal/webhook", (req, res) => {
    const signature = req.headers['x-ematica-signature'] as string;
    const webhookSecret = 'secure_mzo_ematica_webhook_key_2026';

    if (!signature) {
      return res.status(401).json({ error: 'Nedostaje sigurnosni potpis webhooka.' });
    }

    // Verify HMAC
    const rawBody = JSON.stringify(req.body);
    const expectedSignature = crypto.createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Nevažeći potpis webhooka (sigurnosna provjera propala).' });
    }

    const { event_id, event_type, entity_id } = req.body;

    // Idempotency: Protect against double processing (Test 6)
    if (processedEventIds.has(event_id)) {
      console.log(`[IDEMPOTENCY] Webhook event ${event_id} already processed. Skipping.`);
      return res.status(200).json({ success: true, duplicate: true, message: 'Događaj je već uspješno obrađen.' });
    }

    processedEventIds.add(event_id);

    console.log(`[WEBHOOK] Primljen valjan e-Matica webhook dogadaj: ${event_type} za entitet: ${entity_id}`);
    
    // We notify the webhook trigger that we successfully received it
    return res.status(200).json({
      success: true,
      eventId: event_id,
      eventType: event_type,
      message: 'Webhook zaprimljen i provjeren. Sinkronizacija za entitet ' + entity_id + ' je pokrenuta.'
    });
  });

  // Server-to-server sync router on EduPortal backend
  app.post("/api/integrations/eduportal/sync", async (req, res) => {
    const { tables, syncType, requestedBy, studentId, schoolId } = req.body;

    // Load tables received from the client-side state
    const usersList = [...(tables.users || [])];
    const studentsList = [...(tables.students || [])];
    const schoolsList = [...(tables.schools || [])];
    const schoolProgramsList = [...(tables.school_programs || [])];
    const schoolApplicationChoices = [...(tables.school_application_choices || [])];
    const universityApplicationChoices = [...(tables.university_application_choices || [])];
    
    const externalLinksList = [...(tables.student_external_links || [])];
    const syncRunsList = [...(tables.integration_sync_runs || [])];
    const syncErrorsList = [...(tables.integration_sync_errors || [])];
    const auditLogsList = [...(tables.audit_logs || [])];
    const notificationsList = [...(tables.notifications || [])];

    // Prepare sync run metadata
    const runId = "run-" + Date.now();
    const startedAt = new Date().toISOString();
    
    let recordsReceived = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;
    let recordsFailed = 0;
    let errorSummary = "";

    // Security Credentials and Signing
    const validClientId = 'eduportal_mzo_client';
    const secret = 'secure_mzo_ematica_secret_key_2026';
    const timestamp = new Date().toISOString();
    const nonce = "nonce-" + crypto.randomBytes(8).toString("hex");
    const signature = crypto.createHmac('sha256', secret)
      .update(`${timestamp}:${nonce}:${validClientId}`)
      .digest('hex');

    const headers = {
      'Content-Type': 'application/json',
      'X-Integration-Client-Id': validClientId,
      'X-Integration-Timestamp': timestamp,
      'X-Integration-Nonce': nonce,
      'X-Integration-Signature': signature
    };

    try {
      if (!ematicaOnline) {
        throw new Error("e-Matica sustav je izvan mreže (Offline). Spajanje nije uspjelo.");
      }

      console.log(`[SYNC SERVICE] Pokrećem ${syncType} sinkronizaciju...`);

      // 1. FETCH SCHOOLS & PROGRAMS S2S
      const schoolsResponse = await fetch(`http://localhost:${PORT}/api/integrations/eduportal/schools`, { headers });
      if (!schoolsResponse.ok) throw new Error("S2S neuspjeh pri dohvatu škola.");
      const ematicaSchools: any[] = await schoolsResponse.json();

      const programsResponse = await fetch(`http://localhost:${PORT}/api/integrations/eduportal/programs`, { headers });
      if (!programsResponse.ok) throw new Error("S2S neuspjeh pri dohvatu programa.");
      const ematicaPrograms: any[] = await programsResponse.json();

      // Sync Schools (using code/OIB mapping to avoid duplicate titles - Section 26)
      for (const esch of ematicaSchools) {
        recordsReceived++;
        const existingSchoolIndex = schoolsList.findIndex(s => s.mzoCode === esch.code || s.oib === esch.oib);
        if (existingSchoolIndex >= 0) {
          // Update details, do not duplicate
          schoolsList[existingSchoolIndex] = {
            ...schoolsList[existingSchoolIndex],
            name: esch.name,
            address: esch.address,
            type: esch.type,
            mzoCode: esch.code,
            oib: esch.oib || schoolsList[existingSchoolIndex].oib
          };
          recordsUpdated++;
        } else {
          // Add new school
          schoolsList.push({
            id: "sch-" + esch.id.split('-')[1],
            name: esch.name,
            type: esch.type,
            cityId: esch.cityId || "city-1",
            address: esch.address,
            mzoCode: esch.code,
            oib: esch.oib || crypto.randomBytes(5).toString('hex')
          });
          recordsCreated++;
        }
      }

      // Sync School Programs
      for (const eprog of ematicaPrograms) {
        recordsReceived++;
        const targetSchoolId = "sch-" + eprog.schoolId.split('-')[1];
        const existingProgramIndex = schoolProgramsList.findIndex(p => p.schoolId === targetSchoolId && p.name === eprog.name);
        if (existingProgramIndex >= 0) {
          schoolProgramsList[existingProgramIndex] = {
            ...schoolProgramsList[existingProgramIndex],
            name: eprog.name,
            durationYears: eprog.durationYears
          };
          recordsUpdated++;
        } else {
          // Add new program with default quota values
          schoolProgramsList.push({
            id: "prog-" + eprog.id.split('-')[1],
            schoolId: targetSchoolId,
            name: eprog.name,
            durationYears: eprog.durationYears,
            quota: 24,
            minPointsThreshold: 65,
            prevYearThreshold: 68,
            subjectsRequired: ['Hrvatski', 'Matematika', 'Strani jezik'],
            isActive: true,
            isPublished: true
          });
          recordsCreated++;
        }
      }

      // 2. FETCH STUDENTS S2S
      let fetchUrl = `http://localhost:${PORT}/api/integrations/eduportal/students`;
      if (syncType === 'MANUAL_STUDENT' && studentId) {
        // Find external student ID from client studentId
        const extLinkObj = externalLinksList.find(l => l.studentId === studentId);
        const extId = extLinkObj ? extLinkObj.externalStudentId : "ext-" + studentId.split('-')[1];
        fetchUrl = `http://localhost:${PORT}/api/integrations/eduportal/students/${extId}`;
      }

      const studentsResponse = await fetch(fetchUrl, { headers });
      if (!studentsResponse.ok) {
        if (studentsResponse.status === 404) {
          throw new Error("Traženi učenik nije evidentiran u bazi e-Matice.");
        }
        throw new Error("S2S neuspjeh pri dohvatu učenika.");
      }

      const rawStudentData = await studentsResponse.json();
      const studentsToSync = Array.isArray(rawStudentData) ? rawStudentData : [rawStudentData];

      // Sync Students (Section 6, 7, 11, 12, 13)
      for (const estud of studentsToSync) {
        recordsReceived++;

        // Verify Student status
        const isInactive = estud.status === 'INACTIVE'; // Test 14

        // A. Resolve existing or new links using unique source_system + external_student_id constraint
        let link = externalLinksList.find(l => l.sourceSystem === 'e-Matica' && l.externalStudentId === estud.id);
        let studentObj: any = null;
        let isNewStudent = false;

        if (link) {
          studentObj = studentsList.find(s => s.id === link.studentId);
        } else {
          // Fallback check by OIB to avoid duplication (Section 3)
          studentObj = studentsList.find(s => s.oib === estud.oib);
          if (studentObj) {
            // Found existing student profile, link them
            link = {
              id: "link-" + Date.now() + "-" + estud.id,
              studentId: studentObj.id,
              sourceSystem: 'e-Matica',
              externalStudentId: estud.id,
              externalSchoolId: estud.schoolId,
              externalProgramId: estud.programId,
              firstSyncedAt: new Date().toISOString(),
              lastSyncedAt: new Date().toISOString(),
              sourceRecordVersion: String(estud.version),
              syncStatus: 'SYNCED'
            };
            externalLinksList.push(link);
          } else {
            // Pure new student (Test 1)
            isNewStudent = true;
            const newStudentId = "stud-" + estud.id.split('-')[1];
            const newUserId = "usr-linked-" + estud.id.split('-')[1];

            // Auto-create user account (Section 11)
            usersList.push({
              id: newUserId,
              email: estud.email,
              fullName: `${estud.firstName} ${estud.lastName}`,
              role: estud.gradeLevel === 8 ? 'PRIMARY_STUDENT' : 'SECONDARY_STUDENT',
              createdAt: new Date().toISOString()
            });

            studentObj = {
              id: newStudentId,
              userId: newUserId,
              classId: estud.classId === 'ext-cls-8a' ? 'cls-8a' : estud.classId === 'ext-cls-8a-pecine' ? 'cls-8a' : estud.classId === 'ext-cls-4a' ? 'cls-4a' : 'cls-4a',
              schoolId: estud.schoolId === 'ext-sch-4' ? 'sch-4' : estud.schoolId === 'ext-sch-3' ? 'sch-3' : 'sch-1',
              oib: estud.oib,
              dateOfBirth: estud.dateOfBirth,
              gradeAverage5: 4.5,
              gradeAverage6: 4.5,
              gradeAverage7: 4.5,
              gradeAverage8: 4.5,
              competitionsPoints: 0,
              additionalPoints: 0
            };
            studentsList.push(studentObj);

            link = {
              id: "link-" + Date.now() + "-" + estud.id,
              studentId: newStudentId,
              sourceSystem: 'e-Matica',
              externalStudentId: estud.id,
              externalSchoolId: estud.schoolId,
              externalProgramId: estud.programId,
              firstSyncedAt: new Date().toISOString(),
              lastSyncedAt: new Date().toISOString(),
              sourceRecordVersion: String(estud.version),
              syncStatus: 'SYNCED'
            };
            externalLinksList.push(link);
            recordsCreated++;
          }
        }

        if (studentObj) {
          // B. Update official, non-editable fields (Section 12)
          studentObj.firstName = estud.firstName;
          studentObj.lastName = estud.lastName;
          studentObj.oib = estud.oib;
          studentObj.dateOfBirth = estud.dateOfBirth;

          if (isInactive) {
            studentObj.status = 'INACTIVE'; // Test 14
          } else {
            studentObj.status = 'ACTIVE';
            
            // Check School Transfer (Section 13, Test 8)
            const resolvedSchoolId = estud.schoolId === 'ext-sch-4' ? 'sch-4' : estud.schoolId === 'ext-sch-3' ? 'sch-3' : estud.schoolId === 'ext-sch-9' ? 'sch-9' : 'sch-1';
            if (studentObj.schoolId !== resolvedSchoolId) {
              console.log(`[TRANSFER] Učenik ${studentObj.firstName} prešao u školu: ${resolvedSchoolId}`);
              studentObj.schoolId = resolvedSchoolId;
              
              // We dispatch notification to student and write to audit
              notificationsList.unshift({
                id: "not-" + Date.now() + "-transfer",
                userId: studentObj.userId,
                title: "Promjena škole evidentirana",
                message: `U e-Matici je zabilježen Vaš prijelaz u novu školsku ustanovu. Trenutne prijave i bodovi su ažurirani.`,
                isRead: false,
                type: 'ALERT',
                createdAt: new Date().toISOString()
              });
            }
          }

          // Fetch student subjects and grades (Section 7, 8)
          const gradesUrl = `http://localhost:${PORT}/api/integrations/eduportal/students/${estud.id}/grades`;
          const gradesRes = await fetch(gradesUrl, { headers });
          if (gradesRes.ok) {
            const studentGrades: any[] = await gradesRes.json();
            
            // Analyze and normalise grades
            let averagesSum = 0;
            let subjectsCount = 0;
            
            studentGrades.forEach(g => {
              averagesSum += g.gradeValue;
              subjectsCount++;

              // Test 12 - Unmappable subject checking
              const normalizedName = normalizeSubjectName(g.subjectName, g.subjectCode);
              if (g.subjectCode === 'UNKNOWN' || normalizedName.includes('UNKNOWN')) {
                // Register a synchronization error (Test 12)
                syncErrorsList.unshift({
                  id: "err-" + Date.now() + "-" + g.id,
                  syncRunId: runId,
                  entityType: "GRADE",
                  externalEntityId: g.id,
                  errorCode: "UNKNOWN_SUBJECT_CODE",
                  errorMessage: `Nepoznata šifra predmeta '${g.subjectName}' (MZO: UNKNOWN) u e-Matici. Označeno za ručnu provjeru.`,
                  retryCount: 1,
                  createdAt: new Date().toISOString()
                });
                recordsFailed++;
              }
            });

            // Calculate overall averages from e-Matica grades
            const calculatedAvg = subjectsCount > 0 ? parseFloat((averagesSum / subjectsCount).toFixed(2)) : 4.80;
            
            // Set averages for all grades representing school year data
            studentObj.gradeAverage5 = calculatedAvg;
            studentObj.gradeAverage6 = calculatedAvg;
            studentObj.gradeAverage7 = calculatedAvg;
            studentObj.gradeAverage8 = calculatedAvg;

            // Test 3 & Test 4: Parse first and second foreign language specifications
            const firstLang = studentGrades.find(g => g.isFirstLanguage);
            const secondLang = studentGrades.find(g => g.isSecondLanguage);

            if (firstLang) {
              studentObj.firstLanguage = normalizeSubjectName(firstLang.subjectName, firstLang.subjectCode);
              studentObj.firstLanguageYears = firstLang.durationYears;
            }
            if (secondLang) {
              studentObj.secondLanguage = normalizeSubjectName(secondLang.subjectName, secondLang.subjectCode);
              studentObj.secondLanguageYears = secondLang.durationYears;
              studentObj.secondLanguageGrade = secondLang.gradeValue;
            }

            // Section 25 & Test 13: Handle Graduation Status
            if (estud.hasGraduated) {
              studentObj.hasGraduated = true;
              studentObj.graduationDate = estud.graduationDate;
              studentObj.statusGraduation = 'GRADUATED';
            } else {
              studentObj.hasGraduated = false;
              studentObj.statusGraduation = 'NOT_CONFIRMED';
            }

            // Recalculate Points for Choices (Section 9, 10, 24, Test 5, Test 13)
            if (estud.gradeLevel === 8) {
              // Recalculate primary school application choices
              const studentAvgSum = studentObj.gradeAverage5 + studentObj.gradeAverage6 + studentObj.gradeAverage7 + studentObj.gradeAverage8;
              const points = parseFloat((studentAvgSum * 4).toFixed(2)); // basic formula: sum * 4 (max 80)
              
              schoolApplicationChoices.forEach(choice => {
                const appObj = tables.school_applications?.find((a: any) => a.id === choice.applicationId);
                if (appObj && appObj.studentId === studentObj.id) {
                  const prevPoints = choice.pointsCalculated;
                  choice.pointsCalculated = points + (studentObj.competitionsPoints || 0) + (studentObj.additionalPoints || 0);
                  choice.estimatedStatus = choice.pointsCalculated >= 72.0 ? 'UPADA' : 'NE_UPADA';
                  
                  if (prevPoints !== choice.pointsCalculated) {
                    console.log(`[RECALC] Recalculated primary choices for ${studentObj.firstName}. Points updated: ${prevPoints} -> ${choice.pointsCalculated}`);
                  }
                }
              });
            } else {
              // Recalculate secondary university application choices
              const schoolAvg = (studentObj.gradeAverage5 + studentObj.gradeAverage6 + studentObj.gradeAverage7 + studentObj.gradeAverage8) / 4;
              const schoolBasePoints = (schoolAvg / 5.0) * 400; // max 400
              
              universityApplicationChoices.forEach(choice => {
                const appObj = tables.university_applications?.find((a: any) => a.id === choice.applicationId);
                if (appObj && appObj.studentId === studentObj.id) {
                  const prevPoints = choice.pointsCalculated;
                  // We simulate exam points addition
                  const examPoints = 442.5; // Fixed base matura result for simulation
                  choice.pointsCalculated = parseFloat((schoolBasePoints + examPoints).toFixed(1));
                  choice.estimatedStatus = choice.pointsCalculated >= 680.0 ? 'UPADA' : 'ISPOD_PRAGA';

                  if (prevPoints !== choice.pointsCalculated) {
                    console.log(`[RECALC] Recalculated university choices for ${studentObj.firstName}. Points updated: ${prevPoints} -> ${choice.pointsCalculated}`);
                  }
                }
              });
            }
          }

          if (!isNewStudent) recordsUpdated++;
          
          if (link) {
            link.lastSyncedAt = new Date().toISOString();
            link.sourceRecordVersion = String(estud.version);
          }
        }
      }

      // Record successful run
      syncRunsList.unshift({
        id: runId,
        sourceSystem: 'e-Matica',
        syncType,
        startedAt,
        finishedAt: new Date().toISOString(),
        status: recordsFailed > 0 ? 'WARNING' : 'SUCCESS',
        requestedBy: requestedBy || 'Sustav',
        recordsReceived,
        recordsCreated,
        recordsUpdated,
        recordsSkipped,
        recordsFailed,
        errorSummary: recordsFailed > 0 ? `${recordsFailed} pogrešaka pri mapiranju predmeta.` : undefined
      });

      // Audit log (Section 27)
      auditLogsList.unshift({
        id: "log-" + Date.now(),
        userId: requestedBy === 'nikoladuric025@gmail.com' ? 'usr-admin' : 'usr-system',
        userEmail: requestedBy || 'system-integration',
        action: 'SINKRONIZACIJA_EMATICA',
        details: `Završena sinkronizacija s e-Maticom. Tip: ${syncType}. Kreirano: ${recordsCreated}, Ažurirano: ${recordsUpdated}, Pogreške: ${recordsFailed}`,
        ipAddress: '193.198.0.1',
        createdAt: new Date().toISOString()
      });

      console.log(`[SYNC SERVICE] Sinkronizacija uspješna. Kreirano: ${recordsCreated}, Ažurirano: ${recordsUpdated}`);

      res.status(200).json({
        success: true,
        message: "Sinkronizacija s e-Maticom je uspješno završena.",
        tables: {
          users: usersList,
          students: studentsList,
          schools: schoolsList,
          school_programs: schoolProgramsList,
          school_application_choices: schoolApplicationChoices,
          university_application_choices: universityApplicationChoices,
          student_external_links: externalLinksList,
          integration_sync_runs: syncRunsList,
          integration_sync_errors: syncErrorsList,
          audit_logs: auditLogsList,
          notifications: notificationsList
        }
      });

    } catch (err: any) {
      console.error("[SYNC ERROR] Neuspjela sinkronizacija s e-Maticom:", err.message);
      
      // Record failed run (Test 9)
      syncRunsList.unshift({
        id: runId,
        sourceSystem: 'e-Matica',
        syncType,
        startedAt,
        finishedAt: new Date().toISOString(),
        status: 'FAILED',
        requestedBy: requestedBy || 'Sustav',
        recordsReceived: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        recordsFailed: 1,
        errorSummary: err.message
      });

      // Record a connection error log
      syncErrorsList.unshift({
        id: "err-" + Date.now(),
        syncRunId: runId,
        entityType: "CONNECTION",
        externalEntityId: "e-matica-endpoint",
        errorCode: "EMATICA_OFFLINE",
        errorMessage: err.message,
        retryCount: 1,
        createdAt: new Date().toISOString()
      });

      auditLogsList.unshift({
        id: "log-" + Date.now(),
        userId: 'usr-system',
        userEmail: requestedBy || 'system-integration',
        action: 'SINKRONIZACIJA_NEUSPJEH',
        details: `Greška u sinkronizaciji s e-Maticom: ${err.message}`,
        ipAddress: '193.198.0.1',
        createdAt: new Date().toISOString()
      });

      res.status(200).json({
        success: false,
        error: err.message,
        message: "Sinkronizacija nije uspjela. Portal koristi pohranjene podatke.",
        tables: {
          users: usersList,
          students: studentsList,
          schools: schoolsList,
          school_programs: schoolProgramsList,
          school_application_choices: schoolApplicationChoices,
          university_application_choices: universityApplicationChoices,
          student_external_links: externalLinksList,
          integration_sync_runs: syncRunsList,
          integration_sync_errors: syncErrorsList,
          audit_logs: auditLogsList,
          notifications: notificationsList
        }
      });
    }
  });

  // GET Integration Health Status (Section 30)
  app.get("/api/integrations/e-matica/health", (req, res) => {
    res.status(200).json({
      connected: ematicaOnline,
      authenticated: ematicaOnline,
      sourceAvailable: ematicaOnline,
      lastSuccessfulRequest: new Date().toISOString(),
      responseTime: ematicaOnline ? "42ms" : "9999ms",
      currentSyncStatus: ematicaOnline ? "IDLE" : "OFFLINE"
    });
  });

  // ==========================================
  // ORIGINAL EDUPORTAL APP UNLOCK ENDPOINTS (PRESERVED)
  // ==========================================
  app.post("/api/school-applications/:id/unlock", requireSession(['SECONDARY_ADMISSIONS']), (req, res) => {
    const { id } = req.params;
    const { reason, requestorId, requestorRole } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Razlog za otključavanje mora imati barem 10 znakova.' });
    }

    const hasUnlockPermission = ['PRIMARY_HOMEROOM_TEACHER', 'PRIMARY_ADMIN', 'SUPER_ADMIN'].includes(requestorRole);
    if (!hasUnlockPermission) {
      return res.status(403).json({ error: 'Nemate ovlasti za otključavanje ove liste.' });
    }

    auditLogs.push({
      event: 'SCHOOL_WISH_LIST_UNLOCKED',
      applicationId: id,
      requestorId,
      requestorRole,
      reason,
      timestamp: new Date().toISOString()
    });

    console.log(`[AUDIT] SCHOOL_WISH_LIST_UNLOCKED: App ${id} by ${requestorId}. Reason: ${reason}`);

    return res.status(200).json({ 
      success: true, 
      status: 'DRAFT',
      message: 'Lista je uspješno otključana i vraćena u izradu.'
    });
  });

  app.post("/api/university-applications/:id/unlock", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const { id } = req.params;
    const { reason, requestorId, requestorRole } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Razlog za otključavanje mora imati barem 10 znakova.' });
    }

    const hasUnlockPermission = ['SECONDARY_HOMEROOM_TEACHER', 'SECONDARY_ADMIN', 'SUPER_ADMIN'].includes(requestorRole);
    if (!hasUnlockPermission) {
      return res.status(403).json({ error: 'Nemate ovlasti za otključavanje ove liste.' });
    }

    auditLogs.push({
      event: 'UNIVERSITY_PRIORITY_LIST_UNLOCKED',
      applicationId: id,
      requestorId,
      requestorRole,
      reason,
      timestamp: new Date().toISOString()
    });

    console.log(`[AUDIT] UNIVERSITY_PRIORITY_LIST_UNLOCKED: App ${id} by ${requestorId}. Reason: ${reason}`);

    return res.status(200).json({ 
      success: true, 
      status: 'DRAFT',
      message: 'Lista je uspješno otključana i vraćena u izradu.'
    });
  });

  // ==========================================
  // REAL STATEFUL MATURA INTEGRATION ENDPOINTS
  // ==========================================

  // CENTRAL MATURA CATALOG & DYNAMIC PERSISTENT DATABASE ENGINE
  const CENTRAL_MATURA_CATALOG = [
    // OBVEZNI PREDMETI (MANDATORY)
    { id: 'matura-hrv', code: 'HRV', officialName: 'Hrvatski jezik', examPart: 'MANDATORY', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-mat', code: 'MAT', officialName: 'Matematika', examPart: 'MANDATORY', hasLevels: true, allowedLevels: ['A', 'B'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-eng', code: 'ENG', officialName: 'Engleski jezik', examPart: 'MANDATORY', hasLevels: true, allowedLevels: ['A', 'B'], isForeignLanguage: true, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-deu', code: 'DEU', officialName: 'Njemački jezik', examPart: 'MANDATORY', hasLevels: true, allowedLevels: ['A', 'B'], isForeignLanguage: true, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-fra', code: 'FRA', officialName: 'Francuski jezik', examPart: 'MANDATORY', hasLevels: true, allowedLevels: ['A', 'B'], isForeignLanguage: true, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-ita', code: 'ITA', officialName: 'Talijanski jezik kao strani jezik', examPart: 'MANDATORY', hasLevels: true, allowedLevels: ['A', 'B'], isForeignLanguage: true, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-spa', code: 'SPA', officialName: 'Španjolski jezik', examPart: 'MANDATORY', hasLevels: true, allowedLevels: ['A', 'B'], isForeignLanguage: true, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-lat', code: 'LAT', officialName: 'Latinski jezik', examPart: 'MANDATORY', hasLevels: true, allowedLevels: ['A', 'B'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: true, active: true },
    { id: 'matura-grc', code: 'GRC', officialName: 'Grčki jezik', examPart: 'MANDATORY', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: true, active: true },

    // IZBORNI PREDMETI (ELECTIVE)
    { id: 'matura-bio', code: 'BIO', officialName: 'Biologija', examPart: 'ELECTIVE', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-eti', code: 'ETI', officialName: 'Etika', examPart: 'ELECTIVE', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-fil', code: 'FIL', officialName: 'Filozofija', examPart: 'ELECTIVE', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-fiz', code: 'FIZ', officialName: 'Fizika', examPart: 'ELECTIVE', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-geo', code: 'GEO', officialName: 'Geografija', examPart: 'ELECTIVE', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-gla', code: 'GLA', officialName: 'Glazbena umjetnost', examPart: 'ELECTIVE', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-inf', code: 'INF', officialName: 'Informatika', examPart: 'ELECTIVE', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-kem', code: 'KEM', officialName: 'Kemija', examPart: 'ELECTIVE', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-lik', code: 'LIK', officialName: 'Likovna umjetnost', examPart: 'ELECTIVE', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-log', code: 'LOG', officialName: 'Logika', examPart: 'ELECTIVE', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-pig', code: 'PIG', officialName: 'Politika i gospodarstvo', examPart: 'ELECTIVE', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-pov', code: 'POV', officialName: 'Povijest', examPart: 'ELECTIVE', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-psi', code: 'PSI', officialName: 'Psihologija', examPart: 'ELECTIVE', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-soc', code: 'SOC', officialName: 'Sociologija', examPart: 'ELECTIVE', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: false, active: true },
    { id: 'matura-vje', code: 'VJE', officialName: 'Vjeronauk', examPart: 'ELECTIVE', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: false, isClassicalLanguage: false, active: true },

    // JEZICI NACIONALNIH MANJINA (MINORITY)
    { id: 'matura-ces', code: 'CES', officialName: 'Češki jezik', examPart: 'MINORITY', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: true, isClassicalLanguage: false, active: true },
    { id: 'matura-mad', code: 'MAD', officialName: 'Mađarski jezik i književnost', examPart: 'MINORITY', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: true, isClassicalLanguage: false, active: true },
    { id: 'matura-srp', code: 'SRP', officialName: 'Srpski jezik', examPart: 'MINORITY', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: true, isClassicalLanguage: false, active: true },
    { id: 'matura-it-manj', code: 'ITA_MIN', officialName: 'Talijanski jezik i književnost', examPart: 'MINORITY', hasLevels: false, allowedLevels: ['SINGLE'], isForeignLanguage: false, isMinorityLanguage: true, isClassicalLanguage: false, active: true }
  ];

  const DB_FILE = path.join(process.cwd(), "db_matura.json");

  function readDb() {
    if (!fs.existsSync(DB_FILE)) {
      const initialDb = {
        exam_periods: [
          {
            id: 'ep-ljetni-2026',
            name: 'Ljetni rok 2026.',
            academic_year: '2025./2026.',
            period_type: 'LJETNI',
            registration_opens_at: '2026-02-01T12:00:00Z',
            registration_closes_at: '2026-05-15T12:00:00Z',
            withdrawal_closes_at: '2026-05-15T12:00:00Z',
            registrations_lock_at: '2026-05-15T12:00:00Z',
            late_withdrawal_deadline: '2026-05-25T12:00:00Z',
            exams_start_at: '2026-06-01',
            exams_end_at: '2026-06-30',
            temporary_results_at: '2026-07-02T12:00:00Z',
            appeals_close_at: '2026-07-04T12:00:00Z',
            final_results_at: '2026-07-10T12:00:00Z',
            status: 'REGISTRATION_OPEN',
            created_by: 'usr-admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'ep-jesenski-2026',
            name: 'Jesenski rok 2026.',
            academic_year: '2025./2026.',
            period_type: 'JESENSKI',
            registration_opens_at: '2026-08-01T12:00:00Z',
            registration_closes_at: '2026-08-25T12:00:00Z',
            withdrawal_closes_at: '2026-08-25T12:00:00Z',
            registrations_lock_at: '2026-08-25T12:00:00Z',
            late_withdrawal_deadline: '2026-08-30T12:00:00Z',
            exams_start_at: '2026-09-01',
            exams_end_at: '2026-09-15',
            temporary_results_at: '2026-09-17T12:00:00Z',
            appeals_close_at: '2026-09-19T12:00:00Z',
            final_results_at: '2026-09-22T12:00:00Z',
            status: 'DRAFT',
            created_by: 'usr-admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ],
        exam_sessions: [
          {
            id: 'es-hrv',
            exam_period_id: 'ep-ljetni-2026',
            subject_id: 'matura-hrv',
            level: 'SINGLE',
            exam_date: '2026-06-15',
            start_time: '09:00',
            duration_minutes: 180,
            maximum_points: 100,
            passing_threshold: 40,
            status: 'ACTIVE',
            created_by: 'usr-admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'es-mat-a',
            exam_period_id: 'ep-ljetni-2026',
            subject_id: 'matura-mat',
            level: 'A',
            exam_date: '2026-06-17',
            start_time: '09:00',
            duration_minutes: 180,
            maximum_points: 100,
            passing_threshold: 45,
            status: 'ACTIVE',
            created_by: 'usr-admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'es-mat-b',
            exam_period_id: 'ep-ljetni-2026',
            subject_id: 'matura-mat',
            level: 'B',
            exam_date: '2026-06-17',
            start_time: '09:00',
            duration_minutes: 150,
            maximum_points: 80,
            passing_threshold: 30,
            status: 'ACTIVE',
            created_by: 'usr-admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'es-eng-a',
            exam_period_id: 'ep-ljetni-2026',
            subject_id: 'matura-eng',
            level: 'A',
            exam_date: '2026-06-19',
            start_time: '09:00',
            duration_minutes: 180,
            maximum_points: 100,
            passing_threshold: 45,
            status: 'ACTIVE',
            created_by: 'usr-admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'es-eng-b',
            exam_period_id: 'ep-ljetni-2026',
            subject_id: 'matura-eng',
            level: 'B',
            exam_date: '2026-06-19',
            start_time: '09:00',
            duration_minutes: 120,
            maximum_points: 80,
            passing_threshold: 30,
            status: 'ACTIVE',
            created_by: 'usr-admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'es-fiz',
            exam_period_id: 'ep-ljetni-2026',
            subject_id: 'matura-fiz',
            level: 'SINGLE',
            exam_date: '2026-06-22',
            start_time: '09:00',
            duration_minutes: 180,
            maximum_points: 100,
            passing_threshold: 35,
            status: 'ACTIVE',
            created_by: 'usr-admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'es-inf',
            exam_period_id: 'ep-ljetni-2026',
            subject_id: 'matura-inf',
            level: 'SINGLE',
            exam_date: '2026-06-23',
            start_time: '14:00',
            duration_minutes: 150,
            maximum_points: 100,
            passing_threshold: 40,
            status: 'ACTIVE',
            created_by: 'usr-admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ],
        exam_registrations: [], // COMPLETELY EMPTY INIT
        exam_results: [], // COMPLETELY EMPTY INIT
        exam_result_history: [],
        accommodation_requests: [],
        accommodation_documents: [],
        accommodation_measures: [],
        accommodation_measure_exams: [],
        accommodation_decisions: [],
        accommodation_deliveries: [],
        accommodation_history: []
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), "utf8");
      return initialDb;
    }
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      if (!data.exam_periods) data.exam_periods = [];
      if (!data.exam_sessions) data.exam_sessions = [];
      if (!data.exam_registrations) data.exam_registrations = [];
      if (!data.exam_results) data.exam_results = [];
      if (!data.exam_result_history) data.exam_result_history = [];
      if (!data.accommodation_requests) data.accommodation_requests = [];
      if (!data.accommodation_documents) data.accommodation_documents = [];
      if (!data.accommodation_measures) data.accommodation_measures = [];
      if (!data.accommodation_measure_exams) data.accommodation_measure_exams = [];
      if (!data.accommodation_decisions) data.accommodation_decisions = [];
      if (!data.accommodation_deliveries) data.accommodation_deliveries = [];
      if (!data.accommodation_history) data.accommodation_history = [];
      return data;
    } catch (e) {
      fs.unlinkSync(DB_FILE);
      return readDb();
    }
  }

  function writeDb(data: any) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  }

  // API to retrieve all exam periods
  app.get("/api/matura/periods", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const db = readDb();
    res.json(db.exam_periods);
  });

  // API to create a new exam period
  app.post("/api/matura/periods", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: "Samo glavni administrator može stvarati ispitne rokove." });
    }

    const { name, academic_year, period_type, registration_opens_at, registration_closes_at, withdrawal_closes_at, registrations_lock_at, late_withdrawal_deadline, exams_start_at, exams_end_at, temporary_results_at, appeals_close_at, final_results_at, status } = req.body;

    if (!name || !academic_year || !period_type) {
      return res.status(400).json({ error: "Nedostaju osnovni podaci za ispitni rok." });
    }

    const db = readDb();
    const newPeriod = {
      id: `ep-${Date.now()}`,
      name,
      academic_year,
      period_type,
      registration_opens_at: registration_opens_at || new Date().toISOString(),
      registration_closes_at: registration_closes_at || new Date().toISOString(),
      withdrawal_closes_at: withdrawal_closes_at || new Date().toISOString(),
      registrations_lock_at: registrations_lock_at || new Date().toISOString(),
      late_withdrawal_deadline: late_withdrawal_deadline || new Date().toISOString(),
      exams_start_at: exams_start_at || '',
      exams_end_at: exams_end_at || '',
      temporary_results_at: temporary_results_at || '',
      appeals_close_at: appeals_close_at || '',
      final_results_at: final_results_at || '',
      status: status || 'DRAFT',
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.exam_periods.push(newPeriod);
    writeDb(db);

    res.json({ success: true, period: newPeriod });
  });

  // API to update an exam period
  app.put("/api/matura/periods/:id", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: "Samo glavni administrator može mijenjati ispitne rokove." });
    }

    const { id } = req.params;
    const db = readDb();
    const index = db.exam_periods.findIndex((p: any) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Ispitni rok nije pronađen." });
    }

    db.exam_periods[index] = {
      ...db.exam_periods[index],
      ...req.body,
      updated_at: new Date().toISOString()
    };

    writeDb(db);
    res.json({ success: true, period: db.exam_periods[index] });
  });

  // API to retrieve exam sessions
  app.get("/api/matura/sessions", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const db = readDb();
    res.json(db.exam_sessions);
  });

  // API to add an exam session to a period
  app.post("/api/matura/sessions", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: "Samo glavni administrator može dodavati ispite u rok." });
    }

    const { exam_period_id, subject_id, level, exam_date, start_time, duration_minutes, maximum_points, passing_threshold, status } = req.body;

    if (!exam_period_id || !subject_id || !level || !maximum_points) {
      return res.status(400).json({ error: "Nedostaju obvezni podaci za ispit." });
    }

    const db = readDb();
    const period = db.exam_periods.find((p: any) => p.id === exam_period_id);
    if (!period) {
      return res.status(404).json({ error: "Ispitni rok ne postoji." });
    }

    const newSession = {
      id: `es-${Date.now()}`,
      exam_period_id,
      subject_id,
      level,
      exam_date: exam_date || '',
      start_time: start_time || '09:00',
      duration_minutes: duration_minutes ? Number(duration_minutes) : 180,
      maximum_points: Number(maximum_points),
      passing_threshold: passing_threshold ? Number(passing_threshold) : 40,
      status: status || 'ACTIVE',
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.exam_sessions.push(newSession);
    writeDb(db);

    res.json({ success: true, session: newSession });
  });

  // GET available exams (filtered by open registration periods)
  app.get("/api/matura/available-exams", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    if (!ematicaOnline) {
      return res.status(503).json({ error: "Veza s e-Maticom nije uspostavljena ili je portal izvan mreže." });
    }

    const { studentId } = req.query;
    let extStudent = ematicaDb.students.find(s => s.id === 'ext-ivan');
    if (studentId && studentId !== 'stud-ivan') {
      extStudent = ematicaDb.students.find(s => s.email.includes(String(studentId).toLowerCase()));
    }

    if (!extStudent) {
      return res.status(404).json({ error: "Učenik nije pronađen u sustavu e-Matica." });
    }

    const extSubjects = ematicaDb.subjects[extStudent.id] || [];
    const db = readDb();

    // Find sessions belonging to active/open periods
    const openPeriods = db.exam_periods.filter((p: any) => p.status === 'REGISTRATION_OPEN');
    const openPeriodIds = openPeriods.map((p: any) => p.id);

    const activeSessions = db.exam_sessions.filter((s: any) => openPeriodIds.includes(s.exam_period_id) && s.status === 'ACTIVE');

    // Filter available mandatory subjects
    const mandatoryList = activeSessions.filter((s: any) => {
      const sub = CENTRAL_MATURA_CATALOG.find(c => c.id === s.subject_id);
      if (!sub || sub.examPart !== 'MANDATORY') return false;

      // Croatian and Math are always available
      if (sub.code === 'HRV' || sub.code === 'MAT') return true;

      // Foreign languages: learned in school
      if (sub.isForeignLanguage) {
        return extSubjects.some(es => {
          const nameLower = es.name.toLowerCase();
          const subNameLower = sub.officialName.toLowerCase();
          return nameLower.includes(sub.code.toLowerCase()) || nameLower.includes(subNameLower) || es.code === sub.code;
        });
      }

      // Classical languages
      if (sub.isClassicalLanguage) {
        return extSubjects.some(es => es.code === sub.code || es.name.toLowerCase().includes('latinski') || es.name.toLowerCase().includes('grčki'));
      }

      return false;
    }).map((sess: any) => {
      const sub = CENTRAL_MATURA_CATALOG.find(c => c.id === sess.subject_id);
      return {
        ...sub,
        sessionId: sess.id,
        periodId: sess.exam_period_id,
        level: sess.level,
        date: sess.exam_date,
        time: sess.start_time,
        durationMinutes: sess.duration_minutes
      };
    });

    // Elective and minority subjects
    const electiveList = activeSessions.filter((s: any) => {
      const sub = CENTRAL_MATURA_CATALOG.find(c => c.id === s.subject_id);
      if (!sub) return false;
      
      if (sub.examPart === 'ELECTIVE') return true;

      if (sub.examPart === 'MINORITY') {
        return extStudent.minorityProgram || extSubjects.some(es => es.code === sub.code || es.name.toLowerCase().includes(sub.officialName.toLowerCase()));
      }

      return false;
    }).map((sess: any) => {
      const sub = CENTRAL_MATURA_CATALOG.find(c => c.id === sess.subject_id);
      return {
        ...sub,
        sessionId: sess.id,
        periodId: sess.exam_period_id,
        level: sess.level,
        date: sess.exam_date,
        time: sess.start_time,
        durationMinutes: sess.duration_minutes
      };
    });

    const learnedLanguages = extSubjects
      .filter(es => es.foreignLanguageOrder)
      .map(es => ({
        code: es.code || 'ENG',
        name: es.name,
        order: es.foreignLanguageOrder,
        durationYears: es.durationYears
      }));

    res.json({
      mandatory: mandatoryList,
      elective: electiveList,
      eligibility: {
        source: "E_MATICA",
        lastSyncedAt: new Date().toISOString(),
        foreignLanguages: learnedLanguages,
        schoolName: extStudent.schoolId === 'ext-sch-4' ? 'XV. Gimnazija (MIOC)' : 'Srednja škola',
        programName: extStudent.programId === 'ext-prog-1' ? 'Prirodoslovno-matematička gimnazija (IBM program)' : 'Gimnazija',
        gradeLevel: extStudent.gradeLevel,
        classSection: '4.A',
        isClassicalGymnasium: extSubjects.some(es => es.name.toLowerCase().includes('latinski') || es.name.toLowerCase().includes('grčki'))
      }
    });
  });

  // Get active student registrations
  app.get("/api/matura/registrations", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const { studentId } = req.query;
    const filterId = studentId ? String(studentId) : 'stud-ivan';
    
    const db = readDb();
    const regs = db.exam_registrations.filter((r: any) => r.student_id === filterId && r.registration_status === 'REGISTERED');
    
    const enriched = regs.map((r: any) => {
      const sess = db.exam_sessions.find((s: any) => s.id === r.exam_session_id);
      const subject = CENTRAL_MATURA_CATALOG.find(s => s.id === r.subject_id);
      return {
        id: r.id,
        studentId: r.student_id,
        examSessionId: r.exam_session_id,
        subjectId: r.subject_id,
        level: r.level,
        registeredAt: r.registered_at,
        status: r.registration_status,
        subject,
        date: sess ? sess.exam_date : '2026-06-20',
        time: sess ? sess.start_time : '09:00',
        periodId: sess ? sess.exam_period_id : ''
      };
    });

    res.json(enriched);
  });

  // Register an exam
  app.post("/api/matura/register-exam", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    if (!ematicaOnline) {
      return res.status(503).json({ error: "Veza s e-Maticom nije uspostavljena ili je portal izvan mreže." });
    }

    const { studentId, subjectId, level } = req.body;

    if (!studentId || !subjectId) {
      return res.status(400).json({ error: "Nedostaju podaci za prijavu ispita." });
    }

    const db = readDb();

    // Check if there is an active exam period that is open for registration
    const openPeriods = db.exam_periods.filter((p: any) => p.status === 'REGISTRATION_OPEN');
    if (openPeriods.length === 0) {
      return res.status(400).json({ error: "Trenutačno nema aktivnog ispitnog roka otvorenog za prijave." });
    }

    const openPeriodIds = openPeriods.map((p: any) => p.id);

    // Find an active session matching subject and level in the open period(s)
    const session = db.exam_sessions.find((s: any) => 
      openPeriodIds.includes(s.exam_period_id) && 
      s.subject_id === subjectId && 
      (s.level === level || s.level === 'SINGLE') &&
      s.status === 'ACTIVE'
    );

    if (!session) {
      return res.status(404).json({ error: "Nije pronađen otvoren i aktivan ispit za ovaj predmet i razinu." });
    }

    const period = openPeriods.find((p: any) => p.id === session.exam_period_id);
    if (new Date() > new Date(period.registration_closes_at)) {
      return res.status(400).json({ error: "Rok za prijavu ispita u ovom ispitnom roku je završio." });
    }

    const subject = CENTRAL_MATURA_CATALOG.find(s => s.id === subjectId);
    if (!subject || !subject.active) {
      return res.status(404).json({ error: "Predmet nije pronađen u centralnom katalogu ili nije aktivan." });
    }

    // Duplication check
    const alreadyRegistered = db.exam_registrations.some((r: any) => 
      r.student_id === studentId && 
      r.subject_id === subjectId && 
      r.registration_status === 'REGISTERED'
    );
    if (alreadyRegistered) {
      return res.status(400).json({ error: "Ovaj ispit je već prijavljen." });
    }

    // Obvezni strani jezik limit check:
    if (subject.examPart === 'MANDATORY' && subject.isForeignLanguage) {
      const hasOtherForeignMandatory = db.exam_registrations.some((r: any) => {
        if (r.student_id !== studentId || r.registration_status !== 'REGISTERED') return false;
        const sub = CENTRAL_MATURA_CATALOG.find(s => s.id === r.subject_id);
        return sub && sub.examPart === 'MANDATORY' && sub.isForeignLanguage;
      });
      if (hasOtherForeignMandatory) {
        return res.status(400).json({ error: "Već imate prijavljen obvezni strani jezik. Dopušten je najviše jedan obvezni strani jezik." });
      }
    }

    // Eligibility check from e-Matica
    let extStudent = ematicaDb.students.find(s => s.id === 'ext-ivan');
    if (studentId !== 'stud-ivan') {
      extStudent = ematicaDb.students.find(s => s.email.includes(String(studentId).toLowerCase()));
    }

    if (extStudent) {
      const extSubjects = ematicaDb.subjects[extStudent.id] || [];
      if (subject.isForeignLanguage) {
        const learned = extSubjects.some(es => es.code === subject.code || es.name.toLowerCase().includes(subject.officialName.toLowerCase()));
        if (!learned) {
          return res.status(400).json({ error: `Učenik prema podacima e-Matice nije učio ${subject.officialName} te ga ne može prijaviti.` });
        }
      }
    }

    // Create new registration
    const newReg = {
      id: `reg-${Date.now()}`,
      student_id: studentId,
      exam_session_id: session.id,
      subject_id: subjectId,
      level: session.level,
      registration_status: 'REGISTERED',
      registered_at: new Date().toISOString(),
      withdrawn_at: null,
      locked_at: null,
      registration_source: 'STUDENT_PORTAL',
      created_by: studentId,
      updated_at: new Date().toISOString(),
      withdrawal_type: null,
      withdrawal_reason_code: null,
      withdrawal_reason_text: null,
      withdrawal_document_id: null,
      withdrawn_by: null,
      withdrawn_by_role: null
    };

    db.exam_registrations.push(newReg);
    writeDb(db);

    res.status(200).json({
      success: true,
      registration: {
        id: newReg.id,
        studentId: newReg.student_id,
        examSessionId: newReg.exam_session_id,
        subjectId: newReg.subject_id,
        level: newReg.level,
        registeredAt: newReg.registered_at,
        status: newReg.registration_status,
        subject,
        date: session.exam_date,
        time: session.start_time
      },
      message: `Uspješno prijavljen ispit mature: ${subject.officialName} (${newReg.level})`
    });
  });

  // Regular Student Cancel/Withdraw Exam
  app.post("/api/matura/cancel-exam", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Nedostaje ID prijave." });
    }

    const db = readDb();
    const reg = db.exam_registrations.find((r: any) => r.id === id);
    if (!reg) {
      return res.status(404).json({ error: "Prijava ispita nije pronađena." });
    }

    const sess = db.exam_sessions.find((s: any) => s.id === reg.exam_session_id);
    if (!sess) {
      return res.status(404).json({ error: "Ispitna sesija nije pronađena." });
    }

    const period = db.exam_periods.find((p: any) => p.id === sess.exam_period_id);
    if (!period) {
      return res.status(404).json({ error: "Ispitni rok nije pronađen." });
    }

    // Enforce student withdrawal deadline
    if (new Date() > new Date(period.withdrawal_closes_at)) {
      return res.status(400).json({ error: "Rok za redovnu odjavu ispita je istekao. Za naknadnu odjavu obratite se ispitnom koordinatoru škole." });
    }

    reg.registration_status = 'WITHDRAWN';
    reg.withdrawn_at = new Date().toISOString();
    reg.withdrawn_by = (req as any).user.id;
    reg.withdrawn_by_role = (req as any).user.role;
    reg.withdrawal_type = 'REGULAR';
    reg.updated_at = new Date().toISOString();

    writeDb(db);
    res.status(200).json({ success: true, message: "Ispit je uspješno odjavljen." });
  });

  // Change exam level
  app.post("/api/matura/change-level", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const { id, newLevel } = req.body;
    if (!id || !newLevel) {
      return res.status(400).json({ error: "Nedostaju podaci za izmjenu razine." });
    }

    const db = readDb();
    const reg = db.exam_registrations.find((r: any) => r.id === id);
    if (!reg) {
      return res.status(404).json({ error: "Prijava ispita nije pronađena." });
    }

    const sess = db.exam_sessions.find((s: any) => s.id === reg.exam_session_id);
    if (!sess) {
      return res.status(404).json({ error: "Ispitna sesija nije pronađena." });
    }

    const period = db.exam_periods.find((p: any) => p.id === sess.exam_period_id);
    if (!period) {
      return res.status(404).json({ error: "Ispitni rok nije pronađen." });
    }

    // Enforce student deadline
    if (new Date() > new Date(period.withdrawal_closes_at)) {
      return res.status(400).json({ error: "Prijava je zaključana. Više nije moguće mijenjati razinu ispita." });
    }

    const targetSession = db.exam_sessions.find((s: any) => 
      s.exam_period_id === sess.exam_period_id && 
      s.subject_id === reg.subject_id && 
      s.level === newLevel &&
      s.status === 'ACTIVE'
    );

    if (!targetSession) {
      return res.status(404).json({ error: `Nije pronađen aktivan ispit za razinu ${newLevel} u istom ispitnom roku.` });
    }

    reg.exam_session_id = targetSession.id;
    reg.level = newLevel;
    reg.updated_at = new Date().toISOString();

    writeDb(db);
    res.status(200).json({ success: true, message: `Razina uspješno promijenjena u ${newLevel}.` });
  });

  // GET admin listings for registrations
  app.get("/api/matura/registrations-admin", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const db = readDb();
    const { schoolId, status } = req.query;

    let regs = db.exam_registrations;
    if (status) {
      regs = regs.filter((r: any) => r.registration_status === status);
    }

    const enriched = regs.map((r: any) => {
      const sess = db.exam_sessions.find((s: any) => s.id === r.exam_session_id);
      const subject = CENTRAL_MATURA_CATALOG.find(s => s.id === r.subject_id);
      const period = sess ? db.exam_periods.find((p: any) => p.id === sess.exam_period_id) : null;
      
      let extStudent = ematicaDb.students.find(s => s.id === r.student_id);
      if (!extStudent && r.student_id === 'stud-ivan') {
        extStudent = ematicaDb.students.find(s => s.id === 'ext-ivan');
      }

      return {
        ...r,
        studentName: extStudent ? `${extStudent.firstName} ${extStudent.lastName}` : 'Nepoznati učenik',
        studentOib: extStudent ? extStudent.oib : '',
        schoolId: extStudent ? extStudent.schoolId : '',
        subjectName: subject ? subject.officialName : 'Nepoznati predmet',
        examDate: sess ? sess.exam_date : '',
        startTime: sess ? sess.start_time : '',
        periodName: period ? period.name : '',
        lateWithdrawalAllowed: period ? (new Date() < new Date(period.late_withdrawal_deadline)) : false
      };
    });

    if (schoolId) {
      res.json(enriched.filter((e: any) => e.schoolId === schoolId));
    } else {
      res.json(enriched);
    }
  });

  // Late Withdrawal by School Admin
  app.post("/api/matura/late-withdraw", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'SECONDARY_ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'SECONDARY_HOMEROOM_TEACHER') {
      return res.status(403).json({ error: "Samo ispitni koordinatori škola ili administratori mogu vršiti naknadnu odjavu ispita." });
    }

    const { registrationId, reasonCode, reasonText } = req.body;
    if (!registrationId || !reasonCode) {
      return res.status(400).json({ error: "Nedostaje ID prijave ili opravdani razlog odjave." });
    }

    const db = readDb();
    const reg = db.exam_registrations.find((r: any) => r.id === registrationId);
    if (!reg) {
      return res.status(404).json({ error: "Prijava ispita nije pronađena." });
    }

    const sess = db.exam_sessions.find((s: any) => s.id === reg.exam_session_id);
    const period = sess ? db.exam_periods.find((p: any) => p.id === sess.exam_period_id) : null;

    if (!period) {
      return res.status(404).json({ error: "Ispitni rok za ovu prijavu nije pronađen." });
    }

    if (new Date() > new Date(period.late_withdrawal_deadline)) {
      return res.status(400).json({ error: "Rok za naknadnu odjavu ispita kod ispitnog povjerenstva je istekao." });
    }

    reg.previous_registration_status = reg.registration_status;
    reg.registration_status = 'WITHDRAWN_LATE';
    reg.withdrawn_at = new Date().toISOString();
    reg.withdrawn_by = user.id;
    reg.withdrawn_by_role = user.role;
    reg.withdrawal_type = 'LATE_WITHDRAWAL';
    reg.withdrawal_reason_code = reasonCode;
    reg.withdrawal_reason_text = reasonText || '';
    reg.updated_at = new Date().toISOString();

    writeDb(db);
    res.json({ success: true, message: "Ispit je uspješno naknadno odjavljen uz opravdani razlog." });
  });

  // GET results for a student (filtered to published/final results)
  app.get("/api/matura/results", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const { studentId } = req.query;
    const filterId = studentId ? String(studentId) : 'stud-ivan';
    const db = readDb();
    
    // Find registrations for this student
    const regs = db.exam_registrations.filter((r: any) => r.student_id === filterId);
    const regIds = regs.map((r: any) => r.id);
    
    // Find results for these registrations that are PUBLISHED or FINAL
    const results = db.exam_results.filter((r: any) => 
      regIds.includes(r.exam_registration_id) && 
      (r.result_status === 'PUBLISHED' || r.result_status === 'FINAL')
    );
    
    const enriched = results.map((r: any) => {
      const reg = regs.find((rg: any) => rg.id === r.exam_registration_id);
      const sess = reg ? db.exam_sessions.find((s: any) => s.id === reg.exam_session_id) : null;
      const subject = reg ? CENTRAL_MATURA_CATALOG.find(s => s.id === reg.subject_id) : null;
      
      return {
        id: r.id,
        examRegistrationId: r.exam_registration_id,
        studentId: r.studentId,
        pointsEarned: r.points_earned,
        maximumPoints: r.maximum_points,
        scorePercentage: r.percentage,
        grade: r.grade,
        outcome: r.outcome,
        attendanceStatus: r.attendance_status,
        resultStatus: r.result_status,
        subject,
        level: reg ? reg.level : '',
        date: sess ? sess.exam_date : ''
      };
    });
    
    res.json(enriched);
  });

  // GET results listing for admin
  app.get("/api/matura/results-admin", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const db = readDb();
    const enriched = db.exam_results.map((r: any) => {
      const reg = db.exam_registrations.find((rg: any) => rg.id === r.exam_registration_id);
      const sess = reg ? db.exam_sessions.find((s: any) => s.id === reg.exam_session_id) : null;
      const subject = reg ? CENTRAL_MATURA_CATALOG.find(s => s.id === reg.subject_id) : null;
      
      let extStudent = reg ? ematicaDb.students.find(s => s.id === reg.student_id) : null;
      if (!extStudent && reg?.student_id === 'stud-ivan') {
        extStudent = ematicaDb.students.find(s => s.id === 'ext-ivan');
      }

      return {
        ...r,
        studentName: extStudent ? `${extStudent.firstName} ${extStudent.lastName}` : 'Nepoznati učenik',
        studentOib: extStudent ? extStudent.oib : '',
        subjectName: subject ? subject.officialName : 'Nepoznati predmet',
        level: reg ? reg.level : '',
        examDate: sess ? sess.exam_date : ''
      };
    });

    res.json(enriched);
  });

  // Enter/Update Exam Result
  app.post("/api/matura/results", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: "Samo glavni administrator sustava može unositi i mijenjati rezultate." });
    }

    const { exam_registration_id, points_earned, attendance_status, note } = req.body;
    if (!exam_registration_id) {
      return res.status(400).json({ error: "Nedostaje ID prijave ispita." });
    }

    const db = readDb();
    const reg = db.exam_registrations.find((r: any) => r.id === exam_registration_id);
    if (!reg) {
      return res.status(404).json({ error: "Prijava ispita nije pronađena." });
    }

    const sess = db.exam_sessions.find((s: any) => s.id === reg.exam_session_id);
    if (!sess) {
      return res.status(404).json({ error: "Ispitna sesija nije pronađena." });
    }

    const maxPoints = sess.maximum_points;
    const pts = points_earned !== undefined ? Number(points_earned) : 0;

    if (attendance_status === 'PRESENT' && (pts < 0 || pts > maxPoints)) {
      return res.status(400).json({ error: `Osvojeni bodovi moraju biti između 0 i maksimalno ${maxPoints} bodova.` });
    }

    const percentage = attendance_status === 'PRESENT' ? Number(((pts / maxPoints) * 100).toFixed(2)) : 0;
    
    let grade = 1;
    let outcome = 'PAO';
    
    if (attendance_status === 'PRESENT') {
      const threshold = sess.passing_threshold;
      if (percentage >= threshold) {
        outcome = 'POLOŽIO';
        const range = 100 - threshold;
        const step = range / 4;
        if (percentage >= threshold + step * 3) {
          grade = 5;
        } else if (percentage >= threshold + step * 2) {
          grade = 4;
        } else if (percentage >= threshold + step) {
          grade = 3;
        } else {
          grade = 2;
        }
      } else {
        grade = 1;
        outcome = 'PAO';
      }
    } else {
      outcome = attendance_status || 'NEPRISTUPIO';
      grade = 0;
    }

    let existingResult = db.exam_results.find((r: any) => r.exam_registration_id === exam_registration_id);
    const isNew = !existingResult;

    if (existingResult) {
      const historyLog = {
        id: `h-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        exam_result_id: existingResult.id,
        previous_value: JSON.stringify({
          points_earned: existingResult.points_earned,
          percentage: existingResult.percentage,
          grade: existingResult.grade,
          outcome: existingResult.outcome,
          attendance_status: existingResult.attendance_status
        }),
        new_value: JSON.stringify({
          points_earned: pts,
          percentage,
          grade,
          outcome,
          attendance_status
        }),
        reason: note || 'Ispravak administratora',
        changed_by: user.id,
        changed_at: new Date().toISOString()
      };
      db.exam_result_history.push(historyLog);

      existingResult.points_earned = pts;
      existingResult.maximum_points = maxPoints;
      existingResult.percentage = percentage;
      existingResult.grade = grade;
      existingResult.outcome = outcome;
      existingResult.attendance_status = attendance_status || 'PRESENT';
      existingResult.note = note || '';
      existingResult.updated_at = new Date().toISOString();
      existingResult.scorePercentage = percentage;
      existingResult.pointsEarned = pts;
    } else {
      existingResult = {
        id: `res-${Date.now()}`,
        exam_registration_id,
        studentId: reg.student_id,
        examPeriodId: sess.exam_period_id,
        points_earned: pts,
        maximum_points: maxPoints,
        percentage,
        grade,
        outcome,
        attendance_status: attendance_status || 'PRESENT',
        result_status: 'DRAFT',
        entered_by: user.id,
        entered_at: new Date().toISOString(),
        published_at: null,
        finalized_at: null,
        note: note || '',
        updated_at: new Date().toISOString(),
        scorePercentage: percentage,
        pointsEarned: pts
      };
      db.exam_results.push(existingResult);
    }

    writeDb(db);
    res.json({ success: true, result: existingResult, isNew });
  });

  // Bulk publish results
  app.post("/api/matura/results-publish", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: "Samo glavni administrator može objavljivati rezultate." });
    }

    const { status, periodId } = req.body;
    if (!status || !periodId) {
      return res.status(400).json({ error: "Nedostaju status i ID ispitnog roka." });
    }

    const db = readDb();
    let count = 0;

    db.exam_results.forEach((r: any) => {
      const reg = db.exam_registrations.find((rg: any) => rg.id === r.exam_registration_id);
      const sess = reg ? db.exam_sessions.find((s: any) => s.id === reg.exam_session_id) : null;
      if (sess && sess.exam_period_id === periodId) {
        r.result_status = status;
        if (status === 'PUBLISHED') {
          r.published_at = new Date().toISOString();
        } else if (status === 'FINAL') {
          r.finalized_at = new Date().toISOString();
        }
        r.updated_at = new Date().toISOString();
        count++;
      }
    });

    writeDb(db);
    res.json({ success: true, count, message: `Uspješno promijenjen status rezultata u ${status} za ${count} ispita.` });
  });

  // Get edit history of a result
  app.get("/api/matura/results-history/:resultId", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const db = readDb();
    const history = db.exam_result_history.filter((h: any) => h.exam_result_id === req.params.resultId);
    res.json(history);
  });

  // GET accommodations requests list
  app.get("/api/matura/accommodations", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const db = readDb();
    const user = (req as any).user;

    let requests = db.accommodation_requests;

    if (user.role === 'SECONDARY_ADMIN' || user.role === 'SECONDARY_HOMEROOM_TEACHER') {
      let adminSchoolId = 'ext-sch-4';
      const extStudent = ematicaDb.students.find(s => s.email === user.email);
      if (extStudent) {
        adminSchoolId = extStudent.schoolId;
      }
      requests = requests.filter((r: any) => r.school_id === adminSchoolId);
    } else if (user.role === 'SECONDARY_STUDENT') {
      requests = requests.filter((r: any) => r.student_id === user.id);
    }

    const enriched = requests.map((r: any) => {
      let extStudent = ematicaDb.students.find(s => s.id === r.student_id);
      if (!extStudent && r.student_id === 'stud-ivan') {
        extStudent = ematicaDb.students.find(s => s.id === 'ext-ivan');
      }

      const docs = db.accommodation_documents.filter((d: any) => d.request_id === r.id);
      const decisions = db.accommodation_decisions.filter((d: any) => d.request_id === r.id);
      const deliveries = db.accommodation_deliveries.filter((d: any) => d.request_id === r.id);

      return {
        ...r,
        studentName: extStudent ? `${extStudent.firstName} ${extStudent.lastName}` : 'Nepoznati učenik',
        studentOib: extStudent ? extStudent.oib : '',
        classSection: extStudent ? '4.A' : '',
        documents: docs,
        decisions,
        deliveries
      };
    });

    res.json(enriched);
  });

  // POST student creates request
  app.post("/api/matura/accommodations/request", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const user = (req as any).user;
    const { student_id, description_requested, requested_measures } = req.body;

    const targetStudentId = student_id || user.id;

    let schoolId = 'ext-sch-4';
    let extStudent = ematicaDb.students.find(s => s.id === targetStudentId);
    if (!extStudent && targetStudentId === 'stud-ivan') {
      extStudent = ematicaDb.students.find(s => s.id === 'ext-ivan');
    }
    if (extStudent) {
      schoolId = extStudent.schoolId;
    }

    const db = readDb();
    let existing = db.accommodation_requests.find((r: any) => r.student_id === targetStudentId && r.status !== 'REJECTED');

    if (existing) {
      if (['SUBMITTED', 'APPROVED', 'DELIVERED'].includes(existing.status)) {
        return res.status(400).json({ error: "Zahtjev je već predan ili odobren i ne može se mijenjati bez revizije." });
      }
      existing.description_requested = description_requested;
      existing.requested_measures = requested_measures || [];
      existing.updated_at = new Date().toISOString();
    } else {
      existing = {
        id: `acc-${Date.now()}`,
        student_id: targetStudentId,
        school_id: schoolId,
        status: 'DRAFT',
        description_requested,
        requested_measures: requested_measures || [],
        notes: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.accommodation_requests.push(existing);
    }

    writeDb(db);
    res.json({ success: true, request: existing });
  });

  // POST upload document for request
  app.post("/api/matura/accommodations/upload", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const user = (req as any).user;
    const { requestId, name, size } = req.body;

    if (!requestId || !name) {
      return res.status(400).json({ error: "Nedostaju ID zahtjeva ili naziv datoteke." });
    }

    const db = readDb();
    const reqObj = db.accommodation_requests.find((r: any) => r.id === requestId);
    if (!reqObj) {
      return res.status(404).json({ error: "Zahtjev nije pronađen." });
    }

    const newDoc = {
      id: `doc-${Date.now()}`,
      request_id: requestId,
      file_name: name,
      file_path: `/private/documents/${requestId}/${name}`,
      uploaded_by: user.id,
      uploaded_at: new Date().toISOString(),
      file_size: size || '1.5 MB'
    };

    db.accommodation_documents.push(newDoc);
    writeDb(db);

    res.json({ success: true, document: newDoc });
  });

  // POST submit request
  app.post("/api/matura/accommodations/submit", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'SECONDARY_ADMIN' && user.role !== 'SECONDARY_HOMEROOM_TEACHER' && user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: "Samo ispitni koordinator škole može poslati zahtjev na obradu." });
    }

    const { requestId, notes } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: "Nedostaje ID zahtjeva." });
    }

    const db = readDb();
    const reqObj = db.accommodation_requests.find((r: any) => r.id === requestId);
    if (!reqObj) {
      return res.status(404).json({ error: "Zahtjev nije pronađen." });
    }

    const docs = db.accommodation_documents.filter((d: any) => d.request_id === requestId);
    if (docs.length === 0) {
      return res.status(400).json({ error: "Zahtjev se ne može poslati bez priložene medicinske ili službene dokumentacije." });
    }

    reqObj.status = 'SUBMITTED';
    reqObj.notes = notes || reqObj.notes || '';
    reqObj.updated_at = new Date().toISOString();

    const history = {
      id: `acch-${Date.now()}`,
      request_id: requestId,
      action: 'SUBMITTED_TO_COMMISSION',
      performed_by: user.id,
      notes: notes || 'Poslano od strane ispitnog koordinatora škole.',
      timestamp: new Date().toISOString()
    };
    db.accommodation_history.push(history);

    writeDb(db);
    res.json({ success: true, request: reqObj });
  });

  // POST super admin decision
  app.post("/api/matura/accommodations/decision", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: "Samo kupolično nacionalno povjerenstvo može donijeti odluku o prilagodbi." });
    }

    const { requestId, decisionStatus, approvedMeasures, officialComment, examSubjectIds } = req.body;
    if (!requestId || !decisionStatus) {
      return res.status(400).json({ error: "Nedostaju ID zahtjeva ili status odluke." });
    }

    const db = readDb();
    const reqObj = db.accommodation_requests.find((r: any) => r.id === requestId);
    if (!reqObj) {
      return res.status(404).json({ error: "Zahtjev nije pronađen." });
    }

    reqObj.status = decisionStatus;
    reqObj.updated_at = new Date().toISOString();

    const decision = {
      id: `dec-${Date.now()}`,
      request_id: requestId,
      decision_status: decisionStatus,
      approved_measures: approvedMeasures || [],
      official_comment: officialComment || '',
      decided_by: user.id,
      decided_at: new Date().toISOString()
    };
    db.accommodation_decisions.push(decision);

    if (decisionStatus === 'APPROVED' && approvedMeasures && examSubjectIds) {
      examSubjectIds.forEach((subjId: string) => {
        approvedMeasures.forEach((measureCode: string) => {
          db.accommodation_measure_exams.push({
            id: `me-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            request_id: requestId,
            subject_id: subjId,
            measure_code: measureCode,
            created_at: new Date().toISOString()
          });
        });
      });
    }

    const history = {
      id: `acch-${Date.now()}`,
      request_id: requestId,
      action: decisionStatus === 'APPROVED' ? 'APPROVED' : 'REJECTED',
      performed_by: user.id,
      notes: officialComment || 'Donesena službena odluka o prilagodbi ispitne tehnologije.',
      timestamp: new Date().toISOString()
    };
    db.accommodation_history.push(history);

    writeDb(db);
    res.json({ success: true, request: reqObj, decision });
  });

  // POST deliver decision to student
  app.post("/api/matura/accommodations/deliver", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'SECONDARY_ADMIN' && user.role !== 'SECONDARY_HOMEROOM_TEACHER' && user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: "Samo ispitni koordinator škole može potvrditi uručenje rješenja." });
    }

    const { requestId, deliveryMethod } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: "Nedostaje ID zahtjeva." });
    }

    const db = readDb();
    const reqObj = db.accommodation_requests.find((r: any) => r.id === requestId);
    if (!reqObj) {
      return res.status(404).json({ error: "Zahtjev nije pronađen." });
    }

    reqObj.status = 'DELIVERED';
    reqObj.updated_at = new Date().toISOString();

    const delivery = {
      id: `del-${Date.now()}`,
      request_id: requestId,
      delivered_by: user.id,
      delivered_at: new Date().toISOString(),
      delivery_method: deliveryMethod || 'IN_PERSON',
      student_notified: true
    };
    db.accommodation_deliveries.push(delivery);

    const history = {
      id: `acch-${Date.now()}`,
      request_id: requestId,
      action: 'DELIVERED_TO_STUDENT',
      performed_by: user.id,
      notes: `Službeno rješenje o prilagodbi uručeno učeniku (Metoda: ${deliveryMethod || 'Osobno'}).`,
      timestamp: new Date().toISOString()
    };
    db.accommodation_history.push(history);

    writeDb(db);
    res.json({ success: true, request: reqObj, delivery });
  });

  // GET history logs for accommodation
  app.get("/api/matura/accommodations/history/:id", requireSession(['FACULTY_ADMISSIONS']), (req, res) => {
    const db = readDb();
    const history = db.accommodation_history.filter((h: any) => h.request_id === req.params.id);
    res.json(history);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
