import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Plus, Calendar } from 'lucide-react';
import { TASK_STATUS_COLUMNS, type Task } from '@/types/crm';
import { format, isToday, isPast } from 'date-fns';

export function QuadroDoDia() {
  const { user, users } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<'all' | 'mine' | 'today' | 'overdue'>('all');
  const [form, setForm] = useState({ titulo: '', descricao: '', responsavel_id: '', prazo: '', prioridade: 'media', categoria: 'vendas', produto: 'geral', lancamento: '' });

  const fetchTasks = async () => {
    const { data } = await supabase.from('tasks').select('*').order('prazo', { ascending: true });
    if (data) setTasks(data as unknown as Task[]);
  };

  useEffect(() => {
    fetchTasks();
    const ch = supabase.channel('tasks-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filteredTasks = tasks.filter(t => {
    if (filter === 'mine') return t.responsavel_id === user?.id;
    if (filter === 'today') return t.prazo && isToday(new Date(t.prazo));
    if (filter === 'overdue') return t.prazo && isPast(new Date(t.prazo)) && t.status !== 'concluido';
    return true;
  });

  const todayCount = tasks.filter(t => t.prazo && isToday(new Date(t.prazo)) && t.status !== 'concluido').length;
  const overdueCount = tasks.filter(t => t.prazo && isPast(new Date(t.prazo)) && t.status !== 'concluido' && !(t.prazo && isToday(new Date(t.prazo)))).length;
  const doneToday = tasks.filter(t => t.status === 'concluido' && t.updated_at && isToday(new Date(t.updated_at))).length;

  const createTask = async () => {
    if (!form.titulo.trim()) return;
    const { error } = await supabase.from('tasks').insert({
      titulo: form.titulo, descricao: form.descricao || null,
      responsavel_id: form.responsavel_id || null, prazo: form.prazo || null,
      prioridade: form.prioridade, categoria: form.categoria, produto: form.produto,
      lancamento: form.lancamento || null, criado_por_id: user?.id,
    } as any);
    if (error) { toast({ variant: 'destructive', title: 'Erro', description: error.message }); return; }
    toast({ title: 'Tarefa criada!' });
    setShowCreate(false);
    setForm({ titulo: '', descricao: '', responsavel_id: '', prazo: '', prioridade: 'media', categoria: 'vendas', produto: 'geral', lancamento: '' });
  };

  const moveTask = async (id: string, newStatus: string) => {
    await supabase.from('tasks').update({ status: newStatus } as any).eq('id', id);
  };

  const prioIcon: Record<string, string> = { alta: '🔴', media: '🟡', baixa: '🟢' };
  const getUserName = (id?: string) => users.find(u => u.id === id)?.nome?.split(' ')[0] || '—';

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="p-4 lg:p-6 pb-2 flex items-center justify-between flex-shrink-0">
        <h1 className="text-xl lg:text-2xl font-bold">Quadro do Dia</h1>
        <Button onClick={() => setShowCreate(true)} className="gradient-primary hover:opacity-90"><Plus className="h-4 w-4 mr-1" /> Nova Tarefa</Button>
      </div>

      {/* Summary */}
      <div className="px-4 lg:px-6 pb-2 flex-shrink-0">
        <Card className="p-4 bg-produtividade/5 border-produtividade/20">
          <p className="text-sm font-medium">{todayCount} tarefa(s) para hoje · {overdueCount} atrasada(s) · {doneToday} concluída(s) hoje</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="px-4 lg:px-6 pb-2 flex gap-2 flex-shrink-0">
        {(['all', 'mine', 'today', 'overdue'] as const).map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
            {{ all: 'Todas', mine: 'Minhas', today: 'Hoje', overdue: 'Atrasadas' }[f]}
          </Button>
        ))}
      </div>

      {/* Kanban */}
      <div className="flex-1 flex gap-3 overflow-x-auto p-4 lg:px-6 pb-24 lg:pb-6">
        {TASK_STATUS_COLUMNS.map(col => {
          const colTasks = filteredTasks.filter(t => t.status === col.key);
          return (
            <div key={col.key} className="flex-shrink-0 w-[85vw] sm:w-72 lg:w-80">
              <div className="rounded-t-lg p-2.5 bg-muted">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{col.icon} {col.label}</span>
                  <Badge variant="secondary" className="text-xs">{colTasks.length}</Badge>
                </div>
              </div>
              <div className="bg-muted/30 rounded-b-lg p-2 space-y-2 min-h-96 max-h-[calc(100vh-20rem)] overflow-y-auto">
                {colTasks.map(task => (
                  <Card key={task.id} className="p-3 bg-card hover:shadow-md transition-shadow">
                    {task.categoria && <Badge variant="outline" className="text-[10px] mb-1">{task.categoria}</Badge>}
                    <h3 className="font-medium text-sm">{task.titulo}</h3>
                    {task.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.descricao}</p>}
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{prioIcon[task.prioridade]}</span>
                      <span>👤 {getUserName(task.responsavel_id)}</span>
                      {task.prazo && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(task.prazo), 'dd/MM')}</span>}
                      {task.lancamento && <Badge variant="secondary" className="text-[10px]">{task.lancamento}</Badge>}
                    </div>
                    <Select value={task.status} onValueChange={v => moveTask(task.id, v)}>
                      <SelectTrigger className="mt-2 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card border-border z-[100]" position="popper">
                        {TASK_STATUS_COLUMNS.map(s => <SelectItem key={s.key} value={s.key} className="text-xs">{s.icon} {s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Card>
                ))}
                {colTasks.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">Nenhuma tarefa</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Responsável</Label>
                <Select value={form.responsavel_id} onValueChange={v => setForm(p => ({ ...p, responsavel_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{users.filter(u => u.ativo).map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Prazo</Label><Input type="date" value={form.prazo} onChange={e => setForm(p => ({ ...p, prazo: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={v => setForm(p => ({ ...p, prioridade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">🔴 Alta</SelectItem>
                    <SelectItem value="media">🟡 Média</SelectItem>
                    <SelectItem value="baixa">🟢 Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm(p => ({ ...p, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Vendas', 'Marketing', 'Produto', 'Operações', 'NPA'].map(c => <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Lançamento</Label>
                <Select value={form.lancamento} onValueChange={v => setForm(p => ({ ...p, lancamento: v }))}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    <SelectItem value="#30">#30</SelectItem>
                    <SelectItem value="#31">#31</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={createTask} className="gradient-primary">Criar Tarefa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
