import { useState, useEffect } from 'react'
const coresPadrao = ['#DC2626','#2563EB','#16A34A','#EA580C','#7C3AED','#DB2777']
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function NovaTarefaModal({ open, onClose, onSuccess }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    tipo: 'unitaria' as 'unitaria' | 'sequencial',
    prioridade: 'media' as 'baixa' | 'media' | 'alta' | 'urgente',
    data_inicio: '',
    prazo: '',
  })

  const [equipe, setEquipe] = useState<{id: string, nome: string, cor?: string}[]>([])
  const [responsaveisSelecionados, setResponsaveisSelecionados] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    const buscarEquipe = async () => {
      const { data } = await supabase
        .from('equipe')
        .select('id, nome, cor')
      setEquipe(data ?? [])
    }
    buscarEquipe()
  }, [open])

  const handleSubmit = async () => {
    if (!form.titulo.trim()) {
      toast({ title: 'Título obrigatório', variant: 'destructive' })
      return
    }
    setLoading(true)
    const { error } = await supabase.from('tarefas').insert({
      titulo: form.titulo,
      descricao: form.descricao,
      tipo: form.tipo,
      status: 'a_fazer' as const,
      prioridade: form.prioridade,
      responsaveis: responsaveisSelecionados,
      data_inicio: form.data_inicio || null,
      prazo: form.prazo || null,
      tags: [],
    })
    setLoading(false)
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Tarefa criada!' })
    setForm({ titulo: '', descricao: '', tipo: 'unitaria', prioridade: 'media', data_inicio: '', prazo: '' })
    setResponsaveisSelecionados([])
    onSuccess()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div>
            <Label>Título *</Label>
            <Input
              value={form.titulo}
              onChange={e => setForm({ ...form, titulo: e.target.value })}
              placeholder="Nome da tarefa..."
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={form.descricao}
              onChange={e => setForm({ ...form, descricao: e.target.value })}
              placeholder="Descreva a tarefa..."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unitaria">Unitária</SelectItem>
                  <SelectItem value="sequencial">Sequencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={v => setForm({ ...form, prioridade: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Seção de Responsáveis */}
          <div>
            <Label>Responsáveis</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {equipe.map((membro, index) => {
                const selecionado = responsaveisSelecionados.includes(membro.id)
                const cor = membro.cor || coresPadrao[index % coresPadrao.length]
                return (
                  <button
                    key={membro.id}
                    type="button"
                    onClick={() => {
                      setResponsaveisSelecionados(prev =>
                        prev.includes(membro.id)
                          ? prev.filter(id => id !== membro.id)
                          : [...prev, membro.id]
                      )
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                      selecionado ? 'text-white shadow-md scale-105' : 'bg-white text-gray-600 border-gray-200'
                    }`}
                    style={selecionado ? { backgroundColor: cor, borderColor: cor } : {}}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: cor }}
                    >
                      {membro.nome.charAt(0).toUpperCase()}
                    </div>
                    {membro.nome}
                    {selecionado && <span className="ml-1">✓</span>}
                  </button>
                )
              })}
              {equipe.length === 0 && (
                <p className="text-sm text-gray-400">Nenhum membro cadastrado na equipe</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data de Início</Label>
              <Input type="date" value={form.data_inicio} onChange={e => setForm({ ...form, data_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={form.prazo} onChange={e => setForm({ ...form, prazo: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Criando...' : 'Criar Tarefa'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}