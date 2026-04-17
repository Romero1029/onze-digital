import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  ArrowLeft, Plus, Trash2, Pencil, ChevronDown, ChevronRight,
  Link, Video, FileText, Copy, ExternalLink, Check, Loader2,
  Users, BookOpen, ClipboardList, BarChart2, GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Modulo {
  id: string; turma_id: string; nome: string; descricao: string | null; ordem: number;
}
interface Material {
  id: string; modulo_id: string; titulo: string; tipo: string; url: string; ordem: number;
}
interface Questao {
  id: string; tipo: 'texto_livre' | 'multipla_escolha' | 'verdadeiro_falso' | 'resposta_curta';
  enunciado: string; opcoes?: string[]; gabarito?: string; peso: number;
}
interface Tarefa {
  id: string; modulo_id: string; titulo: string; descricao: string | null;
  instrucoes: string | null; questoes: Questao[]; criterios_ia: string | null;
  pontuacao_max: number; data_entrega: string | null; status: string;
}
interface Aluno {
  id: string; turma_id: string; nome: string; email: string | null; whatsapp: string | null; documento: string | null;
}
interface Entrega {
  id: string; tarefa_id: string; aluno_nome: string; aluno_documento: string;
  aluno_email: string | null; respostas: Record<string, string>;
  nota_ia: number | null; feedback_ia: string | null;
  nota_final: number | null; feedback_professor: string | null; status: string;
  created_at: string;
}

type Tab = 'modulos' | 'tarefas' | 'alunos' | 'notas';

