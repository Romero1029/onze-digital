import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, parseISO, isSameDay, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Instagram, Youtube, Music, Linkedin, Trash2, Pencil, X, Check, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useCalendario } from './useCalendario';

interface ConteudoCalendario {
  id: string;
  titulo: string;
  plataforma: 'instagram' | 'youtube' | 'tiktok' | 'linkedin';
  formato?: string;
  data_publicacao: string;
  status: 'ideia' | 'roteiro' | 'gravando' | 'editando' | 'agendado' | 'publicado';
  legenda?: string;
  observacoes?: string;
  link?: string;
}

interface CalendarioConteudoViewProps {
  conteudos: ConteudoCalendario[];
  onLoadData: () => void;
}

interface EventoConteudo {
  id: string;
  titulo: string;
  plataforma: string;
  status: string;
  cor: string;
  data: Date;
  dados: ConteudoCalendario;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const getStatusColor = (status: string) => {
  const map: Record<string, string> = {
    ideia: '#6B7280',
    roteiro: '#2563EB',
    gravando: '#EA580C',
    editando: '#7C3AED',
    agendado: '#D97706',
    publicado: '#10B981',
  };
  return map[status] ?? '#6B7280';
};

const getPlataformaColor = (plataforma: string) => {
  const map: Record<string, string> = {
    instagram: '#E1306C',
    youtube: '#FF0000',
    tiktok: '#1a1a1a',
    linkedin: '#0077B5',
  };
  return map[plataforma] ?? '#E1306C';
};

const PlataformaIcon = ({ plataforma, cls = 'h-3 w-3' }: { plataforma: string; cls?: string }) => {
  const icons: Record<string, any> = {
    instagram: Instagram,
    youtube: Youtube,
    tiktok: Music,
    linkedin: Linkedin,
  };
  const Icon = icons[plataforma] ?? Instagram;
  return <Icon className={cls} />;
};

const STATUS_LABEL: Record<string, string> = {
  ideia: '💡 Ideia',
  roteiro: '📝 Roteiro',
  gravando: '🎥 Gravando',
  editando: '✂️ Editando',
  agendado: '📅 Agendado',
  publicado: '✅ Publicado',
};

const PLATAFORMA_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
};

const FORMATO_OPTIONS = ['reels', 'feed', 'stories', 'carrossel', 'video', 'short'];

// ─── component ────────────────────────────────────────────────────────────────

