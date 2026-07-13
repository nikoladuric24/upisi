import React, { useState } from 'react';
import { SchoolProgram } from '../types';
import { Plus, Edit2, Trash2, Save } from 'lucide-react';
import { useRbac } from './RbacContext';

interface Props {
  institutionId: string;
  institutionType: 'PRIMARY' | 'SECONDARY' | 'UNIVERSITY' | 'FACULTY';
  programs: SchoolProgram[];
  onSave: (program: SchoolProgram) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

export function InstitutionProgramsView({ institutionId, institutionType, programs, onSave, onDelete, onBack }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newProgram, setNewProgram] = useState<Partial<SchoolProgram>>({ schoolId: institutionId, name: '', durationYears: 4, quota: 0, minPointsThreshold: 0, subjectsRequired: [] });
  const { hasPermission } = useRbac();

  // SECONDARY_SCHOOL -> school_programs
  // UNIVERSITY/FACULTY -> study_programs
  const createPermission = institutionType === 'SECONDARY' ? 'school_programs.create' : 'study_programs.create';
  const updatePermission = institutionType === 'SECONDARY' ? 'school_programs.update' : 'study_programs.update';

  const canCreate = hasPermission(createPermission as any, { schoolId: institutionType === 'SECONDARY' ? institutionId : undefined, facultyId: institutionType !== 'SECONDARY' ? institutionId : undefined });
  const canUpdate = hasPermission(updatePermission as any, { schoolId: institutionType === 'SECONDARY' ? institutionId : undefined, facultyId: institutionType !== 'SECONDARY' ? institutionId : undefined });

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs text-indigo-600 hover:underline">← Nazad na popis ustanova</button>
      <h3 className="text-lg font-bold">Upravljanje programima</h3>
      
      <div className="overflow-x-auto border border-slate-100 rounded-2xl">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="py-2 px-3 text-left">Naziv</th>
              <th className="py-2 px-2 text-left">Kvota</th>
              <th className="py-2 px-2 text-left">Prag</th>
              <th className="py-2 px-2 text-center">Status</th>
              <th className="py-2 px-3 text-right">Akcije</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {programs.map(p => (
              <tr key={p.id}>
                <td className="py-2 px-3">{p.name}</td>
                <td className="py-2 px-2">{p.quota}</td>
                <td className="py-2 px-2">{p.minPointsThreshold}</td>
                <td className="py-2 px-2 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.isPublished ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                    {p.isPublished ? 'Objavljeno' : 'Skriveno'}
                  </span>
                </td>
                <td className="py-2 px-3 text-right flex justify-end gap-2">
                    {canUpdate && (
                        <button 
                          onClick={() => onSave({ ...p, isPublished: !p.isPublished })} 
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold"
                        >
                          {p.isPublished ? 'Sakrij' : 'Objavi'}
                        </button>
                    )}
                    {canUpdate && (
                        <button onClick={() => onDelete(p.id)} className="p-1 text-red-500"><Trash2 className="h-4 w-4"/></button>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canCreate && (
        <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
            <h4 className="font-bold text-sm">Dodaj novi program</h4>
            <div className="grid grid-cols-2 gap-2">
                <input placeholder="Naziv programa" className="p-2 border rounded-xl text-xs" onChange={e => setNewProgram({...newProgram, name: e.target.value})} />
                <input placeholder="Kvota" type="number" className="p-2 border rounded-xl text-xs" onChange={e => setNewProgram({...newProgram, quota: parseInt(e.target.value)})} />
                <input placeholder="Bodovni prag" type="number" className="p-2 border rounded-xl text-xs" onChange={e => setNewProgram({...newProgram, minPointsThreshold: parseInt(e.target.value)})} />
                <button className="bg-indigo-600 text-white rounded-xl text-xs font-bold" onClick={() => onSave({ ...newProgram, id: `prog-${Date.now()}`, isPublished: true, isActive: true } as SchoolProgram)}>Spremi</button>
            </div>
        </div>
      )}
    </div>
  );
}
