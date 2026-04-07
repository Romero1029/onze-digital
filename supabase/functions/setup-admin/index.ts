import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Track in-progress setup to prevent race conditions
let setupInProgress = false;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { email, password, nome } = await req.json();

    if (!email || !password || !nome) {
      console.log("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Email, senha e nome são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Race condition protection: prevent concurrent setup attempts
    if (setupInProgress) {
      console.log("Setup already in progress, rejecting concurrent request");
      return new Response(
        JSON.stringify({ error: "Configuração em andamento. Aguarde." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Setting up admin user: ${email}`);

    // Check if any admin exists using a transaction-safe approach
    // First, check if admin exists
    const { data: existingRoles, error: rolesCheckError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1);

    if (rolesCheckError) {
      console.error("Error checking existing admins:", rolesCheckError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar admins existentes" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingRoles && existingRoles.length > 0) {
      console.log("Admin already exists, setup disabled");
      return new Response(
        JSON.stringify({ error: "Configuração inicial já foi concluída. Faça login normalmente." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Set lock to prevent race conditions
    setupInProgress = true;

    try {
      // Double-check after acquiring lock to prevent race conditions
      const { data: doubleCheckRoles, error: doubleCheckError } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("role", "admin")
        .limit(1);

      if (doubleCheckError) {
        console.error("Double-check error:", doubleCheckError);
        return new Response(
          JSON.stringify({ error: "Erro ao verificar admins existentes" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (doubleCheckRoles && doubleCheckRoles.length > 0) {
        console.log("Admin created by concurrent request");
        return new Response(
          JSON.stringify({ error: "Configuração inicial já foi concluída. Faça login normalmente." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
      });

      if (authError) {
        console.error("Auth creation error:", authError);
        return new Response(
          JSON.stringify({ error: authError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!authData.user) {
        return new Response(
          JSON.stringify({ error: "Erro ao criar usuário" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Auth user created: ${authData.user.id}`);

      // Create profile
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: authData.user.id,
          nome,
          email: email.trim().toLowerCase(),
          cor: "#A93356",
          ativo: true,
        });

      if (profileError) {
        console.error("Profile creation error:", profileError);
        // Try to clean up auth user
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return new Response(
          JSON.stringify({ error: "Erro ao criar perfil" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Profile created");

      // Create admin role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role: "admin",
        });

      if (roleError) {
        console.error("Role creation error:", roleError);
        return new Response(
          JSON.stringify({ error: "Erro ao definir permissão" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Admin role assigned");

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Administrador criado com sucesso! Faça login para continuar.",
          userId: authData.user.id 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      // Always release lock
      setupInProgress = false;
    }
  } catch (error) {
    console.error("Setup error:", error);
    setupInProgress = false;
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
