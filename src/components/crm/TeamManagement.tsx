import { useEffect, useState } from 'react';
import { useAuth, AppUser, UserRole } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AccessPermissions, getDefaultPermissions } from '@/lib/access-control';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Plus, Edit, Trash2, UserCheck, UserX, Loader2 } from 'lucide-react';

const COLORS = [
  '#A93356', '#D65876', '#4A90E2', '#28A745', '#F4A460',
  '#6C5CE7', '#00B894', '#E17055', '#636E72', '#2D3436',
];

const MODULE_PERMISSIONS: Array<{ key: keyof AccessPermissions; label: string }> = [
  { key: 'canViewDashboard', label: 'Dashboard' },
  { key: 'canViewPipeline', label: 'Leads diretos' },
  { key: 'canViewLancamentos', label: 'Lançamentos' },
  { key: 'canViewNpa', label: 'NPA' },
  { key: 'canViewAulaSecreta', label: 'Aula secreta' },
  { key: 'canViewChat', label: 'Chat' },
  { key: 'canViewSheets', label: 'Leads Sheets' },
  { key: 'canViewFinanceiro', label: 'Financeiro' },
  { key: 'canViewBalanco', label: 'Balanço' },
  { key: 'canViewOperacoes', label: 'Operações' },
  { key: 'canViewMapaMental', label: 'Mapa mental' },
  { key: 'canViewRodrygo', label: 'Tarefas Rodrygo' },
  { key: 'canViewPedagogico', label: 'Pedagógico' },
  { key: 'canViewTeam', label: 'Equipe' },
  { key: 'canViewSettings', label: 'Configurações' },
];

interface LancamentoOption {
  id: string;
  nome: string;
}

interface TurmaOption {
  id: string;
  nome: string;
}