export function CalendarioConteudoView({ conteudos, onLoadData }: CalendarioConteudoViewProps) {
  const { currentDate, currentMonth, currentYear, getWeeksInMonth, mesAnterior, mesProximo, irParaHoje } = useCalendario();

  const [plataformaFilter, setPlataformaFilter] = useState('todas');
  const [statusFilter, setStatusFilter] = useState('todos');

  // ── create modal ──
  const [showCreate, setShowCreate] = useState(false);
  const [criando, setCriando] = useState(false);
  const [createForm, setCreateForm] = useState({
    titulo: '',
    plataforma: 'instagram',
    formato: 'reels',
    status: 'ideia',
    data_publicacao: '',
    legenda: '',
    observacoes: '',
    link: '',
  });

  // ── detail/edit modal ──
  const [selectedConteudo, setSelectedConteudo] = useState<EventoConteudo | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [salvando, setSalvando] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deletando, setDeletando] = useState(false);

  const weeks = getWeeksInMonth(currentYear, currentMonth);

  // ── populate editForm when opening detail ──
  useEffect(() => {
    if (!selectedConteudo) return;
    const d = selectedConteudo.dados;
    setEditForm({
      titulo: d.titulo ?? '',
      plataforma: d.plataforma ?? 'instagram',
      formato: d.formato ?? 'reels',
      status: d.status ?? 'ideia',
      data_publicacao: d.data_publicacao
        ? format(new Date(d.data_publicacao), "yyyy-MM-dd'T'HH:mm")
        : '',
      legenda: d.legenda ?? '',
      observacoes: d.observacoes ?? '',
      link: d.link ?? '',
    });
  }, [selectedConteudo]);

  // ── derived data ──
  const filteredConteudos = useMemo(() => {
    return (conteudos ?? []).filter(c => {
      const okPlataforma = plataformaFilter === 'todas' || c.plataforma === plataformaFilter;
      const okStatus = statusFilter === 'todos' || c.status === statusFilter;
      return okPlataforma && okStatus;
    });
  }, [conteudos, plataformaFilter, statusFilter]);

  const conteudosPorDia = useMemo(() => {
    const map: Record<string, EventoConteudo[]> = {};
    filteredConteudos.forEach(c => {
      if (!c.data_publicacao) return;
      try {
        const data = parseISO(c.data_publicacao);
        const key = format(data, 'yyyy-MM-dd');
        if (!map[key]) map[key] = [];
        map[key].push({
          id: `conteudo-${c.id}`,
          titulo: c.titulo,
          plataforma: c.plataforma,
          status: c.status,
          cor: getStatusColor(c.status),
          data,
          dados: c,
        });
      } catch { /* skip invalid dates */ }
    });
    return map;
  }, [filteredConteudos]);

  // ── handlers ──
  const handleDiaClick = (dia: Date) => {
    setCreateForm(f => ({
      ...f,
      titulo: '',
      data_publicacao: format(dia, "yyyy-MM-dd'T'HH:mm"),
    }));
    setShowCreate(true);
  };

  const handleConteudoClick = (ev: EventoConteudo) => {
    setSelectedConteudo(ev);
    setEditMode(false);
    setShowConfirmDelete(false);
    setShowDetail(true);
  };

  const handleCreate = async () => {
    if (!createForm.titulo || !createForm.data_publicacao) {
      toast({ variant: 'destructive', title: 'Título e data são obrigatórios' });
      return;
    }
    setCriando(true);
    try {
      const { error } = await supabase.from('conteudo_calendario').insert({
        titulo: createForm.titulo,
        plataforma: createForm.plataforma,
        formato: createForm.formato,
        status: createForm.status,
        data_publicacao: new Date(createForm.data_publicacao).toISOString(),
        legenda: createForm.legenda || null,
        observacoes: createForm.observacoes || null,
        link: createForm.link || null,
      });
      if (error) throw error;
      toast({ title: 'Conteúdo criado!' });
      setShowCreate(false);
      setCreateForm({ titulo: '', plataforma: 'instagram', formato: 'reels', status: 'ideia', data_publicacao: '', legenda: '', observacoes: '', link: '' });
      onLoadData();
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao criar conteúdo' });
    } finally {
      setCriando(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedConteudo) return;
    if (!editForm.titulo || !editForm.data_publicacao) {
      toast({ variant: 'destructive', title: 'Título e data são obrigatórios' });
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.from('conteudo_calendario').update({
        titulo: editForm.titulo,
        plataforma: editForm.plataforma,
        formato: editForm.formato,
        status: editForm.status,
        data_publicacao: new Date(editForm.data_publicacao).toISOString(),
        legenda: editForm.legenda || null,
        observacoes: editForm.observacoes || null,
        link: editForm.link || null,
      }).eq('id', selectedConteudo.dados.id);
      if (error) throw error;
      toast({ title: 'Conteúdo atualizado!' });
      setEditMode(false);
      setShowDetail(false);
      onLoadData();
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao salvar' });
    } finally {
      setSalvando(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedConteudo) return;
    setDeletando(true);
    try {
      const { error } = await supabase.from('conteudo_calendario').delete().eq('id', selectedConteudo.dados.id);
      if (error) throw error;
      toast({ title: 'Conteúdo excluído' });
      setShowDetail(false);
      setSelectedConteudo(null);
      setShowConfirmDelete(false);
      onLoadData();
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao excluir' });
    } finally {
      setDeletando(false);
    }
  };

  // ── render ──
  return (
    <div className="space-y-4">

      {/* ── Filtros + botão ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Plataforma filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Plataforma:</label>
            <Select value={plataformaFilter} onValueChange={setPlataformaFilter}>
              <SelectTrigger className="w-36 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Status:</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ideia">Ideia</SelectItem>
                <SelectItem value="roteiro">Roteiro</SelectItem>
                <SelectItem value="gravando">Gravando</SelectItem>
                <SelectItem value="editando">Editando</SelectItem>
                <SelectItem value="agendado">Agendado</SelectItem>
                <SelectItem value="publicado">Publicado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap gap-3 text-sm">
            {[
              { cor: '#6B7280', label: 'Ideia' },
              { cor: '#2563EB', label: 'Roteiro' },
              { cor: '#EA580C', label: 'Gravando' },
              { cor: '#7C3AED', label: 'Editando' },
              { cor: '#D97706', label: 'Agendado' },
              { cor: '#10B981', label: 'Publicado' },
            ].map(({ cor, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: cor }} />
                <span className="text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <Button
          onClick={() => setShowCreate(true)}
          className="bg-[#be123c] hover:bg-[#9f1239] text-white rounded-xl"
        >
          <Plus className="h-4 w-4 mr-2" />Conteúdo
        </Button>
      </div>

      {/* ── Navegação ── */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
        <h2 className="text-lg sm:text-xl font-bold capitalize">
          {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={mesAnterior} className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-100 text-lg transition-colors">‹</button>
          <button onClick={irParaHoje} className="px-3 h-8 text-sm rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">Hoje</button>
          <button onClick={mesProximo} className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-100 text-lg transition-colors">›</button>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {['Mês', 'Semana', 'Dia'].map((v, i) => (
            <button key={v} className={`h-7 px-3 text-xs rounded-md font-medium transition-all ${i === 0 ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>{v}</button>
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="p-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.map((week, wi) => week.map((dia, di) => {
            const key = format(dia, 'yyyy-MM-dd');
            const evs = conteudosPorDia[key] || [];
            const isHoje = isSameDay(dia, new Date());
            const isMes = isSameMonth(dia, currentDate);
            return (
              <div
                key={`${wi}-${di}`}
                className={`min-h-[120px] border-b border-r border-gray-100 p-1.5 cursor-pointer transition-colors ${isHoje ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                onClick={() => handleDiaClick(dia)}
              >
                <div className={`flex items-center justify-center w-7 h-7 text-xs font-semibold rounded-full mb-1 ${isHoje ? 'bg-[#9B1D42] text-white' : isMes ? 'text-gray-800' : 'text-gray-300'}`}>
                  {dia.getDate()}
                </div>
                <div className="space-y-0.5">
                  {evs.slice(0, 3).map(ev => (
                    <div
                      key={ev.id}
                      className="rounded-md px-1.5 py-0.5 text-xs text-white font-medium truncate cursor-pointer flex items-center gap-1 hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: ev.cor }}
                      onClick={e => { e.stopPropagation(); handleConteudoClick(ev); }}
                    >
                      <PlataformaIcon plataforma={ev.plataforma} />
                      <span className="truncate">{ev.titulo}</span>
                    </div>
                  ))}
                  {evs.length > 3 && (
                    <div className="text-gray-400 text-xs pl-1">+{evs.length - 3} mais</div>
                  )}
                </div>
              </div>
            );
          }))}
        </div>
      </div>

      {/* ── Modal Detalhes / Edição ── */}
      <Dialog open={showDetail} onOpenChange={o => { setShowDetail(o); if (!o) { setEditMode(false); setShowConfirmDelete(false); } }}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden">
          <div
            className="h-1.5 w-full"
            style={{ backgroundColor: editMode ? getPlataformaColor(editForm.plataforma) : getPlataformaColor(selectedConteudo?.plataforma ?? '') }}
          />
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${getPlataformaColor(selectedConteudo?.plataforma ?? '')}20` }}
                >
                  <PlataformaIcon plataforma={selectedConteudo?.plataforma ?? ''} cls="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block">
                    {PLATAFORMA_LABEL[selectedConteudo?.plataforma ?? ''] ?? ''}
                    {selectedConteudo?.dados?.formato ? ` · ${selectedConteudo.dados.formato}` : ''}
                  </span>
                  {!editMode && (
                    <h2 className="text-lg font-bold text-gray-900 leading-tight">{selectedConteudo?.titulo}</h2>
                  )}
                </div>
              </div>
              {!editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>

            {editMode ? (
              /* ── Edit form ── */
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Título</label>
                  <Input value={editForm.titulo} onChange={e => setEditForm({ ...editForm, titulo: e.target.value })} className="rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Plataforma</label>
                    <Select value={editForm.plataforma} onValueChange={v => setEditForm({ ...editForm, plataforma: v })}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="youtube">YouTube</SelectItem>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Formato</label>
                    <Select value={editForm.formato} onValueChange={v => setEditForm({ ...editForm, formato: v })}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FORMATO_OPTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Status</label>
                    <Select value={editForm.status} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABEL).map(([val, lbl]) => (
                          <SelectItem key={val} value={val}>{lbl}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Data</label>
                    <Input type="datetime-local" value={editForm.data_publicacao} onChange={e => setEditForm({ ...editForm, data_publicacao: e.target.value })} className="rounded-xl text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Legenda / Copy</label>
                  <Textarea value={editForm.legenda} onChange={e => setEditForm({ ...editForm, legenda: e.target.value })} rows={3} placeholder="Texto do post..." className="rounded-xl resize-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Observações</label>
                  <Textarea value={editForm.observacoes} onChange={e => setEditForm({ ...editForm, observacoes: e.target.value })} rows={2} placeholder="Briefing, referências..." className="rounded-xl resize-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Link</label>
                  <Input value={editForm.link} onChange={e => setEditForm({ ...editForm, link: e.target.value })} placeholder="https://..." className="rounded-xl" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveEdit} disabled={salvando} className="flex-1 bg-[#be123c] hover:bg-[#9f1239] text-white rounded-xl">
                    {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}Salvar
                  </Button>
                  <Button variant="outline" onClick={() => setEditMode(false)} className="rounded-xl"><X className="h-4 w-4" /></Button>
                </div>
              </div>
            ) : (
              /* ── View mode ── */
              <div className="space-y-3">
                {/* Status badge */}
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: getStatusColor(selectedConteudo?.status ?? '') }}
                  >
                    {STATUS_LABEL[selectedConteudo?.status ?? ''] ?? selectedConteudo?.status}
                  </span>
                </div>

                {/* Data */}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-gray-400 text-xs">📅</span>
                  <span>
                    {selectedConteudo?.dados?.data_publicacao
                      ? format(new Date(selectedConteudo.dados.data_publicacao), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
                      : '—'}
                  </span>
                </div>

                {/* Legenda */}
                {selectedConteudo?.dados?.legenda ? (
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1">📝 Legenda</p>
                    <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                      {selectedConteudo.dados.legenda}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">Sem legenda — clique em editar para adicionar.</p>
                )}

                {/* Observações */}
                {selectedConteudo?.dados?.observacoes && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1">💡 Observações</p>
                    <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                      {selectedConteudo.dados.observacoes}
                    </div>
                  </div>
                )}

                {/* Link */}
                {selectedConteudo?.dados?.link && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 text-xs">🔗</span>
                    <a href={selectedConteudo.dados.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate">
                      {selectedConteudo.dados.link}
                    </a>
                  </div>
                )}

                {/* Confirm delete */}
                {showConfirmDelete ? (
                  <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <p className="text-sm font-semibold text-red-700">Excluir este conteúdo?</p>
                    </div>
                    <p className="text-xs text-red-500 mb-3">Esta ação não pode ser desfeita.</p>
                    <div className="flex gap-2">
                      <Button onClick={handleDelete} disabled={deletando} variant="destructive" className="flex-1 rounded-xl text-sm h-8">
                        {deletando && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Confirmar
                      </Button>
                      <Button variant="outline" onClick={() => setShowConfirmDelete(false)} className="rounded-xl text-sm h-8">Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" onClick={() => setShowDetail(false)} className="flex-1 rounded-xl">Fechar</Button>
                    <Button variant="outline" onClick={() => setShowConfirmDelete(true)} className="rounded-xl border-red-200 text-red-500 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal Criar ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden">
          <div className="h-1.5 w-full" style={{ backgroundColor: getPlataformaColor(createForm.plataforma) }} />
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-lg font-bold">Novo Conteúdo</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Título *</label>
                <Input
                  value={createForm.titulo}
                  onChange={e => setCreateForm({ ...createForm, titulo: e.target.value })}
                  placeholder="Título do conteúdo"
                  className="rounded-xl"
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Plataforma</label>
                  <Select value={createForm.plataforma} onValueChange={v => setCreateForm({ ...createForm, plataforma: v })}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Formato</label>
                  <Select value={createForm.formato} onValueChange={v => setCreateForm({ ...createForm, formato: v })}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORMATO_OPTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Status</label>
                  <Select value={createForm.status} onValueChange={v => setCreateForm({ ...createForm, status: v })}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABEL).map(([val, lbl]) => (
                        <SelectItem key={val} value={val}>{lbl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Data *</label>
                  <Input
                    type="datetime-local"
                    value={createForm.data_publicacao}
                    onChange={e => setCreateForm({ ...createForm, data_publicacao: e.target.value })}
                    className="rounded-xl text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Legenda / Copy</label>
                <Textarea
                  value={createForm.legenda}
                  onChange={e => setCreateForm({ ...createForm, legenda: e.target.value })}
                  placeholder="Texto do post, hashtags..."
                  rows={3}
                  className="rounded-xl resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Observações</label>
                <Textarea
                  value={createForm.observacoes}
                  onChange={e => setCreateForm({ ...createForm, observacoes: e.target.value })}
                  placeholder="Briefing, referências, instruções..."
                  rows={2}
                  className="rounded-xl resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Link</label>
                <Input
                  value={createForm.link}
                  onChange={e => setCreateForm({ ...createForm, link: e.target.value })}
                  placeholder="https://..."
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-xl">Cancelar</Button>
              <Button onClick={handleCreate} disabled={criando} className="flex-1 bg-[#be123c] hover:bg-[#9f1239] text-white rounded-xl">
                {criando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}Criar Conteúdo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
