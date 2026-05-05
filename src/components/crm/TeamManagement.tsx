import { useState, useEffect } from 'react';
import { useAuth, AppUser, UserRole } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, UserCheck, UserX, Loader2, Shield } from 'lucide-react';

const COLORS = [
  '#A93356', '#D65876', '#4A90E2', '#28A745', '#F4A460',
  '#6C5CE7', '#00B894', '#E17055', '#636E72', '#2D3436',
];

interface UserPermissions {
  user_id: string;
  can_view_dashboard: boolean;
  can_view_pipeline: boolean;
  can_view_lancamentos: boolean;
  can_view_all_lancamentos: boolean;
  allowed_lancamento_ids: string[];
  can_view_npa: boolean;
  can_view_aula_secreta: boolean;
  can_view_chat: boolean;
  can_view_sheets: boolean;
  can_view_financeiro: boolean;
  can_view_balanco: boolean;
  can_view_operacoes: boolean;
  can_view_mapa_mental: boolean;
  can_view_rodrygo: boolean;
  can_view_pedagogico: boolean;
  can_view_all_turmas: boolean;
  allowed_turma_ids: string[];
  can_view_team: boolean;
  can_view_settings: boolean;
  can_view_all_financeiro_turmas: boolean;
  allowed_financeiro_turma_ids: string[];
}

const DEFAULT_PERMS = (userId: string): UserPermissions => ({
  user_id: userId,
  can_view_dashboard: true,
  can_view_pipeline: true,
  can_view_lancamentos: true,
  can_view_all_lancamentos: true,
  allowed_lancamento_ids: [],
  can_view_npa: true,
  can_view_aula_secreta: true,
  can_view_chat: true,
  can_view_sheets: true,
  can_view_financeiro: true,
  can_view_balanco: true,
  can_view_operacoes: true,
  can_view_mapa_mental: true,
  can_view_rodrygo: true,
  can_view_pedagogico: true,
  can_view_all_turmas: true,
  allowed_turma_ids: [],
  can_view_team: false,
  can_view_settings: false,
  can_view_all_financeiro_turmas: true,
  allowed_financeiro_turma_ids: [],
});

