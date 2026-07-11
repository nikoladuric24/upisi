import React, { useState } from 'react';
import { SchoolProgram } from '../types';
import { Plus, Edit2, Trash2, Save } from 'lucide-react';

interface Props {
  institutionId: string;
  programs: SchoolProgram[];
  onSave: (program: SchoolProgram) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

export function InstitutionProgramsView({ institutionId, programs, onSave, onDelete, onBack }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newProgram, setNewProgram] = useState<Partial<SchoolProgram>>({ schoolId: institutionId, name: '', durationYears: 4, quota: 0, minPointsThreshold: 0, subjectsRequired: [] });

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs text-indigo-600 hover:underline">← Nazad na popis ustanova</button>
      <h3 className="text-lg font-bold">Upravljanje programima</h3>
      
      <div className="overflow-x-auto border border-slate-100 rounded-2xl">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="py-2 px-3">Naziv</th>
              <th className="py-2 px-2">Kvota</th>
              <th className="py-2 px-2">Bodovni prag</th>
              <th className="py-2 px-3 text-right">Akcije</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {programs.map(p => (
              <tr key={p.id}>
                <td className="py-2 px-3">{p.name}</td>
                <td className="py-2 px-2">{p.quota}</td>
                <td className="py-2 px-2">{p.minPointsThreshold}</td>
                <td className="py-2 px-3 text-right">
                    <button onClick={() => onDelete(p.id)} className="p-1 text-red-500"><Trash2 className="h-4 w-4"/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
        <h4 className="font-bold text-sm">Dodaj novi program</h4>
        <div className="grid grid-cols-2 gap-2">
            <input placeholder="Naziv programa" className="p-2 border rounded-xl text-xs" onChange={e => setNewProgram({...newProgram, name: e.target.value})} />
            <input placeholder="Kvota" type="number" className="p-2 border rounded-xl text-xs" onChange={e => setNewProgram({...newProgram, quota: parseInt(e.target.value)})} />
            <input placeholder="Bodovni prag" type="number" className="p-2 border rounded-xl text-xs" onChange={e => setNewProgram({...newProgram, minPointsThreshold: parseInt(e.target.value)})} />
            <button className="bg-indigo-600 text-white rounded-xl text-xs font-bold" onClick={() => onSave({ ...newProgram, id: `prog-${Date.now()}` } as SchoolProgram)}>Spremi</button>
        </div>
      </div>
    </div>
  );
}
