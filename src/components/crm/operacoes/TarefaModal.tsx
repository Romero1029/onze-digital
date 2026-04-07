import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, User, Tag, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

interface Tarefa {
  id: string;
  titulo: string;
  descricao?: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  progresso: number;
  prazo?: string;
  responsavel_id?: string;
  created_at: string;
  updated_at: string;
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
}

interface TarefaModalProps {
  tarefa: Tarefa | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  usuarios: Usuario[];
  user: any;
}

export function TarefaModal({ tarefa, isOpen, onClose, onSave, usuarios, user }: TarefaModalProps) {
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    prioridade: 'media' as Tarefa['prioridade'],
    status: 'pendente' as Tarefa['status'],
    progresso: 0,
    prazo: '',
    responsavel_id: ''
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (tarefa) {
      setFormData({
        titulo: tarefa.titulo,
        descricao: tarefa.descricao || '',
        prioridade: tarefa.prioridade,
        status: tarefa.status,
        progresso: tarefa.progresso,
        prazo: tarefa.prazo || '',
        responsavel_id: tarefa.responsavel_id || ''
      });
    } else {
      setFormData({
        titulo: '',
        descricao: '',
        prioridade: 'media',
        status: 'pendente',
        progresso: 0,
        prazo: '',
        responsavel_id: user?.id || ''
      });
    }
  }, [tarefa, user, isOpen]);

  const handleSave = async () => {
    if (!formData.titulo.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Título é obrigatório' });
      return;
    }

    setIsLoading(true);
    try {
      const tarefaData = {
        titulo: formData.titulo,
        descricao: formData.descricao,
        prioridade: formData.prioridade,
        status: formData.status === 'pendente' ? 'a_fazer' : formData.status === 'cancelada' ? 'bloqueado' : formData.status,
        prazo: formData.prazo || null,
        responsaveis: [],
        updated_at: new Date().toISOString()
      };

      if (tarefa) {
        const { error } = await supabase
          .from('tarefas')
          .update(tarefaData)
          .eq('id', tarefa.id);

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Tarefa atualizada com sucesso' });
      } else {
        const { error } = await supabase
          .from('tarefas')
          .insert({
            ...tarefaData,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Tarefa criada com sucesso' });
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar tarefa:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao salvar tarefa' });
    } finally {
      setIsLoading(false);
    }
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'baixa': return 'bg-green-100 text-green-800';
      case 'media': return 'bg-yellow-100 text-yellow-800';
      case 'alta': return 'bg-orange-100 text-orange-800';
      case 'urgente': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendente': return 'bg-gray-100 text-gray-800';
      case 'em_andamento': return 'bg-blue-100 text-blue-800';
      case 'concluida': return 'bg-green-100 text-green-800';
      case 'cancelada': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pendente': return <Clock className="h-4 w-4" />;
      case 'em_andamento': return <AlertCircle className="h-4 w-4" />;
      case 'concluida': return <CheckCircle2 className="h-4 w-4" />;
      case 'cancelada': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tarefa ? 'Editar Tarefa' : 'Nova Tarefa'}
            {tarefa && (
              <Badge className={getStatusColor(tarefa.status)}>
                {getStatusIcon(tarefa.status)}
                <span className="ml-1 capitalize">{tarefa.status.replace('_', ' ')}</span>
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Título */}
          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Título *
            </label>
            <Input
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Digite o título da tarefa"
              className="mt-1"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Textarea
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva a tarefa em detalhes"
              rows={4}
              className="mt-1"
            />
          </div>

          {/* Prioridade e Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Prioridade
              </label>
              <Select
                value={formData.prioridade}
                onValueChange={(value: Tarefa['prioridade']) => setFormData({ ...formData, prioridade: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      Baixa
                    </div>
                  </SelectItem>
                  <SelectItem value="media">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      Média
                    </div>
                  </SelectItem>
                  <SelectItem value="alta">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      Alta
                    </div>
                  </SelectItem>
                  <SelectItem value="urgente">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      Urgente
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Status
              </label>
              <Select
                value={formData.status}
                onValueChange={(value: Tarefa['status']) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Progresso */}
          <div>
            <label className="text-sm font-medium">Progresso: {formData.progresso}%</label>
            <Progress value={formData.progresso} className="mt-2" />
            <Input
              type="range"
              min="0"
              max="100"
              value={formData.progresso}
              onChange={(e) => setFormData({ ...formData, progresso: parseInt(e.target.value) })}
              className="mt-2"
            />
          </div>

          {/* Prazo e Responsável */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Prazo
              </label>
              <Input
                type="datetime-local"
                value={formData.prazo}
                onChange={(e) => setFormData({ ...formData, prazo: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Responsável
              </label>
              {/* ✅ CORRIGIDO: value="none" ao invés de value="" */}
              <Select
                value={formData.responsavel_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, responsavel_id: value === 'none' ? '' : value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecionar responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não atribuído</SelectItem>
                  {(usuarios ?? []).map((usuario) => (
                    <SelectItem key={usuario.id} value={usuario.id}>
                      {usuario.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Informações adicionais */}
          {tarefa && (
            <div className="border-t pt-4 space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Criado em:</span>
                <span>{format(new Date(tarefa.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
              </div>
              <div className="flex justify-between">
                <span>Última atualização:</span>
                <span>{format(new Date(tarefa.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Salvando...' : tarefa ? 'Atualizar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}