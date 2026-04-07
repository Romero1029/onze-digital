import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Plus, Trash2, Loader2, GripVertical, ChevronDown, ChevronUp, GitBranch, AlignLeft } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Categorias ───────────────────────────────────────────────────────────────
const PRESET_CATEGORIES = [
  { value: 'video', label: '🎬 Script de Vídeo', color: 'bg-blue-500' },
  { value: 'design', label: '🎨 Design', color: 'bg-purple-500' },
  { value: 'social', label: '📱 Social Media', color: 'bg-pink-500' },
  { value: 'reuniao', label: '📞 Reunião', color: 'bg-green-500' },
  { value: 'custom', label: '✏️ Personalizado', color: 'bg-gray-500' },
];

const TASK_COLUMNS = [
  { key: 'a_fazer', label: 'A Fazer', color: 'bg-muted' },
  { key: 'em_andamento', label: 'Em Andamento', color: 'bg-warning/10' },
  { key: 'concluido', label: 'Concluído', color: 'bg-success/10' },
];

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Etapa {
  ordem: number;
  titulo: string;
  descricao: string;
  responsavel_id: string;
  prazo: string;
}

interface EtapaDB {
  id: string;
  tarefa_id: string;
  ordem: number;
  titulo: string;
  descricao?: string;
  responsavel?: string;
  prazo?: string;
  status: 'pendente' | 'em_andamento' | 'concluido';
  desbloqueada: boolean;
}

interface Task {
  id: string;
  titulo: string;
  descricao?: string;
  categoria: string;
  prioridade: string;
  status: string;
  prazo?: string;
  responsavel_id?: string;
  tipo?: string;
  created_at: string;
}

