import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  TrendingUp, TrendingDown, DollarSign, Plus, Trash2,
  ChevronDown, ChevronRight, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tipo = 'entrada' | 'saida';
type Categoria =
  | 'matricula' | 'outro_entrada'
  | 'custo_fixo' | 'custo_variavel' | 'ads' | 'outro_saida';
type Produto = 'npa' | 'psicanalise' | 'geral';

interface BalancoItem {
  id: string;
  descricao: string;
  valor: number;
  tipo: Tipo;
  categoria: Categoria;
  produto: Produto;
  mes_referencia: string;
  recorrente: boolean;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function mesLabel(mes: string) {
  const [y, m] = mes.split('-');
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${meses[parseInt(m) - 1]} ${y}`;
}

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mesesOpcoes() {
  const opcoes: string[] = [];
  const hoje = new Date();
  for (let i = 5; i >= -2; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    opcoes.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return opcoes;
}

const CATEGORIA_LABELS: Record<Categoria, string> = {
  matricula:      'Matrícula',
  outro_entrada:  'Outra Entrada',
  custo_fixo:     'Custo Fixo',
  custo_variavel: 'Custo Variável',
  ads:            'Facebook / Google Ads',
  outro_saida:    'Outra Saída',
};

const PRODUTO_LABELS: Record<Produto, string> = {
  npa:        'NPA',
  psicanalise:'Psicanálise',
  geral:      'Geral',
};

// ─── SectionTable ─────────────────────────────────────────────────────────────

function SectionTable({
  title, items, color, onAdd, onDelete, disabled,
}: {
  title: string;
  items: BalancoItem[];
  color: string;
  onAdd: () => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const total = items.reduce((s, i) => s + i.valor, 0);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        className={`w-full flex items-center justify-between px-4 py-3 ${color} hover:opacity-90 transition-opacity`}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-semibold text-sm">{title}</span>
          <Badge variant="secondary" className="text-xs">{items.length}</Badge>
        </div>
        <span className="font-bold text-sm">R$ {fmt(total)}</span>
      </button>

      {open && (
        <div className="bg-white">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum item</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2">Descrição</th>
                  <th className="text-left px-4 py-2 hidden sm:table-cell">Categoria</th>
                  <th className="text-right px-4 py-2">Valor</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span>{item.descricao}</span>
                        {item.recorrente && (
                          <RefreshCw className="h-3 w-3 text-muted-foreground" title="Recorrente" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 hidden sm:table-cell text-muted-foreground text-xs">
                      {CATEGORIA_LABELS[item.categoria]}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">R$ {fmt(item.valor)}</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => onDelete(item.id)}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!disabled && (
            <div className="px-4 py-3 border-t border-border/50">
              <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={onAdd}>
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AddDialog ────────────────────────────────────────────────────────────────

interface AddDialogProps {
  open: boolean;
  onClose: () => void;
  defaultCategoria: Categoria;
  defaultProduto: Produto;
  mes: string;
  onSaved: (item: BalancoItem) => void;
}

function AddDialog({ open, onClose, defaultCategoria, defaultProduto, mes, onSaved }: AddDialogProps) {
  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    categoria: defaultCategoria,
    produto: defaultProduto,
    recorrente: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(f => ({ ...f, categoria: defaultCategoria, produto: defaultProduto }));
  }, [open, defaultCategoria, defaultProduto]);

  const tipo: Tipo = ['matricula', 'outro_entrada'].includes(form.categoria) ? 'entrada' : 'saida';

  const handleSave = async () => {
    const valor = parseFloat(form.valor.replace(',', '.'));
    if (!form.descricao.trim() || isNaN(valor) || valor <= 0) {
      toast.error('Preencha descrição e valor válido');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('balanco_itens')
      .insert({
        descricao: form.descricao.trim(),
        valor,
        tipo,
        categoria: form.categoria,
        produto: form.produto,
        mes_referencia: mes,
        recorrente: form.recorrente,
      })
      .select('*')
      .single();

    setSaving(false);
    if (error || !data) { toast.error('Erro ao salvar'); return; }
    onSaved(data as BalancoItem);
    setForm({ descricao: '', valor: '', categoria: defaultCategoria, produto: defaultProduto, recorrente: false });
    onClose();
    toast.success('Item adicionado!');
  };

  const categoriasSaida: Categoria[] = ['custo_fixo', 'custo_variavel', 'ads', 'outro_saida'];
  const categoriasEntrada: Categoria[] = ['matricula', 'outro_entrada'];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Item</DialogTitle>
          <DialogDescription>
            {mesLabel(mes)} · {tipo === 'entrada' ? 'Entrada' : 'Saída'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Descrição</label>
            <Input
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex: Facebook Ads - Semana 1"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Valor (R$)</label>
            <Input
              type="number"
              step="0.01"
              value={form.valor}
              onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
              placeholder="0,00"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Categoria</label>
              <Select
                value={form.categoria}
                onValueChange={v => setForm(f => ({ ...f, categoria: v as Categoria }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__entrada" disabled className="font-semibold text-xs text-muted-foreground">
                    — Entradas —
                  </SelectItem>
                  {categoriasEntrada.map(c => (
                    <SelectItem key={c} value={c}>{CATEGORIA_LABELS[c]}</SelectItem>
                  ))}
                  <SelectItem value="__saida" disabled className="font-semibold text-xs text-muted-foreground">
                    — Saídas —
                  </SelectItem>
                  {categoriasSaida.map(c => (
                    <SelectItem key={c} value={c}>{CATEGORIA_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Produto</label>
              <Select
                value={form.produto}
                onValueChange={v => setForm(f => ({ ...f, produto: v as Produto }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PRODUTO_LABELS) as [Produto, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.recorrente}
              onChange={e => setForm(f => ({ ...f, recorrente: e.target.checked }))}
              className="rounded"
            />
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            Custo recorrente mensal
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── ProdutoView ──────────────────────────────────────────────────────────────

function ProdutoView({
  produto, items, mes, onItemAdded, onItemDeleted,
}: {
  produto: Produto;
  items: BalancoItem[];
  mes: string;
  onItemAdded: (item: BalancoItem) => void;
  onItemDeleted: (id: string) => void;
}) {
  const [dialog, setDialog] = useState<{ open: boolean; categoria: Categoria }>({
    open: false,
    categoria: 'custo_fixo',
  });

  const openAdd = (categoria: Categoria) => setDialog({ open: true, categoria });

  const entradas        = items.filter(i => i.tipo === 'entrada');
  const custosFixos     = items.filter(i => i.categoria === 'custo_fixo');
  const custosVariaveis = items.filter(i => i.categoria === 'custo_variavel');
  const ads             = items.filter(i => i.categoria === 'ads');
  const outrasSaidas    = items.filter(i => i.categoria === 'outro_saida');

  const totalEntradas = entradas.reduce((s, i) => s + i.valor, 0);
  const totalSaidas   = items.filter(i => i.tipo === 'saida').reduce((s, i) => s + i.valor, 0);
  const saldo         = totalEntradas - totalSaidas;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 border border-green-200 bg-green-50">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-green-700 font-medium">Entradas</p>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-700">R$ {fmt(totalEntradas)}</p>
        </Card>
        <Card className="p-4 border border-red-200 bg-red-50">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-red-700 font-medium">Saídas</p>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-700">R$ {fmt(totalSaidas)}</p>
        </Card>
        <Card className={`p-4 border ${saldo >= 0 ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50'}`}>
          <div className="flex items-center justify-between mb-1">
            <p className={`text-xs font-medium ${saldo >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Saldo</p>
            <DollarSign className={`h-4 w-4 ${saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
          </div>
          <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
            {saldo < 0 ? '-' : ''}R$ {fmt(Math.abs(saldo))}
          </p>
        </Card>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        <SectionTable
          title="Entradas (Matrículas / Receitas)"
          items={entradas}
          color="bg-green-100 text-green-800"
          onAdd={() => openAdd('matricula')}
          onDelete={onItemDeleted}
        />
        <SectionTable
          title="Custos Fixos"
          items={custosFixos}
          color="bg-slate-100 text-slate-800"
          onAdd={() => openAdd('custo_fixo')}
          onDelete={onItemDeleted}
        />
        <SectionTable
          title="Custos Variáveis"
          items={custosVariaveis}
          color="bg-yellow-100 text-yellow-800"
          onAdd={() => openAdd('custo_variavel')}
          onDelete={onItemDeleted}
        />
        <SectionTable
          title="Facebook / Google Ads"
          items={ads}
          color="bg-blue-100 text-blue-800"
          onAdd={() => openAdd('ads')}
          onDelete={onItemDeleted}
        />
        {outrasSaidas.length > 0 && (
          <SectionTable
            title="Outras Saídas"
            items={outrasSaidas}
            color="bg-red-100 text-red-800"
            onAdd={() => openAdd('outro_saida')}
            onDelete={onItemDeleted}
          />
        )}
      </div>

      <AddDialog
        open={dialog.open}
        onClose={() => setDialog(d => ({ ...d, open: false }))}
        defaultCategoria={dialog.categoria}
        defaultProduto={produto}
        mes={mes}
        onSaved={onItemAdded}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Balanco() {
  const [mes, setMes] = useState(mesAtual());
  const [produtoTab, setProdutoTab] = useState<Produto>('npa');
  const [items, setItems] = useState<BalancoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('balanco_itens')
        .select('*')
        .eq('mes_referencia', mes)
        .order('created_at', { ascending: false });
      setItems((data ?? []) as BalancoItem[]);
      setLoading(false);
    };
    load();
  }, [mes]);

  const handleItemAdded = (item: BalancoItem) => {
    setItems(prev => [item, ...prev]);
  };

  const handleItemDeleted = async (id: string) => {
    const { error } = await supabase.from('balanco_itens').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover item'); return; }
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success('Item removido!');
  };

  // Split items by produto (NPA + geral, Psicanalise + geral)
  const itemsByProduto = useMemo(() => ({
    npa:        items.filter(i => i.produto === 'npa'        || i.produto === 'geral'),
    psicanalise:items.filter(i => i.produto === 'psicanalise'|| i.produto === 'geral'),
    geral:      items,
  }), [items]);

  // Consolidated totals
  const totalEntradas = items.filter(i => i.tipo === 'entrada').reduce((s, i) => s + i.valor, 0);
  const totalSaidas   = items.filter(i => i.tipo === 'saida').reduce((s, i) => s + i.valor, 0);
  const saldoGeral    = totalEntradas - totalSaidas;

  const tabs: { id: Produto; label: string; color: string }[] = [
    { id: 'npa',        label: 'NPA',        color: 'bg-blue-600'   },
    { id: 'psicanalise',label: 'Psicanálise', color: 'bg-purple-600' },
    { id: 'geral',      label: 'Geral',      color: 'bg-gray-600'   },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-20 lg:pb-6 overflow-y-auto h-full bg-white">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Balanço da Empresa</h1>
          <p className="text-sm text-muted-foreground mt-1">Entradas, saídas e resultado por produto</p>
        </div>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {mesesOpcoes().map(m => (
              <SelectItem key={m} value={m}>{mesLabel(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Consolidated summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 border border-green-200">
          <p className="text-xs text-muted-foreground font-medium">Total Entradas</p>
          <p className="text-2xl font-bold text-green-600 mt-1">R$ {fmt(totalEntradas)}</p>
          <p className="text-xs text-muted-foreground mt-1">Todos os produtos</p>
        </Card>
        <Card className="p-4 border border-red-200">
          <p className="text-xs text-muted-foreground font-medium">Total Saídas</p>
          <p className="text-2xl font-bold text-red-600 mt-1">R$ {fmt(totalSaidas)}</p>
          <p className="text-xs text-muted-foreground mt-1">Todos os produtos</p>
        </Card>
        <Card className={`p-4 ${saldoGeral >= 0 ? 'border-blue-200' : 'border-orange-200'}`}>
          <p className="text-xs text-muted-foreground font-medium">Saldo Geral</p>
          <p className={`text-2xl font-bold mt-1 ${saldoGeral >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
            {saldoGeral < 0 ? '-' : ''}R$ {fmt(Math.abs(saldoGeral))}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{mesLabel(mes)}</p>
        </Card>
      </div>

      {/* Produto tabs */}
      <div className="flex gap-2 border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setProdutoTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              produtoTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <ProdutoView
          key={`${produtoTab}-${mes}`}
          produto={produtoTab}
          items={itemsByProduto[produtoTab]}
          mes={mes}
          onItemAdded={handleItemAdded}
          onItemDeleted={handleItemDeleted}
        />
      )}
    </div>
  );
}
