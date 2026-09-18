import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Sesi tidak ditemukan.");

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) throw new Error("Sesi tidak valid.");

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: caller, error: callerError } = await adminClient
      .from("admin_users")
      .select("role,is_active")
      .eq("user_id", user.id)
      .maybeSingle();

    if (callerError || !caller || caller.role !== "superadmin" || !caller.is_active) {
      return new Response(JSON.stringify({ error: "Hanya Superadmin aktif yang dapat mengganti password user." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id, password } = await req.json();
    if (!target_user_id || typeof password !== "string" || password.length < 8) {
      return new Response(JSON.stringify({ error: "User target atau password tidak valid." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(target_user_id, { password });
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || "Gagal memperbarui password." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