export function TeamManagement() {
  const { user, users, addUser, updateUser, deleteUser } = useAuth();
  const { toast } = useToast();

  // User form state
  const [isOpen, setIsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    tipo: 'vendedor' as UserRole,
    cor: COLORS[0],
  });

  // Permissions state
  const [permOpen, setPermOpen] = useState(false);
  const [permUser, setPermUser] = useState<AppUser | null>(null);
  const [perms, setPerms] = useState<UserPermissions | null>(null);
  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [lancamentos, setLancamentos] = useState<{ id: string; nome: string }[]>([]);
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    if (!permOpen) return;
    const load = async () => {
      const [{ data: lancs }, { data: turmasData }] = await Promise.all([
        supabase.from('lancamentos').select('id, nome').order('created_at', { ascending: false }),
        supabase.from('turmas').select('id, nome').order('nome'),
      ]);
      setLancamentos(lancs || []);
      setTurmas(turmasData || []);
    };
    load();
  }, [permOpen]);

  const openPermissions = async (u: AppUser) => {
    setPermUser(u);
    setPermLoading(true);
    setPermOpen(true);

    const { data } = await (supabase as any)
      .from('user_access_permissions')
      .select('*')
      .eq('user_id', u.id)
      .maybeSingle();

    if (data) {
      setPerms({
        ...DEFAULT_PERMS(u.id),
        ...data,
        allowed_lancamento_ids: data.allowed_lancamento_ids || [],
        allowed_turma_ids: data.allowed_turma_ids || [],
        allowed_financeiro_turma_ids: data.allowed_financeiro_turma_ids || [],
      });
    } else {
      setPerms(DEFAULT_PERMS(u.id));
    }
    setPermLoading(false);
  };

  const savePermissions = async () => {
    if (!perms) return;
    setPermSaving(true);
    const { error } = await (supabase as any)
      .from('user_access_permissions')
      .upsert(perms, { onConflict: 'user_id' });

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar as permissões.' });
    } else {
      toast({ title: 'Permissões salvas!', description: `Permissões de ${permUser?.nome} atualizadas.` });
      setPermOpen(false);
    }
    setPermSaving(false);
  };

  const togglePerm = (key: keyof UserPermissions) => {
    if (!perms) return;
    setPerms({ ...perms, [key]: !perms[key as keyof UserPermissions] });
  };

  const toggleListId = (field: 'allowed_lancamento_ids' | 'allowed_turma_ids' | 'allowed_financeiro_turma_ids', id: string) => {
    if (!perms) return;
    const list = perms[field] as string[];
    const updated = list.includes(id) ? list.filter(x => x !== id) : [...list, id];
    setPerms({ ...perms, [field]: updated });
  };

  // User form helpers
  const resetForm = () => {
    setFormData({
      nome: '',
      email: '',
      senha: '',
      tipo: 'vendedor',
      cor: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
    setEditingUser(null);
  };

  const openEdit = (userToEdit: AppUser) => {
    setEditingUser(userToEdit);
    setFormData({
      nome: userToEdit.nome,
      email: userToEdit.email,
      senha: '',
      tipo: userToEdit.tipo,
      cor: userToEdit.cor,
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.nome || !formData.email) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha todos os campos obrigatórios.' });
      setLoading(false);
      return;
    }

    if (editingUser) {
      const result = await updateUser(editingUser.id, {
        nome: formData.nome,
        tipo: formData.tipo,
        cor: formData.cor,
      });

      if (result.success) {
        toast({ title: 'Sucesso', description: 'Usuário atualizado com sucesso!' });
        setIsOpen(false);
        resetForm();
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error || 'Erro ao atualizar usuário.' });
      }
    } else {
      if (!formData.senha) {
        toast({ variant: 'destructive', title: 'Erro', description: 'A senha é obrigatória para novos usuários.' });
        setLoading(false);
        return;
      }

      const emailExists = users.some((u) => u.email.toLowerCase() === formData.email.toLowerCase());
      if (emailExists) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Este email já está cadastrado.' });
        setLoading(false);
        return;
      }

      const result = await addUser({
        nome: formData.nome,
        email: formData.email,
        senha: formData.senha,
        tipo: formData.tipo,
        cor: formData.cor,
      });

      if (result.success && result.user) {
        toast({ title: 'Usuário criado!', description: `Email: ${result.user.email} | Senha: ${formData.senha}` });
        setIsOpen(false);
        resetForm();
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error || 'Erro ao criar usuário.' });
      }
    }

    setLoading(false);
  };

  const handleToggleStatus = async (userToToggle: AppUser) => {
    if (userToToggle.id === user?.id) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não é possível desativar sua própria conta.' });
      return;
    }
    const result = await updateUser(userToToggle.id, { ativo: !userToToggle.ativo });
    if (result.success) {
      toast({ title: userToToggle.ativo ? 'Usuário desativado' : 'Usuário ativado' });
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: result.error || 'Erro ao alterar status.' });
    }
  };

  const handleDelete = async (userToDelete: AppUser) => {
    if (userToDelete.id === user?.id) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não é possível excluir sua própria conta.' });
      return;
    }
    const result = await deleteUser(userToDelete.id);
    if (result.success) {
      toast({ title: 'Usuário desativado', description: `${userToDelete.nome} foi desativado do sistema.` });
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: result.error || 'Erro ao excluir usuário.' });
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in pb-20 lg:pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Gestão da Equipe</h1>
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary hover:opacity-90">
              <Plus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome do usuário"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  required
                  disabled={loading || !!editingUser}
                />
                {editingUser && (
                  <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>
                )}
              </div>

              {!editingUser && (
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha *</Label>
                  <Input
                    id="senha"
                    type="password"
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    required
                    disabled={loading}
                    minLength={6}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Tipo de acesso</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value: UserRole) => setFormData({ ...formData, tipo: value })}
                  disabled={loading}
                >
                  <SelectTrigger className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border z-50">
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cor de identificação</Label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, cor: color })}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        formData.cor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                      disabled={loading}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="flex-1" disabled={loading}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 gradient-primary hover:opacity-90" disabled={loading}>
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                  ) : editingUser ? 'Salvar' : 'Criar Usuário'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Permissions Dialog */}
      <Dialog open={permOpen} onOpenChange={(open) => { setPermOpen(open); }}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Permissões — {permUser?.nome}
            </DialogTitle>
          </DialogHeader>

          {permLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : perms ? (
            <div className="space-y-5">
              {/* Seções principais */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Seções visíveis</p>

                <PermRow label="Dashboard" checked={perms.can_view_dashboard} onToggle={() => togglePerm('can_view_dashboard')} />
                <PermRow label="Pipeline (Leads Diretos)" checked={perms.can_view_pipeline} onToggle={() => togglePerm('can_view_pipeline')} />

                {/* Lançamentos */}
                <PermRow label="Lançamentos" checked={perms.can_view_lancamentos} onToggle={() => togglePerm('can_view_lancamentos')} />
                {perms.can_view_lancamentos && (
                  <div className="ml-6 mt-1 space-y-2 border-l-2 border-primary/20 pl-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={perms.can_view_all_lancamentos}
                        onCheckedChange={() => togglePerm('can_view_all_lancamentos')}
                        id="all-lanc"
                      />
                      <Label htmlFor="all-lanc" className="text-sm cursor-pointer">
                        {perms.can_view_all_lancamentos ? 'Ver todos os lançamentos' : 'Ver apenas selecionados'}
                      </Label>
                    </div>
                    {!perms.can_view_all_lancamentos && (
                      <div className="space-y-1 mt-2">
                        <p className="text-xs text-muted-foreground mb-1">Selecione os lançamentos permitidos:</p>
                        {lancamentos.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Nenhum lançamento cadastrado.</p>
                        ) : lancamentos.map(l => (
                          <label key={l.id} className="flex items-center gap-2 cursor-pointer py-1">
                            <input
                              type="checkbox"
                              checked={perms.allowed_lancamento_ids.includes(l.id)}
                              onChange={() => toggleListId('allowed_lancamento_ids', l.id)}
                              className="rounded border-border accent-primary w-4 h-4"
                            />
                            <span className="text-sm">{l.nome}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <PermRow label="NPA" checked={perms.can_view_npa} onToggle={() => togglePerm('can_view_npa')} />
                <PermRow label="Aula Secreta" checked={perms.can_view_aula_secreta} onToggle={() => togglePerm('can_view_aula_secreta')} />
                <PermRow label="Chat" checked={perms.can_view_chat} onToggle={() => togglePerm('can_view_chat')} />
                <PermRow label="Leads Sheets" checked={perms.can_view_sheets} onToggle={() => togglePerm('can_view_sheets')} />

                {/* Financeiro */}
                <PermRow label="Financeiro" checked={perms.can_view_financeiro} onToggle={() => togglePerm('can_view_financeiro')} />
                {perms.can_view_financeiro && (
                  <div className="ml-6 mt-1 space-y-2 border-l-2 border-primary/20 pl-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={perms.can_view_all_financeiro_turmas}
                        onCheckedChange={() => togglePerm('can_view_all_financeiro_turmas')}
                        id="all-fin-turmas"
                      />
                      <Label htmlFor="all-fin-turmas" className="text-sm cursor-pointer">
                        {perms.can_view_all_financeiro_turmas ? 'Ver todas as turmas' : 'Ver apenas selecionadas'}
                      </Label>
                    </div>
                    {!perms.can_view_all_financeiro_turmas && (
                      <div className="space-y-1 mt-2">
                        <p className="text-xs text-muted-foreground mb-1">Selecione as turmas permitidas:</p>
                        {turmas.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Nenhuma turma cadastrada.</p>
                        ) : turmas.map(t => (
                          <label key={t.id} className="flex items-center gap-2 cursor-pointer py-1">
                            <input
                              type="checkbox"
                              checked={perms.allowed_financeiro_turma_ids.includes(t.id)}
                              onChange={() => toggleListId('allowed_financeiro_turma_ids', t.id)}
                              className="rounded border-border accent-primary w-4 h-4"
                            />
                            <span className="text-sm">{t.nome}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <PermRow label="Balanço" checked={perms.can_view_balanco} onToggle={() => togglePerm('can_view_balanco')} />
                <PermRow label="Operações" checked={perms.can_view_operacoes} onToggle={() => togglePerm('can_view_operacoes')} />
                <PermRow label="Mapa Mental" checked={perms.can_view_mapa_mental} onToggle={() => togglePerm('can_view_mapa_mental')} />
                <PermRow label="Tarefas Rodrygo" checked={perms.can_view_rodrygo} onToggle={() => togglePerm('can_view_rodrygo')} />
                <PermRow label="Pedagógico" checked={perms.can_view_pedagogico} onToggle={() => togglePerm('can_view_pedagogico')} />
              </div>

              <div className="border-t border-border/60 pt-4 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Administração</p>
                <PermRow label="Equipe" checked={perms.can_view_team} onToggle={() => togglePerm('can_view_team')} />
                <PermRow label="Configurações" checked={perms.can_view_settings} onToggle={() => togglePerm('can_view_settings')} />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setPermOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={savePermissions} disabled={permSaving} className="flex-1 gradient-primary hover:opacity-90">
                  {permSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Salvar Permissões'}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* User Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {users.map((u) => (
          <Card key={u.id} className={`p-4 bg-card border-border ${!u.ativo ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold text-primary-foreground flex-shrink-0"
                style={{ backgroundColor: u.cor }}
              >
                {getInitials(u.nome)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground truncate">{u.nome}</h3>
                  {u.id === user?.id && (
                    <Badge variant="outline" className="text-xs">Você</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={u.tipo === 'admin' ? 'default' : 'secondary'} className={u.tipo === 'admin' ? 'bg-primary' : ''}>
                    {u.tipo === 'admin' ? 'Admin' : 'Vendedor'}
                  </Badge>
                  <Badge variant={u.ativo ? 'outline' : 'destructive'} className="text-xs">
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </div>
            </div>

            {u.id !== user?.id && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-border flex-wrap">
                <Button size="sm" variant="outline" onClick={() => openEdit(u)} className="flex-1 min-w-[80px]">
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => openPermissions(u)} className="flex-1 min-w-[100px]">
                  <Shield className="h-4 w-4 mr-1" />
                  Permissões
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleToggleStatus(u)}>
                  {u.ativo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(u)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function PermRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  const id = `perm-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/40 transition-colors">
      <Label htmlFor={id} className="text-sm cursor-pointer flex-1">{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onToggle} />
    </div>
  );
}
