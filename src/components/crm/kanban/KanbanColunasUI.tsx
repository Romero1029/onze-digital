import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Pencil, Trash2, ChevronLeft, ChevronRight, Settings, Plus } from 'lucide-react';
import { KanbanColuna } from './useKanbanColunas';

// ─── Column header with management buttons ────────────────────────────────────

export function KanbanColunaHeader({
  coluna,
  count,
  leadValues,
  disabled,
  onRename,
  onDelete,
  onMoveLeft,
  onMoveRight,
  onOpenSettings,
}: {
  coluna: KanbanColuna;
  count: number;
  leadValues?: number[]; // for receita/roi columns
  disabled?: boolean;
  onRename: () => void;
  onDelete: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onOpenSettings: () => void;
}) {
  const receita = (leadValues ?? []).reduce((s, v) => s + v, 0);
  const meta = coluna.meta_leads ?? 0;
  const pct = meta > 0 ? Math.min((count / meta) * 100, 100) : 0;
  const cor = coluna.cor ?? '#6366f1';

  return (
    <div className="pb-3 mb-3 border-b border-border/60">
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: cor }}
        />
        <span className="font-semibold text-sm flex-1 leading-tight">{coluna.nome}</span>
        <Badge variant="secondary" className="text-xs px-1.5 py-0">{count}</Badge>
        {!disabled && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover/col:opacity-100 transition-opacity">
            <button onClick={onMoveLeft}  className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><ChevronLeft  className="h-3 w-3" /></button>
            <button onClick={onMoveRight} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><ChevronRight className="h-3 w-3" /></button>
            <button onClick={onRename}    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil   className="h-3 w-3" /></button>
            <button onClick={onOpenSettings} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Settings className="h-3 w-3" /></button>
            <button onClick={onDelete}   className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-red-500"><Trash2   className="h-3 w-3" /></button>
          </div>
        )}
      </div>

      {/* Progress bar when meta is set */}
      {meta > 0 && (
        <div className="mt-1.5 space-y-0.5">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground">{count} / {meta} meta ({pct.toFixed(0)}%)</p>
        </div>
      )}

      {/* Revenue display */}
      {(coluna.tipo_regra === 'receita' || coluna.tipo_regra === 'roi') && (leadValues?.length ?? 0) > 0 && (
        <p className="text-xs font-semibold text-green-600 mt-1">
          R$ {receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      )}
    </div>
  );
}

// ─── Add column button ────────────────────────────────────────────────────────

export function AddColunaButton({ onAdd, disabled }: { onAdd: (nome: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');

  const save = () => {
    if (!nome.trim()) return;
    onAdd(nome.trim());
    setNome('');
    setOpen(false);
  };

  return (
    <>
      <button
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex-shrink-0 w-64 h-12 flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-40"
      >
        <Plus className="h-4 w-4" /> Nova Coluna
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Coluna</DialogTitle></DialogHeader>
          <Input
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex: Negociação"
            onKeyDown={e => e.key === 'Enter' && save()}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Criar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Rename column modal ──────────────────────────────────────────────────────

export function RenameColunaModal({
  coluna,
  onSave,
  onClose,
}: {
  coluna: KanbanColuna | null;
  onSave: (id: string, nome: string) => void;
  onClose: () => void;
}) {
  const [nome, setNome] = useState(coluna?.nome ?? '');

  if (!coluna) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Renomear Coluna</DialogTitle></DialogHeader>
        <Input
          value={nome}
          onChange={e => setNome(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSave(coluna.id, nome)}
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(coluna.id, nome)}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Column settings / rules modal ───────────────────────────────────────────

export function ColunaSettingsModal({
  coluna,
  onSave,
  onClose,
}: {
  coluna: KanbanColuna | null;
  onSave: (id: string, updates: Partial<KanbanColuna>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    meta_leads: String(coluna?.meta_leads ?? ''),
    tipo_regra: coluna?.tipo_regra ?? 'normal',
    cor: coluna?.cor ?? '#6366f1',
  });

  if (!coluna) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Regras da Coluna</DialogTitle>
          <DialogDescription>{coluna.nome}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cor</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.cor}
                onChange={e => setForm(f => ({ ...f, cor: e.target.value }))}
                className="w-10 h-8 rounded cursor-pointer border border-border"
              />
              <span className="text-sm text-muted-foreground">{form.cor}</span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Meta de Leads</label>
            <Input
              type="number"
              value={form.meta_leads}
              onChange={e => setForm(f => ({ ...f, meta_leads: e.target.value }))}
              placeholder="Ex: 50 (deixe vazio para desativar)"
            />
            <p className="text-xs text-muted-foreground">Mostra barra de progresso na coluna</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo / Regra</label>
            <Select value={form.tipo_regra} onValueChange={v => setForm(f => ({ ...f, tipo_regra: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="receita">Receita — soma valores dos leads</SelectItem>
                <SelectItem value="roi">ROI — receita ÷ custo de aquisição</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {form.tipo_regra === 'receita' && 'Exibe soma dos valores dos leads nesta coluna'}
              {form.tipo_regra === 'roi' && 'ROI = (receita − custo) ÷ custo × 100%'}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(coluna.id, {
            meta_leads: form.meta_leads ? Number(form.meta_leads) : null,
            tipo_regra: form.tipo_regra,
            cor: form.cor,
          })}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete column confirm ────────────────────────────────────────────────────

export function DeleteColunaModal({
  coluna,
  leadCount,
  onConfirm,
  onClose,
}: {
  coluna: KanbanColuna | null;
  leadCount: number;
  onConfirm: (id: string) => void;
  onClose: () => void;
}) {
  if (!coluna) return null;
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Apagar Coluna</DialogTitle>
          <DialogDescription>
            "{coluna.nome}" tem {leadCount} lead(s). Os leads ficarão sem coluna no banco.
            Tem certeza?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={() => onConfirm(coluna.id)}>Apagar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
