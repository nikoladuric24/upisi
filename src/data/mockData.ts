/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
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
  User
} from '../types';

export const COUNTIES: County[] = [
  { id: 'zup-1', name: 'Grad Zagreb' },
  { id: 'zup-2', name: 'Splitsko-dalmatinska županija' },
  { id: 'zup-3', name: 'Primorsko-goranska županija' },
  { id: 'zup-4', name: 'Osječko-baranjska županija' },
  { id: 'zup-5', name: 'Istarska županija' },
  { id: 'zup-6', name: 'Varaždinska županija' },
];

export const CITIES: City[] = [
  { id: 'city-1', countyId: 'zup-1', name: 'Zagreb' },
  { id: 'city-2', countyId: 'zup-2', name: 'Split' },
  { id: 'city-3', countyId: 'zup-3', name: 'Rijeka' },
  { id: 'city-4', countyId: 'zup-4', name: 'Osijek' },
  { id: 'city-5', countyId: 'zup-5', name: 'Pula' },
  { id: 'city-6', countyId: 'zup-6', name: 'Varaždin' },
];

export const SCHOOLS: School[] = [
  // Primary
  { id: 'sch-1', name: 'OŠ Nikole Tesle', type: 'PRIMARY', cityId: 'city-1', address: 'Kopernikova ulica 14, Zagreb', phone: '01 6670 122', email: 'os-ntesla@skole.hr', oib: '38194018241', mzoCode: '01-204-001', countyId: 'zup-1', principalName: 'Ana Kovač', adminEmail: 'os-ntesla-admin@skole.hr' },
  { id: 'sch-2', name: 'OŠ Manuš', type: 'PRIMARY', cityId: 'city-2', address: 'Vukovarska 11, Split', phone: '021 345 678', email: 'os-manus@skole.hr', oib: '94810238124', mzoCode: '02-101-042', countyId: 'zup-2', principalName: 'Luka Jurić', adminEmail: 'os-manus-admin@skole.hr' },
  { id: 'sch-3', name: 'OŠ Pećine', type: 'PRIMARY', cityId: 'city-3', address: 'Janka Polića Kamova 32, Rijeka', phone: '051 400 300', email: 'os-pecine@skole.hr', oib: '10482038102', mzoCode: '03-512-003', countyId: 'zup-3', principalName: 'Marija Babić', adminEmail: 'os-pecine-admin@skole.hr' },
  
  // Secondary
  { id: 'sch-4', name: 'XV. Gimnazija (MIOC)', type: 'SECONDARY', cityId: 'city-1', address: 'Jordanovac ul. 8, Zagreb', phone: '01 2302 255', email: 'mioc@xv.hr', oib: '40192830129', mzoCode: '01-105-001', countyId: 'zup-1', principalName: 'Prof. Ljiljana Crnković', adminEmail: 'mioc-admin@xv.hr' },
  { id: 'sch-5', name: 'I. Gimnazija Split', type: 'SECONDARY', cityId: 'city-2', address: 'Ruđera Boškovića 37, Split', phone: '021 460 220', email: 'prva-gimnazija-st@skole.hr', oib: '58192830182', mzoCode: '02-105-001', countyId: 'zup-2', principalName: 'Prof. Dobrila Gotovac Stipaničev', adminEmail: 'prva-gimnazija-admin@skole.hr' },
  { id: 'sch-6', name: 'Prva riječka hrvatska gimnazija', type: 'SECONDARY', cityId: 'city-3', address: 'Frana Kurelca 1, Rijeka', phone: '051 336 211', email: 'prhg@skole.hr', oib: '60192830121', mzoCode: '03-105-001', countyId: 'zup-3', principalName: 'Prof. Jane Sclaunich', adminEmail: 'prhg-admin@skole.hr' },
  { id: 'sch-7', name: 'Tehnička škola Ruđera Boškovića', type: 'SECONDARY', cityId: 'city-1', address: 'Getaldićeva 4, Zagreb', phone: '01 2371 060', email: 'tsrb@tsrb.hr', oib: '70192830182', mzoCode: '01-108-002', countyId: 'zup-1', principalName: 'Đurđica Fuštar', adminEmail: 'tsrb-admin@tsrb.hr' },
  { id: 'sch-8', name: 'Medicinska škola Varaždin', type: 'SECONDARY', cityId: 'city-6', address: 'Vinka Međerala 11, Varaždin', phone: '042 350 110', email: 'medicinska@skole.hr', oib: '80192830182', mzoCode: '06-108-011', countyId: 'zup-6', principalName: 'Prof. Mirjana Grabar Krpan', adminEmail: 'med-varazdin-admin@skole.hr' }
];

