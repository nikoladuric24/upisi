/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  User,
  County,
  City,
  School,
  SchoolProgram,
  University,
  Faculty,
  StudyProgram,
  ExamSubject,
  ExamPeriod,
  AppDeadline,
  Student,
  SchoolApplication,
  SchoolApplicationChoice,
  UniversityApplication,
  UniversityApplicationChoice,
  ExamRegistration,
  ExamResult,
  AppDocument,
  AppNotification,
  AuditLog,
  SchoolYear,
  PrimaryPointsConfig
} from '../types';

import {
  COUNTIES,
  CITIES,
  SCHOOLS,
  SCHOOL_PROGRAMS,
  UNIVERSITIES,
  FACULTIES,
  EXAM_SUBJECTS,
  EXAM_PERIODS,
  STUDY_PROGRAMS,
  DEADLINES,
  INITIAL_USERS
} from '../data/mockData';

// Initialize Database in LocalStorage
function getStored<T>(key: string, defaultValue: T): T {
  const data = localStorage.getItem(`eduportal_${key}`);
  if (!data) {
    localStorage.setItem(`eduportal_${key}`, JSON.stringify(defaultValue));
    return defaultValue;
  }
  return JSON.parse(data);
}

function setStored<T>(key: string, value: T): void {
  localStorage.setItem(`eduportal_${key}`, JSON.stringify(value));
}

