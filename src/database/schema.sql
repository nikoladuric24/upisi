-- EduPortal Hrvatska - Database Schema (Supabase/PostgreSQL)

-- Audit and status fields for all tables
-- Standard fields: id, created_at, updated_at, created_by, updated_by, deleted_at, is_active

-- Users (Profiles)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  oib TEXT UNIQUE,
  phone TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'ACTIVE',
  roles TEXT[] DEFAULT '{PRIMARY_STUDENT}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  is_active BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Institutions (Primary/Secondary Schools, Faculties)
CREATE TABLE public.institutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  institution_type TEXT NOT NULL CHECK (institution_type IN ('PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'UNIVERSITY', 'FACULTY')),
  oib TEXT UNIQUE,
  mzo_code TEXT,
  address TEXT,
  city_id UUID,
  county_id UUID,
  contact TEXT,
  email TEXT,
  website TEXT,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  is_active BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Classes
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID REFERENCES public.institutions(id) NOT NULL,
  school_year_id UUID, -- References a school_years table
  name TEXT NOT NULL, -- e.g., "8.A"
  grade_level INTEGER NOT NULL,
  homeroom_teacher_id UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  is_active BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Students
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id),
  institution_id UUID REFERENCES public.institutions(id),
  class_id UUID REFERENCES public.classes(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  oib TEXT UNIQUE,
  date_of_birth DATE,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  is_active BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Sync Logs (Audit)
CREATE TABLE public.sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  system_name TEXT NOT NULL, -- e.g., 'e-Matica'
  action TEXT NOT NULL,
  status TEXT NOT NULL, -- e.g., 'SUCCESS', 'ERROR'
  records_processed INTEGER DEFAULT 0,
  error_details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_by UUID REFERENCES public.users(id)
);

-- Enable RLS (Row Level Security) - Basic Setup Example
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for now, will refine as RLS implementation proceeds)
CREATE POLICY "Users can read own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Institutions are readable by all authenticated" ON public.institutions FOR SELECT USING (auth.role() = 'authenticated');

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
CREATE OR REPLACE FUNCTION get_user_faculty_id() RETURNS UUID AS $$
DECLARE
  v_faculty_id UUID;
BEGIN
  SELECT institution_id INTO v_faculty_id FROM teachers WHERE user_id = auth.uid() LIMIT 1;
  RETURN v_faculty_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_school_id() RETURNS UUID AS $$
DECLARE
  v_school_id UUID;
BEGIN
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
  faculty_id = get_user_faculty_id() AND 
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'UNIVERSITY_ADMIN')
);

CREATE POLICY uni_admin_study_programs_insert ON study_programs FOR INSERT TO authenticated
WITH CHECK (
  faculty_id = get_user_faculty_id() AND 
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'UNIVERSITY_ADMIN')
);

CREATE POLICY uni_admin_study_programs_update ON study_programs FOR UPDATE TO authenticated
USING (
  faculty_id = get_user_faculty_id() AND 
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'UNIVERSITY_ADMIN')
) WITH CHECK (
  faculty_id = get_user_faculty_id() AND 
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'UNIVERSITY_ADMIN')
);

-- 4. Javno objavljeni programi - Učenici (read-only pristup javno dostupnim programima)
CREATE POLICY public_school_programs_select ON school_programs FOR SELECT TO authenticated
USING (
  is_published = true 
  OR is_super_admin() 
  OR (school_id = get_user_school_id() AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'SECONDARY_ADMIN'))
); 

CREATE POLICY public_study_programs_select ON study_programs FOR SELECT TO authenticated
USING (
  is_published = true
  OR is_super_admin()
  OR (faculty_id = get_user_faculty_id() AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'UNIVERSITY_ADMIN'))
); 

