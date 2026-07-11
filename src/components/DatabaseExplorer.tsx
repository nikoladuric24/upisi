/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import {
  Database,
  Terminal,
  Lock,
  Server,
  Download,
  Code,
  CheckCircle,
  Play,
  RefreshCw,
  Search,
  ChevronRight,
  AlertCircle,
  Table,
  Copy,
  Layers,
  DatabaseZap,
  Info
} from 'lucide-react';
import { getTable, logAuditEvent } from '../lib/storage';
import { User, School, Student, AuditLog, SchoolProgram } from '../types';

interface DatabaseExplorerProps {
  currentUser: User;
}

export function DatabaseExplorer({ currentUser }: DatabaseExplorerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'tables' | 'views' | 'functions' | 'rls' | 'console' | 'backup'>('tables');
  const [selectedTable, setSelectedTable] = useState<string>('users');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // Console state
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM active_students LIMIT 5;');
  const [queryResult, setQueryResult] = useState<any[] | null>(null);
  const [queryHeaders, setQueryHeaders] = useState<string[]>([]);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryMeta, setQueryMeta] = useState<{ rowsCount: number; executionTimeMs: number } | null>(null);

  // Backup state
  const [backupLogs, setBackupLogs] = useState<string[]>([
    'Sučelje za pohranu i backup je operativno.',
    'Sustav detektira primarni čvor: "db-hr-eduportal-01" (Zagreb).',
    'Replika u pripravnosti: "db-hr-eduportal-replica-01" (Split).',
    'Posljednji automatski inkrementalni backup izvršen: Danas u 09:10:04 (Trajanje: 3.2s, Veličina: 45.2 MB).'
  ]);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Table Schemas definitions
  const tableGroups = [
    {
      name: 'Organizacijska Struktura',
      tables: [
        { name: 'countries', desc: 'Registar država s ISO kodovima', cols: ['id (UUID, PK)', 'name (VARCHAR, Unique)', 'iso_code (CHAR, Unique)', 'is_active', 'created_at', 'updated_at'] },
        { name: 'counties', desc: 'Popis županija u Republici Hrvatskoj', cols: ['id (UUID, PK)', 'country_id (UUID, FK)', 'name (VARCHAR, Unique)', 'code (VARCHAR)', 'is_active', 'created_at', 'updated_at'] },
        { name: 'cities', desc: 'Gradovi i općine s poštanskim brojevima', cols: ['id (UUID, PK)', 'county_id (UUID, FK)', 'name (VARCHAR)', 'postal_code (VARCHAR)', 'is_active', 'created_at', 'updated_at'] },
        { name: 'institutions', desc: 'Centralna tablica za škole, fakultete i veleučilišta', cols: ['id (UUID, PK)', 'name (VARCHAR)', 'type (Enum)', 'oib (CHAR(11), Unique)', 'mzo_code (VARCHAR, Unique)', 'address', 'city_id (UUID, FK)', 'county_id (UUID, FK)', 'phone', 'email', 'website', 'principal_name', 'is_active', 'created_at'] },
        { name: 'school_years', desc: 'Školske godine s oznakom trenutne aktivne godine', cols: ['id (UUID, PK)', 'year (VARCHAR(20), Unique)', 'is_current (BOOLEAN)', 'is_active', 'created_at'] }
      ]
    },
    {
      name: 'Korisnici & RBAC',
      tables: [
        { name: 'users', desc: 'Svi korisnici sustava (učenici, profesori, administratori)', cols: ['id (UUID, PK)', 'email (VARCHAR, Unique)', 'password_hash (VARCHAR)', 'full_name', 'avatar_url', 'is_active', 'created_at', 'updated_at'] },
        { name: 'roles', desc: 'Definirane RBAC sigurnosne uloge', cols: ['id (UUID, PK)', 'name (VARCHAR, Unique)', 'description', 'is_active'] },
        { name: 'permissions', desc: 'Sve granularne dozvole unutar portala', cols: ['id (UUID, PK)', 'code (VARCHAR, Unique)', 'description', 'is_active'] },
        { name: 'role_permissions', desc: 'Povezna tablica uloga i pripadajućih dozvola', cols: ['role_id (UUID, FK)', 'permission_id (UUID, FK)'] },
        { name: 'user_roles', desc: 'Dodijeljene uloge korisnicima', cols: ['user_id (UUID, FK)', 'role_id (UUID, FK)'] },
        { name: 'user_permissions', desc: 'Iznimne granularne dozvole izravno na korisnika', cols: ['user_id (UUID, FK)', 'permission_id (UUID, FK)', 'is_granted (BOOLEAN)'] },
        { name: 'sessions', desc: 'Aktivne korisničke sesije', cols: ['id (UUID, PK)', 'user_id (UUID, FK)', 'token (Unique)', 'ip_address', 'expires_at'] },
        { name: 'login_history', desc: 'Povijest prijava na portal s IP i User Agentom', cols: ['id (UUID, PK)', 'user_id (UUID, FK)', 'ip_address', 'status', 'failure_reason', 'created_at'] }
      ]
    },
    {
      name: 'Nastavnici & Učenici',
      tables: [
        { name: 'teachers', desc: 'Podaci o nastavnicima i njihovim školama', cols: ['id (UUID, PK)', 'user_id (UUID, FK, Unique)', 'institution_id (UUID, FK)', 'oib (CHAR(11), Unique)', 'is_active'] },
        { name: 'students', desc: 'Osnovni podaci o učenicima', cols: ['id (UUID, PK)', 'user_id (UUID, FK, Unique)', 'school_id (UUID, FK)', 'class_id (UUID, FK)', 'oib (CHAR(11), Unique)', 'date_of_birth (DATE)', 'is_active'] },
        { name: 'student_profiles', desc: 'Akademski profil učenika (ocjene iz OŠ, bodovi s natjecanja)', cols: ['id (UUID, PK)', 'student_id (UUID, FK, Unique)', 'grade_average_5 (NUMERIC)', 'grade_average_6 (NUMERIC)', 'grade_average_7 (NUMERIC)', 'grade_average_8 (NUMERIC)', 'competitions_points', 'additional_points', 'health_conditions'] },
        { name: 'classes', desc: 'Razredni odjeli u školama po školskoj godini', cols: ['id (UUID, PK)', 'school_id (UUID, FK)', 'school_year_id (UUID, FK)', 'homeroom_teacher_id (UUID, FK)', 'name (VARCHAR)', 'grade_level (INT)'] },
        { name: 'subjects', desc: 'Nastavni predmeti u sustavu', cols: ['id (UUID, PK)', 'name (VARCHAR, Unique)', 'is_elective (BOOLEAN)'] },
        { name: 'class_subjects', desc: 'Dodijeljeni predmeti razredima s pripadajućim profesorom', cols: ['id (UUID, PK)', 'class_id (UUID, FK)', 'subject_id (UUID, FK)', 'teacher_id (UUID, FK)', 'is_active'] }
      ]
    },
    {
      name: 'Ocjene & Matura',
      tables: [
        { name: 'grades', desc: 'Sve upisane tekuće ocjene učenika', cols: ['id (UUID, PK)', 'student_id (UUID, FK)', 'class_subject_id (UUID, FK)', 'grade_value (INT)', 'note (TEXT)', 'grade_date (DATE)'] },
        { name: 'grade_history', desc: 'Sigurnosna povijest izmjene ocjena', cols: ['id (UUID, PK)', 'grade_id (UUID)', 'old_value (INT)', 'new_value (INT)', 'changed_by (UUID, FK)', 'change_reason'] },
        { name: 'final_grades', desc: 'Zaključne ocjene na kraju školske godine', cols: ['id (UUID, PK)', 'student_id (UUID, FK)', 'class_subject_id (UUID, FK)', 'grade_value (INT)', 'is_locked (BOOLEAN)'] },
        { name: 'exam_subjects', desc: 'Predmeti na državnoj maturi', cols: ['id (UUID, PK)', 'name (VARCHAR, Unique)', 'is_elective (BOOLEAN)'] },
        { name: 'exam_periods', desc: 'Ispitni rokovi državne mature', cols: ['id (UUID, PK)', 'name', 'school_year_id (UUID, FK)', 'registration_start', 'registration_end'] },
        { name: 'exam_registrations', desc: 'Prijave učenika za ispite državne mature', cols: ['id (UUID, PK)', 'student_id (UUID, FK)', 'exam_subject_id (UUID, FK)', 'exam_period_id (UUID, FK)', 'level (CHAR(1))', 'status'] },
        { name: 'exam_results', desc: 'Rezultati ispita državne mature s postocima i ocjenama', cols: ['id (UUID, PK)', 'registration_id (UUID, FK, Unique)', 'percentage (NUMERIC)', 'grade (INT)', 'points (NUMERIC)'] }
      ]
    },
    {
      name: 'Upisni Moduli (Srednje & Faks)',
      tables: [
        { name: 'school_programs', desc: 'Smjerovi / programi u srednjim školama', cols: ['id (UUID, PK)', 'school_id (UUID, FK)', 'name', 'quota (INT)', 'min_points_threshold', 'subjects_required (Array)'] },
        { name: 'school_applications', desc: 'Glavni upisni karton učenika za srednje škole', cols: ['id (UUID, PK)', 'student_id (UUID, FK, Unique)', 'school_year_id (UUID, FK)', 'status (WorkflowState)'] },
        { name: 'school_application_choices', desc: 'Odabrani srednjoškolski programi s prioritetima', cols: ['id (UUID, PK)', 'application_id (UUID, FK)', 'school_program_id (UUID, FK)', 'priority_order (INT)', 'calculated_points'] },
        { name: 'universities', desc: 'Sveučilišta u Hrvatskoj', cols: ['id (UUID, PK)', 'name (Unique)', 'city_id (UUID, FK)'] },
        { name: 'faculties', desc: 'Fakulteti i visoke škole unutar sveučilišta', cols: ['id (UUID, PK)', 'university_id (UUID, FK)', 'name', 'oib (Unique)', 'mzo_code (Unique)', 'address'] },
        { name: 'study_programs', desc: 'Studijski programi na fakultetima s ponderima mature', cols: ['id (UUID, PK)', 'faculty_id (UUID, FK)', 'name', 'quota (INT)', 'matura_matematika_weight', 'matura_hrvatski_weight', 'high_school_grades_weight'] },
        { name: 'university_applications', desc: 'Glavni upisni karton za visoko obrazovanje', cols: ['id (UUID, PK)', 'student_id (UUID, FK, Unique)', 'school_year_id (UUID, FK)', 'status (WorkflowState)'] },
        { name: 'university_application_choices', desc: 'Odabrani studijski programi na prioritetnoj listi', cols: ['id (UUID, PK)', 'application_id (UUID, FK)', 'study_program_id (UUID, FK)', 'priority_order (INT)', 'calculated_points'] }
      ]
    }
  ];

  // SQL Views definitions
  const sqlViews = [
    {
      name: 'active_students',
      desc: 'Objedinjuje osnovne podatke o učenicima, njihovim matičnim školama, razredima i akademskim prosjecima iz student_profiles za brzo pretraživanje.',
      sql: `CREATE OR REPLACE VIEW active_students AS
SELECT 
  s.id AS student_id,
  u.full_name,
  u.email,
  s.oib,
  s.date_of_birth,
  inst.name AS school_name,
  cl.name AS class_name,
  sp.grade_average_5,
  sp.grade_average_6,
  sp.grade_average_7,
  sp.grade_average_8
FROM students s
JOIN users u ON s.user_id = u.id
JOIN institutions inst ON s.school_id = inst.id
LEFT JOIN classes cl ON s.class_id = cl.id
LEFT JOIN student_profiles sp ON s.id = sp.student_id
WHERE s.deleted_at IS NULL AND s.is_active = true;`
    },
    {
      name: 'student_scores',
      desc: 'Vrši automatsku kalkulaciju bodova za upis u srednje škole na temelju standardne državne formule (zbroj prosjeka ocjena od 5. do 8. razreda pomnožen s 4, plus bodovi s državnih natjecanja i socijalne zasluge).',
      sql: `CREATE OR REPLACE VIEW student_scores AS
SELECT 
  s.id AS student_id,
  u.full_name,
  COALESCE(sp.grade_average_5, 0) + 
  COALESCE(sp.grade_average_6, 0) + 
  COALESCE(sp.grade_average_7, 0) + 
  COALESCE(sp.grade_average_8, 0) AS school_grades_sum,
  sp.competitions_points,
  sp.additional_points,
  -- Ukupni izračunati upisni bodovi
  (COALESCE(sp.grade_average_5, 0) + 
   COALESCE(sp.grade_average_6, 0) + 
   COALESCE(sp.grade_average_7, 0) + 
   COALESCE(sp.grade_average_8, 0)) * 4.0 + 
   COALESCE(sp.competitions_points, 0) + 
   COALESCE(sp.additional_points, 0) AS total_points
FROM students s
JOIN users u ON s.user_id = u.id
JOIN student_profiles sp ON s.id = sp.student_id
WHERE s.deleted_at IS NULL;`
    },
    {
      name: 'faculty_rankings',
      desc: 'Glavni motor za formiranje državnih rang-lista za visoko obrazovanje. Koristi analitičku funkciju ROW_NUMBER() za particioniranje prijava po studijskim programima i sortira ih opadajuće prema izračunatim bodovima mature, dodjeljujući status plasmana unutar upisne kvote.',
      sql: `CREATE OR REPLACE VIEW faculty_rankings AS
SELECT 
  uac.id AS choice_id,
  uac.application_id,
  uac.study_program_id,
  sp.name AS study_program_name,
  fac.name AS faculty_name,
  stud.id AS student_id,
  usr.full_name AS student_name,
  uac.priority_order,
  uac.calculated_points,
  ROW_NUMBER() OVER(
    PARTITION BY uac.study_program_id 
    ORDER BY uac.calculated_points DESC, uac.created_at ASC
  ) AS current_rank,
  sp.quota,
  CASE 
    WHEN ROW_NUMBER() OVER(PARTITION BY uac.study_program_id ORDER BY uac.calculated_points DESC, uac.created_at ASC) <= sp.quota
    THEN 'UNUTAR_KVOTE'
    ELSE 'ISPOD_KVOTE'
  END AS placement_status
FROM university_application_choices uac
JOIN study_programs sp ON uac.study_program_id = sp.id
JOIN faculties fac ON sp.faculty_id = fac.id
JOIN university_applications ua ON uac.application_id = ua.id
JOIN students stud ON ua.student_id = stud.id
JOIN users usr ON stud.user_id = usr.id
WHERE uac.deleted_at IS NULL;`
    }
  ];

  // SQL Stored Procedures / Functions
  const sqlFunctions = [
    {
      name: 'calculate_university_points',
      desc: 'PL/pgSQL funkcija za automatsko preračunavanje bodova za upis na visoko učilište. Čita ponderaciju bodova određenog studijskog programa (npr. FER: 40% ocjene, 40% matematika, 20% hrvatski) i primjenjuje je na učenikove rezultate državne mature i srednjoškolski prosjek.',
      code: `CREATE OR REPLACE FUNCTION calculate_university_points(student_uuid UUID, program_uuid UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_points NUMERIC(6,2) := 0.00;
  v_grade_avg_pts NUMERIC(6,2) := 0.00;
  v_matura_pts NUMERIC(6,2) := 0.00;
  
  -- Konfiguracije programa
  v_hrv_w NUMERIC(4,2);
  v_mat_w NUMERIC(4,2);
  v_eng_w NUMERIC(4,2);
  v_ele_w NUMERIC(4,2);
  v_ele_sub_id UUID;
  v_grades_w NUMERIC(4,2);
  
  -- Rezultati mature studenta
  v_res_hrv NUMERIC(5,2);
  v_res_mat NUMERIC(5,2);
  v_res_eng NUMERIC(5,2);
  v_res_ele NUMERIC(5,2);
  v_profile_avg NUMERIC(3,2);
BEGIN
  -- 1. Učitaj ponderiranje
  SELECT 
    matura_hrvatski_weight, matura_matematika_weight, matura_engleski_weight, 
    matura_elective_weight, matura_elective_subject_id, high_school_grades_weight
  INTO 
    v_hrv_w, v_mat_w, v_eng_w, v_ele_w, v_ele_sub_id, v_grades_w
  FROM study_programs 
  WHERE id = program_uuid;

  -- 2. Dohvati prosjek ocjena
  SELECT (COALESCE(grade_average_5,0) + COALESCE(grade_average_6,0) + COALESCE(grade_average_7,0) + COALESCE(grade_average_8,0)) / 4.0
  INTO v_profile_avg
  FROM student_profiles
  WHERE student_id = student_uuid;
  
  v_grade_avg_pts := COALESCE(v_profile_avg, 3.5) * 20.0 * (v_grades_w / 100.0);

  -- 3. Dohvati rezultate državne mature
  -- Hrvatski
  SELECT COALESCE(er.percentage, 0.00) INTO v_res_hrv
  FROM exam_results er
  JOIN exam_registrations reg ON er.registration_id = reg.id
  WHERE reg.student_id = student_uuid AND reg.exam_subject_id = 'ex-sub-1'::UUID AND reg.status = 'REGISTERED';
  
  -- Matematika
  SELECT COALESCE(er.percentage, 0.00) INTO v_res_mat
  FROM exam_results er
  JOIN exam_registrations reg ON er.registration_id = reg.id
  WHERE reg.student_id = student_uuid AND reg.exam_subject_id = 'ex-sub-2'::UUID AND reg.status = 'REGISTERED';

  -- Engleski (Strani jezik)
  SELECT COALESCE(er.percentage, 0.00) INTO v_res_eng
  FROM exam_results er
  JOIN exam_registrations reg ON er.registration_id = reg.id
  WHERE reg.student_id = student_uuid AND reg.exam_subject_id = 'ex-sub-3'::UUID AND reg.status = 'REGISTERED';

  -- Izborni
  IF v_ele_sub_id IS NOT NULL THEN
    SELECT COALESCE(er.percentage, 0.00) INTO v_res_ele
    FROM exam_results er
    JOIN exam_registrations reg ON er.registration_id = reg.id
    WHERE reg.student_id = student_uuid AND reg.exam_subject_id = v_ele_sub_id AND reg.status = 'REGISTERED';
  END IF;

  -- 4. Zbroji sve bodove (ponderirano na bazi od 1000 max bodova)
  v_matura_pts := (v_res_hrv * 10.0 * (v_hrv_w / 100.0)) +
                  (v_res_mat * 10.0 * (v_mat_w / 100.0)) +
                  (v_res_eng * 10.0 * (v_eng_w / 100.0)) +
                  (COALESCE(v_res_ele, 0.00) * 10.0 * (v_ele_w / 100.0));

  v_points := v_grade_avg_pts + v_matura_pts;
  
  RETURN ROUND(v_points, 2);
END;
$$ LANGUAGE plpgsql;`
    },
    {
      name: 'archive_current_school_year',
      desc: 'PL/pgSQL procedura za arhiviranje školske godine. Isključuje is_current zastavicu trenutne školske godine, postavlja sve upisne kartone srednjih škola i fakulteta u is_active = false i bilježi unos u audit_logs.',
      code: `CREATE OR REPLACE PROCEDURE archive_current_school_year()
AS $$
DECLARE
  v_current_year_id UUID;
BEGIN
  -- Pronađi trenutnu godinu
  SELECT id INTO v_current_year_id FROM school_years WHERE is_current = true;
  
  IF v_current_year_id IS NOT NULL THEN
    UPDATE school_years SET is_current = false WHERE id = v_current_year_id;
    
    -- Arhiviraj stare prijave škola i fakuleteta
    UPDATE school_applications SET is_active = false WHERE school_year_id = v_current_year_id;
    UPDATE university_applications SET is_active = false WHERE school_year_id = v_current_year_id;

    -- Logiraj arhivu
    INSERT INTO audit_logs (action, details, table_name)
    VALUES ('ARHIVIRANJE_GODINE', 'Arhiviranje školske godine i zaključavanje prijava.', 'school_years');
  END IF;
END;
$$ LANGUAGE plpgsql;`
    }
  ];

  // RLS (Row Level Security) policies
  const rlsPolicies = [
    {
      role: 'SUPER_ADMIN',
      desc: 'Potpuna kontrola i čitanje/pisanje nad svim tablicama unutar cijele baze podataka (vidi sve županije, korisnike, škole, ocjene).',
      sql: `CREATE POLICY super_admin_all_users ON users 
  FOR ALL TO authenticated
  USING (auth.uid() IN (
    SELECT u.id FROM users u 
    JOIN user_roles ur ON u.id = ur.user_id 
    JOIN roles r ON ur.role_id = r.id 
    WHERE r.name = 'SUPER_ADMIN'
  ));`
    },
    {
      role: 'ŠKOLSKI ADMINISTRATOR',
      desc: 'Može čitati i mijenjati podatke isključivo za učenike, razrede i smjerove koji su vezani uz njegovu školsku ustanovu (MZO šifru).',
      sql: `CREATE POLICY school_admin_view_students ON students
  FOR ALL TO authenticated
  USING (school_id IN (
    SELECT institution_id FROM teachers WHERE user_id = auth.uid()
  ));`
    },
    {
      role: 'RAZREDNIK',
      desc: 'Omogućava razrednicima pravo unosa i zaključavanja ocjena te izmjenu profila isključivo za studente koji se nalaze u njihovom razrednom odjelu.',
      sql: `CREATE POLICY teacher_view_class_grades ON grades
  FOR ALL TO authenticated
  USING (student_id IN (
    SELECT s.id FROM students s
    JOIN classes c ON s.class_id = c.id
    JOIN teachers t ON c.homeroom_teacher_id = t.id
    WHERE t.user_id = auth.uid()
  ));`
    },
    {
      role: 'UČENIK',
      desc: 'Strogo ograničava pravo pristupa na bazi pojedinačnog reda tako da učenici mogu vidjeti isključivo vlastite podatke, tekuće ocjene, prijave ispita mature i vlastitu rang-listu.',
      sql: `CREATE POLICY student_view_own_grades ON grades
  FOR SELECT TO authenticated
  USING (student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  ));`
    }
  ];

  // Simulated Query Engine
  const queryTemplates = [
    { label: 'Učitaj aktivne učenike (View: active_students)', query: 'SELECT * FROM active_students LIMIT 5;' },
    { label: 'Izračunaj bodove za upise (View: student_scores)', query: 'SELECT * FROM student_scores ORDER BY total_points DESC;' },
    { label: 'Trenutne rang liste po kvotama (View: faculty_rankings)', query: 'SELECT * FROM faculty_rankings LIMIT 5;' },
    { label: 'Nedavni sigurnosni audit zapisi (Table: audit_logs)', query: 'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5;' },
    { label: 'PL/pgSQL: calculate_university_points()', query: "SELECT calculate_university_points('stud-1', 'prog-1') AS fer_points;" }
  ];

  const handleRunQuery = () => {
    setIsExecuting(true);
    setQueryError(null);
    setQueryResult(null);

    setTimeout(() => {
      try {
        const queryLower = sqlQuery.toLowerCase().trim();

        if (queryLower.includes('active_students')) {
          const students = getTable<Student>('students');
          const users = getTable<User>('users');
          const schools = getTable<School>('schools');

          const merged = students.map(s => {
            const u = users.find(usr => usr.id === s.userId);
            const sch = schools.find(sc => sc.id === s.schoolId);
            return {
              student_id: s.id.slice(0, 8) + '...',
              full_name: u?.fullName || 'Nepoznat',
              email: u?.email || 'N/A',
              oib: s.oib,
              school_name: sch?.name || 'N/A',
              grade_average: ((s.gradeAverage5 + s.gradeAverage6 + s.gradeAverage7 + s.gradeAverage8) / 4).toFixed(2),
              is_active: 'Aktivni upis'
            };
          });

          setQueryHeaders(['student_id', 'full_name', 'email', 'oib', 'school_name', 'grade_average', 'is_active']);
          setQueryResult(merged);
          setQueryMeta({ rowsCount: merged.length, executionTimeMs: 4 });
          logAuditEvent(currentUser.id, currentUser.email, 'SQL_QUERY_EXEC', 'Upit nad active_students view-om');
        } 
        else if (queryLower.includes('student_scores')) {
          const students = getTable<Student>('students');
          const users = getTable<User>('users');

          const scores = students.map(s => {
            const u = users.find(usr => usr.id === s.userId);
            const sumAverage = s.gradeAverage5 + s.gradeAverage6 + s.gradeAverage7 + s.gradeAverage8;
            const points = (sumAverage * 4.0) + s.competitionsPoints + s.additionalPoints;
            return {
              student_name: u?.fullName || 'Učenik',
              grades_sum: sumAverage.toFixed(2),
              competitions: s.competitionsPoints + ' b',
              extra_points: s.additionalPoints + ' b',
              total_points: points.toFixed(2) + ' b'
            };
          }).sort((a,b) => parseFloat(b.total_points) - parseFloat(a.total_points));

          setQueryHeaders(['student_name', 'grades_sum', 'competitions', 'extra_points', 'total_points']);
          setQueryResult(scores);
          setQueryMeta({ rowsCount: scores.length, executionTimeMs: 6 });
          logAuditEvent(currentUser.id, currentUser.email, 'SQL_QUERY_EXEC', 'Upit nad student_scores view-om');
        } 
        else if (queryLower.includes('faculty_rankings')) {
          const choices = getTable<any>('university_application_choices') || [];
          const progs = getTable<SchoolProgram>('school_programs') || []; // fallback to represent study programs
          
          const rankings = choices.map((c, idx) => {
            return {
              choice_id: c.id.slice(0, 8),
              study_program: c.studyProgramId || 'Računarstvo (FER)',
              student_name: c.studentName || 'Ivan Horvat',
              priority: c.priority || 1,
              calculated_points: c.calculatedPoints || '824.50 b',
              rank: idx + 1,
              quota: 120,
              placement: (idx + 1) <= 120 ? 'UNUTAR_KVOTE' : 'ISPOD_KVOTE'
            };
          });

          // mock data fallback if empty
          if (rankings.length === 0) {
            rankings.push(
              { choice_id: '8a2b1c4d', study_program: 'Sveučilišni studij računarstva (FER)', student_name: 'Ivan Horvat', priority: 1, calculated_points: '942.50 b', rank: 1, quota: 120, placement: 'UNUTAR_KVOTE' },
              { choice_id: '3f1c9d8a', study_program: 'Sveučilišni studij računarstva (FER)', student_name: 'Lucija Matić', priority: 1, calculated_points: '912.00 b', rank: 2, quota: 120, placement: 'UNUTAR_KVOTE' },
              { choice_id: '9e8d7c6b', study_program: 'Sveučilišni studij računarstva (FER)', student_name: 'Marko Jurić', priority: 2, calculated_points: '885.20 b', rank: 3, quota: 120, placement: 'UNUTAR_KVOTE' }
            );
          }

          setQueryHeaders(['choice_id', 'study_program', 'student_name', 'priority', 'calculated_points', 'rank', 'quota', 'placement']);
          setQueryResult(rankings);
          setQueryMeta({ rowsCount: rankings.length, executionTimeMs: 5 });
        } 
        else if (queryLower.includes('audit_logs')) {
          const logs = getTable<AuditLog>('audit_logs').slice(0, 5);
          const mappedLogs = logs.map(l => ({
            id: l.id.slice(0, 8) + '...',
            action: l.action,
            user_email: l.userEmail,
            details: l.details,
            created_at: new Date(l.createdAt).toLocaleTimeString('hr-HR')
          }));

          setQueryHeaders(['id', 'action', 'user_email', 'details', 'created_at']);
          setQueryResult(mappedLogs);
          setQueryMeta({ rowsCount: mappedLogs.length, executionTimeMs: 3 });
        } 
        else if (queryLower.includes('calculate_university_points')) {
          const result = [
            { fer_points: '924.50' }
          ];
          setQueryHeaders(['fer_points']);
          setQueryResult(result);
          setQueryMeta({ rowsCount: 1, executionTimeMs: 12 });
        } 
        else {
          throw new Error('Sintaktička greška u blizini "SELECT": Navedena tablica ili pogled ne postoji u aktivnom Postgres katalogu sheme. Molimo odaberite jedan od predefiniranih SQL upita iz predložaka.');
        }
      } catch (err: any) {
        setQueryError(err?.message || 'Greška u izvršavanju SQL upita.');
      } finally {
        setIsExecuting(false);
      }
    }, 600);
  };

  // Manual Backup trigger
  const handleTriggerBackup = () => {
    setIsBackingUp(true);
    setBackupLogs(prev => [...prev, `[Sustav] ${new Date().toLocaleTimeString('hr-HR')} - Pokrećem ručni pg_dump baze podataka...`]);
    
    setTimeout(() => {
      setBackupLogs(prev => [
        ...prev,
        `[Sustav] ${new Date().toLocaleTimeString('hr-HR')} - Privremena kopija generirana za 42 tablice.`,
        `[Sustav] ${new Date().toLocaleTimeString('hr-HR')} - Kompresija GZIP završena (Omjer: 84%).`,
        `[Sustav] ${new Date().toLocaleTimeString('hr-HR')} - Backup datoteka "eduportal_supabase_backup_${new Date().toISOString().slice(0, 10)}.sql.gz" (46.8 MB) uspješno spremljena u Cloud Storage.`
      ]);
      setIsBackingUp(false);
      logAuditEvent(currentUser.id, currentUser.email, 'DB_BACKUP_GEN', 'Pokrenut ručni backup PostgreSQL baze podataka.');
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            PostgreSQL & Supabase (3NF Baza Podataka)
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">
            Upravljanje cjelokupnom relacijskom bazom podataka. Sve tablice koriste UUIDv4 ključeve i RLS zaštitu.
          </p>
        </div>

        <a
          href="data:text/plain;charset=utf-8,--- preuzmite SQL datoteku"
          download="eduportal_schema.sql"
          onClick={(e) => {
            // Read sql code mock or actual file trigger
            e.preventDefault();
            const sqlContent = `-- EduPortal Hrvatska Schema --\n\n` + sqlViews.map(v => v.sql).join('\n\n') + `\n\n` + sqlFunctions.map(f => f.code).join('\n\n');
            const element = document.createElement("a");
            const file = new Blob([sqlContent], {type: 'text/plain'});
            element.href = URL.createObjectURL(file);
            element.download = "eduportal_schema.sql";
            document.body.appendChild(element);
            element.click();
            logAuditEvent(currentUser.id, currentUser.email, 'DOWNLOAD_SCHEMA_SQL', 'Preuzet cjelokupni PostgreSQL shema SQL skript');
          }}
          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
        >
          <Download className="h-3.5 w-3.5" /> Preuzmi cjelokupni SQL sheme (.sql)
        </a>
      </div>

      {/* Database Navigation Grid */}
      <div className="flex gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-3 overflow-x-auto">
        {[
          { id: 'tables', label: 'Tablice i Rječnik (3NF)', icon: Table },
          { id: 'views', label: 'SQL View-ovi', icon: Layers },
          { id: 'functions', label: 'PL/pgSQL Funkcije', icon: Code },
          { id: 'rls', label: 'Row-Level Security (RLS)', icon: Lock },
          { id: 'console', label: 'Interaktivna SQL Konzola', icon: Terminal },
          { id: 'backup', label: 'Backup & Backup kopije', icon: Server }
        ].map(sub => {
          const Icon = sub.icon;
          return (
            <button
              key={sub.id}
              onClick={() => setActiveSubTab(sub.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === sub.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {sub.label}
            </button>
          );
        })}
      </div>

      {/* Subtab Contents */}

      {/* 1. TABLES SUBTAB */}
      {activeSubTab === 'tables' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Sidebar table selection list */}
          <div className="md:col-span-4 space-y-4 max-h-[500px] overflow-y-auto pr-1">
            <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Struktura Relacija</span>
            {tableGroups.map(group => (
              <div key={group.name} className="space-y-1 bg-slate-50/40 dark:bg-slate-800/10 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{group.name}</span>
                <div className="space-y-1 mt-1">
                  {group.tables.map(t => (
                    <button
                      key={t.name}
                      onClick={() => setSelectedTable(t.name)}
                      className={`w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                        selectedTable === t.name
                          ? 'bg-white dark:bg-slate-800 shadow-xs text-indigo-600 dark:text-indigo-300 font-semibold border-l-2 border-indigo-600'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <span className="truncate">{t.name}</span>
                      <ChevronRight className="h-3 w-3 opacity-60" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Dictionary and Table structure view */}
          <div className="md:col-span-8 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-4">
            {(() => {
              const allTables = tableGroups.flatMap(g => g.tables);
              const table = allTables.find(t => t.name === selectedTable) || allTables[0];
              return (
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Table className="h-4 w-4 text-indigo-600" />
                        Tablica: <span className="font-mono text-indigo-600 dark:text-indigo-400">{table.name}</span>
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        {table.desc}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">UUID PK</span>
                  </div>

                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                    <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2.5">Stupci & Ograničenja (Constraints)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      {table.cols.map(c => (
                        <div key={c} className="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800/30">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          <span className="text-slate-700 dark:text-slate-300 text-[11px] truncate">{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 text-yellow-700 dark:text-yellow-400 font-bold">
                      <Info className="h-4 w-4" />
                      Standardni Metapodaci Revizije
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Sukladno specifikaciji, ova tablica sadrži obavezne revizijske i životne atribute: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">id (UUID)</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">created_at</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">updated_at</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">deleted_at (Soft Delete)</code>, te <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">is_active</code>.
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 2. VIEWS SUBTAB */}
      {activeSubTab === 'views' && (
        <div className="space-y-6">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            PostgreSQL View-ovi omogućavaju visoku učinkovitost enkapsulirajući složene JOIN upite i analitičke funkcije za generiranje rang-lista i statističkih prikaza.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {sqlViews.map(view => (
              <div key={view.name} className="p-5 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 uppercase tracking-wider font-mono">VIEW</span>
                  <h4 className="font-black text-sm text-slate-800 dark:text-slate-100 font-mono">{view.name}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    {view.desc}
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="bg-slate-900 text-slate-100 p-3 rounded-xl text-[10px] font-mono max-h-[140px] overflow-y-auto relative border border-slate-800">
                    <button
                      onClick={() => handleCopy(view.sql, view.name)}
                      className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
                      title="Kopiraj SQL"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <pre className="whitespace-pre">{view.sql}</pre>
                  </div>

                  <button
                    onClick={() => {
                      setActiveSubTab('console');
                      setSqlQuery(`SELECT * FROM ${view.name} LIMIT 5;`);
                    }}
                    className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Play className="h-3 w-3" /> Testiraj u SQL Konzoli
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. FUNCTIONS SUBTAB */}
      {activeSubTab === 'functions' && (
        <div className="space-y-6">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Složeni poslovni algoritmi i workflow stanja obrađuju se izravno na PostgreSQL bazi podataka u PL/pgSQL jeziku kako bi se očuvala brzina, sigurnost i atomska točnost podataka.
          </p>

          <div className="space-y-6">
            {sqlFunctions.map(func => (
              <div key={func.name} className="p-6 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <span className="px-2 py-0.5 rounded-sm text-[9px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-mono">PL/pgSQL FUNKCIJA</span>
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 font-mono flex items-center gap-1.5">
                      <Code className="h-4 w-4 text-amber-500" />
                      {func.name}()
                    </h4>
                  </div>
                  <button
                    onClick={() => handleCopy(func.code, func.name)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" /> {copiedText === func.name ? 'Kopirano!' : 'Kopiraj kod'}
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  {func.desc}
                </p>

                <div className="bg-slate-900 text-slate-100 p-4 rounded-xl text-[10px] font-mono max-h-[250px] overflow-y-auto border border-slate-800">
                  <pre className="whitespace-pre-wrap">{func.code}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. RLS POLICIES SUBTAB */}
      {activeSubTab === 'rls' && (
        <div className="space-y-6">
          <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-start gap-3">
            <Lock className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Row Level Security (RLS) je uključen na svim tablicama s osobnim podacima</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Supabase integracija koristi postgreSQL pravila sigurnosti na razini pojedinačnog retka. Svaki selekt upit je izoliran na bazi autoriziranog tokena prijavljenog korisnika.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rlsPolicies.map(policy => (
              <div key={policy.role} className="p-5 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider">Pravilo za: {policy.role}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    {policy.desc}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="bg-slate-900 text-slate-100 p-3 rounded-xl text-[10px] font-mono max-h-[140px] overflow-y-auto relative border border-slate-800">
                    <button
                      onClick={() => handleCopy(policy.sql, policy.role)}
                      className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
                      title="Kopiraj SQL"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <pre className="whitespace-pre">{policy.sql}</pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. SQL CONSOLE SUBTAB */}
      {activeSubTab === 'console' && (
        <div className="space-y-6">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Simulirano razvojno okruženje za provjeru SQL upita i views-a nad testnim skupom podataka EduPortala. Odaberite predefinirani upit ili isprobajte SQL.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Template selector */}
            <div className="lg:col-span-4 space-y-3">
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Predlošci Upita</span>
              <div className="space-y-2">
                {queryTemplates.map(t => (
                  <button
                    key={t.label}
                    onClick={() => {
                      setSqlQuery(t.query);
                      setQueryResult(null);
                      setQueryError(null);
                    }}
                    className={`w-full text-left p-3 rounded-xl text-[11px] font-semibold transition-all border ${
                      sqlQuery === t.query
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-slate-800 dark:border-slate-700 dark:text-indigo-300'
                        : 'bg-white border-slate-100 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Terminal console */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
                {/* Console header */}
                <div className="flex justify-between items-center bg-slate-950 px-4 py-2 border-b border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Terminal className="h-4 w-4 text-indigo-400" />
                    <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-slate-400">PostgreSQL (Supabase) Terminal</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  </div>
                </div>

                {/* Console editor */}
                <div className="p-4 bg-slate-950 font-mono text-xs">
                  <textarea
                    value={sqlQuery}
                    onChange={e => setSqlQuery(e.target.value)}
                    className="w-full h-24 bg-transparent text-slate-100 focus:outline-hidden resize-none leading-relaxed"
                    spellCheck="false"
                  />
                </div>

                {/* Console execution footer */}
                <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-800 flex justify-between items-center">
                  <span className="text-[9px] font-mono text-slate-500">Database node: main-replica-01</span>
                  <button
                    onClick={handleRunQuery}
                    disabled={isExecuting || !sqlQuery.trim()}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {isExecuting ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Izvršavam...
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" /> Pokreni Upit (F5)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Output log */}
              <div className="space-y-2">
                {queryError && (
                  <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl text-xs flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <span className="text-rose-700 dark:text-rose-400 font-mono text-[11px] leading-relaxed">{queryError}</span>
                  </div>
                )}

                {queryResult && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 font-mono">
                      <span>Uspjeh: Upit vraćen ({queryMeta?.rowsCount} redaka)</span>
                      <span>Vrijeme izvršenja: {queryMeta?.executionTimeMs}ms</span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/40 text-[10px] uppercase font-black text-slate-500 border-b border-slate-200/50 dark:border-slate-800">
                            {queryHeaders.map(h => (
                              <th key={h} className="p-3 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                          {queryResult.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-[11px]">
                              {queryHeaders.map(h => (
                                <td key={h} className="p-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{row[h] !== undefined ? String(row[h]) : 'NULL'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. BACKUP SUBTAB */}
      {activeSubTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Sizing calculations and metadata */}
          <div className="md:col-span-4 space-y-6">
            <div className="p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-4">
              <h4 className="font-bold text-xs text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <DatabaseZap className="h-4 w-4" />
                Sustavna Skalabilnost (3NF)
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Prilagođeno za visoku propusnost i milijune zapisa zahvaljujući normalizaciji i strateškom indeksiranju stranih ključeva.
              </p>

              <div className="space-y-3 pt-2 text-[11px] text-slate-600 dark:text-slate-400">
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <span>Projektirani kapacitet:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">100.000+ Korisnika</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <span>Planirani zapisi (ocjene):</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">10M+ redaka</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <span>Prosječno vrijeme odziva:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">&lt; 15ms</span>
                </div>
              </div>
            </div>

            <div className="p-5 bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-2">
              <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300">Pravila arhiviranja</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Prilikom svake arhive školske godine, transakcijska tablica <code className="font-mono bg-slate-100 dark:bg-slate-800 text-[9px] px-1 rounded">school_applications</code> se zaključava, a status prelazi u <code className="font-mono text-[9px]">LOCKED</code> ili <code className="font-mono text-[9px]">COMPLETED</code>. Povijesni podaci se čuvaju u tablicama s is_active = false i ne utječu na rad tekuće godine.
              </p>
            </div>
          </div>

          {/* Backup logs and manuals */}
          <div className="md:col-span-8 bg-slate-50/30 dark:bg-slate-800/10 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">Dnevnici baze podataka i sigurnosni backupi</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Automatsko generiranje snimaka baze za povratak u slučaju nepredviđenih grešaka.</p>
              </div>

              <button
                onClick={handleTriggerBackup}
                disabled={isBackingUp}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isBackingUp ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Izvršavam backup...
                  </>
                ) : (
                  <>
                    <Server className="h-3.5 w-3.5" /> Pokreni Ručni Backup
                  </>
                )}
              </button>
            </div>

            {/* Output log console */}
            <div className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-[10px] space-y-1.5 h-[230px] overflow-y-auto border border-slate-800">
              {backupLogs.map((log, idx) => (
                <div key={idx} className={`${log.includes('[GREŠKA]') ? 'text-red-400' : log.includes('Backup') ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
