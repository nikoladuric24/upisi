/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Student,
  SchoolApplication,
  SchoolApplicationChoice,
  UniversityApplication,
  UniversityApplicationChoice,
  ExamRegistration,
  ExamResult,
  ExamPeriod,
  AppDocument,
  SchoolProgram,
  StudyProgram,
  AuditLog,
  AppDeadline,
  AppNotification
} from '../types';

import {
  getTable,
  saveTable,
  logAuditEvent,
  addNotification,
  calculatePrimarySchoolPoints,
  calculateUniversityPoints
} from './storage';

// State transition types
export type SchoolAppStatus = 'U IZRADI' | 'SPREMLJENA' | 'ZAKLJUČANA' | 'POTVRĐENA' | 'OBRAĐENA' | 'UPISAN' | 'ODBIJEN';
export type ExamRegStatus = 'NIJE PRIJAVLJEN' | 'PRIJAVLJEN' | 'POTVRĐEN' | 'ZAKLJUČAN' | 'ODRŽAN' | 'REZULTATI OBJAVLJENI' | 'KONAČNI REZULTATI';
export type UniversityAppStatus = 'U IZRADI' | 'SPREMLJENA' | 'ZAKLJUČANA' | 'PREGLEDANA' | 'OBRAĐENA' | 'PRIHVAĆEN' | 'ODBIJEN' | 'UPISAN';
export type DocStatus = 'PRENESEN' | 'ZAPRIMLJEN' | 'U OBRADI' | 'ODOBREN' | 'ODBIJEN' | 'ARHIVIRAN';

/**
 * Extensible Rule engine validator.
 * Rules are declared function arrays which must pass (return true or error string) to let transitions happen.
 */
interface TransitionCheckResult {
  allowed: boolean;
  reason?: string;
}

// -------------------------------------------------------------
// 1. UPIS U SREDNJU ŠKOLU WORKFLOW ENGINE
// -------------------------------------------------------------

export const SchoolAppWorkflow = {
  getTransitions(): Record<SchoolAppStatus, SchoolAppStatus[]> {
    return {
      'U IZRADI': ['SPREMLJENA', 'ZAKLJUČANA'],
      'SPREMLJENA': ['U IZRADI', 'ZAKLJUČANA'],
      'ZAKLJUČANA': ['U IZRADI', 'POTVRĐENA'],
      'POTVRĐENA': ['ZAKLJUČANA', 'OBRAĐENA'],
      'OBRAĐENA': ['UPISAN', 'ODBIJEN'],
      'UPISAN': [],
      'ODBIJEN': []
    };
  },

  canTransition(current: SchoolAppStatus, next: SchoolAppStatus, context: {
    choicesCount: number;
    hasPendingDocs: boolean;
    hasGradesVerified: boolean;
    deadlinePassed: boolean;
  }): TransitionCheckResult {
    const allowedTargets = this.getTransitions()[current];
    if (!allowedTargets.includes(next)) {
      return { allowed: false, reason: `Direktni prijelaz sa statusa ${current} na ${next} nije moguć prema državnim pravilima.` };
    }

    // Validation rules checks
    if (next === 'ZAKLJUČANA') {
      if (context.choicesCount === 0) {
        return { allowed: false, reason: 'Nije moguće zaključati praznu listu želja. Molimo odaberite barem jedan srednjoškolski program.' };
      }
      if (context.deadlinePassed) {
        return { allowed: false, reason: 'Rok za zaključavanje prijava je istekao. Promjene više nisu dopuštene.' };
      }
    }

    if (next === 'POTVRĐENA') {
      if (context.hasPendingDocs) {
        return { allowed: false, reason: 'Svi priloženi dokumenti i zahtjevi za dodatne bodove moraju biti odobreni ili odbijeni prije potvrde prijave.' };
      }
      if (!context.hasGradesVerified) {
        return { allowed: false, reason: 'Homeroom razrednik mora verificirati i zaključati završne ocjene u bazi prije potvrde prijave.' };
      }
    }

    return { allowed: true };
  }
};

