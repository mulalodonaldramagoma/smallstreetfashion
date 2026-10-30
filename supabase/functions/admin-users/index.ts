import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface UserRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  email: string | null;
  created_at: string;
  banned_until: string | null;
  is_admin: boolean;
  store: { id: string; name: string; slug: string; is_active: boolean; is_verified: boolean } | null;
  order_count: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: isAdminResult } = await adminClient
      .rpc("check_is_admin", { p_user_id: user.id });

    if (!isAdminResult) {
      return new Response(
        JSON.stringify({ error: "Forbidden: admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const action = body.action as string;

    if (action === "list") {
      return await handleList(adminClient, body);
    } else if (action === "set_role") {
      return await handleSetRole(adminClient, body, user.id);
    } else if (action === "toggle_ban") {
      return await handleToggleBan(adminClient, body, user.id);
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleList(
  adminClient: ReturnType<typeof createClient>,
  body: {
    search?: string;
    role?: string;
    sort?: string;
    status?: string;
    page?: number;
    perPage?: number;
  }
): Promise<Response> {
  const page = Math.max(1, body.page || 1);
  const perPage = Math.min(50, Math.max(1, body.perPage || 20));
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const search = body.search?.trim();
  const status = body.status || "all";

  // Fetch all auth users first so we can filter by email and banned status
  const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers();
  if (authError) throw authError;

  const emailMap = new Map<string, string>();
  const bannedMap = new Map<string, string | null>();
  if (authUsers?.users) {
    for (const u of authUsers.users) {
      emailMap.set(u.id, u.email || "");
      bannedMap.set(u.id, u.banned_until || null);
    }
  }

  // Build profile query
  let query = adminClient
    .from("profiles")
    .select("id, full_name, phone, role, created_at, store:stores!stores_seller_id_fkey(id, name, slug, is_active, is_verified)", { count: "exact" });

  const role = body.role;
  if (role && role !== "all") {
    query = query.eq("role", role);
  }

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const sort = body.sort || "created_desc";
  switch (sort) {
    case "name_asc": query = query.order("full_name", { ascending: true }); break;
    case "name_desc": query = query.order("full_name", { ascending: false }); break;
    case "created_asc": query = query.order("created_at", { ascending: true }); break;
    case "created_desc": default: query = query.order("created_at", { ascending: false }); break;
  }

  // If filtering by email, we need to find matching user IDs first
  let emailFilterIds: Set<string> | null = null;
  if (search) {
    const lowerSearch = search.toLowerCase();
    emailFilterIds = new Set();
    for (const [uid, email] of emailMap) {
      if (email.toLowerCase().includes(lowerSearch)) {
        emailFilterIds.add(uid);
      }
    }
  }

  // If filtering by status, collect matching IDs
  let statusFilterIds: Set<string> | null = null;
  if (status === "banned") {
    statusFilterIds = new Set();
    for (const [uid, banned] of bannedMap) {
      if (banned) statusFilterIds.add(uid);
    }
  } else if (status === "active") {
    statusFilterIds = new Set();
    for (const [uid, banned] of bannedMap) {
      if (!banned) statusFilterIds.add(uid);
    }
  }

  // If we have email or status filters, intersect them and use in query
  // If email search yielded IDs and no profile name/phone match, we still want those users
  // The approach: fetch profiles matching name/phone OR (if email search) all profiles in the email ID set
  if (emailFilterIds && emailFilterIds.size === 0 && search) {
    // Email search with no matches - return empty
    return jsonResponse({ users: [], total: 0, page, perPage });
  }

  // Apply status filter via in() if present
  if (statusFilterIds) {
    if (statusFilterIds.size === 0) {
      return jsonResponse({ users: [], total: 0, page, perPage });
    }
    query = query.in("id", Array.from(statusFilterIds));
  }

  query = query.range(from, to);

  const { data: profiles, error, count } = await query;
  if (error) throw error;

  if (!profiles || profiles.length === 0) {
    return jsonResponse({ users: [], total: count || 0, page, perPage });
  }

  // If email search was performed, filter profiles to only include those whose email matches
  // (the OR query already matched name/phone, but email matches need post-filtering)
  let filteredProfiles = profiles;
  if (emailFilterIds && search) {
    // Keep profiles that either matched name/phone (already returned) OR have matching email
    // Since the DB query searched name/phone, we also want profiles whose email matched
    // But we can't query auth.users from the DB. So we need a different approach:
    // If email search matched some IDs not in the profile results, fetch those separately.
    const profileIds = new Set(profiles.map((p: { id: string }) => p.id));
    const emailOnlyIds = Array.from(emailFilterIds).filter((id) => !profileIds.has(id));

    if (emailOnlyIds.length > 0 && emailOnlyIds.length <= 50) {
      const { data: emailProfiles } = await adminClient
        .from("profiles")
        .select("id, full_name, phone, role, created_at, store:stores!stores_seller_id_fkey(id, name, slug, is_active, is_verified)")
        .in("id", emailOnlyIds)
        .order("created_at", { ascending: sort === "created_asc" });

      if (emailProfiles && emailProfiles.length > 0) {
        filteredProfiles = [...profiles, ...emailProfiles];
      }
    }

    // Now filter out profiles that don't match name/phone AND don't match email
    filteredProfiles = filteredProfiles.filter((p: { id: string; full_name: string | null; phone: string | null }) => {
      const matchesNamePhone =
        (p.full_name?.toLowerCase().includes(search.toLowerCase())) ||
        (p.phone?.toLowerCase().includes(search.toLowerCase()));
      const matchesEmail = emailFilterIds.has(p.id);
      return matchesNamePhone || matchesEmail;
    });

    // Re-sort
    if (sort === "name_asc") {
      filteredProfiles.sort((a: { full_name: string | null }, b: { full_name: string | null }) =>
        (a.full_name || "").localeCompare(b.full_name || ""));
    } else if (sort === "name_desc") {
      filteredProfiles.sort((a: { full_name: string | null }, b: { full_name: string | null }) =>
        (b.full_name || "").localeCompare(a.full_name || ""));
    } else if (sort === "created_asc") {
      filteredProfiles.sort((a: { created_at: string }, b: { created_at: string }) =>
        a.created_at.localeCompare(b.created_at));
    } else {
      filteredProfiles.sort((a: { created_at: string }, b: { created_at: string }) =>
        b.created_at.localeCompare(a.created_at));
    }

    // Re-paginate
    const totalCount = filteredProfiles.length;
    filteredProfiles = filteredProfiles.slice(from, to + 1);

    return jsonResponse({ users: buildUserRows(filteredProfiles, emailMap, bannedMap, adminClient), total: totalCount, page, perPage });
  }

  const userIds = filteredProfiles.map((p: { id: string }) => p.id);

  const { data: orderCounts } = await adminClient
    .from("orders")
    .select("user_id")
    .in("user_id", userIds);

  const orderCountMap = new Map<string, number>();
  if (orderCounts) {
    for (const o of orderCounts as { user_id: string }[]) {
      orderCountMap.set(o.user_id, (orderCountMap.get(o.user_id) || 0) + 1);
    }
  }

  const { data: adminRows } = await adminClient
    .from("admin_allowlist")
    .select("user_id")
    .in("user_id", userIds)
    .is("revoked_at", null);

  const adminSet = new Set<string>();
  if (adminRows) {
    for (const a of adminRows as { user_id: string }[]) {
      adminSet.add(a.user_id);
    }
  }

  const users: UserRow[] = filteredProfiles.map((p: Record<string, unknown>) => {
    const store = p.store as UserRow["store"];
    const id = p.id as string;
    return {
      id,
      full_name: p.full_name as string | null,
      phone: p.phone as string | null,
      role: p.role as string,
      email: emailMap.get(id) || null,
      created_at: p.created_at as string,
      banned_until: bannedMap.get(id) || null,
      is_admin: adminSet.has(id),
      store: store || null,
      order_count: orderCountMap.get(id) || 0,
    };
  });

  return jsonResponse({ users, total: count || 0, page, perPage });
}

async function buildUserRows(
  profiles: Record<string, unknown>[],
  emailMap: Map<string, string>,
  bannedMap: Map<string, string | null>,
  adminClient: ReturnType<typeof createClient>
): Promise<UserRow[]> {
  const userIds = profiles.map((p) => p.id as string);

  const { data: orderCounts } = await adminClient
    .from("orders")
    .select("user_id")
    .in("user_id", userIds);

  const orderCountMap = new Map<string, number>();
  if (orderCounts) {
    for (const o of orderCounts as { user_id: string }[]) {
      orderCountMap.set(o.user_id, (orderCountMap.get(o.user_id) || 0) + 1);
    }
  }

  const { data: adminRows } = await adminClient
    .from("admin_allowlist")
    .select("user_id")
    .in("user_id", userIds)
    .is("revoked_at", null);

  const adminSet = new Set<string>();
  if (adminRows) {
    for (const a of adminRows as { user_id: string }[]) {
      adminSet.add(a.user_id);
    }
  }

  return profiles.map((p) => {
    const store = p.store as UserRow["store"];
    const id = p.id as string;
    return {
      id,
      full_name: p.full_name as string | null,
      phone: p.phone as string | null,
      role: p.role as string,
      email: emailMap.get(id) || null,
      created_at: p.created_at as string,
      banned_until: bannedMap.get(id) || null,
      is_admin: adminSet.has(id),
      store: store || null,
      order_count: orderCountMap.get(id) || 0,
    };
  });
}

async function handleSetRole(
  adminClient: ReturnType<typeof createClient>,
  body: { target_user_id?: string; new_role?: string },
  adminId: string
): Promise<Response> {
  const targetUserId = body.target_user_id;
  const newRole = body.new_role;

  if (!targetUserId || !newRole) {
    return jsonResponse({ error: "target_user_id and new_role are required" }, 400);
  }

  if (!["customer", "seller", "admin"].includes(newRole)) {
    return jsonResponse({ error: "Invalid role" }, 400);
  }

  if (targetUserId === adminId) {
    return jsonResponse({ error: "You cannot change your own role" }, 400);
  }

  const { data: targetProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", targetUserId)
    .maybeSingle();

  if (!targetProfile) {
    return jsonResponse({ error: "User not found" }, 404);
  }

  if (newRole === "admin") {
    const { error: provisionError } = await adminClient.rpc("provision_admin", {
      p_user_id: targetUserId,
      p_granted_by: adminId,
    });
    if (provisionError) throw provisionError;
  } else {
    const { data: isCurrentlyAdmin } = await adminClient
      .from("admin_allowlist")
      .select("user_id")
      .eq("user_id", targetUserId)
      .is("revoked_at", null)
      .maybeSingle();

    if (isCurrentlyAdmin) {
      const { error: revokeError } = await adminClient
        .from("admin_allowlist")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", targetUserId)
        .is("revoked_at", null);
      if (revokeError) throw revokeError;
    }
  }

  const { error: roleError } = await adminClient.rpc("admin_set_user_role", {
    p_target_user_id: targetUserId,
    p_new_role: newRole,
  });
  if (roleError) throw roleError;

  await adminClient.from("admin_audit_log").insert({
    actor_id: adminId,
    action: `role_change_${newRole}`,
    target_type: "user",
    target_id: targetUserId,
  });

  return jsonResponse({ success: true });
}

async function handleToggleBan(
  adminClient: ReturnType<typeof createClient>,
  body: { target_user_id?: string; ban?: boolean },
  adminId: string
): Promise<Response> {
  const targetUserId = body.target_user_id;
  const ban = body.ban;

  if (!targetUserId || typeof ban !== "boolean") {
    return jsonResponse({ error: "target_user_id and ban (boolean) are required" }, 400);
  }

  if (targetUserId === adminId) {
    return jsonResponse({ error: "You cannot ban yourself" }, 400);
  }

  const { data: targetProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", targetUserId)
    .maybeSingle();

  if (!targetProfile) {
    return jsonResponse({ error: "User not found" }, 404);
  }

  const { data: isTargetAdmin } = await adminClient
    .from("admin_allowlist")
    .select("user_id")
    .eq("user_id", targetUserId)
    .is("revoked_at", null)
    .maybeSingle();

  if (isTargetAdmin) {
    return jsonResponse({ error: "Cannot ban an admin user" }, 400);
  }

  if (ban) {
    const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
      ban_duration: "876000h",
    });
    if (error) throw error;
  } else {
    const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
      ban_duration: "none",
    });
    if (error) throw error;
  }

  await adminClient.from("admin_audit_log").insert({
    actor_id: adminId,
    action: ban ? "user_ban" : "user_unban",
    target_type: "user",
    target_id: targetUserId,
  });

  return jsonResponse({ success: true });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