export function TeamManagement() {
  const { user, users, addUser, updateUser, updateUserPermissions, deleteUser } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [availableLancamentos, setAvailableLancamentos] = useState<LancamentoOption[]>([]);
  const [availableTurmas, setAvailableTurmas] = useState<TurmaOption[]>([]);
  const [availableFinanceiroTurmas, setAvailableFinanceiroTurmas] = useState<TurmaOption[]>([]);
  const [permissions, setPermissions] = useState<AccessPermissions>(getDefaultPermissions('vendedor'));
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    tipo: 'vendedor' as UserRole,
    cor: COLORS[0],
  });

  useEffect(() => {
    const loadOptions = async () => {
      const [
        { data: lancamentosData },
        { data: turmasData },
        { data: financeiroTurmasData },
      ] = await Promise.all([
        supabase.from('lancamentos').select('id, nome').order('created_at', { ascending: false }),
        supabase.from('pedagogico_turmas').select('id, nome').order('created_at', { ascending: false }),
        supabase.from('turmas').select('id, nome').order('created_at', { ascending: false }),
      ]);

      setAvailableLancamentos(lancamentosData || []);
      setAvailableTurmas(turmasData || []);
      setAvailableFinanceiroTurmas(financeiroTurmasData || []);
    };

    loadOptions();
  }, []);

  const resetForm = () => {
    const nextRole: UserRole = 'vendedor';
    setFormData({
      nome: '',
      email: '',
      senha: '',
      tipo: nextRole,
      cor: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
    setPermissions(getDefaultPermissions(nextRole));
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
    setPermissions({ ...userToEdit.permissions });
    setIsOpen(true);
  };

  const handleRoleChange = (value: UserRole) => {
    setFormData((prev) => ({ ...prev, tipo: value }));
    if (!editingUser) {
      setPermissions(getDefaultPermissions(value));
    }
  };

  const togglePermission = (key: keyof AccessPermissions, checked: boolean) => {
    setPermissions((prev) => {
      const next = { ...prev, [key]: checked };

      if (key === 'canViewLancamentos' && !checked) {
        next.canViewAllLancamentos = false;
        next.allowedLancamentoIds = [];
      }

      if (key === 'canViewFinanceiro' && !checked) {
        next.canViewAllFinanceiroTurmas = false;
        next.allowedFinanceiroTurmaIds = [];
      }

      if (key === 'canViewPedagogico' && !checked) {
        next.canViewAllTurmas = false;
        next.allowedTurmaIds = [];
      }

      if (key === 'canViewAllLancamentos' && checked) {
        next.allowedLancamentoIds = [];
      }

      if (key === 'canViewAllFinanceiroTurmas' && checked) {
        next.allowedFinanceiroTurmaIds = [];
      }

      if (key === 'canViewAllTurmas' && checked) {
        next.allowedTurmaIds = [];
      }

      return next;
    });
  };

  const toggleLancamento = (id: string, checked: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      allowedLancamentoIds: checked
        ? [...new Set([...prev.allowedLancamentoIds, id])]
        : prev.allowedLancamentoIds.filter((item) => item !== id),
    }));
  };

  const toggleTurma = (id: string, checked: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      allowedTurmaIds: checked
        ? [...new Set([...prev.allowedTurmaIds, id])]
        : prev.allowedTurmaIds.filter((item) => item !== id),
    }));
  };

  const toggleFinanceiroTurma = (id: string, checked: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      allowedFinanceiroTurmaIds: checked
        ? [...new Set([...prev.allowedFinanceiroTurmaIds, id])]
        : prev.allowedFinanceiroTurmaIds.filter((item) => item !== id),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.nome || !formData.email) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios.',
      });
      setLoading(false);
      return;
    }

    if (editingUser) {
      const result = await updateUser(editingUser.id, {
        nome: formData.nome,
        tipo: formData.tipo,
        cor: formData.cor,
      });

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: result.error || 'Erro ao atualizar usuário.',
        });
        setLoading(false);
        return;
      }

      const permissionResult = await updateUserPermissions(editingUser.id, permissions);
      if (!permissionResult.success) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: permissionResult.error || 'Erro ao atualizar permissões.',
        });
        setLoading(false);
        return;
      }

      toast({
        title: 'Sucesso',
        description: 'Usuário e permissões atualizados com sucesso.',
      });
      setIsOpen(false);
      resetForm();
      setLoading(false);
      return;
    }

    if (!formData.senha) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'A senha é obrigatória para novos usuários.',
      });
      setLoading(false);
      return;
    }

    const emailExists = users.some((u) => u.email.toLowerCase() === formData.email.toLowerCase());
    if (emailExists) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Este email já está cadastrado.',
      });
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

    if (!result.success || !result.user) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: result.error || 'Erro ao criar usuário.',
      });
      setLoading(false);
      return;
    }

    const permissionResult = await updateUserPermissions(result.user.id, permissions);
    if (!permissionResult.success) {
      toast({
        variant: 'destructive',
        title: 'Usuário criado, mas faltou salvar as permissões',
        description: permissionResult.error || 'Revise este usuário e salve novamente.',
      });
      setLoading(false);
      return;
    }

    toast({
      title: 'Usuário criado!',
      description: `Email: ${result.user.email} | Senha: ${formData.senha}`,
    });
    setIsOpen(false);
    resetForm();
    setLoading(false);
  };

  const handleToggleStatus = async (userToToggle: AppUser) => {
    if (userToToggle.id === user?.id) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não é possível desativar sua própria conta.',
      });
      return;
    }

    const result = await updateUser(userToToggle.id, { ativo: !userToToggle.ativo });

    if (result.success) {
      toast({
        title: userToToggle.ativo ? 'Usuário desativado' : 'Usuário ativado',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: result.error || 'Erro ao alterar status.',
      });
    }
  };

  const handleDelete = async (userToDelete: AppUser) => {
    if (userToDelete.id === user?.id) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não é possível excluir sua própria conta.',
      });
      return;
    }

    const result = await deleteUser(userToDelete.id);

    if (result.success) {
      toast({
        title: 'Usuário desativado',
        description: `${userToDelete.nome} foi desativado do sistema.`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: result.error || 'Erro ao excluir usuário.',
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const selectedLancamentosCount = permissions.canViewAllLancamentos ? availableLancamentos.length : permissions.allowedLancamentoIds.length;
  const selectedTurmasCount = permissions.canViewAllTurmas ? availableTurmas.length : permissions.allowedTurmaIds.length;
  const selectedFinanceiroTurmasCount = permissions.canViewAllFinanceiroTurmas ? availableFinanceiroTurmas.length : permissions.allowedFinanceiroTurmaIds.length;

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
          <DialogContent className="bg-card border-border max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
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
                      onValueChange={(value: UserRole) => handleRoleChange(value)}
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
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-border p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold text-foreground">Permissões de módulos</h3>
                      <p className="text-xs text-muted-foreground">
                        Aqui você define exatamente o que cada colaborador pode enxergar no sistema.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {MODULE_PERMISSIONS.map((permissionItem) => (
                        <label key={permissionItem.key} className="flex items-center gap-3 text-sm cursor-pointer">
                          <Checkbox
                            checked={Boolean(permissions[permissionItem.key])}
                            onCheckedChange={(checked) => togglePermission(permissionItem.key, checked === true)}
                            disabled={loading}
                          />
                          <span>{permissionItem.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {permissions.canViewLancamentos && (
                    <div className="rounded-xl border border-border p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-foreground">Lançamentos liberados</h3>
                          <p className="text-xs text-muted-foreground">
                            Se marcar todos, a pessoa verá qualquer lançamento. Se não, escolha manualmente.
                          </p>
                        </div>
                        <Badge variant="outline">{selectedLancamentosCount} liberado(s)</Badge>
                      </div>

                      <label className="flex items-center gap-3 text-sm cursor-pointer">
                        <Checkbox
                          checked={permissions.canViewAllLancamentos}
                          onCheckedChange={(checked) => togglePermission('canViewAllLancamentos', checked === true)}
                          disabled={loading}
                        />
                        <span>Ver todos os lançamentos</span>
                      </label>

                      {!permissions.canViewAllLancamentos && (
                        <ScrollArea className="h-36 rounded-md border border-border p-3">
                          <div className="space-y-3">
                            {availableLancamentos.map((lancamento) => (
                              <label key={lancamento.id} className="flex items-center gap-3 text-sm cursor-pointer">
                                <Checkbox
                                  checked={permissions.allowedLancamentoIds.includes(lancamento.id)}
                                  onCheckedChange={(checked) => toggleLancamento(lancamento.id, checked === true)}
                                  disabled={loading}
                                />
                                <span>{lancamento.nome}</span>
                              </label>
                            ))}
                            {availableLancamentos.length === 0 && (
                              <p className="text-xs text-muted-foreground">Nenhum lançamento encontrado.</p>
                            )}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  )}

                  {permissions.canViewFinanceiro && (
                    <div className="rounded-xl border border-border p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-foreground">Financeiro liberado</h3>
                          <p className="text-xs text-muted-foreground">
                            Defina quais turmas do Financeiro este colaborador pode visualizar.
                          </p>
                        </div>
                        <Badge variant="outline">{selectedFinanceiroTurmasCount} liberada(s)</Badge>
                      </div>

                      <label className="flex items-center gap-3 text-sm cursor-pointer">
                        <Checkbox
                          checked={permissions.canViewAllFinanceiroTurmas}
                          onCheckedChange={(checked) => togglePermission('canViewAllFinanceiroTurmas', checked === true)}
                          disabled={loading}
                        />
                        <span>Ver todas as turmas</span>
                      </label>

                      {!permissions.canViewAllFinanceiroTurmas && (
                        <ScrollArea className="h-36 rounded-md border border-border p-3">
                          <div className="space-y-3">
                            {availableFinanceiroTurmas.map((turma) => (
                              <label key={turma.id} className="flex items-center gap-3 text-sm cursor-pointer">
                                <Checkbox
                                  checked={permissions.allowedFinanceiroTurmaIds.includes(turma.id)}
                                  onCheckedChange={(checked) => toggleFinanceiroTurma(turma.id, checked === true)}
                                  disabled={loading}
                                />
                                <span>{turma.nome}</span>
                              </label>
                            ))}
                            {availableFinanceiroTurmas.length === 0 && (
                              <p className="text-xs text-muted-foreground">Nenhuma turma encontrada.</p>
                            )}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  )}

                  {permissions.canViewPedagogico && (
                    <div className="rounded-xl border border-border p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-foreground">Turmas liberadas</h3>
                          <p className="text-xs text-muted-foreground">
                            Use isso para limitar a visualização pedagógica, como uma investidora vendo só a turma #33.
                          </p>
                        </div>
                        <Badge variant="outline">{selectedTurmasCount} liberada(s)</Badge>
                      </div>

                      <label className="flex items-center gap-3 text-sm cursor-pointer">
                        <Checkbox
                          checked={permissions.canViewAllTurmas}
                          onCheckedChange={(checked) => togglePermission('canViewAllTurmas', checked === true)}
                          disabled={loading}
                        />
                        <span>Ver todas as turmas</span>
                      </label>

                      {!permissions.canViewAllTurmas && (
                        <ScrollArea className="h-36 rounded-md border border-border p-3">
                          <div className="space-y-3">
                            {availableTurmas.map((turma) => (
                              <label key={turma.id} className="flex items-center gap-3 text-sm cursor-pointer">
                                <Checkbox
                                  checked={permissions.allowedTurmaIds.includes(turma.id)}
                                  onCheckedChange={(checked) => toggleTurma(turma.id, checked === true)}
                                  disabled={loading}
                                />
                                <span>{turma.nome}</span>
                              </label>
                            ))}
                            {availableTurmas.length === 0 && (
                              <p className="text-xs text-muted-foreground">Nenhuma turma encontrada.</p>
                            )}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="flex-1" disabled={loading}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 gradient-primary hover:opacity-90" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : editingUser ? 'Salvar' : 'Criar Usuário'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant={u.tipo === 'admin' ? 'default' : 'secondary'} className={u.tipo === 'admin' ? 'bg-primary' : ''}>
                    {u.tipo === 'admin' ? 'Admin' : u.tipo === 'professora' ? 'Professora' : 'Vendedor'}
                  </Badge>
                  <Badge variant={u.ativo ? 'outline' : 'destructive'} className="text-xs">
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <p>Módulos liberados: {MODULE_PERMISSIONS.filter((item) => u.permissions[item.key]).length}</p>
                  <p>Lançamentos: {u.permissions.canViewAllLancamentos ? 'todos' : u.permissions.allowedLancamentoIds.length}</p>
                  <p>Turmas: {u.permissions.canViewAllTurmas ? 'todas' : u.permissions.allowedTurmaIds.length}</p>
                </div>
              </div>
            </div>

            {u.id !== user?.id && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(u)}
                  className="flex-1"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleStatus(u)}
                >
                  {u.ativo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(u)}
                  className="text-destructive hover:text-destructive"
                >
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
