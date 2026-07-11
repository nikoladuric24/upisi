/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Search, X, School, GraduationCap, Users, FileText, ArrowRight } from 'lucide-react';
import { getTable } from '../lib/storage';
import { School as SchoolType, University, User, Student, SchoolProgram, StudyProgram, AppDocument } from '../types';

interface GlobalSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDetail: (type: 'student' | 'teacher' | 'school' | 'faculty' | 'program' | 'document', id: string, itemData?: any) => void;
}

export function GlobalSearchOverlay({ isOpen, onClose, onSelectDetail }: GlobalSearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    schools: SchoolType[];
    universities: University[];
    programs: SchoolProgram[];
    studies: StudyProgram[];
    users: User[];
    docs: AppDocument[];
  }>({
    schools: [],
    universities: [],
    programs: [],
    studies: [],
    users: [],
    docs: []
  });

  useEffect(() => {
    if (!query.trim()) {
      setResults({ schools: [], universities: [], programs: [], studies: [], users: [], docs: [] });
      return;
    }

    const q = query.toLowerCase();

    // Fetch data
    const schools = getTable<SchoolType>('schools').filter(
      s => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)
    );
    const universities = getTable<University>('universities').filter(
      u => u.name.toLowerCase().includes(q)
    );
    const programs = getTable<SchoolProgram>('school_programs').filter(
      p => p.name.toLowerCase().includes(q)
    );
    const studies = getTable<StudyProgram>('study_programs').filter(
      p => p.name.toLowerCase().includes(q)
    );
    const users = getTable<User>('users').filter(
      u => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
    );
    const docs = getTable<AppDocument>('documents').filter(
      d => d.name.toLowerCase().includes(q) || d.purpose.toLowerCase().includes(q)
    );

    setResults({ schools, universities, programs, studies, users, docs });
  }, [query]);

  // Handle keyboard ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const totalResults =
    results.schools.length +
    results.universities.length +
    results.programs.length +
    results.studies.length +
    results.users.length +
    results.docs.length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-md p-4 sm:p-6 md:p-20 flex justify-center items-start animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden mt-8">
        
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <Search className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pretraži škole, fakultete, učenike, programe, dokumente..."
            className="w-full bg-transparent border-0 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden text-sm"
            autoFocus
          />
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition-all cursor-pointer"
            aria-label="Zatvori"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Results Area */}
        <div className="p-5 max-h-[480px] overflow-y-auto space-y-5">
          {query === '' ? (
            <div className="text-center py-8 space-y-2">
              <Search className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Globalno pretraživanje</h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-sm mx-auto leading-relaxed">
                Unesite ključnu riječ za pretraživanje nacionalnog sustava visokog i srednjeg obrazovanja u Republici Hrvatskoj.
              </p>
            </div>
          ) : totalResults === 0 ? (
            <div className="text-center py-10 space-y-1">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Nema rezultata za "{query}"</p>
              <p className="text-[11px] text-slate-400">Pokušajte s drugim pojmom (npr. gimnazija, Luka, OIB, FER, medicina).</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex justify-between">
                <span>Pronađeni zapisi</span>
                <span className="text-indigo-600 dark:text-indigo-400">{totalResults} rezultata</span>
              </div>

              {/* Schools */}
              {results.schools.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <School className="h-3.5 w-3.5 text-indigo-500" /> Škole ({results.schools.length})
                  </h5>
                  <div className="grid grid-cols-1 gap-1.5">
                    {results.schools.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectDetail('school', item.id, item);
                          onClose();
                        }}
                        className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-900 border border-transparent hover:border-slate-100 dark:hover:border-slate-800 rounded-2xl flex justify-between items-center transition-all cursor-pointer group"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{item.address}, {item.cityId === 'city-1' ? 'Zagreb' : 'Split'}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Universities */}
              {results.universities.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <GraduationCap className="h-3.5 w-3.5 text-emerald-500" /> Sveučilišta ({results.universities.length})
                  </h5>
                  <div className="grid grid-cols-1 gap-1.5">
                    {results.universities.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectDetail('school', item.id, item); // use generic school viewer
                          onClose();
                        }}
                        className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-900 border border-transparent hover:border-slate-100 dark:hover:border-slate-800 rounded-2xl flex justify-between items-center transition-all cursor-pointer group"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Visoko obrazovanje u Republici Hrvatskoj</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Users & Students */}
              {results.users.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-blue-500" /> Osoblje & Korisnici ({results.users.length})
                  </h5>
                  <div className="grid grid-cols-1 gap-1.5">
                    {results.users.map((item) => {
                      const isStudentRole = item.role.includes('STUDENT');
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            const studentDetail = getTable<Student>('students').find(s => s.userId === item.id);
                            if (studentDetail) {
                              onSelectDetail('student', studentDetail.id, { ...studentDetail, fullName: item.fullName, email: item.email });
                            } else {
                              onSelectDetail('teacher', item.id, item);
                            }
                            onClose();
                          }}
                          className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-900 border border-transparent hover:border-slate-100 dark:hover:border-slate-800 rounded-2xl flex justify-between items-center transition-all cursor-pointer group"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.fullName}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{item.email} • <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{item.role}</span></p>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Programs */}
              {(results.programs.length > 0 || results.studies.length > 0) && (
                <div className="space-y-2">
                  <h5 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <GraduationCap className="h-3.5 w-3.5 text-amber-500" /> Obrazovni programi ({results.programs.length + results.studies.length})
                  </h5>
                  <div className="grid grid-cols-1 gap-1.5">
                    {results.programs.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectDetail('program', item.id, item);
                          onClose();
                        }}
                        className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-900 border border-transparent hover:border-slate-100 dark:hover:border-slate-800 rounded-2xl flex justify-between items-center transition-all cursor-pointer group"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Srednjoškolski smjer • Kvota: {item.quota}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                    {results.studies.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectDetail('program', item.id, item);
                          onClose();
                        }}
                        className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-900 border border-transparent hover:border-slate-100 dark:hover:border-slate-800 rounded-2xl flex justify-between items-center transition-all cursor-pointer group"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Sveučilišni studijski program • Kvota: {item.quota}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents */}
              {results.docs.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-rose-500" /> Dokumenti ({results.docs.length})
                  </h5>
                  <div className="grid grid-cols-1 gap-1.5">
                    {results.docs.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectDetail('document', item.id, item);
                          onClose();
                        }}
                        className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-900 border border-transparent hover:border-slate-100 dark:hover:border-slate-800 rounded-2xl flex justify-between items-center transition-all cursor-pointer group"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Svrha: {item.purpose} • Status: {item.status}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