export const SCHOOL_PROGRAMS: SchoolProgram[] = [
  // XV. Gimnazija (MIOC) (sch-4)
  { id: 'prog-1', schoolId: 'sch-4', name: 'Prirodoslovno-matematička gimnazija (IBM program)', durationYears: 4, quota: 120, minPointsThreshold: 78.5, maxPointsThreshold: 80.0, prevYearThreshold: 79.2, subjectsRequired: ['Hrvatski', 'Matematika', 'Strani jezik', 'Fizika', 'Kemija', 'Biologija'], freeSpots: 18, reservedSpots: 2, filledSpots: 100, applicantsCount: 245, enrolledCount: 100 },
  { id: 'prog-2', schoolId: 'sch-4', name: 'Opća gimnazija', durationYears: 4, quota: 60, minPointsThreshold: 76.0, maxPointsThreshold: 80.0, prevYearThreshold: 77.5, subjectsRequired: ['Hrvatski', 'Matematika', 'Strani jezik', 'Povijest', 'Geografija', 'Biologija'], freeSpots: 5, reservedSpots: 0, filledSpots: 55, applicantsCount: 110, enrolledCount: 55 },
  
  // I. Gimnazija Split (sch-5)
  { id: 'prog-3', schoolId: 'sch-5', name: 'Prirodoslovno-matematička gimnazija', durationYears: 4, quota: 96, minPointsThreshold: 77.0, maxPointsThreshold: 80.0, prevYearThreshold: 78.0, subjectsRequired: ['Hrvatski', 'Matematika', 'Strani jezik', 'Fizika', 'Kemija', 'Biologija'], freeSpots: 14, reservedSpots: 2, filledSpots: 80, applicantsCount: 180, enrolledCount: 80 },
  { id: 'prog-4', schoolId: 'sch-5', name: 'Jezična gimnazija', durationYears: 4, quota: 48, minPointsThreshold: 75.0, maxPointsThreshold: 80.0, prevYearThreshold: 76.2, subjectsRequired: ['Hrvatski', 'Matematika', 'Strani jezik', 'Drugi strani jezik', 'Povijest', 'Zemljopis'], freeSpots: 8, reservedSpots: 0, filledSpots: 40, applicantsCount: 90, enrolledCount: 40 },

  // Prva riječka (sch-6)
  { id: 'prog-5', schoolId: 'sch-6', name: 'Opća gimnazija', durationYears: 4, quota: 80, minPointsThreshold: 74.0, maxPointsThreshold: 80.0, prevYearThreshold: 75.1, subjectsRequired: ['Hrvatski', 'Matematika', 'Strani jezik', 'Povijest', 'Geografija', 'Biologija'], freeSpots: 20, reservedSpots: 1, filledSpots: 59, applicantsCount: 120, enrolledCount: 59 },

  // Tehnička škola Ruđera Boškovića (sch-7)
  { id: 'prog-6', schoolId: 'sch-7', name: 'Tehničar za računalstvo', durationYears: 4, quota: 150, minPointsThreshold: 72.0, maxPointsThreshold: 80.0, prevYearThreshold: 74.5, subjectsRequired: ['Hrvatski', 'Matematika', 'Strani jezik', 'Fizika', 'Kemija', 'Informatika'], freeSpots: 10, reservedSpots: 5, filledSpots: 135, applicantsCount: 380, enrolledCount: 135 },
  { id: 'prog-7', schoolId: 'sch-7', name: 'Tehničar za mehatroniku', durationYears: 4, quota: 90, minPointsThreshold: 68.0, maxPointsThreshold: 80.0, prevYearThreshold: 70.2, subjectsRequired: ['Hrvatski', 'Matematika', 'Strani jezik', 'Fizika', 'Kemija', 'Tehnički'], freeSpots: 12, reservedSpots: 2, filledSpots: 76, applicantsCount: 198, enrolledCount: 76 },

  // Medicinska škola Varaždin (sch-8)
  { id: 'prog-8', schoolId: 'sch-8', name: 'Medicinska sestra / tehničar opće njege', durationYears: 5, quota: 64, minPointsThreshold: 65.0, maxPointsThreshold: 80.0, prevYearThreshold: 68.4, subjectsRequired: ['Hrvatski', 'Matematika', 'Strani jezik', 'Kemija', 'Biologija', 'Fizika'], freeSpots: 4, reservedSpots: 0, filledSpots: 60, applicantsCount: 154, enrolledCount: 60 }
];

export const UNIVERSITIES: University[] = [
  { id: 'uni-1', name: 'Sveučilište u Zagrebu', cityId: 'city-1' },
  { id: 'uni-2', name: 'Sveučilište u Splitu', cityId: 'city-2' },
  { id: 'uni-3', name: 'Sveučilište u Rijeci', cityId: 'city-3' }
];

