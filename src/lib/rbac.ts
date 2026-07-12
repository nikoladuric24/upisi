import { User, UserRole, Student, School, Faculty, AppDocument, Grade } from '../types';
import { getTable } from './storage';

export type Permission =
  | 'users.read'
  | 'users.create'
  | 'users.update'
  | 'users.delete'
  | 'schools.read'
  | 'schools.update'
  | 'schools.delete'
  | 'school_programs.read'
  | 'school_programs.create'
  | 'school_programs.update'
  | 'school_programs.deactivate'
  | 'school_programs.manage_quotas'
  | 'students.read'
  | 'students.create'
  | 'students.update'
  | 'teachers.read'
  | 'teachers.update'
  | 'classes.read'
  | 'classes.update'
  | 'grades.read'
  | 'grades.update'
  | 'applications.read'
  | 'applications.update'
  | 'documents.read'
  | 'documents.approve'
  | 'documents.delete'
  | 'matura.read'
  | 'matura.register'
  | 'matura.unregister'
  | 'matura.results'
  | 'universities.read'
  | 'universities.update'
  | 'study_programs.read'
  | 'study_programs.create'
  | 'study_programs.update'
  | 'study_programs.deactivate'
  | 'study_programs.manage_quotas'
  | 'study_programs.manage_requirements'
  | 'thresholds.update'
  | 'quotas.update'
  | 'deadlines.update'
  | 'notifications.create'
  | 'reports.export'
  | 'audit.read'
  | 'settings.update';

export interface Session {
  id: string;
  fullName: string;
  name: string;
  surname: string;
  roles: UserRole[];
  permissions: Permission[];
  school_id?: string | null;
  faculty_id?: string | null;
  class_id?: string | null;
  school_year_id?: string | null;
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    'users.read', 'users.create', 'users.update', 'users.delete',
    'schools.read', 'schools.update', 'schools.delete',
    'school_programs.read', 'school_programs.create', 'school_programs.update', 'school_programs.deactivate', 'school_programs.manage_quotas',
    'students.read', 'students.create', 'students.update',
    'teachers.read', 'teachers.update',
    'classes.read', 'classes.update',
    'grades.read', 'grades.update',
    'applications.read', 'applications.update',
    'documents.read', 'documents.approve', 'documents.delete',
    'matura.read', 'matura.register', 'matura.unregister', 'matura.results',
    'universities.read', 'universities.update',
    'study_programs.read', 'study_programs.create', 'study_programs.update', 'study_programs.deactivate', 'study_programs.manage_quotas', 'study_programs.manage_requirements',
    'thresholds.update', 'quotas.update', 'deadlines.update',
    'notifications.create', 'reports.export', 'audit.read', 'settings.update'
  ],
  PRIMARY_ADMIN: [
    'schools.read', 'schools.update',
    'students.read', 'students.create', 'students.update',
    'classes.read', 'classes.update',
    'teachers.read', 'teachers.update',
    'grades.read', 'grades.update',
    'applications.read',
    'reports.export'
  ],
  SECONDARY_ADMIN: [
    'schools.read', 'schools.update',
    'school_programs.read', 'school_programs.create', 'school_programs.update', 'school_programs.deactivate', 'school_programs.manage_quotas',
    'study_programs.read', 'study_programs.update',
    'quotas.update', 'thresholds.update',
    'applications.read', 'applications.update',
    'classes.read', 'classes.update',
    'teachers.read', 'teachers.update',
    'matura.read', 'matura.results',
    'reports.export'
  ],
  UNIVERSITY_ADMIN: [
    'universities.read', 'universities.update',
    'study_programs.read', 'study_programs.create', 'study_programs.update', 'study_programs.deactivate', 'study_programs.manage_quotas', 'study_programs.manage_requirements',
    'quotas.update',
    'applications.read', 'applications.update',
    'reports.export'
  ],
  PRIMARY_HOMEROOM_TEACHER: [
    'students.read',
    'grades.read', 'grades.update',
    'applications.read',
    'documents.read', 'documents.approve',
    'reports.export'
  ],
  SECONDARY_HOMEROOM_TEACHER: [
    'students.read',
    'matura.read', 'matura.results',
    'applications.read',
    'documents.read',
    'reports.export'
  ],
  PRIMARY_STUDENT: [
    'schools.read',
    'students.read', 'students.update',
    'grades.read',
    'applications.read', 'applications.update',
    'documents.read'
  ],
  SECONDARY_STUDENT: [
    'students.read', 'students.update',
    'matura.read', 'matura.register', 'matura.unregister',
    'applications.read', 'applications.update',
    'documents.read'
  ]
};

