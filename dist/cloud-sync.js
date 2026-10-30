(function () {
  const config = window.KITCHEN_SUPABASE_CONFIG || {};
  const sdk = window.supabase;
  const enabled = Boolean(config.url && config.anonKey && sdk && sdk.createClient);
  const client = enabled ? sdk.createClient(config.url, config.anonKey) : null;
  let storeId = null;

  async function session() {
    if (!client) return { user: null };
    const result = await client.auth.getUser();
    return { user: result.data?.user || null, error: result.error || null };
  }
  async function resolveStore(user) {
    const result = await client.from('store_members').select('store_id').eq('user_id', user.id).limit(1).maybeSingle();
    if (result.error) throw result.error;
    storeId = result.data?.store_id || null;
    if (!storeId) throw new Error('店舗メンバーに登録されていません。店舗オーナーにユーザーIDを追加してもらってください。');
  }
  async function load() {
    const current = await session();
    if (!current.user) return { authenticated: false, data: null };
    await resolveStore(current.user);
    const result = await client.from('store_state').select('data').eq('store_id', storeId).maybeSingle();
    if (result.error) throw result.error;
    const data = result.data?.data;
    return { authenticated: true, data: data && Array.isArray(data.items) ? data : null };
  }
  async function save(data) {
    if (!client || !storeId) return;
    const current = await session();
    if (!current.user) return;
    const result = await client.from('store_state').upsert({
      store_id: storeId, data, updated_by: current.user.id, updated_at: new Date().toISOString()
    });
    if (result.error) throw result.error;
  }
  async function signIn(email, password) {
    const result = await client.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    return result.data.user;
  }
  async function signUp(email, password) {
    const result = await client.auth.signUp({ email, password });
    if (result.error) throw result.error;
    return result.data.user;
  }
  async function signOut() { if (client) await client.auth.signOut(); }
  function subscribe(onChange) {
    if (!client || !storeId) return;
    client.channel('kitchen-stock-state')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'store_state', filter: 'store_id=eq.' + storeId }, payload => {
        const data = payload.new?.data;
        if (data && Array.isArray(data.items)) onChange(data);
      }).subscribe();
  }
  window.KitchenCloud = { enabled, session, load, save, signIn, signUp, signOut, subscribe };
})();
