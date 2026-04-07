import { useState } from 'react';
import { useAuth, AppUser, UserRole } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

export function TeamManagement() {
  const { user, users, addUser, updateUser, deleteUser } = useAuth();
  const { toast } = useToast();
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

      if (result.success) {
        toast({
          title: 'Sucesso',
          description: 'Usuário atualizado com sucesso!',
        });
        setIsOpen(false);
        resetForm();
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: result.error || 'Erro ao atualizar usuário.',
        });
      }
    } else {
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

      if (result.success && result.user) {
        toast({
          title: 'Usuário criado!',
          description: `Email: ${result.user.email} | Senha: ${formData.senha}`,
        });
        setIsOpen(false);
        resetForm();
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: result.error || 'Erro ao criar usuário.',
        });
      }
    }

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
                  onValueChange={(value: UserRole) =>
                    setFormData({ ...formData, tipo: value })
                  }
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
