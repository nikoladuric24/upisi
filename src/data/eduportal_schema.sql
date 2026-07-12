-- =============================================================================
-- EduPortal Hrvatska - Cjelokupna PostgreSQL (Supabase) Baza Podataka
-- Verzija: 1.1
-- Standarni standardi: 3NF Normalizacija, UUIDv4, Row-Level Security (RLS),
-- Stored Procedures, Triggers, Indexes & SQL Views.
-- =============================================================================

-- Omogućavanje UUID ekstenzije
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. ENUMI / DOMENE ZA KONZISTENTNOST PODATAKA
-- =============================================================================

CREATE TYPE institution_category AS ENUM (
  'PRIMARY_SCHOOL',
  'SECONDARY_SCHOOL',
  'UNIVERSITY',
  'FACULTY',
  'VELEUCILISTE',
  'VISOKA_SKOLA'
);

CREATE TYPE user_role_type AS ENUM (
  'SUPER_ADMIN',
  'PRIMARY_ADMIN',
  'SECONDARY_ADMIN',
  'PRIMARY_HOMEROOM_TEACHER',
  'SECONDARY_HOMEROOM_TEACHER',
  'PRIMARY_STUDENT',
  'SECONDARY_STUDENT',
  'UNIVERSITY_ADMIN'
);

CREATE TYPE workflow_state_type AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'VERIFIED',
  'RANKED',
  'LOCKED',
  'COMPLETED'
);

-- =============================================================================
-- 2. ORGANIZACIJSKA STRUKTURA
-- =============================================================================

CREATE TABLE countries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  iso_code CHAR(2) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE counties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL UNIQUE,
  code VARCHAR(10) UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  county_id UUID NOT NULL REFERENCES counties(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  postal_code VARCHAR(10) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_city_postal UNIQUE (county_id, name, postal_code)
);

CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(250) NOT NULL,
  type institution_category NOT NULL,
  oib CHAR(11) NOT NULL UNIQUE,
  mzo_code VARCHAR(50) NOT NULL UNIQUE,
  address VARCHAR(250) NOT NULL,
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
  county_id UUID NOT NULL REFERENCES counties(id) ON DELETE RESTRICT,
  phone VARCHAR(50),
  email VARCHAR(150),
  website VARCHAR(250),
  principal_name VARCHAR(150),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE school_years (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year VARCHAR(20) NOT NULL UNIQUE, -- npr. "2025/2026"
  is_current BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- 3. KORISNICI I RBAC (Role-Based Access Control)
-- =============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  avatar_url VARCHAR(250),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(250),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(100) NOT NULL UNIQUE, -- npr. "students.read", "grades.update"
  description VARCHAR(250),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE user_permissions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  is_granted BOOLEAN NOT NULL DEFAULT true, -- omogućava preciznu iznimku
  PRIMARY KEY (user_id, permission_id)
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  user_agent VARCHAR(250),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE login_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent VARCHAR(250),
  status VARCHAR(20) NOT NULL, -- "SUCCESS", "FAILED"
  failure_reason VARCHAR(150),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 4. NASTAVNICI I RAZREDI
-- =============================================================================

CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  oib CHAR(11) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT,
  homeroom_teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  name VARCHAR(20) NOT NULL, -- "8.A", "4.B"
  grade_level INT NOT NULL, -- 1-8 za OŠ, 1-4 za SŠ
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_class_per_year UNIQUE (school_id, school_year_id, name)
);

-- =============================================================================
-- 5. UČENICI I STATUSTI
-- =============================================================================

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  school_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  oib CHAR(11) NOT NULL UNIQUE,
  date_of_birth DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE student_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  grade_average_5 NUMERIC(3,2), -- npr. 4.85
  grade_average_6 NUMERIC(3,2),
  grade_average_7 NUMERIC(3,2),
  grade_average_8 NUMERIC(3,2),
  competitions_points NUMERIC(4,2) DEFAULT 0.0,
  additional_points NUMERIC(4,2) DEFAULT 0.0,
  social_points_reason VARCHAR(250),
  health_conditions TEXT,
  special_conditions BOOLEAN DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- 6. PREDMETI I OCJENE
-- =============================================================================

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(150) NOT NULL UNIQUE,
  is_elective BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE class_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_class_subject UNIQUE (class_id, subject_id)
);

CREATE TABLE grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_subject_id UUID NOT NULL REFERENCES class_subjects(id) ON DELETE RESTRICT,
  grade_value INT NOT NULL CHECK (grade_value BETWEEN 1 AND 5),
  note TEXT,
  grade_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE grade_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grade_id UUID NOT NULL,
  student_id UUID NOT NULL,
  old_value INT CHECK (old_value BETWEEN 1 AND 5),
  new_value INT CHECK (new_value BETWEEN 1 AND 5),
  changed_by UUID NOT NULL REFERENCES users(id),
  change_reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE final_grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_subject_id UUID NOT NULL REFERENCES class_subjects(id) ON DELETE RESTRICT,
  grade_value INT NOT NULL CHECK (grade_value BETWEEN 1 AND 5),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_final_grade UNIQUE (student_id, class_subject_id)
);

