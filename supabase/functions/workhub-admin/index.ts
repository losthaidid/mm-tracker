import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
const endpoint = Deno.env.get('SUPABASE_URL')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const site = 'https://losthaidid.github.io/mm-tracker/';
const allowedOrigins = new Set(['https://losthaidid.github.io']);
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
const response = (origin: string, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
      ...(allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
// Every operation verifies the caller with Auth and then checks the database Owner record.
// The gateway JWT check is disabled because this function performs explicit, current authentication.
Deno.serve(async req => {
  const origin = req.headers.get('origin') || '';
  if (req.method === 'OPTIONS') return response(origin, { ok: true });
  if (req.method !== 'POST') return response(origin, { error: 'POST required.' }, 405);
  if (origin && !allowedOrigins.has(origin))
    return response(origin, { error: 'Origin not allowed.' }, 403);
  try {
    if (Number(req.headers.get('content-length') || 0) > 40000)
      return response(origin, { error: 'Request too large.' }, 413);
    let raw = '';
    let size = 0;
    const reader = req.body?.getReader(),
      decoder = new TextDecoder();
    if (!reader) return response(origin, { error: 'Request body required.' }, 400);
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 40000) {
        await reader.cancel();
        return response(origin, { error: 'Request too large.' }, 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const body = JSON.parse(raw);
    const token = /^Bearer (\S+)$/i.exec(req.headers.get('authorization') || '')?.[1];
    if (!token) return response(origin, { error: 'Sign in as the Owner.' }, 401);
    const admin = createClient(endpoint, secret, options);
    const { data: identity, error: authError } = await admin.auth.getUser(token);
    if (authError || !identity.user) return response(origin, { error: 'Sign in again.' }, 401);
    const scoped = createClient(endpoint, secret, {
      ...options,
      global: { headers: { Authorization: 'Bearer ' + token } },
    });
    const { data: profile, error: profileError } = await scoped.rpc('workhub_my_access');
    if (profileError || profile?.role !== 'owner' || profile?.status !== 'active')
      return response(origin, { error: 'Owner access required.' }, 403);
    const commands = new Set([
      'list',
      'permissions',
      'approve',
      'reject',
      'invite',
      'suspend',
      'activate',
      'preview-delete',
      'delete',
    ]);
    if (!commands.has(body.action)) return response(origin, { error: 'Unknown action.' }, 400);
    const rpc = async (action: string, payload = body.payload || {}) => {
      const { data, error } = await scoped.rpc('workhub_admin_command', {
        p_action: action,
        p_target: body.target || null,
        p_payload: payload,
      });
      if (error) throw error;
      return data;
    };
    if (body.action === 'approve' || body.action === 'invite') {
      const record = await rpc(body.action === 'approve' ? 'approve' : 'invite-ready');
      const { error } = await admin.auth.admin.inviteUserByEmail(record.email, {
        redirectTo: site,
      });
      if (error) {
        await rpc('invite-error', { note: 'Invitation could not be sent. ' + error.message });
        return response(
          origin,
          {
            approved: true,
            error: 'Approval saved, but the invitation could not be sent. ' + error.message,
          },
          409
        );
      }
      return response(origin, { ok: true, message: 'Approved invitation sent.' });
    }
    if (body.action === 'suspend' || body.action === 'activate') {
      if (body.action === 'activate') {
        // Verify the target and version before changing Auth. Protected owners never reach this path.
        await rpc('preview-delete');
        const { error } = await admin.auth.admin.updateUserById(body.target, {
          ban_duration: 'none',
        });
        if (error) throw error;
        await rpc('activate');
      } else {
        await rpc('suspend');
        const { error } = await admin.auth.admin.updateUserById(body.target, {
          ban_duration: '876000h',
        });
        if (error)
          return response(
            origin,
            {
              error:
                'Workspace access is suspended. The sign-in ban could not be updated; refresh and retry.',
            },
            409
          );
      }
      return response(origin, { ok: true });
    }
    if (body.action === 'delete') {
      if (
        typeof body.password !== 'string' ||
        body.password.length < 8 ||
        body.password.length > 1000
      )
        return response(origin, { error: 'Confirm your Owner password.' }, 400);
      const proof = createClient(endpoint, secret, options);
      const { data: verified, error } = await proof.auth.signInWithPassword({
        email: identity.user.email!,
        password: body.password,
      });
      body.password = '';
      if (error || verified.user?.id !== identity.user.id || !verified.session)
        return response(origin, { error: 'Owner password could not be verified.' }, 403);
      await admin.auth.admin.signOut(verified.session.access_token, 'local');
      await rpc('begin-delete');
      const deleted = await admin.auth.admin.deleteUser(body.target);
      if (deleted.error)
        return response(
          origin,
          {
            error:
              'Access is blocked, but deletion did not finish. Refresh and review the account before retrying.',
          },
          409
        );
      return response(origin, { ok: true, message: 'Account and its workspace records deleted.' });
    }
    return response(origin, { data: await rpc(body.action) });
  } catch (error) {
    const e = error as { message?: string; code?: string };
    return response(
      origin,
      { error: e.message || 'The request could not be completed.' },
      e.code === '42501' ? 403 : e.code === 'PT409' ? 409 : 400
    );
  }
});