export const FACULTIES: Faculty[] = [
  // Sveučilište u Zagrebu
  { id: 'fac-1', universityId: 'uni-1', name: 'Fakultet elektrotehnike i računarstva (FER)', address: 'Unska ulica 3, Zagreb', oib: '40192801824', mzoCode: '01-123-001', cityId: 'city-1', email: 'fer@unizg.hr', phone: '01 6129 999', principalName: 'Prof. dr. sc. Vedran Bilas', adminEmail: 'fer-admin@unizg.hr' },
  { id: 'fac-2', universityId: 'uni-1', name: 'Medicinski fakultet', address: 'Šalata 3, Zagreb', oib: '41029830182', mzoCode: '01-123-002', cityId: 'city-1', email: 'mef@unizg.hr', phone: '01 4566 777', principalName: 'Prof. dr. sc. Slavko Orešković', adminEmail: 'mef-admin@unizg.hr' },
  { id: 'fac-3', universityId: 'uni-1', name: 'Ekonomski fakultet', address: 'Trg J. F. Kennedyja 6, Zagreb', oib: '42019283018', mzoCode: '01-123-003', cityId: 'city-1', email: 'efzg@unizg.hr', phone: '01 2383 333', principalName: 'Prof. dr. sc. Sanja Sever Mališ', adminEmail: 'efzg-admin@unizg.hr' },
  
  // Sveučilište u Splitu
  { id: 'fac-4', universityId: 'uni-2', name: 'Fakultet elektrotehnike, strojarstva i brodogradnje (FESB)', address: 'Ruđera Boškovića 32, Split', oib: '50192830182', mzoCode: '02-124-001', cityId: 'city-2', email: 'fesb@fesb.hr', phone: '021 305 777', principalName: 'Prof. dr. sc. Branimir Lela', adminEmail: 'fesb-admin@fesb.hr' },
  { id: 'fac-5', universityId: 'uni-2', name: 'Medicinski fakultet u Splitu', address: 'Šoltanska 2, Split', oib: '51029381028', mzoCode: '02-124-002', cityId: 'city-2', email: 'mefst@mefst.hr', phone: '021 557 888', principalName: 'Prof. dr. sc. Ante Tonkić', adminEmail: 'mefst-admin@mefst.hr' }
];

export const EXAM_SUBJECTS: ExamSubject[] = [
  { id: 'ex-sub-1', name: 'Hrvatski jezik', isElective: false },
  { id: 'ex-sub-2', name: 'Matematika', isElective: false },
  { id: 'ex-sub-3', name: 'Engleski jezik', isElective: false },
  { id: 'ex-sub-4', name: 'Fizika', isElective: true },
  { id: 'ex-sub-5', name: 'Informatika', isElective: true },
  { id: 'ex-sub-6', name: 'Kemija', isElective: true },
  { id: 'ex-sub-7', name: 'Biologija', isElective: true }
];

export const EXAM_PERIODS: ExamPeriod[] = [];

export const STUDY_PROGRAMS: StudyProgram[] = [
  // FER (fac-1)
  {
    id: 'stud-1',
    facultyId: 'fac-1',
    name: 'Računarstvo',
    quota: 250,
    minPointsThreshold: 720,
    requiresMaturaMandatory: [
      { subjectId: 'ex-sub-2', minLevel: 'A', weightPercentage: 40 }, // Matematika A - 40%
      { subjectId: 'ex-sub-1', minLevel: 'A', weightPercentage: 20 }, // Hrvatski A - 20%
      { subjectId: 'ex-sub-3', minLevel: 'B', weightPercentage: 15 }, // Engleski B - 15%
      { subjectId: 'ex-sub-4', minLevel: 'N/A', weightPercentage: 25 } // Fizika ili inf - 25%
    ]
  },
  {
    id: 'stud-2',
    facultyId: 'fac-1',
    name: 'Elektrotehnika i informacijska tehnologija',
    quota: 400,
    minPointsThreshold: 680,
    requiresMaturaMandatory: [
      { subjectId: 'ex-sub-2', minLevel: 'A', weightPercentage: 40 },
      { subjectId: 'ex-sub-1', minLevel: 'A', weightPercentage: 20 },
      { subjectId: 'ex-sub-3', minLevel: 'B', weightPercentage: 15 },
      { subjectId: 'ex-sub-4', minLevel: 'N/A', weightPercentage: 25 }
    ]
  },
  
  // Medicinski fakultet (fac-2)
  {
    id: 'stud-3',
    facultyId: 'fac-2',
    name: 'Medicina',
    quota: 300,
    minPointsThreshold: 750,
    requiresMaturaMandatory: [
      { subjectId: 'ex-sub-1', minLevel: 'A', weightPercentage: 20 },
      { subjectId: 'ex-sub-2', minLevel: 'A', weightPercentage: 20 },
      { subjectId: 'ex-sub-3', minLevel: 'A', weightPercentage: 20 },
      { subjectId: 'ex-sub-7', minLevel: 'N/A', weightPercentage: 20 }, // Biologija
      { subjectId: 'ex-sub-6', minLevel: 'N/A', weightPercentage: 20 }  // Kemija
    ]
  },

  // Ekonomski fakultet (fac-3)
  {
    id: 'stud-4',
    facultyId: 'fac-3',
    name: 'Poslovna ekonomija',
    quota: 500,
    minPointsThreshold: 550,
    requiresMaturaMandatory: [
      { subjectId: 'ex-sub-1', minLevel: 'B', weightPercentage: 35 },
      { subjectId: 'ex-sub-2', minLevel: 'B', weightPercentage: 35 },
      { subjectId: 'ex-sub-3', minLevel: 'B', weightPercentage: 30 }
    ]
  },

  // FESB (fac-4)
  {
    id: 'stud-5',
    facultyId: 'fac-4',
    name: 'Računarstvo (Split)',
    quota: 120,
    minPointsThreshold: 680,
    requiresMaturaMandatory: [
      { subjectId: 'ex-sub-2', minLevel: 'A', weightPercentage: 40 },
      { subjectId: 'ex-sub-1', minLevel: 'B', weightPercentage: 20 },
      { subjectId: 'ex-sub-3', minLevel: 'B', weightPercentage: 15 },
      { subjectId: 'ex-sub-5', minLevel: 'N/A', weightPercentage: 25 } // Informatika
    ]
  }
];

