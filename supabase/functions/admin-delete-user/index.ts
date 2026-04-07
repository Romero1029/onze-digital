import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Attempting to delete user with email: ${email}`);

    // List users to find by email
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      return new Response(JSON.stringify({ error: "Erro ao buscar usuários" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userToDelete = usersData.users.find(u => u.email?.toLowerCase() === email);

    if (!userToDelete) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found user ${userToDelete.id}, deleting...`);

    // Delete from auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userToDelete.id);

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      return new Response(JSON.stringify({ error: "Erro ao deletar usuário: " + deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`User ${email} deleted successfully`);

    return new Response(
      JSON.stringify({ success: true, message: `Usuário ${email} deletado com sucesso` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("admin-delete-user error:", error);
    return new Response(JSON.stringify({ error: "Erro interno: " + (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