// -------------------------------------------------------------
// 2. DRŽAVNA MATURA EXAM STATUS WORKFLOW ENGINE
// -------------------------------------------------------------

export const ExamWorkflow = {
  getTransitions(): Record<ExamRegStatus, ExamRegStatus[]> {
    return {
      'NIJE PRIJAVLJEN': ['PRIJAVLJEN'],
      'PRIJAVLJEN': ['NIJE PRIJAVLJEN', 'POTVRĐEN'],
      'POTVRĐEN': ['PRIJAVLJEN', 'ZAKLJUČAN'],
      'ZAKLJUČAN': ['ODRŽAN'],
      'ODRŽAN': ['REZULTATI OBJAVLJENI'],
      'REZULTATI OBJAVLJENI': ['KONAČNI REZULTATI'],
      'KONAČNI REZULTATI': []
    };
  },

  canTransition(current: ExamRegStatus, next: ExamRegStatus, context: {
    deadlinePassed: boolean;
    hasValidGrades: boolean;
  }): TransitionCheckResult {
    const allowedTargets = this.getTransitions()[current];
    if (!allowedTargets.includes(next)) {
      return { allowed: false, reason: `Nevažeći korak statusa ispita: ${current} -> ${next}` };
    }

    if (next === 'PRIJAVLJEN' && context.deadlinePassed) {
      return { allowed: false, reason: 'Rok za prijavu ispita državne mature je istekao.' };
    }

    if (next === 'ZAKLJUČAN' && !context.hasValidGrades) {
      return { allowed: false, reason: 'Kandidat mora imati sve zaključene ocjene srednje škole prije zaključavanja ispita mature.' };
    }

    return { allowed: true };
  }
};

// -------------------------------------------------------------
// 3. UPIS NA FAKULTETE (POSTANI STUDENT) WORKFLOW ENGINE
// -------------------------------------------------------------

export const UniversityAppWorkflow = {
  getTransitions(): Record<UniversityAppStatus, UniversityAppStatus[]> {
    return {
      'U IZRADI': ['SPREMLJENA', 'ZAKLJUČANA'],
      'SPREMLJENA': ['U IZRADI', 'ZAKLJUČANA'],
      'ZAKLJUČANA': ['PREGLEDANA'],
      'PREGLEDANA': ['OBRAĐENA'],
      'OBRAĐENA': ['PRIHVAĆEN', 'ODBIJEN', 'UPISAN'],
      'PRIHVAĆEN': ['UPISAN', 'ODBIJEN'],
      'ODBIJEN': [],
      'UPISAN': []
    };
  },

  canTransition(current: UniversityAppStatus, next: UniversityAppStatus, context: {
    choicesCount: number;
    maturaPassedAllMandatory: boolean;
    deadlinePassed: boolean;
  }): TransitionCheckResult {
    const allowedTargets = this.getTransitions()[current];
    if (!allowedTargets.includes(next)) {
      return { allowed: false, reason: `Nevažeći prijelaz za prijavu fakulteta: ${current} -> ${next}` };
    }

    if (next === 'ZAKLJUČANA') {
      if (context.choicesCount === 0) {
        return { allowed: false, reason: 'Nemoguće je zaključati praznu listu prioriteta fakulteta.' };
      }
      if (context.deadlinePassed) {
        return { allowed: false, reason: 'Prošao je službeni rok za izmjenu liste i prioriteta studijskih programa.' };
      }
    }

    if (next === 'OBRAĐENA' && !context.maturaPassedAllMandatory) {
      return { allowed: false, reason: 'Nisu svi obvezni ispiti državne mature položeni s pozitivnom ocjenom za upis.' };
    }

    return { allowed: true };
  }
};

// -------------------------------------------------------------
// 4. DOKUMENTI (APP DOCUMENT) WORKFLOW ENGINE
// -------------------------------------------------------------

