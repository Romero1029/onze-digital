import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, BookOpen, Users, ClipboardList, Pencil, Trash2, Loader2, GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';
import { TurmaDetail } from './TurmaDetail';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Turma {
  id: string;
  nome: string;
  descricao: string | null;
  status: 'ativa' | 'encerrada' | 'rascunho';
  professora_id: string | null;
  created_at: string;
  // aggregated
  modulos_count?: number;
  alunos_count?: number;
  tarefas_count?: number;
}

interface Professora {
  id: string;
  nome: string;
  email: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Pedagogico() {
  const { user, users } = useAuth();
  const isAdmin = user?.tipo === 'admin';

  const [turmas, setTurmas]         = useState<Turma[]>([]);
  const [professoras, setProfessoras] = useState<Professora[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedTurma, setSelectedTurma] = useState<Turma | null>(null);

  // Modal
  const [modal, setModal] = useState<{ open: boolean; editing: Turma | null }>({ open: false, editing: null });
  const [form, setForm]   = useState({ nome: '', descricao: '', status: 'ativa', professora_id: '' });
  const [saving, setSaving] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);

    // Load turmas
    const { data: turmasData } = await supabase
      .from('pedagogico_turmas')
      .select('*')
      .order('created_at', { ascending: false });

    if (!turmasData) { setLoading(false); return; }

    // Augment with counts
    const augmented: Turma[] = await Promise.all(
      turmasData.map(async (t) => {
        const [mods, alus, tars] = await Promise.all([
          supabase.from('pedagogico_modulos').select('id', { count: 'exact', head: true }).eq('turma_id', t.id),
          supabase.from('pedagogico_alunos').select('id', { count: 'exact', head: true }).eq('turma_id', t.id),
          supabase.from('pedagogico_tarefas')
            .select('id', { count: 'exact', head: true })
            .in('modulo_id',
              (await supabase.from('pedagogico_modulos').select('id').eq('turma_id', t.id)).data?.map(m => m.id) ?? []
            ),
        ]);
        return {
          ...t,
          modulos_count: mods.count ?? 0,
          alunos_count:  alus.count ?? 0,
          tarefas_count: tars.count ?? 0,
        };
      })
    );

    // Filter for professora role — only their turmas
    const filtered = user?.tipo === 'professora'
      ? augmented.filter(t => t.professora_id === user.id)
      : augmented;

    setTurmas(filtered);

    // Professoras = users with role professora (admin can see all)
    if (isAdmin) {
      const profs = users.filter(u => u.tipo === 'professora' && u.ativo);
      setProfessoras(profs.map(p => ({ id: p.id, nome: p.nome, email: p.email })));
    }