// Props legadas para compatibilidade
interface TarefasViewProps {
  tarefas?: any[];
  usuarios?: any[];
  user?: any;
  getPriorityHexColor?: (p: string) => string;
  onOpenTarefaDetail?: (t: any) => void;
  onLoadData?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getCategoryMeta(cat: string) {
  return PRESET_CATEGORIES.find(c => c.value === cat) ?? { value: cat, label: `✏️ ${cat}`, color: 'bg-gray-500' };
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'alta': return <Badge className="bg-destructive text-white text-[10px]">🔴 Alta</Badge>;
    case 'media': return <Badge className="bg-warning text-white text-[10px]">🟡 Média</Badge>;
    case 'baixa': return <Badge className="bg-success text-white text-[10px]">🟢 Baixa</Badge>;
    default: return null;
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function TarefasView(_props: TarefasViewProps) {
  const { user, users } = useAuth();
  const isAdmin = user?.tipo === 'admin';

  const colaboradores = isAdmin
    ? users.filter(u => u.ativo)
    : users.filter(u => u.id === user?.id && u.ativo);

  const [selectedView, setSelectedView] = useState<string>(() =>
    isAdmin ? 'geral' : (user?.id || '')
  );

  const [tasks, setTasks] = useState<Task[]>([]);
  const [etapasMap, setEtapasMap] = useState<Record<string, EtapaDB[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  // Modal unitária
  const [showUnitDialog, setShowUnitDialog] = useState(false);
  const [unitForm, setUnitForm] = useState({
    titulo: '', descricao: '', categoria: 'video', customCategoria: '',
    prioridade: 'media', prazo: '', responsavel_id: '',
  });

  // Modal sequencial
  const [showSeqDialog, setShowSeqDialog] = useState(false);
  const [seqForm, setSeqForm] = useState({
    titulo: '', descricao: '', categoria: 'video', customCategoria: '',
    prioridade: 'media',
  });
  const [etapas, setEtapas] = useState<Etapa[]>([
    { ordem: 1, titulo: '', descricao: '', responsavel_id: '', prazo: '' },
  ]);

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const fetchTasks = async () => {
    setLoading(true);
    let query = supabase.from('tarefas').select('id, titulo, descricao, categoria, prioridade, status, prazo, responsavel_id, tipo, created_at').order('created_at', { ascending: false }).limit(200);

    if (!isAdmin) {
      query = query.eq('responsavel_id', user?.id || '');
    } else if (selectedView !== 'geral') {
      query = query.eq('responsavel_id', selectedView);
    }

    const { data } = await query;
    const taskList = (data as Task[]) ?? [];
    setTasks(taskList);

    // Buscar etapas das tarefas sequenciais
    const seqIds = taskList.filter(t => t.tipo === 'sequencial').map(t => t.id);
    if (seqIds.length > 0) {
      const { data: etapasData } = await supabase
        .from('tarefas_etapas')
        .select('id, tarefa_id, ordem, titulo, descricao, responsavel, prazo, status, desbloqueada')
        .in('tarefa_id', seqIds)
        .order('ordem', { ascending: true });

      const map: Record<string, EtapaDB[]> = {};
      (etapasData ?? []).forEach((e: any) => {
        if (!map[e.tarefa_id]) map[e.tarefa_id] = [];
        map[e.tarefa_id].push(e);
      });
      setEtapasMap(map);
    } else {
      setEtapasMap({});
    }

    setLoading(false);
  };

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchTasks();
    const triggerReload = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchTasks(), 2000);
    };
    const ch = supabase
      .channel('tarefas-operacoes-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas' }, triggerReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas_etapas' }, triggerReload)
      .subscribe();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(ch);
    };
  }, [selectedView, user?.id]);

  // ─── Notificação ──────────────────────────────────────────────────────────
  const notificarColaborador = async (userId: string, titulo: string, descricao: string) => {
    await supabase.from('notifications').insert({
      user_id: userId,
      tipo: 'etapa_desbloqueada',
      titulo,
      descricao,
      lida: false,
    } as any);
  };

  // ─── Criar tarefa unitária ────────────────────────────────────────────────
  const createUnitTask = async () => {
    if (!unitForm.titulo.trim()) return;
    const catFinal = unitForm.categoria === 'custom' ? unitForm.customCategoria.trim() : unitForm.categoria;
    const responsavelId = isAdmin ? (unitForm.responsavel_id || user?.id) : user?.id;

    const { error } = await supabase.from('tarefas').insert({
      titulo: unitForm.titulo,
      descricao: unitForm.descricao || null,
      responsavel_id: responsavelId,
      categoria: catFinal,
      prioridade: unitForm.prioridade,
      prazo: unitForm.prazo || null,
      status: 'a_fazer',
      tipo: 'unitaria',
      pagina: 'operacoes',
      created_by: user?.id,
    } as any);

    if (error) { toast({ variant: 'destructive', title: 'Erro', description: error.message }); return; }
    toast({ title: 'Tarefa criada!' });
    setShowUnitDialog(false);
    setUnitForm({ titulo: '', descricao: '', categoria: 'video', customCategoria: '', prioridade: 'media', prazo: '', responsavel_id: '' });
    fetchTasks();
  };

  // ─── Criar tarefa sequencial ──────────────────────────────────────────────
  const createSeqTask = async () => {
    if (!seqForm.titulo.trim()) return;
    if (etapas.some(e => !e.titulo.trim() || !e.responsavel_id)) {
      toast({ variant: 'destructive', title: 'Preencha título e responsável de cada etapa' });
      return;
    }

    const catFinal = seqForm.categoria === 'custom' ? seqForm.customCategoria.trim() : seqForm.categoria;
    const primeiroResponsavel = etapas[0]?.responsavel_id || user?.id;

    // Criar a tarefa pai apontando para o responsável da 1ª etapa
    const { data: tarefaData, error: tarefaErr } = await supabase.from('tarefas').insert({
      titulo: seqForm.titulo,
      descricao: seqForm.descricao || null,
      responsavel_id: primeiroResponsavel,
      categoria: catFinal,
      prioridade: seqForm.prioridade,
      status: 'a_fazer',
      tipo: 'sequencial',
      pagina: 'operacoes',
      created_by: user?.id,
    } as any).select().single();

    if (tarefaErr || !tarefaData) {
      toast({ variant: 'destructive', title: 'Erro', description: tarefaErr?.message });
      return;
    }

    // Criar etapas
    const etapasInsert = etapas.map((e, i) => ({
      tarefa_id: tarefaData.id,
      ordem: i + 1,
      titulo: e.titulo,
      descricao: e.descricao || null,
      responsavel: e.responsavel_id || null,
      prazo: e.prazo || null,
      status: i === 0 ? 'em_andamento' : 'pendente',
      desbloqueada: i === 0,
    }));

    const { error: etapasErr } = await supabase.from('tarefas_etapas').insert(etapasInsert);
    if (etapasErr) {
      toast({ variant: 'destructive', title: 'Erro nas etapas', description: etapasErr.message });
      return;
    }

    // Notificar responsável da 1ª etapa
    if (primeiroResponsavel) {
      const nomeEtapa = etapas[0].titulo;
      await notificarColaborador(primeiroResponsavel, '📋 Nova tarefa para você!', `"${seqForm.titulo}" — Etapa 1: ${nomeEtapa}`);
    }

    toast({ title: 'Tarefa sequencial criada!' });
    setShowSeqDialog(false);
    setSeqForm({ titulo: '', descricao: '', categoria: 'video', customCategoria: '', prioridade: 'media' });
    setEtapas([{ ordem: 1, titulo: '', descricao: '', responsavel_id: '', prazo: '' }]);
    fetchTasks();
  };

  // ─── Concluir etapa e desbloquear próxima ────────────────────────────────
  const concluirEtapa = async (tarefa: Task, etapa: EtapaDB, todasEtapas: EtapaDB[]) => {
    // Marcar etapa atual como concluída
    await supabase.from('tarefas_etapas').update({ status: 'concluido' }).eq('id', etapa.id);

    const proxima = todasEtapas.find(e => e.ordem === etapa.ordem + 1);
    if (proxima) {
      // Desbloquear próxima etapa
      await supabase.from('tarefas_etapas').update({ status: 'em_andamento', desbloqueada: true }).eq('id', proxima.id);
      // Atualizar responsável da tarefa pai
      if (proxima.responsavel) {
        await supabase.from('tarefas').update({ responsavel_id: proxima.responsavel }).eq('id', tarefa.id);
        // Notificar
        const nomeResp = users.find(u => u.id === proxima.responsavel)?.nome || '';
        await notificarColaborador(
          proxima.responsavel,
          '🔓 Sua etapa foi desbloqueada!',
          `"${tarefa.titulo}" — Etapa ${proxima.ordem}: ${proxima.titulo}`
        );
      }
    } else {
      // Última etapa concluída — fechar tarefa
      await supabase.from('tarefas').update({ status: 'concluido' }).eq('id', tarefa.id);
    }
    fetchTasks();
  };

  // ─── Deletar tarefa ───────────────────────────────────────────────────────
  const deleteTask = async (id: string) => {
    await supabase.from('tarefas_etapas').delete().eq('tarefa_id', id);
    await supabase.from('tarefas').delete().eq('id', id);
    fetchTasks();
  };

  // ─── Mover tarefa unitária ────────────────────────────────────────────────
  const updateTaskStatus = async (id: string, newStatus: string) => {
    await supabase.from('tarefas').update({ status: newStatus }).eq('id', id);
    fetchTasks();
  };

  // ─── Filtros ──────────────────────────────────────────────────────────────
  const filteredTasks = tasks.filter(t => {
    if (!selectedCategory) return true;
    const cat = t.categoria === 'custom' ? 'custom' : t.categoria;
    return cat === selectedCategory || t.categoria === selectedCategory;
  });

  const selectedUser = selectedView !== 'geral' ? colaboradores.find(u => u.id === selectedView) : null;
  const viewTitle = selectedView === 'geral' ? 'Geral — Todos os Colaboradores' : selectedUser?.nome || '';

  // ─── Render card sequencial ───────────────────────────────────────────────
  const renderSeqCard = (task: Task) => {
    const etapasList = etapasMap[task.id] ?? [];
    const etapaAtual = etapasList.find(e => e.status === 'em_andamento');
    const isExpanded = expandedTask === task.id;
    const progresso = etapasList.length > 0
      ? Math.round((etapasList.filter(e => e.status === 'concluido').length / etapasList.length) * 100)
      : 0;

    return (
      <Card key={task.id} className="border border-border hover:shadow-md transition-all">
        <div className="p-4 space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn('text-white text-[10px]', getCategoryMeta(task.categoria).color)}>
                {getCategoryMeta(task.categoria).label.split(' ').slice(1).join(' ') || task.categoria}
              </Badge>
              <Badge variant="outline" className="text-[10px] gap-1">
                <GitBranch className="h-2.5 w-2.5" />Sequencial
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => deleteTask(task.id)}
                className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>

          <p className="font-semibold text-sm text-foreground">{task.titulo}</p>
          {task.descricao && <p className="text-xs text-muted-foreground">{task.descricao}</p>}

          {/* Progresso */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{etapasList.filter(e => e.status === 'concluido').length}/{etapasList.length} etapas</span>
              <span>{progresso}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progresso}%` }} />
            </div>
          </div>

          {/* Etapa atual */}
          {etapaAtual && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 space-y-1.5">
              <p className="text-[10px] text-primary font-semibold uppercase tracking-wide">Etapa atual</p>
              <p className="text-xs font-medium">{etapaAtual.titulo}</p>
              {etapaAtual.descricao && <p className="text-[11px] text-muted-foreground">{etapaAtual.descricao}</p>}
              {etapaAtual.responsavel && (
                <div className="flex items-center gap-1.5">
                  {(() => {
                    const resp = users.find(u => u.id === etapaAtual.responsavel);
                    return resp ? (
                      <span className="w-4 h-4 rounded-full text-white text-[8px] flex items-center justify-center font-bold"
                        style={{ backgroundColor: resp.cor }}>
                        {resp.nome.charAt(0)}
                      </span>
                    ) : null;
                  })()}
                  <span className="text-[10px] text-muted-foreground">
                    {users.find(u => u.id === etapaAtual.responsavel)?.nome?.split(' ')[0]}
                  </span>
                  {etapaAtual.prazo && (
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      📅 {format(new Date(etapaAtual.prazo), 'dd MMM')}
                    </span>
                  )}
                </div>
              )}
              {/* Botão concluir — só aparece para o responsável da etapa ou admin */}
              {(isAdmin || etapaAtual.responsavel === user?.id) && (
                <Button size="sm" variant="outline" className="w-full h-7 text-xs mt-1"
                  onClick={() => concluirEtapa(task, etapaAtual, etapasList)}>
                  ✅ Concluir esta etapa
                </Button>
              )}
            </div>
          )}

          {/* Etapas expandidas */}
          {isExpanded && (
            <div className="space-y-1.5 pt-1 border-t border-border">
              {etapasList.map((e, i) => {
                const resp = users.find(u => u.id === e.responsavel);
                return (
                  <div key={e.id} className={cn(
                    'flex items-start gap-2 p-2 rounded-lg text-xs',
                    e.status === 'concluido' ? 'bg-success/10 text-muted-foreground line-through' :
                    e.status === 'em_andamento' ? 'bg-primary/5' : 'bg-muted/50 opacity-60'
                  )}>
                    <span className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-white',
                      e.status === 'concluido' ? 'bg-success' :
                      e.status === 'em_andamento' ? 'bg-primary' : 'bg-muted-foreground/40'
                    )}>
                      {e.status === 'concluido' ? '✓' : i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{e.titulo}</p>
                      {e.descricao && <p className="text-[10px] text-muted-foreground">{e.descricao}</p>}
                      <div className="flex items-center gap-1 mt-0.5">
                        {resp && (
                          <span className="w-3.5 h-3.5 rounded-full text-white text-[7px] flex items-center justify-center font-bold"
                            style={{ backgroundColor: resp.cor }}>
                            {resp.nome.charAt(0)}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">{resp?.nome?.split(' ')[0]}</span>
                        {e.prazo && <span className="text-[10px] text-muted-foreground ml-auto">📅 {format(new Date(e.prazo), 'dd/MM')}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    );
  };

  // ─── Render card unitária ─────────────────────────────────────────────────
  const renderUnitCard = (task: Task, col: typeof TASK_COLUMNS[0]) => {
    const isOverdue = task.prazo && isPast(new Date(task.prazo)) && task.status !== 'concluido';
    const responsavelUser = selectedView === 'geral' ? users.find(u => u.id === task.responsavel_id) : null;
    const catMeta = getCategoryMeta(task.categoria);

    return (
      <Card key={task.id} className="p-4 border border-border hover:shadow-md transition-all">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn('text-white text-[10px]', catMeta.color)}>
                {catMeta.label.split(' ').slice(1).join(' ') || task.categoria}
              </Badge>
              {responsavelUser && (
                <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold"
                  style={{ backgroundColor: responsavelUser.cor }} title={responsavelUser.nome}>
                  {responsavelUser.nome.charAt(0)}
                </span>
              )}
            </div>
            <button onClick={() => deleteTask(task.id)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>

          <p className="font-semibold text-foreground text-sm">{task.titulo}</p>
          {task.descricao && <p className="text-xs text-muted-foreground">{task.descricao}</p>}

          <div className="flex items-center justify-between">
            {getPriorityBadge(task.prioridade)}
            {isOverdue && <Badge className="bg-destructive/20 text-destructive text-[10px] border-0">Atrasado</Badge>}
          </div>

          {task.prazo && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              📅 {format(new Date(task.prazo), 'dd MMM')}
            </div>
          )}

          {col.key !== 'concluido' && (
            <div className="flex gap-2 pt-2 border-t border-border">
              {col.key === 'a_fazer' && (
                <Button size="sm" variant="outline" className="flex-1 h-7 text-xs"
                  onClick={() => updateTaskStatus(task.id, 'em_andamento')}>Começar</Button>
              )}
              {col.key === 'em_andamento' && (
                <Button size="sm" variant="outline" className="flex-1 h-7 text-xs"
                  onClick={() => updateTaskStatus(task.id, 'concluido')}>Concluir</Button>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  };

  // ─── Formulário de categoria (reutilizável) ───────────────────────────────
  const CategoriaField = ({ value, customValue, onChange, onCustomChange }: {
    value: string; customValue: string;
    onChange: (v: string) => void; onCustomChange: (v: string) => void;
  }) => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Categoria</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
        <SelectContent>
          {PRESET_CATEGORIES.map(cat => (
            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value === 'custom' && (
        <Input value={customValue} onChange={e => onCustomChange(e.target.value)}
          placeholder="Digite a categoria..." className="mt-1" />
      )}
    </div>
  );

  // ─── JSX principal ────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-white">

      {/* Header */}
      <div className="px-4 lg:px-6 pt-4 pb-2 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
            {viewTitle && <p className="text-sm text-muted-foreground mt-0.5">{viewTitle}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowUnitDialog(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />Unitária
            </Button>
            {isAdmin && (
              <Button onClick={() => setShowSeqDialog(true)} className="bg-primary hover:bg-primary/90 text-white gap-1.5">
                <GitBranch className="h-4 w-4" />Sequencial
              </Button>
            )}
          </div>
        </div>

        {/* Seletor de colaborador */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
          {isAdmin && (
            <button onClick={() => setSelectedView('geral')}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0 border',
                selectedView === 'geral' ? 'bg-primary text-white border-primary' : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/70')}>
              🌐 Geral
            </button>
          )}
          {colaboradores.map(u => (
            <button key={u.id} onClick={() => setSelectedView(u.id)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0 border flex items-center gap-2',
                selectedView === u.id ? 'text-white border-transparent' : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/70')}
              style={selectedView === u.id ? { backgroundColor: u.cor } : {}}>
              <span className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: selectedView === u.id ? 'white' : u.cor }} />
              {u.nome.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Filtro categoria */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setSelectedCategory('')}
            className={cn('px-3 py-1.5 rounded text-sm font-medium transition-colors flex-shrink-0',
              selectedCategory === '' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70')}>
            Todas ({filteredTasks.length})
          </button>
          {PRESET_CATEGORIES.filter(c => c.value !== 'custom').map(cat => {
            const count = tasks.filter(t => t.categoria === cat.value).length;
            return (
              <button key={cat.value} onClick={() => setSelectedCategory(cat.value)}
                className={cn('px-3 py-1.5 rounded text-sm font-medium transition-colors flex-shrink-0',
                  selectedCategory === cat.value ? `${cat.color} text-white` : 'bg-muted text-muted-foreground hover:bg-muted/70')}>
                {cat.label.split(' ')[0]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto p-4 lg:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="inline-flex gap-4 min-w-full">
            {TASK_COLUMNS.map(col => {
              const columnTasks = filteredTasks.filter(t => t.status === col.key);
              return (
                <div key={col.key} className="flex-shrink-0 w-96">
                  <div className={cn('rounded-lg p-3 mb-4', col.color)}>
                    <h2 className="font-bold text-foreground flex items-center justify-between">
                      {col.label}
                      <Badge variant="secondary" className="text-xs">{columnTasks.length}</Badge>
                    </h2>
                  </div>
                  <div className="space-y-3 max-h-[calc(100vh-22rem)] overflow-y-auto pr-2">
                    {columnTasks.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-xs text-muted-foreground">Nenhuma tarefa</p>
                      </div>
                    ) : columnTasks.map(task =>
                      task.tipo === 'sequencial'
                        ? renderSeqCard(task)
                        : renderUnitCard(task, col)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal Tarefa Unitária ── */}
      <Dialog open={showUnitDialog} onOpenChange={setShowUnitDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título *</label>
              <Input value={unitForm.titulo} onChange={e => setUnitForm({ ...unitForm, titulo: e.target.value })}
                placeholder="Ex: Gravar vídeo do lançamento" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1"><AlignLeft className="h-3.5 w-3.5" />Contexto / Descrição</label>
              <Textarea value={unitForm.descricao} onChange={e => setUnitForm({ ...unitForm, descricao: e.target.value })}
                placeholder="Descreva o contexto, instruções detalhadas, links, referências..." className="mt-1" rows={4} />
            </div>
            {isAdmin && (
              <div>
                <label className="text-sm font-medium">Responsável</label>
                <Select value={unitForm.responsavel_id || user?.id || ''} onValueChange={v => setUnitForm({ ...unitForm, responsavel_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {colaboradores.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <CategoriaField
              value={unitForm.categoria} customValue={unitForm.customCategoria}
              onChange={v => setUnitForm({ ...unitForm, categoria: v })}
              onCustomChange={v => setUnitForm({ ...unitForm, customCategoria: v })}
            />
            <div>
              <label className="text-sm font-medium">Prioridade</label>
              <Select value={unitForm.prioridade} onValueChange={v => setUnitForm({ ...unitForm, prioridade: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">🔴 Alta</SelectItem>
                  <SelectItem value="media">🟡 Média</SelectItem>
                  <SelectItem value="baixa">🟢 Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Prazo</label>
              <Input type="date" value={unitForm.prazo} onChange={e => setUnitForm({ ...unitForm, prazo: e.target.value })} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnitDialog(false)}>Cancelar</Button>
            <Button onClick={createUnitTask} className="bg-primary hover:bg-primary/90 text-white">Criar Tarefa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Tarefa Sequencial ── */}
      <Dialog open={showSeqDialog} onOpenChange={setShowSeqDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><GitBranch className="h-5 w-5" />Nova Tarefa Sequencial</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Info geral */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">Título do Funil *</label>
                <Input value={seqForm.titulo} onChange={e => setSeqForm({ ...seqForm, titulo: e.target.value })}
                  placeholder="Ex: Lançamento 32 — Funil completo" className="mt-1" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium flex items-center gap-1"><AlignLeft className="h-3.5 w-3.5" />Contexto Geral</label>
                <Textarea value={seqForm.descricao} onChange={e => setSeqForm({ ...seqForm, descricao: e.target.value })}
                  placeholder="Descreva o objetivo geral deste funil de tarefas..." className="mt-1" rows={3} />
              </div>
              <div>
                <CategoriaField
                  value={seqForm.categoria} customValue={seqForm.customCategoria}
                  onChange={v => setSeqForm({ ...seqForm, categoria: v })}
                  onCustomChange={v => setSeqForm({ ...seqForm, customCategoria: v })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Prioridade</label>
                <Select value={seqForm.prioridade} onValueChange={v => setSeqForm({ ...seqForm, prioridade: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">🔴 Alta</SelectItem>
                    <SelectItem value="media">🟡 Média</SelectItem>
                    <SelectItem value="baixa">🟢 Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Etapas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Etapas do Funil</label>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => setEtapas(prev => [...prev, { ordem: prev.length + 1, titulo: '', descricao: '', responsavel_id: '', prazo: '' }])}>
                  <Plus className="h-3 w-3" />Adicionar Etapa
                </Button>
              </div>

              {etapas.map((etapa, i) => (
                <div key={i} className="border border-border rounded-xl p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center gap-2 mb-1">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Etapa {i + 1}</span>
                    {etapas.length > 1 && (
                      <button className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => setEtapas(prev => prev.filter((_, idx) => idx !== i).map((e, idx) => ({ ...e, ordem: idx + 1 })))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Input placeholder="Título da etapa *" value={etapa.titulo}
                    onChange={e => setEtapas(prev => prev.map((ep, idx) => idx === i ? { ...ep, titulo: e.target.value } : ep))}
                    className="h-8 text-sm" />
                  <Textarea placeholder="Contexto / instruções desta etapa..." value={etapa.descricao}
                    onChange={e => setEtapas(prev => prev.map((ep, idx) => idx === i ? { ...ep, descricao: e.target.value } : ep))}
                    rows={2} className="text-sm resize-none" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-muted-foreground">Responsável *</label>
                      <Select value={etapa.responsavel_id} onValueChange={v => setEtapas(prev => prev.map((ep, idx) => idx === i ? { ...ep, responsavel_id: v } : ep))}>
                        <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {colaboradores.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Prazo</label>
                      <Input type="date" value={etapa.prazo} className="h-8 text-xs mt-0.5"
                        onChange={e => setEtapas(prev => prev.map((ep, idx) => idx === i ? { ...ep, prazo: e.target.value } : ep))} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSeqDialog(false)}>Cancelar</Button>
            <Button onClick={createSeqTask} className="bg-primary hover:bg-primary/90 text-white gap-1.5">
              <GitBranch className="h-4 w-4" />Criar Funil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