export const DocumentWorkflow = {
  getTransitions(): Record<DocStatus, DocStatus[]> {
    return {
      'PRENESEN': ['ZAPRIMLJEN', 'U OBRADI'],
      'ZAPRIMLJEN': ['U OBRADI', 'ODOBREN', 'ODBIJEN'],
      'U OBRADI': ['ODOBREN', 'ODBIJEN'],
      'ODOBREN': ['ARHIVIRAN'],
      'ODBIJEN': ['PRENESEN', 'ARHIVIRAN'],
      'ARHIVIRAN': []
    };
  },

  canTransition(current: DocStatus, next: DocStatus, context: {
    hasValidFile: boolean;
    verifierRole: string;
  }): TransitionCheckResult {
    const allowedTargets = this.getTransitions()[current];
    if (!allowedTargets.includes(next)) {
      return { allowed: false, reason: `Nevažeći status dokumenta: ${current} -> ${next}` };
    }

    if ((next === 'ODOBREN' || next === 'ODBIJEN') && 
        context.verifierRole !== 'PRIMARY_HOMEROOM_TEACHER' && 
        context.verifierRole !== 'PRIMARY_ADMIN' && 
        context.verifierRole !== 'SUPER_ADMIN' &&
        context.verifierRole !== 'SECONDARY_HOMEROOM_TEACHER' &&
        context.verifierRole !== 'SECONDARY_ADMIN') {
      return { allowed: false, reason: 'Samo ovlašteni razrednici i administratori ustanova mogu odobriti/odbiti dokumentaciju.' };
    }

    return { allowed: true };
  }
};