    setLoading(false);
  }, [user, users, isAdmin]);

  useEffect(() => { load(); }, [load]);

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const openModal = (editing: Turma | null = null) => {
    setForm({
      nome: editing?.nome ?? '',
      descricao: editing?.descricao ?? '',
      status: editing?.status ?? 'ativa',
      professora_id: editing?.professora_id ?? '',
    });
    setModal({ open: true, editing });
  };

  const saveTurma = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      status: form.status,
      professora_id: form.professora_id || null,
    };
    if (modal.editing) {
      const { error } = await supabase.from('pedagogico_turmas').update(payload).eq('id', modal.editing.id);
      if (error) { toast.error('Erro ao atualizar'); setSaving(false); return; }
      toast.success('Turma atualizada!');
    } else {
      const { error } = await supabase.from('pedagogico_turmas').insert(payload);
      if (error) { toast.error('Erro ao criar turma'); setSaving(false); return; }
      toast.success('Turma criada!');
    }
    setModal({ open: false, editing: null });
    setSaving(false);
    await load();
  };

  const deleteTurma = async (id: string) => {
    if (!confirm('Apagar turma e todo o conteúdo? Esta ação não pode ser desfeita.')) return;
    const { error } = await supabase.from('pedagogico_turmas').delete().eq('id', id);
    if (error) { toast.error('Erro ao apagar'); return; }
    toast.success('Turma apagada!');
    await load();
  };

  // ── Detail view ────────────────────────────────────────────────────────────
  if (selectedTurma) {
    return (
      <TurmaDetail
        turmaId={selectedTurma.id}
        turmaNome={selectedTurma.nome}
        onBack={() => { setSelectedTurma(null); load(); }}
      />
    );
  }

  // ── Status helpers ─────────────────────────────────────────────────────────
  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      ativa:     'bg-green-100 text-green-700',
      encerrada: 'bg-gray-100 text-gray-500',
      rascunho:  'bg-yellow-100 text-yellow-700',
    };
    const labels: Record<string, string> = { ativa: 'Ativa', encerrada: 'Encerrada', rascunho: 'Rascunho' };
    return { cls: map[s] ?? 'bg-gray-100 text-gray-500', label: labels[s] ?? s };
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 overflow-y-auto h-full bg-white">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-100">
            <GraduationCap className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pedagógico</h1>
            <p className="text-sm text-gray-400">
              {user?.tipo === 'professora' ? `Olá, ${user.nome} 👋` : `${turmas.length} turma${turmas.length !== 1 ? 's' : ''} cadastrada${turmas.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => openModal()} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4" /> Nova Turma
          </Button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
        </div>
      )}

      {/* Empty */}
      {!loading && turmas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 text-center">
          <GraduationCap className="h-12 w-12 text-gray-200" />
          <p className="text-gray-400 font-medium">Nenhuma turma ainda</p>
          {isAdmin && (
            <Button onClick={() => openModal()} size="sm" variant="outline" className="gap-1.5">
              <Plus className="h-4 w-4" /> Criar primeira turma
            </Button>
          )}
        </div>
      )}

      {/* Turmas grid */}
      {!loading && turmas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {turmas.map(turma => {
            const { cls, label } = statusBadge(turma.status);
            const prof = professoras.find(p => p.id === turma.professora_id);
            return (
              <Card
                key={turma.id}
                className="border border-gray-100 shadow-sm rounded-2xl p-5 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
                onClick={() => setSelectedTurma(turma)}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 leading-snug truncate">{turma.nome}</h3>
                    {turma.descricao && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{turma.descricao}</p>
                    )}
                  </div>
                  <Badge className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${cls}`}>{label}</Badge>
                </div>

                {/* Counts */}
                <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" /> {turma.modulos_count} módulo{turma.modulos_count !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <ClipboardList className="h-3.5 w-3.5" /> {turma.tarefas_count} tarefa{turma.tarefas_count !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {turma.alunos_count} aluno{turma.alunos_count !== 1 ? 's' : ''}
                  </span>
                </div>

                {prof && (
                  <p className="text-xs text-indigo-500 font-medium">👩‍🏫 {prof.nome}</p>
                )}

                {/* Admin actions */}
                {isAdmin && (
                  <div
                    className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => openModal(turma)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                    >
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                    <button
                      onClick={() => deleteTurma(turma.id)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> Apagar
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Modal Turma ─────────────────────────────────────────────────────── */}
      <Dialog open={modal.open} onOpenChange={v => setModal(p => ({ ...p, open: v }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{modal.editing ? 'Editar' : 'Nova'} Turma</DialogTitle>
            <DialogDescription>Configure a turma e atribua uma professora.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Nome *</label>
              <Input
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Turma A — Psicanálise 2026"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Descrição</label>
              <Input
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Descrição opcional"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="encerrada">Encerrada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {professoras.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Professora responsável</label>
                <Select value={form.professora_id} onValueChange={v => setForm(f => ({ ...f, professora_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar professora" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma</SelectItem>
                    {professoras.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModal(p => ({ ...p, open: false }))}>Cancelar</Button>
            <Button
              onClick={saveTurma}
              disabled={saving || !form.nome.trim()}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
