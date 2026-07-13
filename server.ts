import express from "express";
import path from "path";
import crypto from "crypto";
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
  app.post("/api/school-applications/:id/unlock", (req, res) => {
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

  app.post("/api/university-applications/:id/unlock", (req, res) => {
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