// Centralized Status Transition Service
export const WorkflowService = {
  executeSchoolAppTransition(
    appId: string,
    next: SchoolAppStatus,
    userId: string,
    userEmail: string,
    context: {
      choicesCount: number;
      hasPendingDocs: boolean;
      hasGradesVerified: boolean;
      deadlinePassed: boolean;
    },
    note?: string
  ): { success: boolean; error?: string } {
    const apps = getTable<SchoolApplication>('school_applications');
    const app = apps.find(a => a.id === appId);
    if (!app) {
      return { success: false, error: 'Prijava nije pronađena u bazi podataka.' };
    }

    let currentStatus: SchoolAppStatus = 'U IZRADI';
    if (app.status === 'LOCKED') currentStatus = 'ZAKLJUČANA';
    else if (app.status === 'VERIFIED') currentStatus = 'POTVRĐENA';
    else if (app.status === 'SUBMITTED') currentStatus = 'SPREMLJENA';
    
    const check = SchoolAppWorkflow.canTransition(currentStatus, next, context);
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }

    const updatedApps = apps.map(a => {
      if (a.id === appId) {
        let dbStatus: any = 'DRAFT';
        if (next === 'SPREMLJENA') dbStatus = 'SUBMITTED';
        else if (next === 'ZAKLJUČANA') dbStatus = 'LOCKED';
        else if (next === 'POTVRĐENA' || next === 'OBRAĐENA' || next === 'UPISAN' || next === 'ODBIJEN') dbStatus = 'VERIFIED';
        return { ...a, status: dbStatus, submittedAt: new Date().toISOString() };
      }
      return a;
    });
    saveTable('school_applications', updatedApps);

    logAuditEvent(userId, userEmail, `STATUS_CHANGED_SCHOOL`, `Promjena statusa liste želja: ${currentStatus} -> ${next}. Napomena: ${note || 'Nema'}`, currentStatus, next);
    addNotification(app.studentId, `Promjena statusa prijave`, `Vaša prijava u srednje škole je promijenila status u: ${next}.`, 'INFO');

    return { success: true };
  },

  executeExamTransition(
    regId: string,
    next: ExamRegStatus,
    userId: string,
    userEmail: string,
    context: {
      deadlinePassed: boolean;
      hasValidGrades: boolean;
    },
    note?: string
  ): { success: boolean; error?: string } {
    const regs = getTable<ExamRegistration>('exam_registrations');
    const reg = regs.find(r => r.id === regId);
    if (!reg) {
      return { success: false, error: 'Prijava ispita državne mature nije pronađena.' };
    }

    let currentStatus: ExamRegStatus = 'NIJE PRIJAVLJEN';
    if (reg.status === 'REGISTERED') currentStatus = 'PRIJAVLJEN';
    else if (reg.status === 'CANCELLED') currentStatus = 'NIJE PRIJAVLJEN';

    const check = ExamWorkflow.canTransition(currentStatus, next, context);
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }

    const updated = regs.map(r => {
      if (r.id === regId) {
        let dbStatus: any = 'REGISTERED';
        if (next === 'NIJE PRIJAVLJEN') dbStatus = 'CANCELLED';
        return { ...r, status: dbStatus };
      }
      return r;
    });
    saveTable('exam_registrations', updated);

    logAuditEvent(userId, userEmail, `STATUS_CHANGED_EXAM`, `Ispit državne mature: ${currentStatus} -> ${next}. Napomena: ${note || 'Nema'}`, currentStatus, next);
    return { success: true };
  },

  executeDocumentTransition(
    docId: string,
    next: DocStatus,
    userId: string,
    userEmail: string,
    context: {
      hasValidFile: boolean;
      verifierRole: string;
    },
    note?: string
  ): { success: boolean; error?: string } {
    const docs = getTable<AppDocument>('documents');
    const doc = docs.find(d => d.id === docId);
    if (!doc) {
      return { success: false, error: 'Dokument nije pronađen.' };
    }

    let currentStatus: DocStatus = 'PRENESEN';
    if (doc.status === 'PENDING') currentStatus = 'ZAPRIMLJEN';
    else if (doc.status === 'VERIFIED') currentStatus = 'ODOBREN';
    else if (doc.status === 'REJECTED') currentStatus = 'ODBIJEN';

    const check = DocumentWorkflow.canTransition(currentStatus, next, context);
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }

    const updated = docs.map(d => {
      if (d.id === docId) {
        let dbStatus: any = 'PENDING';
        if (next === 'ODOBREN') dbStatus = 'VERIFIED';
        else if (next === 'ODBIJEN') dbStatus = 'REJECTED';
        return { 
          ...d, 
          status: dbStatus, 
          verifiedBy: next === 'ODOBREN' ? 'Ured za upise' : undefined,
          rejectionReason: next === 'ODBIJEN' ? (note || 'Neodgovarajući format ili podaci') : undefined 
        };
      }
      return d;
    });
    saveTable('documents', updated);

    logAuditEvent(userId, userEmail, `STATUS_CHANGED_DOCUMENT`, `Dokument ${doc.name} status: ${currentStatus} -> ${next}. Napomena: ${note || 'Nema'}`, currentStatus, next);
    addNotification(doc.userId, `Dokument ${next.toLowerCase()}`, `Vaš priloženi dokument ${doc.name} je označen kao ${next}.`, next === 'ODBIJEN' ? 'ALERT' : 'INFO');

    return { success: true };
  }
};


// -------------------------------------------------------------
// 5. AUTOMATSKI PROCESI & SIMULATOR RANG-LISTA
// -------------------------------------------------------------

/**
 * Executes a full automatic cycle:
 *  - Checks deadlines and triggers automatic state changes
 *  - Recalculates upisni bodovi for all students (both primary & secondary)
 *  - Forms dynamic live ranking lists based on Croatian legal sorting rules:
 *      1. Number of points (broj bodova)
 *      2. Additional points (dodatni bodovi)
 *      3. Special conditions (posebni uvjeti)
 *      4. Submission time (vrijeme prijave) as tie-breaker
 *  - Automatically updates program quotas, filled spots, and estimates status (UPADA / NE_UPADA)
 *  - Emits real-time notifications to users
 */
