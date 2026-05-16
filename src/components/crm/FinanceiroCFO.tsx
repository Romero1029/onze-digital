import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, TrendingUp, AlertTriangle, Target } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Turma {
  id: string;
  nome: string;
  produto?: string;
  valor_mensalidade?: number;
  total_mensalidades?: number;
}

interface Aluno {
  id: string;
  nome: string;
  turma_id: string;
  status: 'ativo' | 'inadimplente' | 'cancelado' | 'concluido';
  dia_vencimento?: number;
  valor_mensalidade?: number;
  mensalidades_pagas?: number;
  total_mensalidades?: number;
}

interface Pagamento {
  id: string;
  aluno_id: string;
  turma_id: string;
  valor: number;
  status: 'pago' | 'pendente' | 'atrasado';
  data_vencimento: string;
  mes_referencia: string;
}

interface TurmaResponsavel {
  id: string;
  turma_id: string;
  user_id: string;
  nome_ref: string;
  percentual: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function FinanceiroCFO() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [responsaveis, setResponsaveis] = useState<TurmaResponsavel[]>([]);
  const [loading, setLoading] = useState(true);

  const mesAtual = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const hoje = useMemo(todayStr, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: t }, { data: a }, { data: p }, { data: r }] = await Promise.all([
        supabase.from('turmas').select('id, nome, produto, valor_mensalidade, total_mensalidades'),
        supabase
          .from('alunos')
          .select('id, nome, turma_id, status, dia_vencimento, valor_mensalidade, mensalidades_pagas, total_mensalidades')
          .neq('status', 'cancelado'),
        supabase
          .from('pagamentos')
          .select('id, aluno_id, turma_id, valor, status, data_vencimento, mes_referencia'),
        supabase.from('turma_responsaveis').select('id, turma_id, user_id, nome_ref, percentual'),
      ]);
      setTurmas(t || []);
      setAlunos(a || []);
      setPagamentos(p || []);
      setResponsaveis(r || []);
      setLoading(false);
    };
    load();
  }, []);

  const alunosAtivos = useMemo(
    () => alunos.filter(a => a.status === 'ativo' || a.status === 'inadimplente'),
    [alunos],
  );

  const mrrTotal = useMemo(
    () =>
      alunosAtivos.reduce((sum, a) => {
        const turma = turmas.find(t => t.id === a.turma_id);
        return sum + (a.valor_mensalidade ?? turma?.valor_mensalidade ?? 0);
      }, 0),
    [alunosAtivos, turmas],
  );

  const recebidoMes = useMemo(
    () =>
      pagamentos
        .filter(p => p.status === 'pago' && p.mes_referencia.startsWith(mesAtual))
        .reduce((s, p) => s + p.valor, 0),
    [pagamentos, mesAtual],
  );

  const taxaColeta = pct(recebidoMes, mrrTotal);

  // MRR por turma
  const mrrPorTurma = useMemo(() => {
    return turmas
      .map(turma => {
        const ativos = alunosAtivos.filter(a => a.turma_id === turma.id);
        if (ativos.length === 0) return null;
        const mrrReal = ativos.reduce(
          (s, a) => s + (a.valor_mensalidade ?? turma.valor_mensalidade ?? 0),
          0,
        );
        const recebido = pagamentos
          .filter(
            p =>
              p.turma_id === turma.id &&
              p.status === 'pago' &&
              p.mes_referencia.startsWith(mesAtual),
          )
          .reduce((s, p) => s + p.valor, 0);
        return { turma, ativos: ativos.length, mrrReal, recebido, tc: pct(recebido, mrrReal) };
      })
      .filter(Boolean)
      .sort((a, b) => b!.mrrReal - a!.mrrReal) as NonNullable<
      ReturnType<typeof turmas.map>[0]
    >[];
  }, [turmas, alunosAtivos, pagamentos, mesAtual]);

  // Fluxo por dia de vencimento
  const fluxoPorDia = useMemo(() => {
    const days: Record<
      number,
      { count: number; mrr: number; recebido: number; pendente: number; atrasado: number }
    > = {};
    for (const aluno of alunosAtivos) {
      const dia = aluno.dia_vencimento ?? 10;
      if (!days[dia]) days[dia] = { count: 0, mrr: 0, recebido: 0, pendente: 0, atrasado: 0 };
      const turma = turmas.find(t => t.id === aluno.turma_id);
      days[dia].count += 1;
      days[dia].mrr += aluno.valor_mensalidade ?? turma?.valor_mensalidade ?? 0;
    }
    for (const pag of pagamentos) {
      if (!pag.mes_referencia.startsWith(mesAtual)) continue;
      const aluno = alunosAtivos.find(a => a.id === pag.aluno_id);
      if (!aluno) continue;
      const dia = aluno.dia_vencimento ?? 10;
      if (!days[dia]) days[dia] = { count: 0, mrr: 0, recebido: 0, pendente: 0, atrasado: 0 };
      if (pag.status === 'pago') days[dia].recebido += pag.valor;
      else if (pag.status === 'pendente') days[dia].pendente += pag.valor;
      else if (pag.status === 'atrasado') days[dia].atrasado += pag.valor;
    }
    return Object.entries(days)
      .map(([dia, v]) => ({ dia: Number(dia), ...v }))
      .sort((a, b) => a.dia - b.dia);
  }, [alunosAtivos, turmas, pagamentos, mesAtual]);

  // Receita por responsável
  const receitaPorResponsavel = useMemo(() => {
    const map: Record<string, { nome: string; mrr: number; recebido: number }> = {};
    for (const resp of responsaveis) {
      const nome = resp.nome_ref || `ID:${resp.user_id.slice(0, 6)}`;
      if (!map[nome]) map[nome] = { nome, mrr: 0, recebido: 0 };
      const item = (mrrPorTurma as any[]).find((m: any) => m?.turma?.id === resp.turma_id);
      const mrrTurma: number = item?.mrrReal ?? 0;
      const recTurma: number = item?.recebido ?? 0;
      map[nome].mrr += mrrTurma * (resp.percentual / 100);
      map[nome].recebido += recTurma * (resp.percentual / 100);
    }
    return Object.values(map).sort((a, b) => b.mrr - a.mrr);
  }, [responsaveis, mrrPorTurma]);

  // Aging de inadimplência
  const aging = useMemo(() => {
    const buckets = { b0_30: 0, b31_60: 0, b61_90: 0, b90p: 0 };
    const counts = { b0_30: 0, b31_60: 0, b61_90: 0, b90p: 0 };
    for (const pag of pagamentos.filter(p => p.status === 'atrasado')) {
      const days = differenceInDays(new Date(hoje), parseISO(pag.data_vencimento));
      if (days <= 30) { buckets.b0_30 += pag.valor; counts.b0_30++; }
      else if (days <= 60) { buckets.b31_60 += pag.valor; counts.b31_60++; }
      else if (days <= 90) { buckets.b61_90 += pag.valor; counts.b61_90++; }
      else { buckets.b90p += pag.valor; counts.b90p++; }
    }
    return {
      buckets,
      counts,
      total: buckets.b0_30 + buckets.b31_60 + buckets.b61_90 + buckets.b90p,
    };
  }, [pagamentos, hoje]);

  // Parcelas por turma
  const parcelasPorTurma = useMemo(() => {
    return turmas
      .map(turma => {
        const ativos = alunosAtivos.filter(a => a.turma_id === turma.id);
        if (ativos.length === 0) return null;
        const totalMens = turma.total_mensalidades ?? 15;
        const avgPagas =
          ativos.reduce((s, a) => s + (a.mensalidades_pagas ?? 0), 0) / ativos.length;
        const receitaRestante = ativos.reduce((s, a) => {
          const val = a.valor_mensalidade ?? turma.valor_mensalidade ?? 0;
          const t = a.total_mensalidades ?? totalMens;
          const pg = a.mensalidades_pagas ?? 0;
          return s + val * Math.max(t - pg, 0);
        }, 0);
        return {
          turma,
          ativos: ativos.length,
          total: totalMens,
          avgPagas,
          receitaRestante,
          progressPct: pct(avgPagas, totalMens),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.receitaRestante - a!.receitaRestante) as NonNullable<
      ReturnType<typeof turmas.map>[0]
    >[];
  }, [turmas, alunosAtivos]);

  const receitaRestanteTotal = (parcelasPorTurma as any[]).reduce(
    (s: number, t: any) => s + (t?.receitaRestante ?? 0),
    0,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Análise CFO</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })} · Visão financeira executiva
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={<DollarSign className="h-4 w-4" />}
          label="MRR Total"
          value={fmt(mrrTotal)}
          sub={`${alunosAtivos.length} alunos ativos`}
          color="blue"
        />
        <KPICard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Recebido (mês)"
          value={fmt(recebidoMes)}
          sub={`${taxaColeta}% de coleta`}
          color="emerald"
          progress={taxaColeta}
        />
        <KPICard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Inadimplência"
          value={fmt(aging.total)}
          sub={`${Object.values(aging.counts).reduce((a, b) => a + b, 0)} pagamentos`}
          color="red"
        />
        <KPICard
          icon={<Target className="h-4 w-4" />}
          label="LTV Restante"
          value={fmt(receitaRestanteTotal)}
          sub="Parcelas pendentes de ativos"
          color="violet"
        />
      </div>

      <Tabs defaultValue="turmas">
        <TabsList className="bg-muted/40">
          <TabsTrigger value="turmas">Por Turma</TabsTrigger>
          <TabsTrigger value="vencimento">Por Vencimento</TabsTrigger>
          <TabsTrigger value="responsavel">Responsáveis</TabsTrigger>
          <TabsTrigger value="aging">Inadimplência</TabsTrigger>
          <TabsTrigger value="parcelas">Parcelas</TabsTrigger>
        </TabsList>

        {/* ── Por Turma ── */}
        <TabsContent value="turmas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">MRR por Turma</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Turma</TableHead>
                    <TableHead className="text-right">Alunos</TableHead>
                    <TableHead className="text-right">MRR</TableHead>
                    <TableHead className="text-right">Recebido (mês)</TableHead>
                    <TableHead className="text-right">Taxa Coleta</TableHead>
                    <TableHead className="min-w-[120px]">Progresso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(mrrPorTurma as any[]).map((item: any) => (
                    <TableRow key={item.turma.id}>
                      <TableCell className="font-medium">{item.turma.nome}</TableCell>
                      <TableCell className="text-right">{item.ativos}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(item.mrrReal)}</TableCell>
                      <TableCell className="text-right">{fmt(item.recebido)}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={
                            item.tc >= 80
                              ? 'text-emerald-700 border-emerald-300'
                              : item.tc >= 50
                              ? 'text-yellow-700 border-yellow-300'
                              : 'text-red-700 border-red-300'
                          }
                        >
                          {item.tc}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Progress value={item.tc} className="h-1.5" />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 bg-muted/20 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{alunosAtivos.length}</TableCell>
                    <TableCell className="text-right">{fmt(mrrTotal)}</TableCell>
                    <TableCell className="text-right">{fmt(recebidoMes)}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={
                          taxaColeta >= 80
                            ? 'text-emerald-700 border-emerald-300'
                            : taxaColeta >= 50
                            ? 'text-yellow-700 border-yellow-300'
                            : 'text-red-700 border-red-300'
                        }
                      >
                        {taxaColeta}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Progress value={taxaColeta} className="h-1.5" />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Por Vencimento ── */}
        <TabsContent value="vencimento" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fluxo por Dia de Vencimento</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dia</TableHead>
                    <TableHead className="text-right">Alunos</TableHead>
                    <TableHead className="text-right">MRR Esperado</TableHead>
                    <TableHead className="text-right text-emerald-700">Recebido</TableHead>
                    <TableHead className="text-right text-yellow-700">Pendente</TableHead>
                    <TableHead className="text-right text-red-700">Atrasado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fluxoPorDia.map(({ dia, count, mrr, recebido, pendente, atrasado }) => (
                    <TableRow key={dia}>
                      <TableCell className="font-medium">Dia {String(dia).padStart(2, '0')}</TableCell>
                      <TableCell className="text-right">{count}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(mrr)}</TableCell>
                      <TableCell className="text-right text-emerald-700">{fmt(recebido)}</TableCell>
                      <TableCell className="text-right text-yellow-700">{fmt(pendente)}</TableCell>
                      <TableCell className="text-right text-red-700">{fmt(atrasado)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 bg-muted/20 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{alunosAtivos.length}</TableCell>
                    <TableCell className="text-right">{fmt(mrrTotal)}</TableCell>
                    <TableCell className="text-right text-emerald-700">
                      {fmt(fluxoPorDia.reduce((s, d) => s + d.recebido, 0))}
                    </TableCell>
                    <TableCell className="text-right text-yellow-700">
                      {fmt(fluxoPorDia.reduce((s, d) => s + d.pendente, 0))}
                    </TableCell>
                    <TableCell className="text-right text-red-700">
                      {fmt(fluxoPorDia.reduce((s, d) => s + d.atrasado, 0))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Responsáveis ── */}
        <TabsContent value="responsavel" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Receita por Responsável</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {receitaPorResponsavel.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center px-6">
                  Nenhum responsável configurado nas turmas. Configure em Financeiro → Turmas.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Responsável</TableHead>
                      <TableHead className="text-right">MRR Proporcional</TableHead>
                      <TableHead className="text-right">Recebido (mês)</TableHead>
                      <TableHead className="text-right">Taxa Coleta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receitaPorResponsavel.map(r => {
                      const tc = pct(r.recebido, r.mrr);
                      return (
                        <TableRow key={r.nome}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                                {r.nome.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium">{r.nome}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{fmt(r.mrr)}</TableCell>
                          <TableCell className="text-right text-emerald-700">{fmt(r.recebido)}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={
                                tc >= 80
                                  ? 'text-emerald-700 border-emerald-300'
                                  : tc >= 50
                                  ? 'text-yellow-700 border-yellow-300'
                                  : 'text-red-700 border-red-300'
                              }
                            >
                              {tc}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Detalhamento por turma */}
          {responsaveis.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {turmas
                .filter(t => responsaveis.some(r => r.turma_id === t.id))
                .map(turma => {
                  const rs = responsaveis.filter(r => r.turma_id === turma.id);
                  const item = (mrrPorTurma as any[]).find((m: any) => m?.turma?.id === turma.id);
                  const mrrTurma: number = item?.mrrReal ?? 0;
                  return (
                    <Card key={turma.id}>
                      <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-sm">{turma.nome}</CardTitle>
                        <p className="text-xs text-muted-foreground">MRR: {fmt(mrrTurma)}</p>
                      </CardHeader>
                      <CardContent className="pb-4 space-y-2">
                        {rs.map(r => (
                          <div key={r.id} className="flex items-center justify-between text-sm">
                            <span className="text-foreground/80">{r.nome_ref || 'Sem nome'}</span>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="text-xs">
                                {r.percentual}%
                              </Badge>
                              <span className="font-semibold min-w-[80px] text-right">
                                {fmt(mrrTurma * (r.percentual / 100))}
                              </span>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </TabsContent>

        {/* ── Inadimplência (Aging) ── */}
        <TabsContent value="aging" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <AgingCard
              label="0–30 dias"
              value={aging.buckets.b0_30}
              count={aging.counts.b0_30}
              total={aging.total}
              color="yellow"
            />
            <AgingCard
              label="31–60 dias"
              value={aging.buckets.b31_60}
              count={aging.counts.b31_60}
              total={aging.total}
              color="orange"
            />
            <AgingCard
              label="61–90 dias"
              value={aging.buckets.b61_90}
              count={aging.counts.b61_90}
              total={aging.total}
              color="red"
            />
            <AgingCard
              label="90+ dias"
              value={aging.buckets.b90p}
              count={aging.counts.b90p}
              total={aging.total}
              color="darkred"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inadimplência por Turma</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Turma</TableHead>
                    <TableHead className="text-right">0–30d</TableHead>
                    <TableHead className="text-right">31–60d</TableHead>
                    <TableHead className="text-right">61–90d</TableHead>
                    <TableHead className="text-right">90+d</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {turmas
                    .map(turma => {
                      const atrasados = pagamentos.filter(
                        p => p.turma_id === turma.id && p.status === 'atrasado',
                      );
                      if (atrasados.length === 0) return null;
                      const age = (p: Pagamento) =>
                        differenceInDays(new Date(hoje), parseISO(p.data_vencimento));
                      const b0 = atrasados.filter(p => age(p) <= 30).reduce((s, p) => s + p.valor, 0);
                      const b31 = atrasados
                        .filter(p => age(p) > 30 && age(p) <= 60)
                        .reduce((s, p) => s + p.valor, 0);
                      const b61 = atrasados
                        .filter(p => age(p) > 60 && age(p) <= 90)
                        .reduce((s, p) => s + p.valor, 0);
                      const b90 = atrasados.filter(p => age(p) > 90).reduce((s, p) => s + p.valor, 0);
                      return (
                        <TableRow key={turma.id}>
                          <TableCell className="font-medium">{turma.nome}</TableCell>
                          <TableCell className="text-right text-yellow-700">
                            {b0 > 0 ? fmt(b0) : '—'}
                          </TableCell>
                          <TableCell className="text-right text-orange-700">
                            {b31 > 0 ? fmt(b31) : '—'}
                          </TableCell>
                          <TableCell className="text-right text-red-700">
                            {b61 > 0 ? fmt(b61) : '—'}
                          </TableCell>
                          <TableCell className="text-right text-red-900 font-semibold">
                            {b90 > 0 ? fmt(b90) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {fmt(b0 + b31 + b61 + b90)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                    .filter(Boolean)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Parcelas ── */}
        <TabsContent value="parcelas" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progresso de Parcelas por Turma</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {(parcelasPorTurma as any[]).map((item: any) => {
                if (!item) return null;
                return (
                  <div key={item.turma.id} className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm">{item.turma.nome}</span>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground text-right">
                        <span>{item.ativos} alunos</span>
                        <span>
                          Média {item.avgPagas.toFixed(1)}/{item.total} parcelas
                        </span>
                        <span className="font-semibold text-foreground">
                          Restante: {fmt(item.receitaRestante)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={item.progressPct} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground min-w-[35px] text-right">
                        {item.progressPct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">LTV Remanescente Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{fmt(receitaRestanteTotal)}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Soma de todas as parcelas pendentes de alunos ativos
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ──

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: 'blue' | 'emerald' | 'red' | 'violet';
  progress?: number;
}

function KPICard({ icon, label, value, sub, color, progress }: KPICardProps) {
  const colorMap = {
    blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    border: 'border-blue-100' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100' },
    red:     { bg: 'bg-red-50',     icon: 'text-red-600',     border: 'border-red-100' },
    violet:  { bg: 'bg-violet-50',  icon: 'text-violet-600',  border: 'border-violet-100' },
  };
  const c = colorMap[color];
  return (
    <Card className={`border ${c.border}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">
              {label}
            </p>
            <p className="text-xl font-bold text-foreground mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
          <div className={`p-2 rounded-lg flex-shrink-0 ${c.bg}`}>
            <div className={c.icon}>{icon}</div>
          </div>
        </div>
        {progress !== undefined && (
          <div className="mt-3">
            <Progress value={progress} className="h-1" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface AgingCardProps {
  label: string;
  value: number;
  count: number;
  total: number;
  color: 'yellow' | 'orange' | 'red' | 'darkred';
}

function AgingCard({ label, value, count, total, color }: AgingCardProps) {
  const colorMap = {
    yellow:  { bg: 'bg-yellow-50',  text: 'text-yellow-700',  badge: 'bg-yellow-100 text-yellow-800' },
    orange:  { bg: 'bg-orange-50',  text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-800' },
    red:     { bg: 'bg-red-50',     text: 'text-red-700',     badge: 'bg-red-100 text-red-800' },
    darkred: { bg: 'bg-red-100',    text: 'text-red-900',     badge: 'bg-red-200 text-red-900' },
  };
  const c = colorMap[color];
  const share = pct(value, total);
  return (
    <Card className={`border-0 ${c.bg}`}>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold mt-1 ${c.text}`}>{fmt(value)}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.badge}`}>
            {count} pagamentos
          </span>
          {total > 0 && (
            <span className="text-xs text-muted-foreground">{share}% do total</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
