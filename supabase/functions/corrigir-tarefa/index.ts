import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { entregaId } = await req.json();
    if (!entregaId) throw new Error('entregaId obrigatório');

    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    // Marcar como em_correcao
    await db.from('pedagogico_entregas').update({ status: 'em_correcao' }).eq('id', entregaId);

    // Buscar entrega + tarefa
    const { data: entrega, error } = await db
      .from('pedagogico_entregas')
      .select('*, tarefa:pedagogico_tarefas(*)')
      .eq('id', entregaId)
      .single();

    if (error || !entrega) throw new Error('Entrega não encontrada');

    const tarefa = entrega.tarefa as {
      titulo: string; descricao: string; instrucoes: string;
      questoes: Array<{ id: string; tipo: string; enunciado: string; opcoes?: string[]; gabarito?: string; peso?: number }>;
      criterios_ia: string; pontuacao_max: number;
    };

    const respostas = entrega.respostas as Record<string, string>;

    // Montar prompt
    const questoesTexto = tarefa.questoes.map((q, i) => {
      const resposta = respostas[q.id] ?? '(sem resposta)';
      const opcoes = q.opcoes?.length ? `\n   Opções: ${q.opcoes.join(' | ')}` : '';
      const gabarito = q.gabarito ? `\n   Gabarito: ${q.gabarito}` : '';
      return `Q${i + 1} [${q.tipo}] — ${q.enunciado}${opcoes}${gabarito}\n   Resposta do aluno: ${resposta}`;
    }).join('\n\n');

    const prompt = `Você é um agente de correção pedagógica. Corrija a tarefa abaixo com critério justo e feedback construtivo.

TAREFA: ${tarefa.titulo}
Descrição: ${tarefa.descricao ?? ''}
Instruções: ${tarefa.instrucoes ?? ''}
Pontuação máxima: ${tarefa.pontuacao_max}
Critérios de correção: ${tarefa.criterios_ia ?? 'Avalie a qualidade e completude das respostas.'}

QUESTÕES E RESPOSTAS:
${questoesTexto}

Retorne APENAS um JSON válido (sem markdown, sem explicação), no formato:
{
  "nota": <número de 0 a ${tarefa.pontuacao_max}>,
  "feedback": "<feedback geral encorajador de 2-3 frases>",
  "por_questao": [
    {"id": "<question_id>", "nota_parcial": <0-10>, "feedback": "<feedback específico>"}
  ]
}`;

    // Chamar Claude
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const aiJson = await aiRes.json();
    const rawText = aiJson.content?.[0]?.text ?? '{}';

    let correction: { nota: number; feedback: string; por_questao: unknown[] };
    try {
      correction = JSON.parse(rawText);
    } catch {
      correction = { nota: 0, feedback: 'Erro ao processar correção automática.', por_questao: [] };
    }

    // Atualizar entrega
    await db.from('pedagogico_entregas').update({
      nota_ia: correction.nota,
      feedback_ia: correction.feedback,
      status: 'corrigido',
    }).eq('id', entregaId);

    return new Response(JSON.stringify(correction), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