// Ensure database keys exist
export function initDatabase() {
  // Safe migration to wipe mock exam data
  const existingRegs = localStorage.getItem('eduportal_exam_registrations');
  if (existingRegs && (existingRegs.includes('reg-1') || existingRegs.includes('stud-ivan'))) {
    localStorage.removeItem('eduportal_exam_registrations');
  }
  const existingResults = localStorage.getItem('eduportal_exam_results');
  if (existingResults && (existingResults.includes('res-1') || existingResults.includes('stud-ivan'))) {
    localStorage.removeItem('eduportal_exam_results');
  }
  const existingPeriods = localStorage.getItem('eduportal_exam_periods');
  if (existingPeriods && existingPeriods.includes('ep-1')) {
    localStorage.removeItem('eduportal_exam_periods');
  }

  getStored<User[]>('users', INITIAL_USERS);
  getStored<County[]>('counties', COUNTIES);
  getStored<City[]>('cities', CITIES);
  getStored<School[]>('schools', SCHOOLS);
  getStored<SchoolProgram[]>('school_programs', SCHOOL_PROGRAMS);
  getStored<University[]>('universities', UNIVERSITIES);
  getStored<Faculty[]>('faculties', FACULTIES);
  getStored<StudyProgram[]>('study_programs', STUDY_PROGRAMS);
  getStored<ExamSubject[]>('exam_subjects', EXAM_SUBJECTS);
  getStored<ExamPeriod[]>('exam_periods', EXAM_PERIODS);
  getStored<AppDeadline[]>('deadlines', DEADLINES);

  // Seed school years and formula configurations
  const defaultSchoolYears: SchoolYear[] = [
    { id: 'sy-2026', year: '2026./2027.', isCurrent: true },
    { id: 'sy-2025', year: '2025./2026.', isCurrent: false },
    { id: 'sy-2027', year: '2027./2028.', isCurrent: false }
  ];
  getStored<SchoolYear[]>('school_years', defaultSchoolYears);

  const defaultPointsConfigs: PrimaryPointsConfig[] = [
    { id: 'cfg-default', gradeAverageWeight: 4, competitionsWeight: 1, additionalWeight: 1, maxPoints: 80 }
  ];
  getStored<PrimaryPointsConfig[]>('primary_points_configs', defaultPointsConfigs);
  
  // Seed Students (Luka Marić and Ivan Jurić)
  const defaultStudents: Student[] = [
    {
      id: 'stud-luka',
      userId: 'usr-prim-stud',
      classId: 'cls-8a',
      schoolId: 'sch-1',
      oib: '12345678901',
      dateOfBirth: '2011-04-12',
      gradeAverage5: 4.85,
      gradeAverage6: 4.90,
      gradeAverage7: 4.92,
      gradeAverage8: 5.00,
      competitionsPoints: 2.0,
      additionalPoints: 1.0,
      socialPointsReason: 'Sportska postignuća (državno natjecanje)',
      healthConditions: 'Nema',
      specialConditions: false
    },
    {
      id: 'stud-ivan',
      userId: 'usr-sec-stud',
      classId: 'cls-4a',
      schoolId: 'sch-4', // Attends MIOC
      oib: '98765432109',
      dateOfBirth: '2007-09-25',
      gradeAverage5: 4.60, // Srednjoškolski prosjeci (1. razred)
      gradeAverage6: 4.80, // (2. razred)
      gradeAverage7: 4.75, // (3. razred)
      gradeAverage8: 4.90, // (4. razred)
      competitionsPoints: 0,
      additionalPoints: 0,
      specialConditions: false
    }
  ];
  getStored<Student[]>('students', defaultStudents);

  // Seed School Application for primary student
  const defaultSchoolApps: SchoolApplication[] = [
    { id: 'app-luka', studentId: 'stud-luka', status: 'SUBMITTED', submittedAt: '2026-06-20T10:00:00Z' }
  ];
  getStored<SchoolApplication[]>('school_applications', defaultSchoolApps);

  const defaultSchoolChoices: SchoolApplicationChoice[] = [
    { id: 'choice-1', applicationId: 'app-luka', programId: 'prog-1', priority: 1, pointsCalculated: 81.67, estimatedStatus: 'UPADA' }, // MIOC PMG
    { id: 'choice-2', applicationId: 'app-luka', programId: 'prog-3', priority: 2, pointsCalculated: 81.67, estimatedStatus: 'UPADA' }, // Split PMG
    { id: 'choice-3', applicationId: 'app-luka', programId: 'prog-6', priority: 3, pointsCalculated: 81.67, estimatedStatus: 'UPADA' }  // Ruđer Računalstvo
  ];
  getStored<SchoolApplicationChoice[]>('school_application_choices', defaultSchoolChoices);

  // Seed University Application for secondary student
  const defaultUnivApps: UniversityApplication[] = [
    { id: 'app-ivan', studentId: 'stud-ivan', status: 'SUBMITTED', submittedAt: '2026-06-22T14:30:00Z' }
  ];
  getStored<UniversityApplication[]>('university_applications', defaultUnivApps);

  const defaultUnivChoices: UniversityApplicationChoice[] = [
    { id: 'uchoice-1', applicationId: 'app-ivan', studyProgramId: 'stud-1', priority: 1, pointsCalculated: 842.5, estimatedStatus: 'UPADA' }, // FER Računarstvo
    { id: 'uchoice-2', applicationId: 'app-ivan', studyProgramId: 'stud-5', priority: 2, pointsCalculated: 830.0, estimatedStatus: 'UPADA' }  // Split Računarstvo
  ];
  getStored<UniversityApplicationChoice[]>('university_application_choices', defaultUnivChoices);

  // Seed Exam Registrations
  getStored<ExamRegistration[]>('exam_registrations', []);

  // Seed Exam Results
  getStored<ExamResult[]>('exam_results', []);

  // Seed Documents
  const defaultDocs: AppDocument[] = [
    {
      id: 'doc-1',
      userId: 'usr-prim-stud',
      name: 'Svjedodžba_8_razred.pdf',
      fileType: 'application/pdf',
      fileSize: '1.4 MB',
      purpose: 'OCJENE',
      status: 'VERIFIED',
      fileUrl: '#',
      createdAt: '2026-06-20T09:45:00Z',
      verifiedBy: 'Marko Horvat'
    },
    {
      id: 'doc-2',
      userId: 'usr-prim-stud',
      name: 'Potvrda_Zupanijsko_Natjecanje.pdf',
      fileType: 'application/pdf',
      fileSize: '840 KB',
      purpose: 'DODATNI_BODOVI',
      status: 'PENDING',
      fileUrl: '#',
      createdAt: '2026-06-20T09:50:00Z'
    }
  ];
  getStored<AppDocument[]>('documents', defaultDocs);

  // Seed Notifications
  const defaultNotifications: AppNotification[] = [
    { id: 'not-1', userId: 'usr-prim-stud', title: 'Verifikacija započeta', message: 'Vaša prijava je uspješno podnesena i poslana razredniku na pregled.', isRead: false, type: 'INFO', createdAt: '2026-06-20T10:05:00Z' },
    { id: 'not-2', userId: 'usr-sec-stud', title: 'Rezultati mature objavljeni', message: 'Privremeni rezultati ispita državne mature su učitani u sustav. Imate pravo prigovora u roku 48h.', isRead: false, type: 'RESULT', createdAt: '2026-07-02T12:00:00Z' }
  ];
  getStored<AppNotification[]>('notifications', defaultNotifications);

  // Seed Audit Logs
  const defaultAuditLogs: AuditLog[] = [
    { id: 'log-1', userId: 'usr-admin', userEmail: 'nikoladuric025@gmail.com', action: 'INICIJALIZACIJA', details: 'Sustav EduPortal Hrvatska uspješno pokrenut.', ipAddress: '127.0.0.1', createdAt: '2026-07-11T08:59:00Z' }
  ];
  getStored<AuditLog[]>('audit_logs', defaultAuditLogs);
}

// Current Logged-in User Management
export function getCurrentUser(): User | null {
  const user = localStorage.getItem('eduportal_current_user');
  if (!user) {
    return null;
  }
  return JSON.parse(user);
}