-- =============================================================================
-- 7. SREDNJE ŠKOLE I UPISI (Upisi u srednje)
-- =============================================================================

CREATE TABLE school_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL, -- "Prirodoslovno-matematička gimnazija"
  duration_years INT NOT NULL CHECK (duration_years BETWEEN 3 AND 5),
  quota INT NOT NULL CHECK (quota > 0),
  min_points_threshold NUMERIC(4,2) NOT NULL DEFAULT 0.00,
  subjects_required VARCHAR(100)[] NOT NULL, -- Nazivi predmeta
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_school_program_name UNIQUE (school_id, name)
);

CREATE TABLE school_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE RESTRICT,
  school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT,
  status workflow_state_type NOT NULL DEFAULT 'DRAFT',
  points_override NUMERIC(4,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE school_application_choices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES school_applications(id) ON DELETE CASCADE,
  school_program_id UUID NOT NULL REFERENCES school_programs(id) ON DELETE RESTRICT,
  priority_order INT NOT NULL CHECK (priority_order > 0),
  calculated_points NUMERIC(4,2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_choice_priority UNIQUE (application_id, priority_order),
  CONSTRAINT unique_choice_program UNIQUE (application_id, school_program_id)
);

-- =============================================================================
-- 8. DRŽAVNA MATURA
-- =============================================================================

CREATE TABLE exam_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  is_elective BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE exam_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL, -- "Ljetni rok 2026", "Jesenski rok 2026"
  school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT,
  registration_start TIMESTAMP WITH TIME ZONE NOT NULL,
  registration_end TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE exam_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_subject_id UUID NOT NULL REFERENCES exam_subjects(id) ON DELETE RESTRICT,
  exam_period_id UUID NOT NULL REFERENCES exam_periods(id) ON DELETE RESTRICT,
  level CHAR(1) NOT NULL CHECK (level IN ('A', 'B')),
  status VARCHAR(20) NOT NULL DEFAULT 'REGISTERED', -- "REGISTERED", "CANCELLED", "ABSENT"
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_registration UNIQUE (student_id, exam_subject_id, exam_period_id)
);

CREATE TABLE exam_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id UUID NOT NULL UNIQUE REFERENCES exam_registrations(id) ON DELETE CASCADE,
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage BETWEEN 0.00 AND 100.00),
  grade INT NOT NULL CHECK (grade BETWEEN 1 AND 5),
  points NUMERIC(6,2) NOT NULL DEFAULT 0.00, -- Preračunati bodovi za faks
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- 9. VISOKO OBRAZOVANJE I UPISI (Upisi na fakultete)
-- =============================================================================

CREATE TABLE universities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(250) NOT NULL UNIQUE,
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE faculties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name VARCHAR(250) NOT NULL,
  oib CHAR(11) NOT NULL UNIQUE,
  mzo_code VARCHAR(50) NOT NULL UNIQUE,
  address VARCHAR(250) NOT NULL,
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
  email VARCHAR(150),
  phone VARCHAR(50),
  principal_name VARCHAR(150),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_faculty_univ UNIQUE (university_id, name)
);

CREATE TABLE study_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id UUID NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
  name VARCHAR(250) NOT NULL, -- "Sveučilišni studij računarstva"
  quota INT NOT NULL CHECK (quota > 0),
  min_points_threshold NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  -- Postoci za vrednovanje mature i ocjena iz SŠ
  matura_hrvatski_weight NUMERIC(4,2) DEFAULT 0.00,
  matura_matematika_weight NUMERIC(4,2) DEFAULT 0.00,
  matura_engleski_weight NUMERIC(4,2) DEFAULT 0.00,
  matura_elective_weight NUMERIC(4,2) DEFAULT 0.00,
  matura_elective_subject_id UUID REFERENCES exam_subjects(id),
  high_school_grades_weight NUMERIC(4,2) NOT NULL DEFAULT 40.00, -- npr 40%
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_study_program UNIQUE (faculty_id, name)
);

CREATE TABLE university_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE RESTRICT,
  school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT,
  status workflow_state_type NOT NULL DEFAULT 'DRAFT',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE university_application_choices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES university_applications(id) ON DELETE CASCADE,
  study_program_id UUID NOT NULL REFERENCES study_programs(id) ON DELETE RESTRICT,
  priority_order INT NOT NULL CHECK (priority_order > 0),
  calculated_points NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_univ_priority UNIQUE (application_id, priority_order),
  CONSTRAINT unique_univ_program UNIQUE (application_id, study_program_id)
);

