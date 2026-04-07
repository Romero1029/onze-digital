import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Plus, Filter, Trash2, Edit2 } from 'lucide-react';
import type { Task } from '@/types/crm';
import { format, isPast } from 'date-fns';
import { cn } from '@/lib/utils';

const TASK_CATEGORIES = [
  { value: 'video', label: '🎬 Script de Vídeo', color: 'bg-blue-500' },
  { value: 'design', label: '🎨 Design', color: 'bg-purple-500' },
  { value: 'social', label: '📱 Social Media', color: 'bg-pink-500' },
  { value: 'reuniao', label: '📞 Reunião', color: 'bg-green-500' },
];

const TASK_COLUMNS = [
  { key: 'a_fazer', label: 'A Fazer', color: 'bg-muted' },
  { key: 'em_andamento', label: 'Em Andamento', color: 'bg-warning/10' },
  { key: 'concluido', label: 'Concluído', color: 'bg-success/10' },
];

export function Rodrygo() {
  const { user, users } = useAuth();
  const rodrygoUser = users.find(u => u.nome.includes('Rodrygo'));
  const rodrygoId = rodrygoUser?.id;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    categoria: 'video' as const,
    prioridade: 'media' as const,
    prazo: '',
  });

  const fetchTasks = async () => {
    const { data } = await supabase
      .from('tarefas')
      .select('*')
      .eq('responsavel_id', rodrygoId || '')
      .order('prazo', { ascending: true });
    if (data) setTasks(data as unknown as Task[]);
  };

  useEffect(() => {
    if (rodrygoId) {
      fetchTasks();
      const ch = supabase
        .channel('tarefas-rodrygo')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tarefas' },
          () => fetchTasks()
        )
        .subscribe();
      return () => {
        supabase.removeChannel(ch);
      };
    }
  }, [rodrygoId]);

  const filtertedTasks = selectedCategory
    ? tasks.filter(t => t.categoria === selectedCategory)
    : tasks;

  const createTask = async () => {
    if (!form.titulo.trim()) return;
    const { error } = await supabase.from('tarefas').insert({
      titulo: form.titulo,
      descricao: form.descricao || null,
      responsavel_id: rodrygoId,
      categoria: form.categoria,
      prioridade: form.prioridade,
      prazo: form.prazo || null,
      status: 'a_fazer',
      pagina: 'rodrygo',
      criado_por_id: user?.id,
    } as any);
    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
      return;
    }
    toast({ title: 'Tarefa criada!' });
    setShowCreateDialog(false);
    setForm({ titulo: '', descricao: '', categoria: 'video', prioridade: 'media', prazo: '' });
    fetchTasks();
  };

  const updateTaskStatus = async (id: string, newStatus: string) => {
    await supabase.from('tarefas').update({ status: newStatus }).eq('id', id);
    fetchTasks();
  };

  const deleteTask = async (id: string) => {
    await supabase.from('tarefas').delete().eq('id', id);
    fetchTasks();
  };

  const getCategoryLabel = (cat: string) => TASK_CATEGORIES.find(c => c.value === cat)?.label || cat;
  const getCategoryColor = (cat: string) => TASK_CATEGORIES.find(c => c.value === cat)?.color || 'bg-gray-500';

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'alta':
        return <Badge className="bg-destructive text-white text-[10px]">🔴 Alta</Badge>;
      case 'media':
        return <Badge className="bg-warning text-white text-[10px]">🟡 Média</Badge>;
      case 'baixa':
        return <Badge className="bg-success text-white text-[10px]">🟢 Baixa</Badge>;
      default:
        return null;
    }
  };

  if (!rodrygoId) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <p className="text-muted-foreground">Usuário Rodrygo não encontrado</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Tarefas</h1>
            <p className="text-sm text-muted-foreground mt-1">Rodrygo</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="bg-primary hover:bg-primary/90 text-white">
            <Plus className="h-4 w-4 mr-2" />Nova Tarefa
          </Button>
        </div>

        {/* Filtro de Categoria */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory('')}
            className={cn(
              'px-3 py-1.5 rounded text-sm font-500 transition-colors flex-shrink-0',
              selectedCategory === '' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'
            )}
          >
            Todas ({filtertedTasks.length})
          </button>
          {TASK_CATEGORIES.map(cat => {
            const count = tasks.filter(t => t.categoria === cat.value).length;
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={cn(
                  'px-3 py-1.5 rounded text-sm font-500 transition-colors flex-shrink-0 flex items-center gap-1',
                  selectedCategory === cat.value ? `${cat.color} text-white` : 'bg-muted text-muted-foreground hover:bg-muted/70'
                )}
              >
                {cat.label.split(' ')[0]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-4 lg:p-6">
        <div className="inline-flex gap-4 min-w-full">
          {TASK_COLUMNS.map(col => {
            const columnTasks = filtertedTasks.filter(t => t.status === col.key);
            return (
              <div key={col.key} className="flex-shrink-0 w-96">
                <div className={cn('rounded-lg p-3 mb-4', col.color)}>
                  <h2 className="font-bold text-foreground flex items-center justify-between">
                    {col.label}
                    <Badge variant="secondary" className="text-xs">{columnTasks.length}</Badge>
                  </h2>
                </div>
                <div className="space-y-3 max-h-[calc(100vh-20rem)] overflow-y-auto pr-2">
                  {columnTasks.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-xs text-muted-foreground">Nenhuma tarefa</p>
                    </div>
                  ) : (
                    columnTasks.map(task => {
                      const isOverdue = task.prazo && isPast(new Date(task.prazo)) && task.status !== 'concluido';
                      return (
                        <Card key={task.id} className="p-4 border border-border hover:shadow-md transition-all cursor-move">
                          <div className="space-y-2">
                            {/* Categoria */}
                            <div className="flex items-start justify-between gap-2">
                              <Badge className={cn('text-white text-[10px]', getCategoryColor(task.categoria))}>
                                {getCategoryLabel(task.categoria).split(' ')[1]}
                              </Badge>
                              <button
                                onClick={() => deleteTask(task.id)}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>

                            {/* Título */}
                            <p className="font-600 text-foreground text-sm">{task.titulo}</p>

                            {/* Descrição */}
                            {task.descricao && (
                              <p className="text-xs text-muted-foreground">{task.descricao}</p>
                            )}

                            {/* Prioridade */}
                            <div className="flex items-center justify-between">
                              {getPriorityBadge(task.prioridade)}
                              {isOverdue && (
                                <Badge className="bg-destructive/20 text-destructive text-[10px] border-0">
                                  Atrasado
                                </Badge>
                              )}
                            </div>

                            {/* Prazo */}
                            {task.prazo && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                📅 {format(new Date(task.prazo), 'dd MMM')}
                              </div>
                            )}

                            {/* Botões de ação */}
                            {col.key !== 'concluido' && (
                              <div className="flex gap-2 pt-2 border-t border-border">
                                {col.key === 'a_fazer' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 h-7 text-xs"
                                    onClick={() => updateTaskStatus(task.id, 'em_andamento')}
                                  >
                                    Começar
                                  </Button>
                                )}
                                {col.key === 'em_andamento' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 h-7 text-xs"
                                    onClick={() => updateTaskStatus(task.id, 'concluido')}
                                  >
                                    Concluir
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Nova Tarefa */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tarefa para Rodrygo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-500 text-foreground">Título *</label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ex: Gravar vídeo do lançamento 33"
                className="mt-1 border-border"
              />
            </div>
            <div>
              <label className="text-sm font-500 text-foreground">Descrição</label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Adicione detalhes da tarefa..."
                className="mt-1 border-border"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-500 text-foreground">Categoria</label>
                <Select value={form.categoria} onValueChange={(v: any) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger className="mt-1 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-500 text-foreground">Prioridade</label>
                <Select value={form.prioridade} onValueChange={(v: any) => setForm({ ...form, prioridade: v })}>
                  <SelectTrigger className="mt-1 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">🔴 Alta</SelectItem>
                    <SelectItem value="media">🟡 Média</SelectItem>
                    <SelectItem value="baixa">🟢 Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-500 text-foreground">Prazo</label>
              <Input
                type="date"
                value={form.prazo}
                onChange={(e) => setForm({ ...form, prazo: e.target.value })}
                className="mt-1 border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={createTask} className="bg-primary hover:bg-primary/90 text-white">
              Criar Tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