const TIPO_ICONS: Record<string, React.ElementType> = {
  link: Link, video: Video, documento: FileText,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId() { return crypto.randomUUID(); }

function CopyLinkBtn({ tarefaId }: { tarefaId: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/forms/tarefa/${tarefaId}`;
  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
      title="Copiar link público"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copiado!' : 'Copiar link'}
    </button>
  );
}

// ─── QuestionEditor ────────────────────────────────────────────────────────────

function QuestionEditor({
  questoes,
  onChange,
}: {
  questoes: Questao[];
  onChange: (q: Questao[]) => void;
}) {
  const add = () =>
    onChange([...questoes, { id: newId(), tipo: 'texto_livre', enunciado: '', peso: 1 }]);

  const update = (id: string, patch: Partial<Questao>) =>
    onChange(questoes.map(q => q.id === id ? { ...q, ...patch } : q));

  const remove = (id: string) => onChange(questoes.filter(q => q.id !== id));

  const addOpcao = (qId: string) => {
    const q = questoes.find(x => x.id === qId)!;
    update(qId, { opcoes: [...(q.opcoes ?? []), ''] });
  };

  const updateOpcao = (qId: string, idx: number, val: string) => {
    const q = questoes.find(x => x.id === qId)!;
    const opcoes = [...(q.opcoes ?? [])];
    opcoes[idx] = val;
    update(qId, { opcoes });
  };

  const removeOpcao = (qId: string, idx: number) => {
    const q = questoes.find(x => x.id === qId)!;
    update(qId, { opcoes: (q.opcoes ?? []).filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      {questoes.map((q, idx) => (
        <div key={q.id} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-gray-500">Questão {idx + 1}</span>
            <button onClick={() => remove(q.id)} className="text-gray-300 hover:text-red-500 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select value={q.tipo} onValueChange={v => update(q.id, { tipo: v as Questao['tipo'] })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="texto_livre">Texto livre</SelectItem>
                <SelectItem value="resposta_curta">Resposta curta</SelectItem>
                <SelectItem value="multipla_escolha">Múltipla escolha</SelectItem>
                <SelectItem value="verdadeiro_falso">Verdadeiro / Falso</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 whitespace-nowrap">Peso:</span>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={q.peso}
                onChange={e => update(q.id, { peso: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <textarea
            className="w-full border border-gray-200 rounded-lg p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 min-h-[64px]"
            placeholder="Enunciado da questão"
            value={q.enunciado}
            onChange={e => update(q.id, { enunciado: e.target.value })}
          />

          {q.tipo === 'multipla_escolha' && (
            <div className="space-y-1.5">
              {(q.opcoes ?? []).map((op, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <Input
                    value={op}
                    onChange={e => updateOpcao(q.id, oi, e.target.value)}
                    placeholder={`Opção ${oi + 1}`}
                    className="h-8 text-xs flex-1"
                  />
                  <button onClick={() => removeOpcao(q.id, oi)} className="text-gray-300 hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addOpcao(q.id)}
                className="text-xs text-indigo-600 hover:underline"
              >
                + Adicionar opção
              </button>
            </div>
          )}

          {(q.tipo === 'multipla_escolha' || q.tipo === 'verdadeiro_falso' || q.tipo === 'resposta_curta') && (
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Gabarito (para correção automática)</label>
              <Input
                value={q.gabarito ?? ''}
                onChange={e => update(q.id, { gabarito: e.target.value })}
                placeholder={q.tipo === 'verdadeiro_falso' ? 'Verdadeiro ou Falso' : 'Resposta correta'}
                className="h-8 text-xs"
              />
            </div>
          )}
        </div>
      ))}
      <button
        onClick={add}
        className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus className="h-4 w-4" /> Adicionar Questão
      </button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface Props {
  turmaId: string;
  turmaNome: string;
  onBack: () => void;
}

export function TurmaDetail({ turmaId, turmaNome, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('modulos');

  // Data
  const [modulos, setModulos]   = useState<Modulo[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [tarefas, setTarefas]   = useState<Tarefa[]>([]);
  const [alunos, setAlunos]     = useState<Aluno[]>([]);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading]   = useState(true);

  // Expanded
  const [expandedMod, setExpandedMod] = useState<Record<string, boolean>>({});

  // Modals
  const [moduloModal, setModuloModal]   = useState<{ open: boolean; editing: Modulo | null }>({ open: false, editing: null });
  const [materialModal, setMaterialModal] = useState<{ open: boolean; moduloId: string | null; editing: Material | null }>({ open: false, moduloId: null, editing: null });
  const [tarefaModal, setTarefaModal]   = useState<{ open: boolean; moduloId: string | null; editing: Tarefa | null }>({ open: false, moduloId: null, editing: null });
  const [alunoModal, setAlunoModal]     = useState<{ open: boolean; editing: Aluno | null }>({ open: false, editing: null });
  const [entregaModal, setEntregaModal] = useState<Entrega | null>(null);

  // Forms
  const [moduloForm, setModuloForm]   = useState({ nome: '', descricao: '' });
  const [materialForm, setMaterialForm] = useState({ titulo: '', tipo: 'link', url: '' });
  const [tarefaForm, setTarefaForm]   = useState({
    titulo: '', descricao: '', instrucoes: '', criterios_ia: '',
    pontuacao_max: '10', data_entrega: '', status: 'rascunho' as string,
    questoes: [] as Questao[],
  });
  const [alunoForm, setAlunoForm]     = useState({ nome: '', email: '', whatsapp: '', documento: '' });
  const [notaFinalInput, setNotaFinalInput] = useState('');
  const [feedbackProfInput, setFeedbackProfInput] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const [mods, mats, tar, alu, entr] = await Promise.all([
      supabase.from('pedagogico_modulos').select('*').eq('turma_id', turmaId).order('ordem'),
      supabase.from('pedagogico_materiais').select('*').order('ordem'),
      supabase.from('pedagogico_tarefas').select('*').order('created_at'),
      supabase.from('pedagogico_alunos').select('*').eq('turma_id', turmaId).order('nome'),
      supabase.from('pedagogico_entregas').select('*').order('created_at', { ascending: false }),
    ]);
    setModulos((mods.data ?? []) as Modulo[]);
    setMateriais((mats.data ?? []) as Material[]);
    setTarefas((tar.data ?? []) as Tarefa[]);
    setAlunos((alu.data ?? []) as Aluno[]);
    setEntregas((entr.data ?? []) as Entrega[]);
    setLoading(false);
  }, [turmaId]);

  useEffect(() => { load(); }, [load]);

  // ── Módulos CRUD ───────────────────────────────────────────────────────────
  const openModuloModal = (editing: Modulo | null = null) => {
    setModuloForm({ nome: editing?.nome ?? '', descricao: editing?.descricao ?? '' });
    setModuloModal({ open: true, editing });
  };

  const saveModulo = async () => {
    if (!moduloForm.nome.trim()) return;
    setSaving(true);
    if (moduloModal.editing) {
      await supabase.from('pedagogico_modulos').update({ nome: moduloForm.nome, descricao: moduloForm.descricao || null })
        .eq('id', moduloModal.editing.id);
    } else {
      const ordem = modulos.length;
      await supabase.from('pedagogico_modulos').insert({ turma_id: turmaId, nome: moduloForm.nome, descricao: moduloForm.descricao || null, ordem });
    }
    setModuloModal({ open: false, editing: null });
    setSaving(false);
    await load();
    toast.success(moduloModal.editing ? 'Módulo atualizado!' : 'Módulo criado!');
  };

  const deleteModulo = async (id: string) => {
    if (!confirm('Apagar módulo e todos os materiais/tarefas?')) return;
    await supabase.from('pedagogico_modulos').delete().eq('id', id);
    await load();
    toast.success('Módulo apagado!');
  };

  // ── Materiais CRUD ─────────────────────────────────────────────────────────
  const openMaterialModal = (moduloId: string, editing: Material | null = null) => {
    setMaterialForm({ titulo: editing?.titulo ?? '', tipo: editing?.tipo ?? 'link', url: editing?.url ?? '' });
    setMaterialModal({ open: true, moduloId, editing });
  };

  const saveMaterial = async () => {
    if (!materialForm.titulo.trim() || !materialForm.url.trim()) return;
    setSaving(true);
    const modId = materialModal.moduloId!;
    if (materialModal.editing) {
      await supabase.from('pedagogico_materiais').update({ titulo: materialForm.titulo, tipo: materialForm.tipo, url: materialForm.url })
        .eq('id', materialModal.editing.id);
    } else {
      const ordem = materiais.filter(m => m.modulo_id === modId).length;
      await supabase.from('pedagogico_materiais').insert({ modulo_id: modId, titulo: materialForm.titulo, tipo: materialForm.tipo, url: materialForm.url, ordem });
    }
    setMaterialModal({ open: false, moduloId: null, editing: null });
    setSaving(false);
    await load();
    toast.success('Material salvo!');
  };

  const deleteMaterial = async (id: string) => {
    await supabase.from('pedagogico_materiais').delete().eq('id', id);
    await load();
    toast.success('Material removido!');
  };

  // ── Tarefas CRUD ───────────────────────────────────────────────────────────
  const openTarefaModal = (moduloId: string, editing: Tarefa | null = null) => {
    setTarefaForm({
      titulo: editing?.titulo ?? '',
      descricao: editing?.descricao ?? '',
      instrucoes: editing?.instrucoes ?? '',
      criterios_ia: editing?.criterios_ia ?? '',
      pontuacao_max: String(editing?.pontuacao_max ?? 10),
      data_entrega: editing?.data_entrega ? editing.data_entrega.slice(0, 16) : '',
      status: editing?.status ?? 'rascunho',
      questoes: editing?.questoes ? JSON.parse(JSON.stringify(editing.questoes)) : [],
    });
    setTarefaModal({ open: true, moduloId, editing });
  };

  const saveTarefa = async () => {
    if (!tarefaForm.titulo.trim()) return;
    setSaving(true);
    const payload = {
      titulo: tarefaForm.titulo,
      descricao: tarefaForm.descricao || null,
      instrucoes: tarefaForm.instrucoes || null,
      criterios_ia: tarefaForm.criterios_ia || null,
      pontuacao_max: Number(tarefaForm.pontuacao_max) || 10,
      data_entrega: tarefaForm.data_entrega ? new Date(tarefaForm.data_entrega).toISOString() : null,
      status: tarefaForm.status,
      questoes: tarefaForm.questoes,
    };
    if (tarefaModal.editing) {
      await supabase.from('pedagogico_tarefas').update(payload).eq('id', tarefaModal.editing.id);
    } else {
      await supabase.from('pedagogico_tarefas').insert({ ...payload, modulo_id: tarefaModal.moduloId! });
    }
    setTarefaModal({ open: false, moduloId: null, editing: null });
    setSaving(false);
    await load();
    toast.success(tarefaModal.editing ? 'Tarefa atualizada!' : 'Tarefa criada!');
  };

  const deleteTarefa = async (id: string) => {
    if (!confirm('Apagar tarefa e todas as entregas?')) return;
    await supabase.from('pedagogico_tarefas').delete().eq('id', id);
    await load();
    toast.success('Tarefa apagada!');
  };

  // ── Alunos CRUD ────────────────────────────────────────────────────────────
  const openAlunoModal = (editing: Aluno | null = null) => {
    setAlunoForm({ nome: editing?.nome ?? '', email: editing?.email ?? '', whatsapp: editing?.whatsapp ?? '', documento: editing?.documento ?? '' });
    setAlunoModal({ open: true, editing });
  };

  const saveAluno = async () => {
    if (!alunoForm.nome.trim()) return;
    setSaving(true);
    if (alunoModal.editing) {
      await supabase.from('pedagogico_alunos').update({ nome: alunoForm.nome, email: alunoForm.email || null, whatsapp: alunoForm.whatsapp || null, documento: alunoForm.documento || null })
        .eq('id', alunoModal.editing.id);
    } else {
      await supabase.from('pedagogico_alunos').insert({ turma_id: turmaId, nome: alunoForm.nome, email: alunoForm.email || null, whatsapp: alunoForm.whatsapp || null, documento: alunoForm.documento || null });
    }
    setAlunoModal({ open: false, editing: null });
    setSaving(false);
    await load();
    toast.success(alunoModal.editing ? 'Aluno atualizado!' : 'Aluno adicionado!');
  };

  const deleteAluno = async (id: string) => {
    await supabase.from('pedagogico_alunos').delete().eq('id', id);
    await load();
    toast.success('Aluno removido!');
  };

  // ── Notas ──────────────────────────────────────────────────────────────────
  const openEntregaModal = (e: Entrega) => {
    setEntregaModal(e);
    setNotaFinalInput(String(e.nota_final ?? e.nota_ia ?? ''));
    setFeedbackProfInput(e.feedback_professor ?? '');
  };

  const saveNota = async () => {
    if (!entregaModal) return;
    setSaving(true);
    await supabase.from('pedagogico_entregas').update({
      nota_final: notaFinalInput ? Number(notaFinalInput) : null,
      feedback_professor: feedbackProfInput || null,
      status: 'corrigido',
    }).eq('id', entregaModal.id);
    setSaving(false);
    setEntregaModal(null);
    await load();
    toast.success('Nota salva!');
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const moduloTarefas = (modId: string) => tarefas.filter(t => t.modulo_id === modId);
  const tarefaEntregas = (tId: string) => entregas.filter(e => e.tarefa_id === tId);
  const statusColor = (s: string) => ({ aberta: 'bg-green-100 text-green-700', fechada: 'bg-gray-100 text-gray-500', rascunho: 'bg-yellow-100 text-yellow-700' }[s] ?? 'bg-gray-100 text-gray-500');

  const TABS = [
    { id: 'modulos', label: 'Módulos', icon: BookOpen },
    { id: 'tarefas', label: 'Tarefas', icon: ClipboardList },
    { id: 'alunos',  label: 'Alunos',  icon: Users },
    { id: 'notas',   label: 'Notas',   icon: BarChart2 },
  ] as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 overflow-y-auto h-full bg-white">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{turmaNome}</h1>
          <p className="text-xs text-gray-400">{modulos.length} módulos · {alunos.length} alunos · {tarefas.length} tarefas</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Módulos ────────────────────────────────────────────────────────── */}
      {tab === 'modulos' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openModuloModal()} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
              <Plus className="h-4 w-4" /> Novo Módulo
            </Button>
          </div>

          {modulos.length === 0 && (
            <p className="text-center text-gray-400 py-12 text-sm">Nenhum módulo ainda. Crie o primeiro!</p>
          )}

          {modulos.map(mod => {
            const mats = materiais.filter(m => m.modulo_id === mod.id);
            const expanded = expandedMod[mod.id] ?? false;
            return (
              <Card key={mod.id} className="border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 p-4 cursor-pointer select-none" onClick={() => setExpandedMod(p => ({ ...p, [mod.id]: !p[mod.id] }))}>
                  {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{mod.nome}</p>
                    {mod.descricao && <p className="text-xs text-gray-400 truncate">{mod.descricao}</p>}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{mats.length} material{mats.length !== 1 ? 'is' : ''}</span>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openModuloModal(mod)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteModulo(mod.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-gray-100 p-4 space-y-2 bg-gray-50/50">
                    {mats.length === 0 && (
                      <p className="text-xs text-gray-400 py-2 text-center">Nenhum material ainda.</p>
                    )}
                    {mats.map(mat => {
                      const Icon = TIPO_ICONS[mat.tipo] ?? Link;
                      return (
                        <div key={mat.id} className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-gray-100">
                          <Icon className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">{mat.titulo}</p>
                            <a href={mat.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline flex items-center gap-1 truncate">
                              <ExternalLink className="h-2.5 w-2.5" /> {mat.url}
                            </a>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => openMaterialModal(mod.id, mat)} className="p-1 rounded hover:bg-gray-100 text-gray-400"><Pencil className="h-3 w-3" /></button>
                            <button onClick={() => deleteMaterial(mat.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        </div>
                      );
                    })}
                    <button
                      onClick={() => openMaterialModal(mod.id)}
                      className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Adicionar material
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Tarefas ─────────────────────────────────────────────────────────── */}
      {tab === 'tarefas' && (
        <div className="space-y-3">
          {modulos.length === 0 && (
            <p className="text-center text-gray-400 py-12 text-sm">Crie módulos primeiro para adicionar tarefas.</p>
          )}

          {modulos.map(mod => (
            <div key={mod.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-gray-400" />
                  {mod.nome}
                </h3>
                <Button size="sm" variant="outline" onClick={() => openTarefaModal(mod.id)} className="h-7 text-xs gap-1 border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                  <Plus className="h-3 w-3" /> Tarefa
                </Button>
              </div>

              {moduloTarefas(mod.id).length === 0 && (
                <p className="text-xs text-gray-300 pl-5 pb-2">Nenhuma tarefa neste módulo.</p>
              )}

              {moduloTarefas(mod.id).map(tar => (
                <Card key={tar.id} className="border border-gray-100 shadow-sm rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800 text-sm">{tar.titulo}</p>
                        <Badge className={`text-[10px] px-1.5 py-0 ${statusColor(tar.status)}`}>{tar.status}</Badge>
                        <span className="text-xs text-gray-400">{tar.questoes.length} questão{tar.questoes.length !== 1 ? 'ões' : ''}</span>
                      </div>
                      {tar.descricao && <p className="text-xs text-gray-400 leading-relaxed">{tar.descricao}</p>}
                      {tar.data_entrega && (
                        <p className="text-xs text-gray-400">
                          Prazo: {new Date(tar.data_entrega).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      <div className="flex items-center gap-3 pt-1">
                        <CopyLinkBtn tarefaId={tar.id} />
                        <a
                          href={`/forms/tarefa/${tar.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600"
                        >
                          <ExternalLink className="h-3 w-3" /> Abrir formulário
                        </a>
                        <span className="text-xs text-gray-400">
                          {tarefaEntregas(tar.id).length} entrega{tarefaEntregas(tar.id).length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openTarefaModal(mod.id, tar)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => deleteTarefa(tar.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Alunos ──────────────────────────────────────────────────────────── */}
      {tab === 'alunos' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openAlunoModal()} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
              <Plus className="h-4 w-4" /> Adicionar Aluno
            </Button>
          </div>

          {alunos.length === 0 && (
            <p className="text-center text-gray-400 py-12 text-sm">Nenhum aluno matriculado ainda.</p>
          )}

          <div className="space-y-2">
            {alunos.map(aluno => (
              <Card key={aluno.id} className="flex items-center justify-between p-4 border border-gray-100 shadow-sm rounded-xl">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{aluno.nome}</p>
                  <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                    {aluno.documento && <span>Doc: {aluno.documento}</span>}
                    {aluno.email && <span>{aluno.email}</span>}
                    {aluno.whatsapp && <span>{aluno.whatsapp}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openAlunoModal(aluno)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteAluno(aluno.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Notas ───────────────────────────────────────────────────────────── */}
      {tab === 'notas' && (
        <div className="space-y-4">
          {tarefas.length === 0 && (
            <p className="text-center text-gray-400 py-12 text-sm">Nenhuma tarefa criada ainda.</p>
          )}

          {tarefas.map(tar => {
            const tEntregas = tarefaEntregas(tar.id);
            return (
              <div key={tar.id} className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-gray-400" />
                  {tar.titulo}
                  <Badge className={`text-[10px] px-1.5 py-0 ${statusColor(tar.status)}`}>{tar.status}</Badge>
                  <span className="font-normal text-gray-400">{tEntregas.length} entrega{tEntregas.length !== 1 ? 's' : ''}</span>
                </h3>

                {tEntregas.length === 0 && (
                  <p className="text-xs text-gray-300 pl-5">Nenhuma entrega ainda.</p>
                )}

                {tEntregas.map(entr => (
                  <Card
                    key={entr.id}
                    className="border border-gray-100 shadow-sm rounded-xl p-4 cursor-pointer hover:border-indigo-200 transition-colors"
                    onClick={() => openEntregaModal(entr)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{entr.aluno_nome}</p>
                        <p className="text-xs text-gray-400">{entr.aluno_documento} · {new Date(entr.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="text-right space-y-1">
                        {entr.nota_final !== null ? (
                          <div>
                            <p className="text-lg font-black text-indigo-600">{entr.nota_final}<span className="text-xs font-normal text-gray-400">/{tar.pontuacao_max}</span></p>
                            <p className="text-[10px] text-gray-400">Nota final</p>
                          </div>
                        ) : entr.nota_ia !== null ? (
                          <div>
                            <p className="text-lg font-black text-amber-500">{entr.nota_ia}<span className="text-xs font-normal text-gray-400">/{tar.pontuacao_max}</span></p>
                            <p className="text-[10px] text-amber-400">Nota IA (revisar)</p>
                          </div>
                        ) : (
                          <Badge className="text-[10px] bg-yellow-100 text-yellow-700">Aguardando</Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Módulo ─────────────────────────────────────────────────────── */}
      <Dialog open={moduloModal.open} onOpenChange={v => setModuloModal(p => ({ ...p, open: v }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{moduloModal.editing ? 'Editar' : 'Novo'} Módulo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome do módulo" value={moduloForm.nome} onChange={e => setModuloForm(f => ({ ...f, nome: e.target.value }))} autoFocus />
            <Input placeholder="Descrição (opcional)" value={moduloForm.descricao} onChange={e => setModuloForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setModuloModal(p => ({ ...p, open: false }))}>Cancelar</Button>
            <Button onClick={saveModulo} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal Material ────────────────────────────────────────────────────── */}
      <Dialog open={materialModal.open} onOpenChange={v => setMaterialModal(p => ({ ...p, open: v }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{materialModal.editing ? 'Editar' : 'Novo'} Material</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Título" value={materialForm.titulo} onChange={e => setMaterialForm(f => ({ ...f, titulo: e.target.value }))} autoFocus />
            <Select value={materialForm.tipo} onValueChange={v => setMaterialForm(f => ({ ...f, tipo: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="link">Link</SelectItem>
                <SelectItem value="video">Vídeo (YouTube)</SelectItem>
                <SelectItem value="documento">Documento (Drive)</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="URL" value={materialForm.url} onChange={e => setMaterialForm(f => ({ ...f, url: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setMaterialModal(p => ({ ...p, open: false }))}>Cancelar</Button>
            <Button onClick={saveMaterial} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal Aluno ───────────────────────────────────────────────────────── */}
      <Dialog open={alunoModal.open} onOpenChange={v => setAlunoModal(p => ({ ...p, open: v }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{alunoModal.editing ? 'Editar' : 'Adicionar'} Aluno</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome *" value={alunoForm.nome} onChange={e => setAlunoForm(f => ({ ...f, nome: e.target.value }))} autoFocus />
            <Input placeholder="CPF / Matrícula" value={alunoForm.documento} onChange={e => setAlunoForm(f => ({ ...f, documento: e.target.value }))} />
            <Input placeholder="E-mail" value={alunoForm.email} onChange={e => setAlunoForm(f => ({ ...f, email: e.target.value }))} />
            <Input placeholder="WhatsApp" value={alunoForm.whatsapp} onChange={e => setAlunoForm(f => ({ ...f, whatsapp: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setAlunoModal(p => ({ ...p, open: false }))}>Cancelar</Button>
            <Button onClick={saveAluno} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal Tarefa ──────────────────────────────────────────────────────── */}
      <Dialog open={tarefaModal.open} onOpenChange={v => setTarefaModal(p => ({ ...p, open: v }))}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tarefaModal.editing ? 'Editar' : 'Nova'} Tarefa</DialogTitle>
            <DialogDescription>Configure as questões e os critérios de correção automática.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-xs text-gray-500">Título *</label>
                <Input value={tarefaForm.titulo} onChange={e => setTarefaForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Atividade 1 — Módulo Introdução" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Pontuação máxima</label>
                <Input type="number" value={tarefaForm.pontuacao_max} onChange={e => setTarefaForm(f => ({ ...f, pontuacao_max: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Prazo de entrega</label>
                <Input type="datetime-local" value={tarefaForm.data_entrega} onChange={e => setTarefaForm(f => ({ ...f, data_entrega: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Status</label>
                <Select value={tarefaForm.status} onValueChange={v => setTarefaForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="aberta">Aberta (alunos podem responder)</SelectItem>
                    <SelectItem value="fechada">Fechada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500">Descrição</label>
              <textarea
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm resize-none min-h-[60px] focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="Descrição da tarefa (visível para o aluno)"
                value={tarefaForm.descricao}
                onChange={e => setTarefaForm(f => ({ ...f, descricao: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500">Instruções para o aluno</label>
              <textarea
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm resize-none min-h-[60px] focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="Ex: Leia o módulo 2 antes de responder. Use suas próprias palavras."
                value={tarefaForm.instrucoes}
                onChange={e => setTarefaForm(f => ({ ...f, instrucoes: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500 flex items-center gap-1">
                🤖 Critérios de correção para IA
              </label>
              <textarea
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm resize-none min-h-[80px] focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="Ex: O aluno deve demonstrar compreensão do conceito de transferência. Valorize exemplos práticos e linguagem técnica. Deduza pontos por respostas superficiais."
                value={tarefaForm.criterios_ia}
                onChange={e => setTarefaForm(f => ({ ...f, criterios_ia: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Questões</label>
              <QuestionEditor
                questoes={tarefaForm.questoes}
                onChange={q => setTarefaForm(f => ({ ...f, questoes: q }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setTarefaModal(p => ({ ...p, open: false }))}>Cancelar</Button>
            <Button onClick={saveTarefa} disabled={saving || !tarefaForm.titulo.trim()} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Tarefa'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal Entrega (Notas) ─────────────────────────────────────────────── */}
      <Dialog open={!!entregaModal} onOpenChange={v => !v && setEntregaModal(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {entregaModal && (
            <>
              <DialogHeader>
                <DialogTitle>Entrega — {entregaModal.aluno_nome}</DialogTitle>
                <DialogDescription>{entregaModal.aluno_documento} · {new Date(entregaModal.created_at).toLocaleString('pt-BR')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {/* Respostas */}
                {tarefas.find(t => t.id === entregaModal.tarefa_id)?.questoes.map((q, idx) => (
                  <div key={q.id} className="space-y-1">
                    <p className="text-xs font-semibold text-gray-500">Q{idx + 1}. {q.enunciado}</p>
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-800">
                      {entregaModal.respostas[q.id] ?? <span className="text-gray-300 italic">Sem resposta</span>}
                    </div>
                  </div>
                ))}

                {/* Feedback IA */}
                {entregaModal.nota_ia !== null && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">🤖 Correção Automática</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-amber-800">{entregaModal.feedback_ia}</p>
                      <span className="text-2xl font-black text-amber-600 ml-4">{entregaModal.nota_ia}</span>
                    </div>
                  </div>
                )}

                {/* Nota final */}
                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Avaliação da Professora</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">Nota final</label>
                      <Input
                        type="number"
                        step="0.5"
                        value={notaFinalInput}
                        onChange={e => setNotaFinalInput(e.target.value)}
                        placeholder={String(entregaModal.nota_ia ?? 0)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">Feedback para o aluno</label>
                    <textarea
                      className="w-full border border-gray-200 rounded-lg p-2.5 text-sm resize-none min-h-[80px] focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      value={feedbackProfInput}
                      onChange={e => setFeedbackProfInput(e.target.value)}
                      placeholder="Feedback personalizado (opcional)"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => setEntregaModal(null)}>Fechar</Button>
                <Button onClick={saveNota} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Nota'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
