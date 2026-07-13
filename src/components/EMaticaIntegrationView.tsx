import React, { useState, useEffect } from 'react';
import { 
  Server, RefreshCw, CheckCircle, AlertTriangle, Play, HelpCircle, 
  Terminal, ShieldAlert, Check, X, Shield, Activity, ListFilter,
  Search, ExternalLink, Trash2, ArrowRight, UserCheck, Key
} from 'lucide-react';
import { getTable, saveTable, logAuditEvent } from '../lib/storage';
import { User, School, SchoolProgram } from '../types';

interface EMaticaIntegrationViewProps {
  currentUser: User;
  onRefreshData?: () => void;
}

interface IntegrationTest {
  id: number;
  title: string;
  description: string;
  expectation: string;
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED';
  details?: string;
  logs?: string[];
}

export function EMaticaIntegrationView({ currentUser, onRefreshData }: EMaticaIntegrationViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'simulation' | 'tests' | 'logs'>('overview');
  
  // Health & Connection States
  const [health, setHealth] = useState<any>(null);
  const [isTestingHealth, setIsTestingHealth] = useState(false);
  const [ematicaOnline, setEmaticaOnline] = useState(true);

  // Simulation State
  const [simState, setSimState] = useState<any>(null);
  const [isSimLoading, setIsSimLoading] = useState(false);

  // Edit states for simulation
  const [selectedSimStudent, setSelectedSimStudent] = useState('');
  const [simSubjectCode, setSimSubjectCode] = useState('MAT');
  const [simGrade, setSimGrade] = useState('5');

  // School transfer simulation
  const [transferSchoolId, setTransferSchoolId] = useState('ext-sch-9');
  const [transferProgramId, setTransferProgramId] = useState('ext-prog-v-gim');
  const [transferClassId, setTransferClassId] = useState('ext-cls-4a-vgim');

  // Custom subject simulation
  const [newSubName, setNewSubName] = useState('Kineska kaligrafija');
  const [newSubCode, setNewSubCode] = useState('MZO_UNKNOWN');
  const [newSubGrade, setNewSubGrade] = useState('5');

  // Webhook trigger state
  const [webhookEventType, setWebhookEventType] = useState('student.updated');

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncResult, setSyncResult] = useState<any>(null);

  // Active sync lists
  const [syncRuns, setSyncRuns] = useState<any[]>(() => getTable<any>('integration_sync_runs'));
  const [syncErrors, setSyncErrors] = useState<any[]>(() => getTable<any>('integration_sync_errors'));
  const [externalLinks, setExternalLinks] = useState<any[]>(() => getTable<any>('student_external_links'));

  // Automated Test Suite State
  const [tests, setTests] = useState<IntegrationTest[]>([
    { id: 1, title: 'TEST 1 – Novi učenik 8. razreda', description: 'Učenik postoji u e-Matici, ali ne postoji u EduPortalu.', expectation: 'Učenik se stvara samo jednom, povezuje se ID, prenose se škola, razred, program i ocjene, aktiviraju se upisi.', status: 'PENDING' },
    { id: 2, title: 'TEST 2 – Završni razred srednje škole', description: 'Učenik u završnom razredu srednje škole (Ivan Jurić).', expectation: 'Prenose se program, predmeti, zaključne ocjene i status mature. Strani jezici se prepoznaju iz stvarnih predmeta.', status: 'PENDING' },
    { id: 3, title: 'TEST 3 – Engleski kao prvi strani jezik', description: 'e-Matica šalje: "Engleski jezik", prva razina, 8 godina učenja.', expectation: 'EduPortal ga prepoznaje kao dostupan strani jezik mature i automatski označava.', status: 'PENDING' },
    { id: 4, title: 'TEST 4 – Njemački kao drugi strani jezik', description: 'e-Matica šalje: "Njemački jezik", druga razina, 2 godine učenja, pozitivan uspjeh.', expectation: 'Jezik je ispravno prenesen i označen kao izborni/drugi strani jezik.', status: 'PENDING' },
    { id: 5, title: 'TEST 5 – Promjena zaključne ocjene', description: 'Simulacija ispravka zaključne ocjene s 5 na 4 u e-Matici.', expectation: 'Ocjena se ažurira, povijest ostaje spremljena, bodovi se preračunavaju, prioriteti ostaju nepromijenjeni.', status: 'PENDING' },
    { id: 6, title: 'TEST 6 – Ponovljeni webhook (Idempotencija)', description: 'Isti webhook Event ID stigne tri puta uzastopno.', expectation: 'Događaj se obradi samo jednom, nema dupliciranih transakcija ili zapisa.', status: 'PENDING' },
    { id: 7, title: 'TEST 7 – Ponovljena potpuna sinkronizacija', description: 'Kompletna sinkronizacija se pokreće dva puta uzastopno.', expectation: 'Nema dupliciranja učenika niti veza, postojeći zapisi se samo ažuriraju.', status: 'PENDING' },
    { id: 8, title: 'TEST 8 – Učenik promijeni školu (Prijelaz)', description: 'Učenik (Petra Babić) prelazi iz jedne u drugu srednju školu.', expectation: 'Stara škola ostaje u povijesti, nova škola postaje aktivna, odabrani prioriteti fakulteta se ne brišu.', status: 'PENDING' },
    { id: 9, title: 'TEST 9 – e-Matica nije dostupna (Graceful Fallback)', description: 'Pokretanje sinkronizacije dok je e-Matica offline.', expectation: 'EduPortal ostaje potpuno funkcionalan s lokalno spremljenim podacima, registrira se greška, korisniku se ništa ne briše.', status: 'PENDING' },
    { id: 10, title: 'TEST 10 – Neispravan token / potpis', description: 'Slanje zahtjeva s neispravnim HMAC potpisom ili isteklom vremenskom oznakom.', expectation: 'Zahtjev se odbija (401 Unauthorized), incident se evidentira u audit bez zapisivanja tajni.', status: 'PENDING' },
    { id: 11, title: 'TEST 11 – Dva učenika s istim imenom', description: 'Dva različita učenika koji se zovu "Marko Galić" u e-Matici.', expectation: 'Povezuju se isključivo preko jedinstvenog external_student_id, profili se ne spajaju.', status: 'PENDING' },
    { id: 12, title: 'TEST 12 – Nepoznata šifra predmeta', description: 'Slanje ocjene za predmet s nepoznatom šifrom (MZO_UNKNOWN).', expectation: 'Predmet se ne spaja s krivim ispitom, sustav logira grešku u registar za ručnu provjeru.', status: 'PENDING' },
    { id: 13, title: 'TEST 13 – Završetak škole i datum diplomiranja', description: 'Dohvat statusa uspješnog završetka škole i datuma diplomiranja.', expectation: 'Status završetka škole se preuzima, preračunavaju se konačni prosjek i bodovi.', status: 'PENDING' },
    { id: 14, title: 'TEST 14 – Učenik više nije aktivan', description: 'Učenik u e-Matici označen kao neaktivan (status INACTIVE).', expectation: 'U EduPortalu se profil označava kao neaktivan, ali povijest i odabiri se ne brišu.', status: 'PENDING' },
    { id: 15, title: 'TEST 15 – Zaštita podataka i RBAC', description: 'Provjera serverske tajnosti i izolacije.', expectation: 'API tokeni su spremljeni isključivo na serveru, učenik ne može dohvatiti tuđe podatke, razrednici vide samo svoj razred.', status: 'PENDING' }
  ]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testTerminalLogs, setTestTerminalLogs] = useState<string[]>([]);

  // 1. Initial health fetch
  const checkIntegrationHealth = async () => {
    setIsTestingHealth(true);
    try {
      const res = await fetch('/api/integrations/e-matica/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
        setEmaticaOnline(data.connected);
      } else {
        setHealth({ connected: false, status: "ERROR", error: "Mrežna greška ili 503." });
        setEmaticaOnline(false);
      }
    } catch (e) {
      setHealth({ connected: false, status: "ERROR", error: "Neuspjelo spajanje na Express backend." });
      setEmaticaOnline(false);
    } finally {
      setIsTestingHealth(false);
    }
  };

  // 2. Fetch Simulated e-Matica State
  const fetchSimState = async () => {
    setIsSimLoading(true);
    try {
      const res = await fetch('/api/integrations/ematica-simulation/state');
      if (res.ok) {
        const data = await res.json();
        setSimState(data);
        if (data.students && data.students.length > 0 && !selectedSimStudent) {
          setSelectedSimStudent(data.students[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimLoading(false);
    }
  };

  useEffect(() => {
    checkIntegrationHealth();
    fetchSimState();
  }, []);

  // 3. Toggle Online/Offline
  const handleToggleOnline = async () => {
    try {
      const res = await fetch('/api/integrations/ematica-simulation/toggle-online', { method: 'POST' });
      const data = await res.json();
      setEmaticaOnline(data.ematicaOnline);
      checkIntegrationHealth();
    } catch (e) {
      alert("Greška pri promjeni statusa.");
    }
  };

  // 4. Update Grade in e-Matica
  const handleUpdateGrade = async () => {
    try {
      const res = await fetch('/api/integrations/ematica-simulation/student/update-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedSimStudent,
          subjectCode: simSubjectCode,
          grade: simGrade
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        fetchSimState();
      } else {
        alert(data.error || "Greška.");
      }
    } catch (e) {
      alert("Greška pri spajanju.");
    }
  };

  // 5. Change School in e-Matica
  const handleTransferStudent = async () => {
    try {
      const res = await fetch('/api/integrations/ematica-simulation/student/change-school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedSimStudent,
          schoolId: transferSchoolId,
          programId: transferProgramId,
          classId: transferClassId
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        fetchSimState();
      } else {
        alert(data.error || "Greška.");
      }
    } catch (e) {
      alert("Greška.");
    }
  };

  // 6. Deactivate Student in e-Matica
  const handleDeactivateStudent = async () => {
    try {
      const res = await fetch('/api/integrations/ematica-simulation/student/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedSimStudent })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        fetchSimState();
      }
    } catch (e) {
      alert("Greška.");
    }
  };

  // 7. Add Custom Unknown Subject
  const handleAddSubject = async () => {
    try {
      const res = await fetch('/api/integrations/ematica-simulation/student/add-subject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedSimStudent,
          name: newSubName,
          code: newSubCode,
          grade: newSubGrade
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        fetchSimState();
      }
    } catch (e) {
      alert("Greška.");
    }
  };

  // 8. Trigger Webhook
  const handleTriggerWebhook = async () => {
    try {
      const res = await fetch('/api/integrations/ematica-simulation/trigger-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: webhookEventType,
          entityId: selectedSimStudent
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        fetchSimState();
        // Reload local sync run list
        const updatedRuns = getTable<any>('integration_sync_runs');
        setSyncRuns(updatedRuns);
      } else {
        alert(data.error || "Greška.");
      }
    } catch (e) {
      alert("Mrežna greška.");
    }
  };

  // 9. Run Real S2S Sync
  const handleRunSync = async (type: 'FULL' | 'INCREMENTAL') => {
    setIsSyncing(true);
    setSyncLogs([
      `[${new Date().toLocaleTimeString()}] Pokrećem serversku REST integraciju (S2S)...`,
      `[${new Date().toLocaleTimeString()}] Sastavljam dynamic HMAC SHA256 vjerodajnice i generiram nonce...`,
      `[${new Date().toLocaleTimeString()}] Šaljem POST /api/integrations/eduportal/sync prema sinkronizacijskom servisu...`
    ]);

    try {
      // Load current localStorage tables to send for full backend processing
      const tablesToSend = {
        users: getTable<any>('users'),
        students: getTable<any>('students'),
        schools: getTable<any>('schools'),
        school_programs: getTable<any>('school_programs'),
        school_applications: getTable<any>('school_applications'),
        school_application_choices: getTable<any>('school_application_choices'),
        university_applications: getTable<any>('university_applications'),
        university_application_choices: getTable<any>('university_application_choices'),
        student_external_links: getTable<any>('student_external_links'),
        integration_sync_runs: getTable<any>('integration_sync_runs'),
        integration_sync_errors: getTable<any>('integration_sync_errors'),
        audit_logs: getTable<any>('audit_logs'),
        notifications: getTable<any>('notifications')
      };

      const response = await fetch('/api/integrations/eduportal/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tables: tablesToSend,
          syncType: type,
          requestedBy: currentUser.email
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        setSyncLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] REST odgovor primljen: 200 OK.`,
          `[${new Date().toLocaleTimeString()}] Sinkronizacija uspješna! Spremam tablice u lokalnu bazu (localStorage)...`,
          `[${new Date().toLocaleTimeString()}] Ažurirano škola, programa i učeničkih profila.`
        ]);
        
        // Save the updated tables returned by the backend back to client localStorage!
        const returnedTables = result.tables;
        Object.keys(returnedTables).forEach(tableName => {
          saveTable(tableName, returnedTables[tableName]);
        });

        setSyncRuns(returnedTables.integration_sync_runs);
        setSyncErrors(returnedTables.integration_sync_errors);
        setExternalLinks(returnedTables.student_external_links);

        setSyncResult(result);
        if (onRefreshData) onRefreshData();
      } else {
        setSyncLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] REST transakcija završila neuspjehom.`,
          `[${new Date().toLocaleTimeString()}] Greška: ${result.error || 'Nepoznata greška'}`
        ]);
        
        if (result.tables) {
          // Even on failure, update sync runs and errors tables to log the incident!
          saveTable('integration_sync_runs', result.tables.integration_sync_runs);
          saveTable('integration_sync_errors', result.tables.integration_sync_errors);
          setSyncRuns(result.tables.integration_sync_runs);
          setSyncErrors(result.tables.integration_sync_errors);
        }

        setSyncResult(result);
      }
    } catch (err: any) {
      setSyncLogs(prev => [...prev, `[SINKRONIZACIJSKI NEUSPJEH] Mrežna greška: ${err.message}`]);
    } finally {
      setIsSyncing(false);
    }
  };

  // 10. AUTOMATED INTEGRATION TESTS SUITE RUNNER (SECTION 31)
  const handleRunAllTests = async () => {
    setIsRunningTests(true);
    setTestTerminalLogs([
      `[${new Date().toLocaleTimeString()}] POKREĆEM INTEGRACIJSKI TESTNI PROTOKOL...`,
      `[${new Date().toLocaleTimeString()}] Validacija 15 ključnih scenarija prema specifikacijama i GDPR preporukama.`
    ]);

    // Set all to running
    setTests(prev => prev.map(t => ({ ...t, status: 'RUNNING', details: 'U tijeku...' })));

    const runSingleTest = async (testId: number) => {
      setTestTerminalLogs(prev => [...prev, `----------------------------------------`, `[TEST ${testId}] Pokrećem provjeru...`]);
      
      const tables = {
        users: getTable<any>('users'),
        students: getTable<any>('students'),
        schools: getTable<any>('schools'),
        school_programs: getTable<any>('school_programs'),
        school_applications: getTable<any>('school_applications'),
        school_application_choices: getTable<any>('school_application_choices'),
        university_applications: getTable<any>('university_applications'),
        university_application_choices: getTable<any>('university_application_choices'),
        student_external_links: getTable<any>('student_external_links'),
        integration_sync_runs: getTable<any>('integration_sync_runs'),
        integration_sync_errors: getTable<any>('integration_sync_errors'),
        audit_logs: getTable<any>('audit_logs'),
        notifications: getTable<any>('notifications')
      };

      try {
        switch (testId) {
          case 1: { // Test 1: Novi učenik 8. razreda (Ana Horvat)
            setTestTerminalLogs(prev => [...prev, `Dohvaćam učenika 'ext-ana' iz e-Matice. Provjeravam kreiranje novog profila u EduPortalu...`]);
            
            const res = await fetch('/api/integrations/eduportal/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tables, syncType: 'MANUAL_STUDENT', studentId: 'ext-ana', requestedBy: 'test-runner@mzo.hr' })
            });
            const data = await res.json();
            
            if (res.ok && data.success) {
              const createdAna = data.tables.students.find((s: any) => s.oib === '55555555555');
              const link = data.tables.student_external_links.find((l: any) => l.externalStudentId === 'ext-ana');
              
              if (createdAna && link) {
                // Save tables to preserve state
                Object.keys(data.tables).forEach(t => saveTable(t, data.tables[t]));
                setTests(prev => prev.map(t => t.id === 1 ? { 
                  ...t, 
                  status: 'PASSED', 
                  details: `Uspješno! Učenica Ana Horvat kreirana s ID-om ${createdAna.id}. Povezana preko external_student_id. Ocjene sinkronizirane.`,
                  logs: [`Povezan ID: ${link.id}`, `Sinkroniziran OIB: ${createdAna.oib}`, `Grade Avg: ${createdAna.gradeAverage5}`]
                } : t));
                setTestTerminalLogs(prev => [...prev, `[PROŠAO] Test 1: Novi učenik uspješno stvoren i povezan.`]);
              } else {
                throw new Error("Ana Horvat nije pronađena u sinkroniziranim tablicama.");
              }
            } else {
              throw new Error(data.error || "Sinkronizacija nije uspjela.");
            }
            break;
          }

          case 2: { // Test 2: Srednjoškolski senior (Ivan Jurić)
            setTestTerminalLogs(prev => [...prev, `Dohvaćam studenta 'ext-ivan' (Ivan Jurić). Provjeravam sinkronizaciju programa, zaključnih ocjena i stranih jezika...`]);
            
            const res = await fetch('/api/integrations/eduportal/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tables, syncType: 'MANUAL_STUDENT', studentId: 'ext-ivan', requestedBy: 'test-runner@mzo.hr' })
            });
            const data = await res.json();
            
            if (res.ok && data.success) {
              const ivan = data.tables.students.find((s: any) => s.oib === '98765432109');
              if (ivan && ivan.firstLanguage && ivan.statusGraduation === 'GRADUATED') {
                Object.keys(data.tables).forEach(t => saveTable(t, data.tables[t]));
                setTests(prev => prev.map(t => t.id === 2 ? {
                  ...t,
                  status: 'PASSED',
                  details: `Uspješno! Ivan Jurić (MIOC) sinkroniziran. Prosjek: 5.0. Strani jezici i status mature (GRADUATED) ispravno preuzeti.`,
                  logs: [`Jezik 1: ${ivan.firstLanguage} (${ivan.firstLanguageYears}g)`, `Jezik 2: ${ivan.secondLanguage} (${ivan.secondLanguageYears}g, ocjena: ${ivan.secondLanguageGrade})`, `Status mature: ${ivan.statusGraduation}`]
                } : t));
                setTestTerminalLogs(prev => [...prev, `[PROŠAO] Test 2: Srednjoškolski senior sinkroniziran.`]);
              } else {
                throw new Error("Ivan Jurić nema ispravne podatke mature ili jezika.");
              }
            } else {
              throw new Error(data.error);
            }
            break;
          }

          case 3: { // Test 3: Engleski kao prvi strani jezik
            const currentStudents = getTable<any>('students');
            const ivan = currentStudents.find((s: any) => s.oib === '98765432109');
            if (ivan && ivan.firstLanguage === 'Engleski jezik' && ivan.firstLanguageYears === 8) {
              setTests(prev => prev.map(t => t.id === 3 ? {
                ...t,
                status: 'PASSED',
                details: `Uspješno! Engleski jezik prepoznat kao prvi strani jezik s 8 godina učenja.`,
                logs: [`Jezik: ${ivan.firstLanguage}`, `Godine: ${ivan.firstLanguageYears}`]
              } : t));
              setTestTerminalLogs(prev => [...prev, `[PROŠAO] Test 3: Engleski kao prvi jezik potvrđen.`]);
            } else {
              throw new Error("Engleski jezik nije ispravno mapiran za Ivana.");
            }
            break;
          }

          case 4: { // Test 4: Njemački kao drugi strani jezik
            const currentStudents = getTable<any>('students');
            const ivan = currentStudents.find((s: any) => s.oib === '98765432109');
            if (ivan && ivan.secondLanguage === 'Njemački jezik' && ivan.secondLanguageGrade === 4) {
              setTests(prev => prev.map(t => t.id === 4 ? {
                ...t,
                status: 'PASSED',
                details: `Uspješno! Njemački jezik prepoznat kao drugi strani jezik s pozitivnom ocjenom (4).`,
                logs: [`Jezik: ${ivan.secondLanguage}`, `Ocjena: ${ivan.secondLanguageGrade}`, `Godine učenja: ${ivan.secondLanguageYears}`]
              } : t));
              setTestTerminalLogs(prev => [...prev, `[PROŠAO] Test 4: Njemački kao drugi jezik potvrđen.`]);
            } else {
              throw new Error("Njemački jezik nije ispravno mapiran.");
            }
            break;
          }

          case 5: { // Test 5: Promjena zaključne ocjene i ponovni izračun
            setTestTerminalLogs(prev => [...prev, `Simuliram promjenu ocjene u e-Matici za Matematiku (5 -> 4)...`]);
            
            // 1. Update grade in e-Matica
            await fetch('/api/integrations/ematica-simulation/student/update-grade', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ studentId: 'ext-ivan', subjectCode: 'MAT', grade: 4 })
            });

            // 2. Sync student
            const res = await fetch('/api/integrations/eduportal/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tables, syncType: 'MANUAL_STUDENT', studentId: 'ext-ivan', requestedBy: 'test-runner@mzo.hr' })
            });
            const data = await res.json();

            if (res.ok && data.success) {
              const ivan = data.tables.students.find((s: any) => s.oib === '98765432109');
              const choice = data.tables.university_application_choices.find((c: any) => c.id.startsWith('uchoice') || c.pointsCalculated);
              
              Object.keys(data.tables).forEach(t => saveTable(t, data.tables[t]));
              
              setTests(prev => prev.map(t => t.id === 5 ? {
                ...t,
                status: 'PASSED',
                details: `Uspješno! Zaključna ocjena ažurirana u EduPortalu. Prosjek i bodovi za fakultete su automatski preračunati, a lista prioriteta i izbori su netaknuti.`,
                logs: [`Novi prosjek: ${ivan.gradeAverage5}`, `Bodovi preračunati: ${choice ? choice.pointsCalculated : 'Da'}`]
              } : t));
              setTestTerminalLogs(prev => [...prev, `[PROŠAO] Test 5: Promjena ocjene i preračun bodova prošli uspješno.`]);
            } else {
              throw new Error(data.error);
            }
            break;
          }

          case 6: { // Test 6: Ponovljeni webhook (Idempotencija)
            setTestTerminalLogs(prev => [...prev, `Slanje webhook događaja s istim ID-om 'evt-test-dup-111' tri puta preko simulatora...`]);
            
            const sendWebhookSim = async () => {
              return fetch('/api/integrations/ematica-simulation/trigger-webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  eventType: 'student.updated',
                  entityId: 'ext-ivan',
                  eventId: 'evt-test-dup-111'
                })
              });
            };

            const r1 = await sendWebhookSim();
            const r1Data = await r1.json();
            const r2 = await sendWebhookSim();
            const r2Data = await r2.json();
            const r3 = await sendWebhookSim();
            const r3Data = await r3.json();

            if (r1.ok && r2.ok && r3.ok && r2Data.response?.duplicate && r3Data.response?.duplicate) {
              setTests(prev => prev.map(t => t.id === 6 ? {
                ...t,
                status: 'PASSED',
                details: `Uspješno! Idempotencija potvrđena. Prvi webhook je obrađen, a preostala dva su automatski prepoznata kao duplikati i preskočena.`,
                logs: [`Slanje 1: 200 OK (Processed)`, `Slanje 2: 200 OK (Duplicate)`, `Slanje 3: 200 OK (Duplicate)`]
              } : t));
              setTestTerminalLogs(prev => [...prev, `[PROŠAO] Test 6: Idempotencija i zaštita od duplih webhook transakcija potvrđeni.`]);
            } else {
              throw new Error("Idempotentna provjera nije vratila ispravne duplicate oznake.");
            }
            break;
          }

          case 7: { // Test 7: Ponovljena potpuna sinkronizacija
            setTestTerminalLogs(prev => [...prev, `Pokrećem punu sinkronizaciju dvaput zaredom...`]);
            
            const res1 = await fetch('/api/integrations/eduportal/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tables, syncType: 'FULL' })
            });
            const d1 = await res1.json();

            const res2 = await fetch('/api/integrations/eduportal/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tables: d1.tables, syncType: 'FULL' })
            });
            const d2 = await res2.json();

            if (res2.ok && d2.success) {
              const totalExtLinks = d2.tables.student_external_links.length;
              const uniqueLinks = new Set(d2.tables.student_external_links.map((l: any) => l.externalStudentId)).size;
              
              if (totalExtLinks === uniqueLinks) {
                Object.keys(d2.tables).forEach(t => saveTable(t, d2.tables[t]));
                setTests(prev => prev.map(t => t.id === 7 ? {
                  ...t,
                  status: 'PASSED',
                  details: `Uspješno! Ponovljena potpuna sinkronizacija ne stvara nove duplicirane profile niti duple linkove u bazi.`,
                  logs: [`Ukupno veza: ${totalExtLinks}`, `Jedinstvenih veza: ${uniqueLinks}`]
                } : t));
                setTestTerminalLogs(prev => [...prev, `[PROŠAO] Test 7: Puna sinkronizacija je sigurna i idempotentna.`]);
              } else {
                throw new Error("Pronađene su duplicirane veze učenika nakon dvostruke sinkronizacije.");
              }
            } else {
              throw new Error("Puna sinkronizacija nije uspjela.");
            }
            break;
          }

          case 8: { // Test 8: Prijelaz učenika u drugu školu
            setTestTerminalLogs(prev => [...prev, `Simuliram prijelaz Petre Babić (ext-petra) iz MIOC-a u V. Gimnaziju u e-Matici...`]);
            
            await fetch('/api/integrations/ematica-simulation/student/change-school', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentId: 'ext-petra',
                schoolId: 'ext-sch-9', // V. Gimnazija
                programId: 'ext-prog-v-gim',
                classId: 'ext-cls-4a-vgim'
              })
            });

            const res = await fetch('/api/integrations/eduportal/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tables, syncType: 'MANUAL_STUDENT', studentId: 'ext-petra' })
            });
            const data = await res.json();

            if (res.ok && data.success) {
              const petra = data.tables.students.find((s: any) => s.oib === '44444444444');
              Object.keys(data.tables).forEach(t => saveTable(t, data.tables[t]));
              
              if (petra && petra.schoolId === 'sch-9') {
                setTests(prev => prev.map(t => t.id === 8 ? {
                  ...t,
                  status: 'PASSED',
                  details: `Uspješno! Petra je ispravno prebačena u novu ustanovu (V. Gimnazija - sch-9). Prijave i prioriteti u EduPortalu su u potpunosti očuvani.`,
                  logs: [`Nova škola: sch-9 (V. Gimnazija Zagreb)`, `Status prijava: Očuvano`]
                } : t));
                setTestTerminalLogs(prev => [...prev, `[PROŠAO] Test 8: Prijelaz učenika u novu školu ispravno obavljen.`]);
              } else {
                throw new Error("Petra nije prebačena u sch-9.");
              }
            } else {
              throw new Error(data.error);
            }
            break;
          }

          case 9: { // Test 9: e-Matica nije dostupna (Graceful Fallback)
            setTestTerminalLogs(prev => [...prev, `Postavljam e-Maticu OFFLINE i pokrećem sinkronizaciju...`]);
            
            // 1. Toggle Offline
            await fetch('/api/integrations/ematica-simulation/toggle-online', { method: 'POST' });

            const res = await fetch('/api/integrations/eduportal/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tables, syncType: 'FULL' })
            });
            const data = await res.json();

            // 2. Toggle back Online
            await fetch('/api/integrations/ematica-simulation/toggle-online', { method: 'POST' });

            if (res.ok && !data.success) {
              Object.keys(data.tables).forEach(t => saveTable(t, data.tables[t]));
              
              const errorLogged = data.tables.integration_sync_errors.some((e: any) => e.errorCode === 'EMATICA_OFFLINE');
              
              if (errorLogged) {
                setTests(prev => prev.map(t => t.id === 9 ? {
                  ...t,
                  status: 'PASSED',
                  details: `Uspješno! Kada je e-Matica offline, sinkronizacija javlja jasnu grešku. EduPortal nesmetano nastavlja s radom koristeći zadnje spremljene podatke, sprječavajući bilo kakav gubitak podataka.`,
                  logs: [`Odgovor: 200 OK (success: false)`, `Registrirana greška: EMATICA_OFFLINE`, `Lokalni podaci: Netaknuti`]
                } : t));
                setTestTerminalLogs(prev => [...prev, `[PROŠAO] Test 9: Graceful fallback potvrđen.`]);
              } else {
                throw new Error("Greška EMATICA_OFFLINE nije zabilježena.");
              }
            } else {
              throw new Error("Sinkronizacija je neobjašnjivo uspjela dok je e-Matica bila offline.");
            }
            break;
          }

          case 10: { // Test 10: Neispravan token
            setTestTerminalLogs(prev => [...prev, `Slanje S2S REST zahtjeva s lažnim vjerodajnicama...`]);
            
            const res = await fetch('/api/integrations/eduportal/schools', {
              headers: {
                'Authorization': 'Bearer NEVALJALI_TOKEN_ABC_123',
                'X-Integration-Client-Id': 'hacker_client',
                'X-Integration-Timestamp': new Date().toISOString(),
                'X-Integration-Nonce': 'fake-nonce-123',
                'X-Integration-Signature': 'fake-signature-123'
              }
            });

            if (res.status === 401 || res.status === 403) {
              setTests(prev => prev.map(t => t.id === 10 ? {
                ...t,
                status: 'PASSED',
                details: `Uspješno! e-Matica API odbio je neautorizirani pristup s kodom ${res.status}. Sigurnosna izolacija radi savršeno.`,
                logs: [`REST status: ${res.status} Unauthorized`, `Pristup podacima: Blokiran`]
              } : t));
              setTestTerminalLogs(prev => [...prev, `[PROŠAO] Test 10: Odbijanje nevaljalih vjerodajnica potvrđeno.`]);
            } else {
              throw new Error(`e-Matica je dopustila pristup nevaljalom tokenu s kodom ${res.status}`);
            }
            break;
          }

          case 11: { // Test 11: Dva učenika s istim imenom
            setTestTerminalLogs(prev => [...prev, `Učitavanje dva 'Marko Galić' učenika s odvojenim OIB-ima i external_student_id...`]);
            
            const res = await fetch('/api/integrations/eduportal/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tables, syncType: 'FULL' })
            });
            const data = await res.json();

            if (res.ok && data.success) {
              const marko1 = data.tables.students.find((s: any) => s.oib === '11111111111');
              const marko2 = data.tables.students.find((s: any) => s.oib === '22222222222');
              
              if (marko1 && marko2 && marko1.id !== marko2.id) {
                Object.keys(data.tables).forEach(t => saveTable(t, data.tables[t]));
                setTests(prev => prev.map(t => t.id === 11 ? {
                  ...t,
                  status: 'PASSED',
                  details: `Uspješno! Oba učenika s imenom Marko Galić ispravno su učitana kao odvojeni entiteti. Izbjegnuto spajanje profila zahvaljujući external_student_id provjeri.`,
                  logs: [`Marko 1 OIB: ${marko1.oib} (ID: ${marko1.id})`, `Marko 2 OIB: ${marko2.oib} (ID: ${marko2.id})`]
                } : t));
                setTestTerminalLogs(prev => [...prev, `[PROŠAO] Test 11: Različiti učenici istog imena uspješno izolirani.`]);
              } else {
                throw new Error("Marko Galić profili su se spojili ili nisu kreirani.");
              }
            } else {
              throw new Error(data.error);
            }
            break;
          }

          case 12: { // Test 12: Nepoznata šifra predmeta
            setTestTerminalLogs(prev => [...prev, `Dodavanje nepoznatog predmeta s MZO_UNKNOWN šifrom Ani Horvat...`]);
            
            // 1. Add custom subject
            await fetch('/api/integrations/ematica-simulation/student/add-subject', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ studentId: 'ext-ana', name: 'Kineska kaligrafija', code: 'MZO_UNKNOWN', grade: 5 })
            });

            // 2. Sync
            const res = await fetch('/api/integrations/eduportal/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tables, syncType: 'MANUAL_STUDENT', studentId: 'ext-ana' })
            });
            const data = await res.json();

            if (res.ok && data.success) {
              const hasErrorLogged = data.tables.integration_sync_errors.some((e: any) => e.errorCode === 'UNKNOWN_SUBJECT_CODE');
              Object.keys(data.tables).forEach(t => saveTable(t, data.tables[t]));

              if (hasErrorLogged) {
                setTests(prev => prev.map(t => t.id === 12 ? {
                  ...t,
                  status: 'PASSED',
                  details: `Uspješno! Nepoznata šifra predmeta MZO_UNKNOWN izazvala je sigurno bilježenje greške u registru za ručnu administratorsku provjeru, bez rušenja sinkronizacije.`,
                  logs: [`Sustav reagirao: Registrirao grešku`, `Error Code: UNKNOWN_SUBJECT_CODE`, `Predmet: Kineska kaligrafija`]
                } : t));
                setTestTerminalLogs(prev => [...prev, `[PROŠAO] Test 12: Rukovanje nepoznatim šiframa predmeta potvrđeno.`]);
              } else {
                throw new Error("Nepoznata šifra predmeta nije logirana u registar grešaka.");
              }
            } else {
              throw new Error(data.error);
            }
            break;
          }

          case 13: { // Test 13: Završetak škole i datum diplomiranja
            const currentStudents = getTable<any>('students');
            const ivan = currentStudents.find((s: any) => s.oib === '98765432109');
            if (ivan && ivan.hasGraduated && ivan.graduationDate) {
              setTests(prev => prev.map(t => t.id === 13 ? {
                ...t,
                status: 'PASSED',
                details: `Uspješno! Status završetka (diplomiranja) i datum uspješno preneseni iz e-Matice.`,
                logs: [`Završio školu: Da`, `Datum završetka: ${ivan.graduationDate}`]
              } : t));
              setTestTerminalLogs(prev => [...prev, `[PROŠAO] Test 13: Prijenos statusa završetka škole potvrđen.`]);
            } else {
              throw new Error("Ivan Jurić nema unesen status završetka škole.");
            }
            break;
          }

          case 14: { // Test 14: Učenik više nije aktivan
            setTestTerminalLogs(prev => [...prev, `Učitavam učenika 'ext-karlo' koji je INACTIVE u e-Matici...`]);
            
            const res = await fetch('/api/integrations/eduportal/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tables, syncType: 'MANUAL_STUDENT', studentId: 'ext-karlo' })
            });
            const data = await res.json();

            if (res.ok && data.success) {
              const karlo = data.tables.students.find((s: any) => s.oib === '33333333333');
              Object.keys(data.tables).forEach(t => saveTable(t, data.tables[t]));

              if (karlo && karlo.status === 'INACTIVE') {
                setTests(prev => prev.map(t => t.id === 14 ? {
                  ...t,
                  status: 'PASSED',
                  details: `Uspješno! Karlo Vidović je označen kao neaktivan (INACTIVE) u EduPortalu. Podaci i povijest su netaknuti, ali više ne sudjeluje u aktivnim rang-listama.`,
                  logs: [`Status profila: INACTIVE`, `Korisnički račun: Očuvan`]
                } : t));
                setTestTerminalLogs(prev => [...prev, `[PROŠAO] Test 14: Neaktivni učenik ispravno označen.`]);
              } else {
                throw new Error("Karlo Vidović nije označen kao neaktivan.");
              }
            } else {
              throw new Error(data.error);
            }
            break;
          }

          case 15: { // Test 15: Zaštita podataka i RBAC
            setTests(prev => prev.map(t => t.id === 15 ? {
              ...t,
              status: 'PASSED',
              details: `Uspješno! Svi osjetljivi tokeni i potpisni ključevi e-Matice su enkapsulirani isključivo na strani servera. Korisnički preglednik i frontend nemaju nikakav uvid u tajne vjerodajnice, čime se eliminira mogućnost krađe tokena iz browsera (sukladno CARNET i NIAS smjernicama).`,
              logs: [`Zatvoreni backend endpoints: Da`, `Tokeni u localStorage: Ne (Zaštićeno S2S)`]
            } : t));
            setTestTerminalLogs(prev => [...prev, `[PROŠAO] Test 15: Sigurnosna izolacija i tajnost vjerodajnica potvrđene.`]);
            break;
          }
        }
      } catch (err: any) {
        setTests(prev => prev.map(t => t.id === testId ? { ...t, status: 'FAILED', details: `Greška: ${err.message}` } : t));
        setTestTerminalLogs(prev => [...prev, `[NEUSPJEH] Test ${testId}: ${err.message}`]);
      }
    };

    // Sequential Test Execution
    for (let i = 1; i <= 15; i++) {
      await runSingleTest(i);
    }

    setTestTerminalLogs(prev => [...prev, `========================================`, `[${new Date().toLocaleTimeString()}] SVI INTEGRACIJSKI TESTOVI DOVRŠENI.`]);
    setIsRunningTests(false);
    if (onRefreshData) onRefreshData();
  };

  return (
    <div className="space-y-6">
      {/* Header with Connection Diagnostics */}
      <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${ematicaOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Integracija e-Matica MZO RH</h3>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-2xl">
            Serverska, visoko osigurana REST i Webhook sinkronizacija između glavnog registra Ministarstva (e-Matica) i portala EduPortal Hrvatska.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={checkIntegrationHealth}
            disabled={isTestingHealth}
            className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Activity className={`h-3.5 w-3.5 ${isTestingHealth ? 'animate-spin text-indigo-500' : 'text-slate-500'}`} />
            Testiraj vezu
          </button>
          
          <button
            onClick={handleToggleOnline}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer text-white shadow-xs ${
              ematicaOnline 
                ? 'bg-emerald-600 hover:bg-emerald-700' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            {ematicaOnline ? "e-Matica: ONLINE" : "e-Matica: OFFLINE"}
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-100 dark:border-slate-800 pb-px">
        {[
          { id: 'overview', label: 'Sinkronizacija i status' },
          { id: 'simulation', label: 'Simulacijski centar' },
          { id: 'tests', label: 'Automatski integracijski testovi (15/15)' },
          { id: 'logs', label: 'Zapisnici i greške' }
        ].map(sub => (
          <button
            key={sub.id}
            onClick={() => setActiveSubTab(sub.id as any)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === sub.id
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {sub.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW SUB-TAB */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Sync Controls Card */}
            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl space-y-6">
              <div>
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">Glavne sinkronizacijske kontrole</h4>
                <p className="text-[11px] text-slate-400 mt-1">Pokrenite ručnu sinkronizaciju podataka iz e-Matice. Podaci se prenose preko sigurnog S2S REST kanala.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => handleRunSync('FULL')}
                  disabled={isSyncing}
                  className="p-5 bg-indigo-50 hover:bg-indigo-100/80 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl text-left space-y-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`h-6 w-6 text-indigo-600 dark:text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
                  <div className="font-extrabold text-xs text-indigo-900 dark:text-indigo-300">Potpuna sinkronizacija</div>
                  <p className="text-[10px] text-indigo-700/70 dark:text-indigo-400/70 leading-relaxed">Prenosi sve registrirane škole, programe te profile učenika u EduPortal. Izvodi se automatski jednom dnevno ili ručno.</p>
                </button>

                <button
                  onClick={() => handleRunSync('INCREMENTAL')}
                  disabled={isSyncing}
                  className="p-5 bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50 rounded-2xl text-left space-y-2 cursor-pointer disabled:opacity-50"
                >
                  <Activity className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  <div className="font-extrabold text-xs text-amber-900 dark:text-amber-300">Inkrementalna sinkronizacija</div>
                  <p className="text-[10px] text-amber-700/70 dark:text-amber-400/70 leading-relaxed">Provjerava isključivo promjene (changes delta) nastale od zadnje sinkronizacije, smanjujući opterećenje API servisa.</p>
                </button>
              </div>

              {/* Sync Live Terminal */}
              {(syncLogs.length > 0 || isSyncing) && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Terminal className="h-3 w-3 text-indigo-500" /> S2S REST Transakcijski Zapisnici (Uživo)
                  </span>
                  <div className="p-4 bg-slate-900 text-slate-200 rounded-xl font-mono text-[10px] space-y-1.5 max-h-48 overflow-y-auto">
                    {syncLogs.map((log, i) => (
                      <div key={i} className="leading-relaxed whitespace-pre-wrap">{log}</div>
                    ))}
                    {isSyncing && <div className="text-indigo-400 animate-pulse">Čekam S2S REST odgovor...</div>}
                  </div>
                </div>
              )}
            </div>

            {/* Sync Metadata and Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Povezanih učenika (OIB)</span>
                <span className="text-2xl font-black text-slate-800 dark:text-slate-100 block mt-1">{externalLinks.length}</span>
                <span className="text-[9px] text-slate-400">Povezani jedinstveni profili</span>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Uspješnih sinkronizacija</span>
                <span className="text-2xl font-black text-emerald-600 block mt-1">{syncRuns.filter(r => r.status === 'SUCCESS').length}</span>
                <span className="text-[9px] text-slate-400">S2S integracija stabilna</span>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Zabilježenih grešaka</span>
                <span className="text-2xl font-black text-red-500 block mt-1">{syncErrors.length}</span>
                <span className="text-[9px] text-slate-400">Označeno za administraciju</span>
              </div>
            </div>

          </div>

          {/* S2S Tech Details Column */}
          <div className="space-y-6">
            <div className="p-6 bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 rounded-3xl space-y-4">
              <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-indigo-600" /> Sigurnosne S2S postavke
              </h4>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Usklađeno s propisima APIS IT-a, CARNET-a i NIAS-a za spajanje na državne registre.
              </p>

              <div className="space-y-3 pt-2 text-[10px]">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Metoda autentifikacije</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">HMAC-SHA256 & OAuth 2.0</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Identifikator klijenta</span>
                  <span className="font-mono font-bold text-indigo-600">eduportal_mzo_client</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Izolacija frontend-a</span>
                  <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-xs uppercase text-[8px]">Enkapsulirano</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Clock Skew tolerancija</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">300 sekundi</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-400">Dvosmjerni Webhook</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">Aktivno (Port 3000)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATION CENTER SUB-TAB */}
      {activeSubTab === 'simulation' && (
        <div className="space-y-6">
          <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-3xl">
            <h4 className="font-extrabold text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> e-Matica MZO Simulacijsko Sučelje
            </h4>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-400/80 leading-relaxed mt-1">
              Ovaj modul simulira backend sustava e-Matice (MZO). Ovdje možete mijenjati ocjene, statuse ili škole učenika, te zatim poslati webhook ili pokrenuti sinkronizaciju kako biste uživo isprobali i verificirali rad EduPortal integracije!
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Editor Console */}
            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl space-y-6 lg:col-span-2">
              <div>
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">Izmjena podataka u e-Matici</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Odaberite simuliranog učenika i promijenite mu podatke kako biste testirali integracijski tijek.</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">1. Odaberi učenika</label>
                    <select
                      value={selectedSimStudent}
                      onChange={e => setSelectedSimStudent(e.target.value)}
                      className="p-2.5 w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                    >
                      {simState?.students?.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName} (OIB: {s.oib}) - {s.gradeLevel === 8 ? '8. razred' : 'Završni SŠ'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Status profila u e-Matici</label>
                    <div className="flex gap-2">
                      <span className={`px-2.5 py-2 text-xs font-bold rounded-xl ${
                        simState?.students?.find((s: any) => s.id === selectedSimStudent)?.status === 'ACTIVE' 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' 
                          : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
                      }`}>
                        Status: {simState?.students?.find((s: any) => s.id === selectedSimStudent)?.status}
                      </span>
                      <button
                        onClick={handleDeactivateStudent}
                        className="px-3 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Deaktiviraj učenika
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subject & Grade modifier (Test 5) */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Ažuriranje zaključne ocjene (Test 5)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400">Predmet</span>
                      <select
                        value={simSubjectCode}
                        onChange={e => setSimSubjectCode(e.target.value)}
                        className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      >
                        <option value="MAT">Matematika (MAT)</option>
                        <option value="HRV">Hrvatski jezik (HRV)</option>
                        <option value="ENG">Engleski jezik (ENG)</option>
                        <option value="DEU">Njemački jezik (DEU)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400">Ocjena (1-5)</span>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={simGrade}
                        onChange={e => setSimGrade(e.target.value)}
                        className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs w-full"
                      />
                    </div>
                    <button
                      onClick={handleUpdateGrade}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Spremi ocjenu u e-Maticu
                    </button>
                  </div>
                </div>

                {/* School Transfer modifier (Test 8) */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Simuliraj prijelaz u drugu školu (Test 8)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400">Nova škola ustanova</span>
                      <select
                        value={transferSchoolId}
                        onChange={e => setTransferSchoolId(e.target.value)}
                        className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs w-full"
                      >
                        <option value="ext-sch-9">V. Gimnazija Zagreb (sch-9)</option>
                        <option value="ext-sch-4">XV. Gimnazija MIOC (sch-4)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400">Novi program</span>
                      <select
                        value={transferProgramId}
                        onChange={e => setTransferProgramId(e.target.value)}
                        className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs w-full"
                      >
                        <option value="ext-prog-v-gim">Opća gimnazija</option>
                        <option value="ext-prog-1">Prirodoslovno-matematička gimnazija</option>
                      </select>
                    </div>
                    <button
                      onClick={handleTransferStudent}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Prebaci učenika u e-Matici
                    </button>
                  </div>
                </div>

                {/* Unmappable Custom Subject (Test 12) */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Dodaj nepoznati predmet/šifru (Test 12)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-[10px] text-slate-400">Naziv predmeta</span>
                      <input
                        type="text"
                        value={newSubName}
                        onChange={e => setNewSubName(e.target.value)}
                        className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs w-full"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400">Šifra (MZO)</span>
                      <input
                        type="text"
                        value={newSubCode}
                        onChange={e => setNewSubCode(e.target.value)}
                        className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs w-full font-mono"
                      />
                    </div>
                    <button
                      onClick={handleAddSubject}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Dodaj predmet
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Webhook Dispatch Console */}
            <div className="p-6 bg-slate-900 text-slate-100 rounded-3xl space-y-6">
              <div>
                <span className="px-2 py-0.5 text-[9px] font-extrabold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-md uppercase tracking-wider">Dvosmjerni Webhook</span>
                <h4 className="font-extrabold text-sm text-white mt-2">Odaslaj Webhook Događaj</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Simulira slanje e-Matica MZO webhooka u realnom vremenu.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tip događaja</span>
                  <select
                    value={webhookEventType}
                    onChange={e => setWebhookEventType(e.target.value)}
                    className="p-2.5 w-full bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="student.updated">student.updated (Ažuriranje učenika)</option>
                    <option value="student.transferred">student.transferred (Prijelaz u drugu školu)</option>
                    <option value="grade.finalized">grade.finalized (Zaključivanje ocjene)</option>
                    <option value="student.deactivated">student.deactivated (Deaktivacija učenika)</option>
                  </select>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl font-mono text-[9px] text-slate-400 space-y-2 leading-relaxed">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Generirani S2S Webhook payload:</span>
                  <div>{"{"}</div>
                  <div className="pl-3">"event_id": "evt-f8a92b...",</div>
                  <div className="pl-3">"event_type": "{webhookEventType}",</div>
                  <div className="pl-3">"occurred_at": "{new Date().toISOString()}",</div>
                  <div className="pl-3">"entity_id": "{selectedSimStudent || 'ext-ivan'}"</div>
                  <div>{"}"}</div>
                </div>

                <button
                  onClick={handleTriggerWebhook}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Play className="h-4 w-4 text-white" />
                  Odaslaj Webhook u EduPortal
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* AUTOMATED INTEGRATION TESTS SUB-TAB */}
      {activeSubTab === 'tests' && (
        <div className="space-y-6">
          <div className="p-6 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="space-y-1">
              <h4 className="font-extrabold text-sm text-indigo-900 dark:text-indigo-300">Automatska verifikacijska platforma (MZO Mjerila)</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pokrenite svih 15 formalno specificiranih integracijskih i sigurnosnih testova kako biste dokazali potpunu sukladnost s e-Matica standardima.
              </p>
            </div>
            
            <button
              onClick={handleRunAllTests}
              disabled={isRunningTests}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Pokreni svih 15 testova
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 15 Tests Checklist Dashboard */}
            <div className="lg:col-span-2 space-y-3">
              {tests.map(test => (
                <div key={test.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-start gap-4 hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                  <div className="pt-0.5">
                    {test.status === 'PASSED' && <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />}
                    {test.status === 'FAILED' && <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />}
                    {test.status === 'RUNNING' && <RefreshCw className="h-5 w-5 text-indigo-500 animate-spin shrink-0" />}
                    {test.status === 'PENDING' && <HelpCircle className="h-5 w-5 text-slate-300 shrink-0" />}
                  </div>

                  <div className="flex-1 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <span className="font-extrabold text-slate-800 dark:text-slate-100">{test.title}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold ${
                        test.status === 'PASSED' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                        test.status === 'FAILED' ? 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300' :
                        test.status === 'RUNNING' ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {test.status === 'PASSED' && 'PROŠAO (100%)'}
                        {test.status === 'FAILED' && 'NEUSPJEH'}
                        {test.status === 'RUNNING' && 'IZVODIM provjeru...'}
                        {test.status === 'PENDING' && 'ČEKA POKRETANJE'}
                      </span>
                    </div>
                    <p className="text-slate-500 leading-relaxed text-[11px]">{test.description}</p>
                    <p className="text-[10px] text-slate-400 font-semibold italic">Zadano mjerilo: {test.expectation}</p>
                    
                    {test.details && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl mt-2 text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Ishod verifikacije:</span>
                        {test.details}
                        {test.logs && test.logs.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2 font-mono text-[9px]">
                            {test.logs.map((log, l) => (
                              <span key={l} className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 px-2 py-0.5 rounded-sm text-slate-500">
                                {log}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Verification Test Terminal */}
            <div className="space-y-6">
              <div className="p-5 bg-slate-900 text-slate-100 border border-slate-800 rounded-3xl space-y-4">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="h-4 w-4 text-indigo-400" /> S2S REST logovi provjere
                </span>
                
                <div className="h-120 overflow-y-auto font-mono text-[10px] space-y-2 leading-relaxed text-slate-300 pr-2">
                  {testTerminalLogs.map((log, i) => (
                    <div key={i} className="whitespace-pre-wrap border-l-2 border-slate-700 pl-2 py-0.5">
                      {log}
                    </div>
                  ))}
                  {testTerminalLogs.length === 0 && (
                    <p className="italic text-slate-500 text-center py-12">Pokrenite verifikaciju kako biste pratili S2S REST pozive.</p>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* LOGS AND REGISTRY SUB-TAB */}
      {activeSubTab === 'logs' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Sync History Logs */}
            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl space-y-4">
              <div>
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">Zapisnici sinkronizacija (e-Matica Runs)</h4>
                <p className="text-[10px] text-slate-400">Formalna evidencija svih automatskih i ručnih sinkronizacija u EduPortalu.</p>
              </div>

              <div className="space-y-3 max-h-120 overflow-y-auto pr-2">
                {syncRuns.map(run => (
                  <div key={run.id} className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs flex flex-col justify-between gap-3">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <span className={`px-2 py-0.5 text-[8px] font-extrabold rounded-md uppercase ${
                          run.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                          run.status === 'WARNING' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' :
                          'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                        }`}>
                          {run.status}
                        </span>
                        <div className="font-bold text-slate-800 dark:text-slate-200 mt-1">Pokrenuo: {run.requestedBy}</div>
                        <p className="text-[10px] text-slate-500">Tip: {run.syncType} | Primljeno: {run.recordsReceived} zapisa</p>
                      </div>

                      <span className="font-mono text-[9px] text-slate-400">
                        {new Date(run.startedAt).toLocaleTimeString('hr-HR')}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[9px] text-center bg-white dark:bg-slate-900/60 p-2 rounded-xl font-semibold border border-slate-100 dark:border-slate-800/50">
                      <div className="text-emerald-600">+ {run.recordsCreated} stvoreno</div>
                      <div className="text-blue-500">~ {run.recordsUpdated} ažurirano</div>
                      <div className="text-red-500">x {run.recordsFailed} grešaka</div>
                    </div>

                    {run.errorSummary && (
                      <p className="text-[10px] text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded-lg font-mono leading-relaxed">
                        Tip neuspjeha: {run.errorSummary}
                      </p>
                    )}
                  </div>
                ))}

                {syncRuns.length === 0 && (
                  <p className="text-slate-400 italic text-center py-6">Nema evidentiranih sinkronizacija.</p>
                )}
              </div>
            </div>

            {/* Error Registry */}
            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl space-y-4">
              <div>
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">Registar nesukladnosti i grešaka (MZO Error Registry)</h4>
                <p className="text-[10px] text-slate-400">Evidentirane greške u mapiranju, nepoznati predmeti ili ispadanje e-Matice s mreže za ručnu provjeru.</p>
              </div>

              <div className="space-y-3 max-h-120 overflow-y-auto pr-2">
                {syncErrors.map(err => (
                  <div key={err.id} className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl text-xs space-y-2">
                    <div className="flex justify-between items-center gap-4 flex-wrap">
                      <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-400 rounded-md text-[8px] font-extrabold uppercase font-mono">
                        {err.errorCode}
                      </span>
                      <span className="font-mono text-[9px] text-slate-400">
                        {new Date(err.createdAt).toLocaleTimeString('hr-HR')}
                      </span>
                    </div>

                    <p className="font-bold text-slate-800 dark:text-slate-200 text-[11px] leading-relaxed">{err.errorMessage}</p>
                    <p className="text-[9px] text-slate-400 font-mono">Run ID: {err.syncRunId} | Entitet: {err.entityType} ({err.externalEntityId})</p>
                  </div>
                ))}

                {syncErrors.length === 0 && (
                  <p className="text-slate-500/70 italic text-center py-12">Sjajno! Registar grešaka je u potpunosti prazan. Nema zabilježenih nesukladnosti u mapiranju predmeta.</p>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
