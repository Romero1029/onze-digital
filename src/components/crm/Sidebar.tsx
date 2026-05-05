import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  LayoutDashboard, Kanban, Settings, UserCog, FileSpreadsheet,
  MessageCircle, Rocket, BarChart3, CheckSquare, ChevronDown, Plus, Brain, ListTodo, Scale,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export type View =
  | 'dashboard' | 'pipeline' | 'npa_overview' | 'chat' | 'sheets' | 'financeiro' | 'balanco' | 'rodrygo'
  | 'lancamentos_30' | 'lancamentos_31' | 'lancamentos_32'
  | 'team' | 'settings'
  | 'operacoes_tarefas' | 'operacoes_calendario_geral' | 'operacoes_calendario_conteudo'
  | 'mapa_mental' | 'pedagogico';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

type MenuItem =
  | { key: View; label: string; icon: React.ElementType; adminOnly?: boolean }
  | { group: string; label: string; icon: React.ElementType; adminOnly?: boolean; children: { key: View; label: string }[] };

const MENU: MenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'pipeline', label: 'Leads Diretos', icon: Kanban },
  {
    group: 'lancamentos_legado', label: 'Lançamentos', icon: Rocket,
    children: [],
  },
  {
    group: 'npa_dinamico', label: 'NPA', icon: BarChart3,
    children: [],
  },
  {
    group: 'aula_secreta', label: 'Aula Secreta', icon: Rocket,
    children: [],
  },
  { key: 'chat', label: 'Chat', icon: MessageCircle },
  { key: 'sheets', label: 'Leads Sheets', icon: FileSpreadsheet },
  { key: 'financeiro', label: 'Financeiro', icon: BarChart3 },
  { key: 'balanco', label: 'Balanço', icon: Scale },
  { key: 'team', label: 'Equipe', icon: UserCog, adminOnly: true },
  {
    group: 'operacoes', label: 'Operações', icon: ListTodo,
    children: [
      { key: 'operacoes_tarefas', label: 'Tarefas' },
      { key: 'operacoes_calendario_geral', label: 'Calendário Geral' },
      { key: 'operacoes_calendario_conteudo', label: 'Calendário de Conteúdo' },
    ],
  },
  { key: 'mapa_mental', label: 'Mapa Mental', icon: Brain },
  { key: 'rodrygo', label: 'Tarefas Rodrygo', icon: CheckSquare },
  { key: 'pedagogico', label: 'Pedagógico', icon: GraduationCap },
  { key: 'settings', label: 'Configurações', icon: Settings },
];

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const isAdmin = user?.tipo === 'admin';
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Lançamentos
  const [lancamentos, setLancamentos] = useState<{ id: string; nome: string }[]>([]);
  const [loadingLancamentos, setLoadingLancamentos] = useState(true);
  const [newLancamentoName, setNewLancamentoName] = useState('');
  const [isLancamentoDialogOpen, setIsLancamentoDialogOpen] = useState(false);

  // NPA
  const [npaEventos, setNpaEventos] = useState<{ id: string; nome: string }[]>([]);
  const [loadingNpaEventos, setLoadingNpaEventos] = useState(true);
  const [newNpaName, setNewNpaName] = useState('');
  const [isNpaDialogOpen, setIsNpaDialogOpen] = useState(false);

  // Aula Secreta
  const [aulaSecretaEventos, setAulaSecretaEventos] = useState<{ id: string; nome: string }[]>([]);
  const [loadingAulaSecreta, setLoadingAulaSecreta] = useState(true);
  const [newAulaSecretaName, setNewAulaSecretaName] = useState('');
  const [isAulaSecretaDialogOpen, setIsAulaSecretaDialogOpen] = useState(false);

  // Fetch lançamentos
  useEffect(() => {
    const load = async () => {
      setLoadingLancamentos(true);
      try {
        const { data, error } = await supabase
          .from('lancamentos')
          .select('id, nome')
          .order('created_at', { ascending: false });
        if (error) { console.error('Erro ao carregar lançamentos:', error); return; }
        setLancamentos(data || []);
      } catch (err) {
        console.error('Erro inesperado ao carregar lançamentos:', err);
      } finally {
        setLoadingLancamentos(false);
      }
    };
    load();
    const channel = supabase.channel('lancamentos-sidebar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamentos' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Fetch NPA eventos
  useEffect(() => {
    const load = async () => {
      setLoadingNpaEventos(true);
      try {
        const { data, error } = await supabase
          .from('npa_eventos')
          .select('id, nome')
          .order('created_at', { ascending: false });
        if (error) { console.error('Erro ao carregar eventos NPA:', error); return; }
        setNpaEventos(data || []);
      } catch (err) {
        console.error('Erro inesperado ao carregar eventos NPA:', err);
      } finally {
        setLoadingNpaEventos(false);
      }
    };
    load();
    const channel = supabase.channel('npa-eventos-sidebar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'npa_eventos' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Fetch Aula Secreta eventos
  useEffect(() => {
    const load = async () => {
      setLoadingAulaSecreta(true);
      try {
        const { data, error } = await supabase
          .from('aula_secreta_eventos')
          .select('id, nome')
          .order('created_at', { ascending: false });
        if (error) { console.error('Erro ao carregar eventos Aula Secreta:', error); return; }
        setAulaSecretaEventos(data || []);
      } catch (err) {
        console.error('Erro inesperado ao carregar eventos Aula Secreta:', err);
      } finally {
        setLoadingAulaSecreta(false);
      }
    };
    load();
    const channel = supabase.channel('aula-secreta-sidebar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aula_secreta_eventos' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const toggle = (g: string) => setExpanded(p => ({ ...p, [g]: !p[g] }));
  const isGroupActive = (children: { key: View }[]) => children.some(c => c.key === currentView);

  const handleAddLancamento = async () => {
    if (!newLancamentoName.trim()) return;
    try {
      const { data, error } = await supabase
        .from('lancamentos')
        .insert({ nome: newLancamentoName, status: 'planejamento', ativo: false, meta_matriculas: 0, created_at: new Date().toISOString() })
        .select('id')
        .single();
      if (error) { toast.error(`Erro ao criar lançamento: ${error.message}`); return; }
      if (data) {
        toast.success(`Lançamento "${newLancamentoName}" criado com sucesso!`);
        setNewLancamentoName('');
        setIsLancamentoDialogOpen(false);
        onViewChange(`lancamentos_${data.id}` as View);
      }
    } catch (err) {
      toast.error('Erro inesperado ao criar lançamento. Tente novamente.');
    }
  };

  const handleAddNpa = async () => {
    if (!newNpaName.trim()) return;
    try {
      const { data, error } = await supabase
        .from('npa_eventos')
        .insert({ nome: newNpaName, status: 'em_andamento', ativo: false, created_at: new Date().toISOString() })
        .select('id')
        .single();
      if (error) { toast.error(`Erro ao criar evento NPA: ${error.message}`); return; }
      if (data) {
        toast.success(`Evento NPA "${newNpaName}" criado com sucesso!`);
        setNewNpaName('');
        setIsNpaDialogOpen(false);
        onViewChange(`npa_${data.id}` as View);
      }
    } catch (err) {
      toast.error('Erro inesperado ao criar evento NPA. Tente novamente.');
    }
  };

  const handleAddAulaSecreta = async () => {
    if (!newAulaSecretaName.trim()) return;
    try {
      const { data, error } = await supabase
        .from('aula_secreta_eventos')
        .insert({ nome: newAulaSecretaName, status: 'em_andamento', ativo: false, created_at: new Date().toISOString() })
        .select('id')
        .single();
      if (error) { toast.error(`Erro ao criar Aula Secreta: ${error.message}`); return; }
      if (data) {
        toast.success(`Aula Secreta "${newAulaSecretaName}" criada com sucesso!`);
        setNewAulaSecretaName('');
        setIsAulaSecretaDialogOpen(false);
        onViewChange(`aula_secreta_${data.id}` as View);
      }
    } catch (err) {
      toast.error('Erro inesperado ao criar Aula Secreta. Tente novamente.');
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-border min-h-[calc(100vh-4rem)] p-3 hidden lg:block overflow-y-auto">
      <nav className="space-y-0.5">
        {MENU.map((item, idx) => {
          if ('adminOnly' in item && item.adminOnly && !isAdmin) return null;

          // Filtro de permissões por grupo
          if ('group' in item) {
            if (item.group === 'lancamentos_legado' && !permissions.can_view_lancamentos) return null;
            if (item.group === 'npa_dinamico' && !permissions.can_view_npa) return null;
            if (item.group === 'aula_secreta' && !permissions.can_view_aula_secreta) return null;
            if (item.group === 'operacoes' && !permissions.can_view_operacoes) return null;
          }

          // Filtro de permissões por item simples
          if ('key' in item) {
            if (item.key === 'dashboard' && !permissions.can_view_dashboard) return null;
            if (item.key === 'pipeline' && !permissions.can_view_pipeline) return null;
            if (item.key === 'chat' && !permissions.can_view_chat) return null;
            if (item.key === 'sheets' && !permissions.can_view_sheets) return null;
            if (item.key === 'financeiro' && !permissions.can_view_financeiro) return null;
            if (item.key === 'balanco' && !permissions.can_view_balanco) return null;
            if (item.key === 'mapa_mental' && !permissions.can_view_mapa_mental) return null;
            if (item.key === 'rodrygo' && !permissions.can_view_rodrygo) return null;
            if (item.key === 'pedagogico' && !permissions.can_view_pedagogico) return null;
            if (item.key === 'team' && !permissions.can_view_team) return null;
            if (item.key === 'settings' && !permissions.can_view_settings) return null;
          }

          const needsSeparator =
            (idx > 0 && MENU[idx - 1]?.key === 'dashboard') ||
            (idx > 0 && MENU[idx - 1]?.group === 'npa') ||
            (idx > 0 && MENU[idx - 1]?.key === 'sheets') ||
            (idx > 0 && MENU[idx - 1]?.group === 'produtividade');

          if ('group' in item) {
            let renderedChildren = item.children;

            if (item.group === 'lancamentos_legado') {
              renderedChildren = lancamentos
                .filter(l => permissions.can_view_all_lancamentos || permissions.allowed_lancamento_ids.includes(l.id))
                .map(l => ({
                  key: `lancamentos_${l.id}` as View,
                  label: l.nome,
                }));
            } else if (item.group === 'npa_dinamico') {
              renderedChildren = npaEventos.map(e => ({
                key: `npa_${e.id}` as View,
                label: e.nome,
              }));
            } else if (item.group === 'aula_secreta') {
              renderedChildren = aulaSecretaEventos.map(e => ({
                key: `aula_secreta_${e.id}` as View,
                label: e.nome,
              }));
            }

            const isOpen =
              expanded[item.group] ||
              isGroupActive(renderedChildren) ||
              (item.group === 'lancamentos_legado' && lancamentos.length > 0) ||
              (item.group === 'npa_dinamico' && npaEventos.length > 0) ||
              (item.group === 'aula_secreta' && aulaSecretaEventos.length > 0);

            return (
              <div key={item.group}>
                {needsSeparator && <div className="my-3 border-t border-border/40" />}
                <button
                  onClick={() => toggle(item.group)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded transition-all duration-300 text-left text-sm font-600',
                    isGroupActive(renderedChildren)
                      ? 'text-primary bg-primary/8'
                      : 'text-foreground hover:bg-primary/5 hover:text-primary'
                  )}
                >
                  <item.icon className={cn('h-4.5 w-4.5 transition-colors duration-300 flex-shrink-0', isGroupActive(renderedChildren) ? 'text-primary' : 'text-foreground/60')} />
                  <span className="flex-1">{item.label}</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-all duration-300 flex-shrink-0', isOpen ? 'rotate-180 text-primary' : 'text-foreground/40')} />
                </button>

                {isOpen && (
                  <div className="ml-0 mt-1 space-y-0.5 pl-3 border-l-2 border-primary/15">
                    {renderedChildren.map(child => (
                      <button
                        key={child.key}
                        onClick={() => onViewChange(child.key)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded text-left text-xs transition-all duration-300',
                          currentView === child.key
                            ? 'bg-primary/12 text-primary font-600'
                            : 'text-foreground/70 hover:text-primary hover:bg-primary/5'
                        )}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full transition-all duration-300 flex-shrink-0', currentView === child.key ? 'bg-primary scale-100' : 'bg-foreground/30 scale-75')} />
                        <span className="truncate">{child.label}</span>
                      </button>
                    ))}

                    {/* Botão Novo Lançamento */}
                    {item.group === 'lancamentos_legado' && (
                      <Dialog open={isLancamentoDialogOpen} onOpenChange={setIsLancamentoDialogOpen}>
                        <DialogTrigger asChild>
                          <button className="w-full flex items-center gap-2 px-3 py-2 rounded text-left text-xs transition-all duration-300 text-primary hover:bg-primary/10 mt-1 font-600">
                            <Plus className="h-4 w-4" />
                            Novo Lançamento
                          </button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Criar novo lançamento</DialogTitle>
                            <DialogDescription>Digite o nome do novo lançamento (ex: #33, Lançamento 2024, etc)</DialogDescription>
                          </DialogHeader>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Nome do lançamento"
                              value={newLancamentoName}
                              onChange={(e) => setNewLancamentoName(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && handleAddLancamento()}
                              className="border border-border focus:border-primary"
                            />
                            <Button onClick={handleAddLancamento} className="bg-primary hover:bg-primary/90">Criar</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}

                    {/* Botão Novo NPA */}
                    {item.group === 'npa_dinamico' && (
                      <Dialog open={isNpaDialogOpen} onOpenChange={setIsNpaDialogOpen}>
                        <DialogTrigger asChild>
                          <button className="w-full flex items-center gap-2 px-3 py-2 rounded text-left text-xs transition-all duration-300 text-primary hover:bg-primary/10 mt-1 font-600">
                            <Plus className="h-4 w-4" />
                            Novo NPA
                          </button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Criar novo evento NPA</DialogTitle>
                            <DialogDescription>Digite o nome do novo evento NPA (ex: NPA #01, Evento 2024, etc)</DialogDescription>
                          </DialogHeader>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Nome do evento NPA"
                              value={newNpaName}
                              onChange={(e) => setNewNpaName(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && handleAddNpa()}
                              className="border border-border focus:border-primary"
                            />
                            <Button onClick={handleAddNpa} className="bg-primary hover:bg-primary/90">Criar</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}

                    {/* Botão Nova Aula Secreta */}
                    {item.group === 'aula_secreta' && (
                      <Dialog open={isAulaSecretaDialogOpen} onOpenChange={setIsAulaSecretaDialogOpen}>
                        <DialogTrigger asChild>
                          <button className="w-full flex items-center gap-2 px-3 py-2 rounded text-left text-xs transition-all duration-300 text-primary hover:bg-primary/10 mt-1 font-600">
                            <Plus className="h-4 w-4" />
                            Nova Aula Secreta
                          </button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Criar nova Aula Secreta</DialogTitle>
                            <DialogDescription>Digite o nome da nova Aula Secreta (ex: Aula Secreta #01, Evento Especial, etc)</DialogDescription>
                          </DialogHeader>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Nome da Aula Secreta"
                              value={newAulaSecretaName}
                              onChange={(e) => setNewAulaSecretaName(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && handleAddAulaSecreta()}
                              className="border border-border focus:border-primary"
                            />
                            <Button onClick={handleAddAulaSecreta} className="bg-primary hover:bg-primary/90">Criar</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                )}
              </div>
            );
          }

          const mi = item as { key: View; label: string; icon: React.ElementType };
          return (
            <div key={mi.key}>
              {needsSeparator && <div className="my-3 border-t border-border/40" />}
              <button
                onClick={() => onViewChange(mi.key)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded transition-all duration-300 text-left text-sm font-600',
                  currentView === mi.key
                    ? 'bg-primary/8 text-primary'
                    : 'text-foreground hover:bg-primary/5 hover:text-primary'
                )}
              >
                <mi.icon className={cn('h-4.5 w-4.5 transition-colors duration-300 flex-shrink-0', currentView === mi.key ? 'text-primary' : 'text-foreground/60')} />
                <span>{mi.label}</span>
              </button>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

interface MobileNavProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

export function MobileNav({ currentView, onViewChange }: MobileNavProps) {
  const mobileItems: { key: View; label: string; icon: React.ElementType }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'pipeline', label: 'Leads', icon: Kanban },
    { key: 'chat', label: 'Chat', icon: MessageCircle },
    { key: 'lancamentos_30', label: 'Lanç.', icon: Rocket },
    { key: 'operacoes_tarefas', label: 'Tarefas', icon: CheckSquare },
    { key: 'settings', label: 'Config', icon: Settings },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex justify-around py-2">
        {mobileItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onViewChange(item.key)}
            className={cn(
              'flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors',
              currentView === item.key ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}