export function runAutomaticWorkflowTick(triggeredByUserId: string, triggeredByUserEmail: string): { logs: string[] } {
  const logs: string[] = [];
  const now = new Date();
  
  // Load database tables
  const students = getTable<Student>('students');
  const schoolPrograms = getTable<SchoolProgram>('school_programs');
  const studyPrograms = getTable<StudyProgram>('study_programs');
  const schoolApps = getTable<SchoolApplication>('school_applications');
  const schoolChoices = getTable<SchoolApplicationChoice>('school_application_choices');
  const univApps = getTable<UniversityApplication>('university_applications');
  const univChoices = getTable<UniversityApplicationChoice>('university_application_choices');
  const examRegistrations = getTable<ExamRegistration>('exam_registrations');
  const examResults = getTable<ExamResult>('exam_results');
  const examPeriods = getTable<ExamPeriod>('exam_periods');
  const documents = getTable<AppDocument>('documents');
  const deadlines = getTable<AppDeadline>('deadlines');

  logs.push(`[${now.toLocaleTimeString()}] Pokrenut automatski task runner (EduPortal Workflow Engine).`);

  // --- STEP 1: DEADLINE COMPLIANCE CHECKS ---
  const simulateDateStr = '2026-07-11'; // Fixed simulated date from current time
  
  // A. Matura registrations (dl-1: 2026-02-15)
  const maturaDeadline = deadlines.find(d => d.id === 'dl-1');
  const maturaDeadlinePassed = maturaDeadline ? new Date(simulateDateStr) > new Date(maturaDeadline.date) : true;
  if (maturaDeadlinePassed) {
    let lockedCount = 0;
    const updatedExamRegs = examRegistrations.map(reg => {
      if (reg.status === 'REGISTERED') {
        lockedCount++;
        return { ...reg, status: 'ZAKLJUČAN' as any };
      }
      return reg;
    });
    if (lockedCount > 0) {
      saveTable('exam_registrations', updatedExamRegs);
      logs.push(`Automatski zaključano ${lockedCount} prijava ispita državne mature zbog isteka roka.`);
    }
  }

  // B. Verification Deadline (dl-2: 2026-07-05)
  // Auto-verify legacy pending documents to keep simulation clean
  const pendingDocs = documents.filter(d => d.status === 'PENDING');
  if (pendingDocs.length > 0) {
    const updatedDocs = documents.map(d => {
      if (d.status === 'PENDING') {
        logs.push(`Dokument ${d.name} je automatski zaprimljen u obradu.`);
        return { ...d, status: 'VERIFIED' as const, verifiedBy: 'Sustav (Auto-Tick)' };
      }
      return d;
    });
    saveTable('documents', updatedDocs);
  }

  // C. School applications lock (dl-3: 2026-07-10)
  const schoolAppsDeadline = deadlines.find(d => d.id === 'dl-3');
  const schoolAppsPassed = schoolAppsDeadline ? new Date(simulateDateStr) > new Date(schoolAppsDeadline.date) : true;
  
  if (schoolAppsPassed) {
    const updatedApps = schoolApps.map(app => {
      if (app.status === 'DRAFT' || app.status === 'SUBMITTED') {
        logs.push(`Prijava upisa u srednju školu za studenta ID ${app.studentId} automatski zaključana.`);
        return { ...app, status: 'LOCKED' as any };
      }
      return app;
    });
    saveTable('school_applications', updatedApps);
  }

  // --- STEP 2: RECALCULATE PRIMARY SCHOOL RANKS (Srednje upisne liste) ---
  logs.push('Ažuriranje bodova i formiranje privremenih rang-lista za Srednje škole...');

  // Map each program's choices
  const programApplicants: Record<string, { choice: SchoolApplicationChoice; student: Student; application: SchoolApplication }[]> = {};
  
  // Group choices by program
  schoolChoices.forEach(choice => {
    const app = schoolApps.find(a => a.id === choice.applicationId);
    if (!app) return;
    const student = students.find(s => s.id === app.studentId);
    if (!student) return;

    if (!programApplicants[choice.programId]) {
      programApplicants[choice.programId] = [];
    }
    programApplicants[choice.programId].push({ choice, student, application: app });
  });

  // Sort and rank each program's applicants
  Object.keys(programApplicants).forEach(programId => {
    const applicants = programApplicants[programId];
    const program = schoolPrograms.find(p => p.id === programId);
    if (!program) return;

    // Recalculate points first
    applicants.forEach(item => {
      item.choice.pointsCalculated = calculatePrimarySchoolPoints(item.student, program);
    });

    // Croatian Sorting rule:
    // 1. pointsCalculated (desc)
    // 2. additionalPoints (desc)
    // 3. specialConditions (desc)
    // 4. submission time (asc)
    applicants.sort((a, b) => {
      if (b.choice.pointsCalculated !== a.choice.pointsCalculated) {
        return b.choice.pointsCalculated - a.choice.pointsCalculated;
      }
      if (b.student.additionalPoints !== a.student.additionalPoints) {
        return b.student.additionalPoints - a.student.additionalPoints;
      }
      if (Number(b.student.specialConditions) !== Number(a.student.specialConditions)) {
        return Number(b.student.specialConditions) ? 1 : -1;
      }
      // fallback to OIB/id to maintain deterministic sorting
      return a.student.oib.localeCompare(b.student.oib);
    });

    // Assign rank and status
    applicants.forEach((item, index) => {
      const rank = index + 1;
      item.choice.currentRank = rank;
      
      const quota = program.quota;
      if (rank <= quota) {
        item.choice.estimatedStatus = 'UPADA';
      } else {
        item.choice.estimatedStatus = 'NE_UPADA';
      }
    });
  });

  // Save updated primary choices back to the database
  saveTable('school_application_choices', schoolChoices);

  // --- STEP 3: RECALCULATE UNIVERSITY RANKS (Postani Student) ---
  logs.push('Ažuriranje bodova i rangiranje za visoko obrazovanje (Fakulteti)...');

  const studyApplicants: Record<string, { choice: UniversityApplicationChoice; student: Student; application: UniversityApplication }[]> = {};

  univChoices.forEach(choice => {
    const app = univApps.find(a => a.id === choice.applicationId);
    if (!app) return;
    const student = students.find(s => s.id === app.studentId);
    if (!student) return;

    if (!studyApplicants[choice.studyProgramId]) {
      studyApplicants[choice.studyProgramId] = [];
    }
    studyApplicants[choice.studyProgramId].push({ choice, student, application: app });
  });

  Object.keys(studyApplicants).forEach(studyId => {
    const applicants = studyApplicants[studyId];
    const studyProg = studyPrograms.find(p => p.id === studyId);
    if (!studyProg) return;

    // Recalculate points
    applicants.forEach(item => {
      item.choice.pointsCalculated = calculateUniversityPoints(item.student, studyProg, examResults, examPeriods);
    });

    // Sort by university points, then school averages
    applicants.sort((a, b) => {
      if (b.choice.pointsCalculated !== a.choice.pointsCalculated) {
        return b.choice.pointsCalculated - a.choice.pointsCalculated;
      }
      const avgA = (a.student.gradeAverage5 + a.student.gradeAverage6 + a.student.gradeAverage7 + a.student.gradeAverage8) / 4;
      const avgB = (b.student.gradeAverage5 + b.student.gradeAverage6 + b.student.gradeAverage7 + b.student.gradeAverage8) / 4;
      return avgB - avgA;
    });

    applicants.forEach((item, index) => {
      const rank = index + 1;
      item.choice.currentRank = rank;
      
      const satisfiesThreshold = item.choice.pointsCalculated >= studyProg.minPointsThreshold;
      if (!satisfiesThreshold) {
        item.choice.estimatedStatus = 'ISPOD_PRAGA';
      } else if (rank <= studyProg.quota) {
        item.choice.estimatedStatus = 'UPADA';
      } else {
        item.choice.estimatedStatus = 'NE_UPADA';
      }
    });
  });

  saveTable('university_application_choices', univChoices);

  // --- STEP 4: QUOTAS & REMAINING PLACES AUTOMATION ---
  schoolPrograms.forEach(prog => {
    const applicants = schoolChoices.filter(c => c.programId === prog.id && c.estimatedStatus === 'UPADA');
    prog.filledSpots = applicants.length;
    prog.freeSpots = Math.max(0, prog.quota - applicants.length);
    prog.applicantsCount = schoolChoices.filter(c => c.programId === prog.id).length;
  });
  saveTable('school_programs', schoolPrograms);

  studyPrograms.forEach(prog => {
    const applicants = univChoices.filter(c => c.studyProgramId === prog.id && c.estimatedStatus === 'UPADA');
    prog.filledSpots = applicants.length;
    prog.freeSpots = Math.max(0, prog.quota - applicants.length);
    prog.applicantsCount = univChoices.filter(c => c.studyProgramId === prog.id).length;
  });
  saveTable('study_programs', studyPrograms);

  // --- STEP 5: AUTOMATIC FINAL ALLOCATION IF SYSTEM YEAR IS CONCLUDED ---
  // If the school deadline is finalized, students with UPADA status on their priority 1 choice get enrolled!
  // In the real system, students are automatically distributed to the highest priority choice where they rank within quota.
  students.forEach(stud => {
    // 1. Primary school candidate final distribution
    const lukaApp = schoolApps.find(a => a.studentId === stud.id);
    if (lukaApp && ((lukaApp.status as any) === 'LOCKED' || (lukaApp.status as any) === 'VERIFIED' || (lukaApp.status as any) === 'POTVRĐENA')) {
      const choices = schoolChoices
        .filter(c => c.applicationId === lukaApp.id)
        .sort((a, b) => a.priority - b.priority);
      
      // Find highest priority choice that got 'UPADA' status
      const winningChoice = choices.find(c => c.estimatedStatus === 'UPADA');
      if (winningChoice) {
        // Enrolled to this program!
        const prog = schoolPrograms.find(p => p.id === winningChoice.programId);
        if (prog && (lukaApp.status as any) !== 'UPISAN') {
          lukaApp.status = 'UPISAN' as any;
          saveTable('school_applications', schoolApps);
          addNotification(
            stud.userId,
            'ČESTITAMO! Raspoređeni ste u srednju školu!',
            `Sustav je završio raspodjelu. Upisani ste u program: ${prog.name}. Čestitamo!`,
            'RESULT'
          );
          logAuditEvent(
            'sustav-workflow',
            'system@carnet.hr',
            'AUTOMATSKI_UPIS',
            `Učenik OIB ${stud.oib} je automatski raspoređen u program: ${prog.name}.`,
            'POTVRĐENA',
            'UPISAN'
          );
        }
      }
    }

    // 2. University student final distribution
    const ivanApp = univApps.find(a => a.studentId === stud.id);
    if (ivanApp && (ivanApp.status as any) === 'SUBMITTED') {
      const choices = univChoices
        .filter(c => c.applicationId === ivanApp.id)
        .sort((a, b) => a.priority - b.priority);
      
      const winningUniChoice = choices.find(c => c.estimatedStatus === 'UPADA');
      if (winningUniChoice) {
        const prog = studyPrograms.find(p => p.id === winningUniChoice.studyProgramId);
        if (prog && (ivanApp.status as any) !== 'UPISAN') {
          ivanApp.status = 'UPISAN' as any;
          saveTable('university_applications', univApps);
          addNotification(
            stud.userId,
            'ČESTITAMO! Ostvarili ste pravo upisa na fakultet!',
            `Sustav je završio obradu rang-lista. Ostvarili ste pravo upisa na studij: ${prog.name}.`,
            'RESULT'
          );
          logAuditEvent(
            'sustav-workflow',
            'system@carnet.hr',
            'AUTOMATSKI_UPIS_FAKULTET',
            `Kandidat OIB ${stud.oib} je ostvario pravo upisa na studijski program: ${prog.name}.`,
            'SUBMITTED',
            'UPISAN'
          );
        }
      }
    }
  });

  // Log audit event for the automatic tick execution
  logAuditEvent(
    triggeredByUserId,
    triggeredByUserEmail,
    'SISTEMSKI_WORKFLOW_RUN',
    `Uspješno završen automatski ciklus provjere rokova, rang-lista i kvota za sve upisane kandidate.`
  );

  logs.push(`[${new Date().toLocaleTimeString()}] Automatski task runner je uspješno završio obradu.`);
  return { logs };
}