export function setCurrentUser(user: User | null): void {
  if (user) {
    localStorage.setItem('eduportal_current_user', JSON.stringify(user));
    logAuditEvent(user.id, user.email, 'PRIJAVA', `Uspješna prijava u sustav kao ${user.role}`);
  } else {
    localStorage.removeItem('eduportal_current_user');
  }
}

// Generic Table accessors
export function getTable<T>(tableName: string): T[] {
  return JSON.parse(localStorage.getItem(`eduportal_${tableName}`) || '[]');
}

export function saveTable<T>(tableName: string, data: T[]): void {
  localStorage.setItem(`eduportal_${tableName}`, JSON.stringify(data));
}

// Audit Logging
export function logAuditEvent(userId: string, email: string, action: string, details: string, oldValue?: string, newValue?: string) {
  const logs = getTable<AuditLog>('audit_logs');
  const newLog: AuditLog = {
    id: `log-${Date.now()}`,
    userId,
    userEmail: email,
    action,
    details,
    ipAddress: '193.198.0.1', // Croatian Academic IP placeholder
    createdAt: new Date().toISOString(),
    oldValue,
    newValue
  };
  logs.unshift(newLog);
  saveTable<AuditLog>('audit_logs', logs);
}

// Notifications
export function addNotification(userId: string, title: string, message: string, type: 'ALERT' | 'REMINDER' | 'INFO' | 'RESULT') {
  const notifications = getTable<AppNotification>('notifications');
  const newNotification: AppNotification = {
    id: `not-${Date.now()}`,
    userId,
    title,
    message,
    isRead: false,
    type,
    createdAt: new Date().toISOString()
  };
  notifications.unshift(newNotification);
  saveTable<AppNotification>('notifications', notifications);
}

// Points Calculation Logic for primary student school choices
export function calculatePrimarySchoolPoints(student: Student, program: SchoolProgram): number {
  const configs = getTable<PrimaryPointsConfig>('primary_points_configs');
  const config = configs[0] || { id: 'cfg-default', gradeAverageWeight: 4, competitionsWeight: 1, additionalWeight: 1, maxPoints: 80 };

  const averagesSum = student.gradeAverage5 + student.gradeAverage6 + student.gradeAverage7 + student.gradeAverage8;
  const basePoints = averagesSum * config.gradeAverageWeight;
  const compPoints = student.competitionsPoints * config.competitionsWeight;
  const addPoints = student.additionalPoints * config.additionalWeight;

  return parseFloat((basePoints + compPoints + addPoints).toFixed(2));
}

// Drag & Drop / Choice Ordering (Srednje Škole)
export function updateSchoolChoicesOrder(applicationId: string, choices: SchoolApplicationChoice[]): void {
  const allChoices = getTable<SchoolApplicationChoice>('school_application_choices');
  
  // Filter out other choices, then combine with sorted current choices
  const otherChoices = allChoices.filter(c => c.applicationId !== applicationId);
  const updated = [...otherChoices, ...choices.map((c, i) => ({ ...c, priority: i + 1 }))];
  
  saveTable<SchoolApplicationChoice>('school_application_choices', updated);
}

// Drag & Drop / Choice Ordering (Visoka učilišta)
export function updateUniversityChoicesOrder(applicationId: string, choices: UniversityApplicationChoice[]): void {
  const allChoices = getTable<UniversityApplicationChoice>('university_application_choices');
  
  const otherChoices = allChoices.filter(c => c.applicationId !== applicationId);
  const updated = [...otherChoices, ...choices.map((c, i) => ({ ...c, priority: i + 1 }))];
  
  saveTable<UniversityApplicationChoice>('university_application_choices', updated);
}

// State Matura points calculator (Visoka učilišta)
export function calculateUniversityPoints(student: Student, studyProgram: StudyProgram, examResults: ExamResult[], examPeriods: ExamPeriod[]): number {
  // Standard calculations: 40% from school grades, and percentages from required exams
  // Let's say Ivan Jurić school average is (4.6 + 4.8 + 4.75 + 4.9) / 4 = 4.76
  const schoolAvg = (student.gradeAverage5 + student.gradeAverage6 + student.gradeAverage7 + student.gradeAverage8) / 4;
  const schoolBasePoints = (schoolAvg / 5.0) * 400; // max 400 points from school
  
  let examPoints = 0;
  for (const requirement of studyProgram.requiresMaturaMandatory) {
    // Find Ivan's result for this subject
    const result = examResults.find(r => {
      const ep = examPeriods.find(p => p.id === r.examPeriodId);
      return ep && ep.subjectId === requirement.subjectId;
    });

    if (result) {
      // If we meet or exceed the required level, calculate points
      examPoints += (result.scorePercentage / 100) * (requirement.weightPercentage * 10); // weight out of 1000 points
    }
  }

  return parseFloat((schoolBasePoints + examPoints).toFixed(1));
}
