(function () {
  const config = window.KITCHEN_SUPABASE_CONFIG || {};
  const sdk = window.supabase;
  const enabled = Boolean(config.url && config.anonKey && sdk && sdk.createClient);
  const client = enabled ? sdk.createClient(config.url, config.anonKey) : null;
  let storeId = null;
  let storeName = '';
  let stores = [];
  let channel = null;

  async function session() {
    if (!client) return { user: null };
    const result = await client.auth.getUser();
    return { user: result.data?.user || null, error: result.error || null };
  }
  async function resolveStores(user, selectedId) {
    const result = await client.from('store_members').select('store_id, role, stores(id, name)').eq('user_id', user.id);
    if (result.error) throw result.error;
    stores = (result.data || []).map(row => ({ id: row.store_id, name: row.stores?.name || '店舗', role: row.role }));
    if (!stores.length) throw new Error('店舗メンバーに登録されていません。店舗オーナーにユーザーIDを追加してもらってください。');
    storeId = stores.some(store => store.id === selectedId) ? selectedId : stores[0].id;
    storeName = stores.find(store => store.id === storeId)?.name || '店舗';
  }
  async function load(selectedId) {
    const current = await session();
    if (!current.user) return { authenticated: false, data: null };
    await resolveStores(current.user, selectedId || localStorage.getItem('kitchen-stock-store'));
    const result = await client.from('store_state').select('data').eq('store_id', storeId).maybeSingle();
    if (result.error) throw result.error;
    const data = result.data?.data;
    localStorage.setItem('kitchen-stock-store', storeId);
    return { authenticated: true, data: data && Array.isArray(data.items) ? data : null, stores, storeId, storeName };
  }
  async function switchStore(id) { return load(id); }
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
    if (channel) client.removeChannel(channel);
    channel = client.channel('kitchen-stock-state-' + storeId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'store_state', filter: 'store_id=eq.' + storeId }, payload => {
        const data = payload.new?.data;
        if (data && Array.isArray(data.items)) onChange(data);
      }).subscribe();
  }
  window.KitchenCloud = { enabled, session, load, switchStore, save, signIn, signUp, signOut, subscribe, get stores() { return stores; }, get storeId() { return storeId; }, get storeName() { return storeName; } };
})();