-- =============================================================================
-- 10. ROKOVI, DOKUMENTI I AUDIT LOGS
-- =============================================================================

CREATE TABLE deadlines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL, -- "MIDDLE_SCHOOL_UPISI", "STATE_MATURA", "UNIVERSITY_UPISI"
  deadline_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR(150),
  action VARCHAR(100) NOT NULL,
  details TEXT,
  table_name VARCHAR(100),
  record_id UUID,
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- 11. INDEKSI ZA BRZINU I SKALABILNOST (OIB, E-mail, Strani ključevi)
-- =============================================================================

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_institutions_oib ON institutions(oib) WHERE deleted_at IS NULL;
CREATE INDEX idx_institutions_mzo ON institutions(mzo_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_teachers_oib ON teachers(oib) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_oib ON students(oib) WHERE deleted_at IS NULL;

-- Indeksi na strane ključeve i česta filtriranja
CREATE INDEX idx_students_school_id ON students(school_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_class_id ON students(class_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_classes_school_year ON classes(school_year_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_grades_student_id ON grades(student_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_univ_choices_program ON university_application_choices(study_program_id);
CREATE INDEX idx_school_choices_program ON school_application_choices(school_program_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);


-- =============================================================================
-- 12. SQL VIEW-OVI (IZVJEŠTAVANJE I REZULTATI)
-- =============================================================================

-- View za aktivne učenike
CREATE OR REPLACE VIEW active_students AS
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
WHERE s.deleted_at IS NULL AND s.is_active = true;

-- View za izračun bodova srednje škole (zbroj prosjeka ocjena od 5. do 8. razreda)
CREATE OR REPLACE VIEW student_scores AS
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
WHERE s.deleted_at IS NULL;

-- View za rang liste po studijskim programima
CREATE OR REPLACE VIEW faculty_rankings AS
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
WHERE uac.deleted_at IS NULL;


-- =============================================================================
-- 13. PL/pgSQL FUNKCIJE & PROCEDURE
-- =============================================================================

-- Funkcija za automatski izračun bodova učenika na upisu na fakultet
CREATE OR REPLACE FUNCTION calculate_university_points(student_uuid UUID, program_uuid UUID)
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

  -- 2. Dohvati ocjene učenika
  SELECT (COALESCE(grade_average_5,0) + COALESCE(grade_average_6,0) + COALESCE(grade_average_7,0) + COALESCE(grade_average_8,0)) / 4.0
  INTO v_profile_avg
  FROM student_profiles
  WHERE student_id = student_uuid;
  
  v_grade_avg_pts := COALESCE(v_profile_avg, 3.5) * 20.0 * (v_grades_w / 100.0); -- npr. max 1000 bodova

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
$$ LANGUAGE plpgsql;

-- Procedura za arhiviranje školske godine (Automatski proces)
CREATE OR REPLACE PROCEDURE archive_current_school_year()
AS $$
DECLARE
  v_current_year_id UUID;
  v_new_year_id UUID;
BEGIN
  -- Pronađi trenutnu godinu
  SELECT id INTO v_current_year_id FROM school_years WHERE is_current = true;
  
  IF v_current_year_id IS NOT NULL THEN
    -- 1. Ukloni zastavicu trenutne
    UPDATE school_years SET is_current = false WHERE id = v_current_year_id;
    
    -- 2. Arhiviraj stare prijave škola
    UPDATE school_applications 
    SET is_active = false 
    WHERE school_year_id = v_current_year_id;

    -- 3. Arhiviraj stare prijave fakulteta
    UPDATE university_applications 
    SET is_active = false 
    WHERE school_year_id = v_current_year_id;

    -- Logiraj arhivu
    INSERT INTO audit_logs (action, details, table_name)
    VALUES ('ARHIVIRANJE_GODINE', 'Pokrenuto automatsko arhiviranje školske godine i zaključavanje prijava.', 'school_years');
  END IF;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- 14. TRIGGERI ZA AUTOMATIZACIJU I REVIZIJU (AUDIT)
-- =============================================================================

-- Trigger funkcija za automatsko ažuriranje updated_at stupca
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Primjer triggera na tablicu institutions
CREATE TRIGGER trigger_update_institutions_updated_at
BEFORE UPDATE ON institutions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger za automatski audit log izmjene ocjena
CREATE OR REPLACE FUNCTION log_grade_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF OLD.grade_value <> NEW.grade_value THEN
      INSERT INTO grade_history (grade_id, student_id, old_value, new_value, changed_by, change_reason)
      VALUES (NEW.id, NEW.student_id, OLD.grade_value, NEW.grade_value, NEW.updated_by, 'Izmjena ocjene u sustavu od strane profesora.');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_grade_update
AFTER UPDATE ON grades
FOR EACH ROW
EXECUTE FUNCTION log_grade_changes();


-- =============================================================================
-- 15. ROW LEVEL SECURITY (RLS) POLICIJE
-- =============================================================================

-- Omogući RLS na tablicama s osjetljivim podacima
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE university_applications ENABLE ROW LEVEL SECURITY;

-- 1. SUPER_ADMIN može raditi sve
CREATE POLICY super_admin_all_users ON users 
  FOR ALL TO authenticated
  USING (auth.uid() IN (
    SELECT u.id FROM users u 
    JOIN user_roles ur ON u.id = ur.user_id 
    JOIN roles r ON ur.role_id = r.id 
    WHERE r.name = 'SUPER_ADMIN'
  ));

-- 2. Učenik može vidjeti samo svoje vlastite ocjene
CREATE POLICY student_view_own_grades ON grades
  FOR SELECT TO authenticated
  USING (student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  ));

-- 3. Razrednik može vidjeti samo ocjene učenika u svom razredu
CREATE POLICY teacher_view_class_grades ON grades
  FOR ALL TO authenticated
  USING (student_id IN (
    SELECT s.id FROM students s
    JOIN classes c ON s.class_id = c.id
    JOIN teachers t ON c.homeroom_teacher_id = t.id
    WHERE t.user_id = auth.uid()
  ));

-- 4. Administrator škole vidi samo studente iz svoje institucije
CREATE POLICY school_admin_view_students ON students
  FOR ALL TO authenticated
  USING (school_id IN (
    SELECT institution_id FROM teachers WHERE user_id = auth.uid() -- podrazumijeva da admini imaju zapis u teachers
  ));

-- =============================================================================
-- RLS ZA OBRAZOVNE I STUDIJSKE PROGRAME (school_programs, study_programs)
-- =============================================================================

ALTER TABLE school_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_programs ENABLE ROW LEVEL SECURITY;

-- Funkcija za provjeru je li korisnik SUPER_ADMIN
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.name = 'SUPER_ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funkcija za provjeru ustanove SECONDARY_ADMIN-a
CREATE OR REPLACE FUNCTION get_user_school_id() RETURNS UUID AS $$
DECLARE
  v_school_id UUID;
BEGIN
  -- Pokušaj dohvatiti iz tablice administracije ili nastavnika (ovisi o strukturi baze)
  -- Ako postoji specifična tablica za admine, prilagodi upit.
  SELECT institution_id INTO v_school_id FROM teachers WHERE user_id = auth.uid() LIMIT 1;
  RETURN v_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. SUPER_ADMIN ima pristup svim zapisima
CREATE POLICY super_admin_school_programs ON school_programs FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY super_admin_study_programs ON study_programs FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- 2. SECONDARY_ADMIN može INSERT, SELECT i UPDATE samo gdje institution_id odgovara njegovoj školi
CREATE POLICY sec_admin_school_programs_select ON school_programs FOR SELECT TO authenticated
USING (
  school_id = get_user_school_id() AND 
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'SECONDARY_ADMIN')
);

CREATE POLICY sec_admin_school_programs_insert ON school_programs FOR INSERT TO authenticated
WITH CHECK (
  school_id = get_user_school_id() AND 
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'SECONDARY_ADMIN')
);

CREATE POLICY sec_admin_school_programs_update ON school_programs FOR UPDATE TO authenticated
USING (
  school_id = get_user_school_id() AND 
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'SECONDARY_ADMIN')
) WITH CHECK (
  school_id = get_user_school_id() AND 
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'SECONDARY_ADMIN')
);

