import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLeads } from '@/contexts/LeadsContext';
import { PIPELINE_STAGES, PipelineStage } from '@/types/crm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Zap } from 'lucide-react';

interface FlashLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FlashLeadModal({ isOpen, onClose }: FlashLeadModalProps) {
  const { user, getActiveVendedores } = useAuth();
  const { cursos, addLead } = useLeads();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const vendedores = getActiveVendedores();

  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    cursoInteresse: '',
    responsavelId: '',
    etapa: 'novo' as PipelineStage,
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        nome: '',
        telefone: '',
        cursoInteresse: '',
        responsavelId: user?.id || '',
        etapa: 'novo',
      });
    }
  }, [isOpen, user]);

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const leadData = {
        nome: formData.nome || 'Lead Rápido',
        email: '',
        telefone: formData.telefone || '',
        cursoInteresse: formData.cursoInteresse || 'Não informado',
        comoConheceu: 'Não informado',
        etapa: formData.etapa,
        responsavelId: formData.responsavelId || user?.id || '',
      };

      await addLead(leadData);
      
      toast({
        title: 'Lead adicionado!',
        description: `${leadData.nome} foi adicionado rapidamente ao pipeline.`,
      });

      onClose();
    } catch (error: any) {
      console.error('Erro ao adicionar lead:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao adicionar',
        description: error?.message || 'Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-warning" />
            Adicionar Lead Rápido
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Nome do lead (opcional)"
            />
          </div>

          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: formatPhone(e.target.value) })}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="space-y-2">
            <Label>Curso de interesse</Label>
            <Select
              value={formData.cursoInteresse}
              onValueChange={(value) => setFormData({ ...formData, cursoInteresse: value })}
            >
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Selecione (opcional)" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {cursos.map((c) => (
                  <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Etapa</Label>
            <Select
              value={formData.etapa}
              onValueChange={(value: PipelineStage) => setFormData({ ...formData, etapa: value })}
            >
              <SelectTrigger className="bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${s.color}`} />
                      {s.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Vendedor responsável</Label>
            <Select
              value={formData.responsavelId}
              onValueChange={(value) => setFormData({ ...formData, responsavelId: value })}
            >
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Selecione (opcional)" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {vendedores.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: v.cor }}
                      />
                      {v.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 gradient-primary hover:opacity-90"
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
