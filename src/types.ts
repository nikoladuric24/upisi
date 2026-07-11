/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole =
  | 'SUPER_ADMIN'
  | 'PRIMARY_ADMIN'
  | 'SECONDARY_ADMIN'
  | 'PRIMARY_HOMEROOM_TEACHER'
  | 'SECONDARY_HOMEROOM_TEACHER'
  | 'PRIMARY_STUDENT'
  | 'SECONDARY_STUDENT'
  | 'UNIVERSITY_ADMIN';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
}

export interface County {
  id: string;
  name: string; // e.g., "Zagrebačka županija", "Splitsko-dalmatinska"
}

export interface City {
  id: string;
  countyId: string;
  name: string;
}

export interface School {
  id: string;
  name: string;
  type: 'PRIMARY' | 'SECONDARY';
  cityId: string;
  address: string;
  phone?: string;
  email?: string;
  oib?: string;
  mzoCode?: string;
  countyId?: string;
  contactPerson?: string;
  principalName?: string;
  adminEmail?: string;
  isArchived?: boolean;
}

export interface SchoolProgram {
  id: string;
  schoolId: string;
  name: string; // e.g., "Opća gimnazija", "Tehničar za računalstvo"
  durationYears: number;
  quota: number;
  minPointsThreshold: number;
  maxPointsThreshold?: number;
  prevYearThreshold: number; // For simulation
  subjectsRequired: string[]; // subjects used for calculating points
  freeSpots?: number;
  reservedSpots?: number;
  filledSpots?: number;
  applicantsCount?: number;
  enrolledCount?: number;
  isArchived?: boolean;
}

export interface SchoolYear {
  id: string;
  year: string; // e.g., "2025/2026"
  isCurrent: boolean;
}

export interface ClassSection {
  id: string;
  schoolId: string;
  teacherId: string;
  name: string; // e.g., "8.A", "4.B"
  schoolYearId: string;
}

export interface Student {
  id: string;
  userId: string;
  classId: string;
  schoolId: string;
  oib: string;
  dateOfBirth: string;
  gradeAverage5: number; // 5th grade avg
  gradeAverage6: number; // 6th grade avg
  gradeAverage7: number; // 7th grade avg
  gradeAverage8: number; // 8th grade avg
  competitionsPoints: number; // points from competitions
  additionalPoints: number; // extra points (social, health, sport)
  socialPointsReason?: string;
  healthConditions?: string;
  specialConditions?: boolean;
}

export interface Teacher {
  id: string;
  userId: string;
  schoolId: string;
  isHomeroom: boolean;
}

export interface Subject {
  id: string;
  name: string; // e.g., "Hrvatski jezik", "Matematika", "Strani jezik"
}

export interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  schoolYearId: string;
  gradeValue: number; // 1-5
  term: 'MIDTERM' | 'FINAL';
  createdAt: string;
}

export interface University {
  id: string;
  name: string; // e.g., "Sveučilište u Zagrebu"
  cityId: string;
}

export interface Faculty {
  id: string;
  universityId: string;
  name: string; // e.g., "Fakultet elektrotehnike i računarstva"
  address: string;
  oib?: string;
  mzoCode?: string;
  cityId?: string;
  email?: string;
  phone?: string;
  principalName?: string;
  adminEmail?: string;
  isArchived?: boolean;
}

export interface StudyProgram {
  id: string;
  facultyId: string;
  name: string; // e.g., "Računarstvo", "Medicina"
  quota: number;
  minPointsThreshold: number;
  maxPointsThreshold?: number;
  prevYearThreshold?: number;
  freeSpots?: number;
  reservedSpots?: number;
  filledSpots?: number;
  applicantsCount?: number;
  enrolledCount?: number;
  isArchived?: boolean;
  requiresMaturaMandatory: {
    subjectId: string; // e.g., Matematika
    minLevel: 'A' | 'B' | 'N/A';
    weightPercentage: number; // e.g., 40%
  }[];
}

export interface AdmissionRound {
  id: string;
  name: string; // e.g., "Ljetni upisni rok 2026"
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface SchoolApplication {
  id: string;
  studentId: string;
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED' | 'VERIFIED';
  submittedAt?: string;
}

export interface SchoolApplicationChoice {
  id: string;
  applicationId: string;
  programId: string;
  priority: number; // 1, 2, 3...
  pointsCalculated: number;
  currentRank?: number;
  estimatedStatus: 'UPADA' | 'NE_UPADA' | 'ZAKLJUČANO';
}

export interface UniversityApplication {
  id: string;
  studentId: string; // secondary student
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED';
  submittedAt?: string;
}

export interface UniversityApplicationChoice {
  id: string;
  applicationId: string;
  studyProgramId: string;
  priority: number; // 1, 2, 3...
  pointsCalculated: number;
  currentRank?: number;
  estimatedStatus: 'UPADA' | 'NE_UPADA' | 'ISPOD_PRAGA';
}

export interface ExamSubject {
  id: string;
  name: string; // e.g., "Hrvatski jezik", "Matematika", "Engleski jezik", "Fizika"
  isElective: boolean;
}

export interface ExamPeriod {
  id: string;
  subjectId: string;
  level: 'A' | 'B' | 'N/A'; // N/A for elective subjects
  date: string; // exam date
  time: string; // exam time e.g. "09:00"
  durationMinutes: number;
}

export interface ExamRegistration {
  id: string;
  studentId: string;
  examPeriodId: string;
  registeredAt: string;
  status: 'REGISTERED' | 'CANCELLED';
}

export interface ExamResult {
  id: string;
  studentId: string;
  examPeriodId: string;
  scorePercentage: number; // 0 - 100
  grade: number; // 1-5
  pointsEarned: number; // calculated exam points
}

export interface AppDocument {
  id: string;
  userId: string;
  name: string;
  fileType: string;
  fileSize: string;
  purpose: 'OCJENE' | 'DOMOVNICA' | 'ZDRAVSTVENA_POTVRDA' | 'DODATNI_BODOVI' | 'DRŽAVNA_MATURA' | 'OSTALO';
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  fileUrl: string;
  createdAt: string;
  verifiedBy?: string;
  rejectionReason?: string;
  submittedAt?: string;
  approvedAt?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  type: 'ALERT' | 'REMINDER' | 'INFO' | 'RESULT';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string; // e.g. "PRIJAVA", "PROMJENA_PRIORITETA", "VERIFIKACIJA_DOKUMENTA"
  details: string;
  ipAddress: string;
  createdAt: string;
  oldValue?: string;
  newValue?: string;
}

export interface AppDeadline {
  id: string;
  title: string;
  date: string;
  type: 'SCHOOL_APPLICATIONS' | 'MATURA_REGISTRATION' | 'UNIVERSITY_APPLICATIONS' | 'VERIFICATION';
  description: string;
}

export interface PrimaryPointsConfig {
  id: string;
  gradeAverageWeight: number; // Multiplier for grade avg sum (default 4)
  competitionsWeight: number; // Multiplier for competition points (default 1)
  additionalWeight: number; // Multiplier for extra points (default 1)
  maxPoints: number; // Total max points (default 80)
}