export const DEADLINES: AppDeadline[] = [
  { id: 'dl-1', title: 'Prijava ispita državne mature', date: '2026-02-15', type: 'MATURA_REGISTRATION', description: 'Krajnji rok za prijavu i odjavu ispita državne mature te promjene razina u ljetnom roku.' },
  { id: 'dl-2', title: 'Verifikacija dokumenata (srednje škole)', date: '2026-07-05', type: 'VERIFICATION', description: 'Rok do kojeg razrednici moraju potvrditi i verificirati ocjene i dokumente učenika 8. razreda.' },
  { id: 'dl-3', title: 'Zaključavanje lista prioriteta (srednje)', date: '2026-07-10', type: 'SCHOOL_APPLICATIONS', description: 'Krajnji rok za unos i promjenu redoslijeda programa na listi želja za upis u srednju školu.' },
  { id: 'dl-4', title: 'Zaključavanje lista fakulteta', date: '2026-07-18', type: 'UNIVERSITY_APPLICATIONS', description: 'Zadnji trenutak za promjenu prioriteta studijskih programa na portalu Postani Student.' }
];

export const INITIAL_USERS: User[] = [
  { id: 'usr-admin', email: 'nikoladuric025@gmail.com', fullName: 'Nikola Đurić', role: 'SUPER_ADMIN', createdAt: '2026-07-11T08:59:00Z' },
  { id: 'usr-prim-admin', email: 'skola.prim@skole.hr', fullName: 'Ana Kovač (Ravnatelj OŠ)', role: 'PRIMARY_ADMIN', createdAt: '2026-07-11T08:59:00Z' },
  { id: 'usr-prim-teach', email: 'razrednik.prim@skole.hr', fullName: 'Marko Horvat (Razrednik 8.A)', role: 'PRIMARY_HOMEROOM_TEACHER', createdAt: '2026-07-11T08:59:00Z' },
  { id: 'usr-prim-stud', email: 'ucenik.prim@skole.hr', fullName: 'Luka Marić (Učenik 8.razred)', role: 'PRIMARY_STUDENT', createdAt: '2026-07-11T08:59:00Z' },
  { id: 'usr-sec-admin', email: 'skola.sec@skole.hr', fullName: 'Ivan Babić (Admin Gimnazije)', role: 'SECONDARY_ADMIN', createdAt: '2026-07-11T08:59:00Z' },
  { id: 'usr-sec-teach', email: 'razrednik.sec@skole.hr', fullName: 'Petra Novak (Razrednik 4.A)', role: 'SECONDARY_HOMEROOM_TEACHER', createdAt: '2026-07-11T08:59:00Z' },
  { id: 'usr-sec-stud', email: 'ucenik.sec@skole.hr', fullName: 'Ivan Jurić (Učenik 4.razred)', role: 'SECONDARY_STUDENT', createdAt: '2026-07-11T08:59:00Z' },
  { id: 'usr-uni-admin', email: 'fer@unizg.hr', fullName: 'Prof. dr. sc. Stjepan Car (Admin FER-a)', role: 'UNIVERSITY_ADMIN', createdAt: '2026-07-11T08:59:00Z' }
];
