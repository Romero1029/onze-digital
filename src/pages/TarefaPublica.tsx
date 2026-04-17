import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, CheckCircle2, Calendar, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Questao {
  id: string;
  tipo: 'texto_livre' | 'multipla_escolha' | 'verdadeiro_falso' | 'resposta_curta';
  enunciado: string;
  opcoes?: string[];
  peso?: number;
}

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  instrucoes: string | null;
  questoes: Questao[];
  pontuacao_max: number;
  data_entrega: string | null;
  status: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TarefaPublica() {
  const { tarefaId } = useParams<{ tarefaId: string }>();
  const [tarefa, setTarefa] = useState<Tarefa | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const [resultadoIA, setResultadoIA] = useState<{ nota: number; feedback: string } | null>(null);

  const [identificacao, setIdentificacao] = useState({ nome: '', documento: '', email: '' });
  const [respostas, setRespostas] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!tarefaId) return;
    (async () => {
      const { data, error } = await supabase
        .from('pedagogico_tarefas')
        .select('*')
        .eq('id', tarefaId)
        .single();
      if (error || !data) {
        setLoading(false);
        return;
      }
      setTarefa(data as Tarefa);
      setLoading(false);
    })();
  }, [tarefaId]);

  const handleSubmit = async () => {
    if (!tarefa || !identificacao.nome.trim() || !identificacao.documento.trim()) {
      toast.error('Preencha nome e documento');
      return;
    }
    const unanswered = tarefa.questoes.filter(q => !respostas[q.id]?.trim());
    if (unanswered.length > 0) {
      toast.error(`Responda todas as questões (${unanswered.length} pendente${unanswered.length > 1 ? 's' : ''})`);
      return;
    }

    setSubmitting(true);
    const { data: entrega, error } = await supabase
      .from('pedagogico_entregas')
      .insert({
        tarefa_id: tarefa.id,
        aluno_nome: identificacao.nome.trim(),
        aluno_documento: identificacao.documento.trim(),
        aluno_email: identificacao.email.trim() || null,
        respostas,
        status: 'entregue',
      })
      .select('id')
      .single();

    if (error || !entrega) {
      toast.error('Erro ao enviar tarefa');
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
    setCorrigindo(true);

    // Solicitar correção IA via edge function
    try {
      const { data: resultado } = await supabase.functions.invoke('corrigir-tarefa', {
        body: { entregaId: entrega.id },
      });
      if (resultado?.nota !== undefined) {
        setResultadoIA({ nota: resultado.nota, feedback: resultado.feedback });
      }
    } catch {
      // Correção falhou silenciosamente — professor verá manualmente
    } finally {
      setCorrigindo(false);
    }
  };

  const setResposta = (id: string, value: string) =>
    setRespostas(prev => ({ ...prev, [id]: value }));

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!tarefa) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-2">
          <p className="text-xl font-semibold text-gray-700">Tarefa não encontrada</p>
          <p className="text-sm text-gray-400">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  if (tarefa.status !== 'aberta') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-2">
          <p className="text-xl font-semibold text-gray-700">Esta tarefa está encerrada</p>
          <p className="text-sm text-gray-400">O prazo de entrega já foi encerrado.</p>
        </div>
      </div>
    );
  }

  // ── Confirmação pós-envio ─────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4 shadow-lg">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">Entrega registrada!</h2>
          <p className="text-gray-500">
            Obrigado, <strong>{identificacao.nome}</strong>. Sua tarefa foi enviada com sucesso.
          </p>

          {corrigindo && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400 pt-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Correção automática em andamento...
            </div>
          )}

          {resultadoIA && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-left space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-green-700">Resultado preliminar</span>
                <span className="text-2xl font-black text-green-700">
                  {resultadoIA.nota} / {tarefa.pontuacao_max}
                </span>
              </div>
              <p className="text-sm text-green-800">{resultadoIA.feedback}</p>
              <p className="text-xs text-green-500 mt-1">
                * Nota sujeita à revisão da professora
              </p>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ── Formulário ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-2">
          <div className="flex items-center gap-2 text-indigo-600 text-sm font-medium">
            <BookOpen className="h-4 w-4" />
            Tarefa
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{tarefa.titulo}</h1>
          {tarefa.descricao && (
            <p className="text-gray-500 text-sm leading-relaxed">{tarefa.descricao}</p>
          )}
          {tarefa.instrucoes && (
            <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-indigo-700 mb-1">Instruções</p>
              <p className="text-sm text-indigo-800">{tarefa.instrucoes}</p>
            </div>
          )}
          {tarefa.data_entrega && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-2">
              <Calendar className="h-3.5 w-3.5" />
              Prazo: {new Date(tarefa.data_entrega).toLocaleString('pt-BR', {
                day: '2-digit', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </div>
          )}
        </div>

        {/* Identificação */}
        <Card className="p-6 shadow-sm border border-gray-100 space-y-4">
          <h2 className="font-bold text-gray-800">Sua identificação</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Nome completo *</label>
              <Input
                value={identificacao.nome}
                onChange={e => setIdentificacao(p => ({ ...p, nome: e.target.value }))}
                placeholder="Digite seu nome"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">CPF / Matrícula *</label>
              <Input
                value={identificacao.documento}
                onChange={e => setIdentificacao(p => ({ ...p, documento: e.target.value }))}
                placeholder="000.000.000-00"
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-medium text-gray-500">E-mail (opcional)</label>
              <Input
                type="email"
                value={identificacao.email}
                onChange={e => setIdentificacao(p => ({ ...p, email: e.target.value }))}
                placeholder="seu@email.com"
              />
            </div>
          </div>
        </Card>

        {/* Questões */}
        {tarefa.questoes.map((q, idx) => (
          <Card key={q.id} className="p-6 shadow-sm border border-gray-100 space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <p className="text-gray-800 font-medium leading-snug">{q.enunciado}</p>
            </div>

            {q.tipo === 'texto_livre' && (
              <textarea
                className="w-full min-h-[120px] border border-gray-200 rounded-xl p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="Escreva sua resposta aqui..."
                value={respostas[q.id] ?? ''}
                onChange={e => setResposta(q.id, e.target.value)}
              />
            )}

            {q.tipo === 'resposta_curta' && (
              <Input
                placeholder="Sua resposta"
                value={respostas[q.id] ?? ''}
                onChange={e => setResposta(q.id, e.target.value)}
              />
            )}

            {q.tipo === 'multipla_escolha' && (
              <div className="space-y-2 pl-2">
                {(q.opcoes ?? []).map((op, oi) => (
                  <label key={oi} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    respostas[q.id] === op
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                      : 'bg-white border-gray-200 hover:border-indigo-200'
                  }`}>
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={op}
                      checked={respostas[q.id] === op}
                      onChange={() => setResposta(q.id, op)}
                      className="accent-indigo-600"
                    />
                    <span className="text-sm">{op}</span>
                  </label>
                ))}
              </div>
            )}

            {q.tipo === 'verdadeiro_falso' && (
              <div className="flex gap-3 pl-2">
                {['Verdadeiro', 'Falso'].map(op => (
                  <label key={op} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                    respostas[q.id] === op
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-800 font-medium'
                      : 'bg-white border-gray-200 hover:border-indigo-200'
                  }`}>
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={op}
                      checked={respostas[q.id] === op}
                      onChange={() => setResposta(q.id, op)}
                      className="accent-indigo-600"
                    />
                    <span className="text-sm">{op}</span>
                  </label>
                ))}
              </div>
            )}
          </Card>
        ))}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-12 text-base font-semibold bg-indigo-600 hover:bg-indigo-700 rounded-xl"
        >
          {submitting ? (
            <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Enviando...</>
          ) : (
            'Enviar Tarefa'
          )}
        </Button>

        <p className="text-center text-xs text-gray-400 pb-8">
          Ao enviar, sua tarefa será registrada e corrigida automaticamente.
        </p>
      </div>
    </div>
  );
}
