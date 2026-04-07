import { supabase } from '@/integrations/supabase/client';

export async function seedLancamentos() {
  // Create sample launches if they don't exist
  const { data: existingLaunches } = await supabase
    .from('lancamentos')
    .select('id, nome');

  const launchesToCreate = [
    { nome: '#30 Lançamento', status: 'em_andamento', ativo: true },
    { nome: '#31 Lançamento', status: 'em_andamento', ativo: false },
    { nome: '#32 Lançamento', status: 'planejamento', ativo: false },
  ].filter(l => !existingLaunches?.some(el => el.nome === l.nome));

  if (launchesToCreate.length > 0) {
    const { error } = await supabase
      .from('lancamentos')
      .insert(
        launchesToCreate.map(l => ({
          ...l,
          created_at: new Date().toISOString(),
          meta_matriculas: 0,
        }))
      );

    if (error) {
      console.error('Error seeding launches:', error);
      return false;
    }
  }

  // Create sample leads for #30
  const { data: launch30 } = await supabase
    .from('lancamentos')
    .select('id')
    .eq('nome', '#30 Lançamento')
    .single();

  if (launch30) {
    const { data: existingLeads } = await supabase
      .from('lancamento_leads')
      .select('id')
      .eq('lancamento_id', launch30.id);

    if (!existingLeads || existingLeads.length === 0) {
      const sampleLeads = [
        {
          lancamento_id: launch30.id,
          nome: 'João Silva',
          whatsapp: '11987654321',
          email: 'joao@email.com',
          fase: 'planilha' as const,
          no_grupo: false,
          grupo_oferta: false,
          matriculado: false,
          created_at: new Date().toISOString(),
        },
        {
          lancamento_id: launch30.id,
          nome: 'Maria Santos',
          whatsapp: '11987654322',
          email: 'maria@email.com',
          fase: 'grupo_lancamento' as const,
          no_grupo: true,
          grupo_oferta: false,
          matriculado: false,
          created_at: new Date().toISOString(),
        },
        {
          lancamento_id: launch30.id,
          nome: 'Pedro Costa',
          whatsapp: '11987654323',
          email: 'pedro@email.com',
          fase: 'matricula' as const,
          no_grupo: true,
          grupo_oferta: true,
          matriculado: true,
          created_at: new Date().toISOString(),
        },
      ];

      const { error } = await supabase
        .from('lancamento_leads')
        .insert(sampleLeads);

      if (error) {
        console.error('Error seeding leads:', error);
        return false;
      }
    }
  }

  console.log('✅ Lancamentos seed completed');
  return true;
}