-- 3. UNIVERSITY_ADMIN može INSERT, SELECT i UPDATE samo gdje faculty_id odgovara njegovom fakultetu
CREATE POLICY uni_admin_study_programs_select ON study_programs FOR SELECT TO authenticated
USING (
  faculty_id = get_user_school_id() AND 
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'UNIVERSITY_ADMIN')
);

CREATE POLICY uni_admin_study_programs_insert ON study_programs FOR INSERT TO authenticated
WITH CHECK (
  faculty_id = get_user_school_id() AND 
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'UNIVERSITY_ADMIN')
);

CREATE POLICY uni_admin_study_programs_update ON study_programs FOR UPDATE TO authenticated
USING (
  faculty_id = get_user_school_id() AND 
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'UNIVERSITY_ADMIN')
) WITH CHECK (
  faculty_id = get_user_school_id() AND 
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'UNIVERSITY_ADMIN')
);

-- 4. Javno objavljeni programi - Učenici (read-only pristup javno dostupnim programima)
CREATE POLICY public_school_programs_select ON school_programs FOR SELECT TO authenticated
USING (true); -- Ili uvjet is_active = true ako postoji to polje

CREATE POLICY public_study_programs_select ON study_programs FOR SELECT TO authenticated
USING (true); -- Ili uvjet is_active = true ako postoji to polje