// Generates session details for the logged-in user
export function createSessionForUser(user: User): Session {
  const parts = user.fullName.split(' ');
  const name = parts[0] || '';
  const surname = parts.slice(1).join(' ') || '';

  // Suppport multiple roles on the user object if they are set, fallback to a single role
  const userRoles: UserRole[] = (user as any).roles || [user.role];

  // Merge permissions from all roles
  const permissionsSet = new Set<Permission>();
  userRoles.forEach(r => {
    const list = ROLE_PERMISSIONS[r] || [];
    list.forEach(p => permissionsSet.add(p));
  });

  const permissions = Array.from(permissionsSet);

  let school_id: string | null = null;
  let faculty_id: string | null = null;
  let class_id: string | null = null;
  const school_year_id = 'sy-2026'; // Default school year

  // Dynamic Lookup
  // 1. Is this user a student?
  const students = getTable<Student>('students');
  const student = students.find(s => s.userId === user.id);
  if (student) {
    school_id = student.schoolId;
    class_id = student.classId;
  }

  // 2. Specific Hardcoded Test Simulators & Dynamic Email Matches
  if (user.id === 'usr-prim-admin' || user.email === 'skola.prim@skole.hr') {
    school_id = 'sch-1'; // OŠ Nikole Tesle
  } else if (user.id === 'usr-prim-teach' || user.email === 'razrednik.prim@skole.hr') {
    school_id = 'sch-1';
    class_id = 'cls-8a';
  } else if (user.id === 'usr-sec-admin' || user.email === 'skola.sec@skole.hr') {
    school_id = 'sch-4'; // XV. Gimnazija
  } else if (user.id === 'usr-sec-teach' || user.email === 'razrednik.sec@skole.hr') {
    school_id = 'sch-4';
    class_id = 'cls-4a';
  } else if (user.id === 'usr-uni-admin' || user.email === 'fer@unizg.hr') {
    faculty_id = 'fac-1'; // FER
  }

  // 3. Fallback dynamically check by school adminEmail or principalName
  if (!school_id && !faculty_id) {
    const schools = getTable<School>('schools');
    const matchedSchool = schools.find(s => s.adminEmail === user.email || s.principalName === user.fullName);
    if (matchedSchool) {
      school_id = matchedSchool.id;
    } else {
      const faculties = getTable<Faculty>('faculties');
      const matchedFaculty = faculties.find(f => f.adminEmail === user.email || f.principalName === user.fullName);
      if (matchedFaculty) {
        faculty_id = matchedFaculty.id;
      }
    }
  }

  return {
    id: user.id,
    fullName: user.fullName,
    name,
    surname,
    roles: userRoles,
    permissions,
    school_id,
    faculty_id,
    class_id,
    school_year_id
  };
}

/**
 * Row Level Security (RLS) Policy engine.
 * Ensures the logged-in session has the right scope for the resources being requested.
 */
export function checkPermission(
  session: Session,
  permission: Permission,
  resourceContext?: {
    schoolId?: string;
    facultyId?: string;
    classId?: string;
    studentId?: string;
    userId?: string;
  }
): boolean {
  // SUPER_ADMIN has god-mode bypass
  if (session.roles.includes('SUPER_ADMIN')) {
    return true;
  }

  // Base permission check
  if (!session.permissions.includes(permission)) {
    return false;
  }

  // If no resource context is specified, check passes (it was a general tab check)
  if (!resourceContext) {
    return true;
  }

  // Row Level Security (RLS) policies enforcement
  
  // 1. Učenik vidi samo svoje podatke
  if (session.roles.includes('PRIMARY_STUDENT') || session.roles.includes('SECONDARY_STUDENT')) {
    // If checking a resource belonging to a user/student
    if (resourceContext.userId && resourceContext.userId !== session.id) {
      return false;
    }
    // Resolve student id for this student
    const students = getTable<Student>('students');
    const myStudentObj = students.find(s => s.userId === session.id);
    if (myStudentObj && resourceContext.studentId && resourceContext.studentId !== myStudentObj.id) {
      return false;
    }
    return true;
  }

  // 2. Razrednik vidi samo svoj razred
  if (session.roles.includes('PRIMARY_HOMEROOM_TEACHER') || session.roles.includes('SECONDARY_HOMEROOM_TEACHER')) {
    if (resourceContext.classId && resourceContext.classId !== session.class_id) {
      return false;
    }
    // If studentId is supplied, check if that student belongs to teacher's class
    if (resourceContext.studentId) {
      const students = getTable<Student>('students');
      const targetStudent = students.find(s => s.id === resourceContext.studentId);
      if (targetStudent && targetStudent.classId !== session.class_id) {
        return false;
      }
    }
    return true;
  }

  // 3. Administrator škole vidi samo svoju školu
  if (session.roles.includes('PRIMARY_ADMIN') || session.roles.includes('SECONDARY_ADMIN')) {
    if (resourceContext.schoolId && resourceContext.schoolId !== session.school_id) {
      return false;
    }
    // If studentId is checked, check if student is registered in administrator's school
    if (resourceContext.studentId) {
      const students = getTable<Student>('students');
      const targetStudent = students.find(s => s.id === resourceContext.studentId);
      if (targetStudent && targetStudent.schoolId !== session.school_id) {
        return false;
      }
    }
    return true;
  }

  // 4. Administrator fakulteta vidi samo svoj fakultet
  if (session.roles.includes('UNIVERSITY_ADMIN')) {
    if (resourceContext.facultyId && resourceContext.facultyId !== session.faculty_id) {
      return false;
    }
    return true;
  }

  return true;
}

/**
 * Audit log structure for detailed logging of actions.
 */
export function logSecurityAudit(
  session: Session,
  action: string,
  objectName: string,
  oldValue?: string,
  newValue?: string,
  result: 'SUCCESS' | 'DENIED' = 'SUCCESS'
) {
  const logs = getTable<any>('audit_logs');
  const userAgent = navigator.userAgent || 'Unknown Device';
  
  const newLog = {
    id: `log-${Date.now()}`,
    userId: session.id,
    userEmail: session.fullName + ` (${session.roles.join(', ')})`,
    action: action,
    details: `Korisnik ${session.fullName} izvršio: ${action} na objektu ${objectName}. Rezultat: ${result}`,
    ipAddress: '193.198.0.1', // CARNET academic subnet proxy
    userAgent: userAgent,
    oldValue: oldValue || null,
    newValue: newValue || null,
    result: result,
    createdAt: new Date().toISOString()
  };

  logs.unshift(newLog);
  // Also write to localStorage
  localStorage.setItem('eduportal_audit_logs', JSON.stringify(logs));
}
