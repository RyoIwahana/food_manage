(function () {
  function showAuth(message) {
    document.body.insertAdjacentHTML('afterbegin',
      '<div id="authGate" style="position:fixed;inset:0;z-index:20;background:#f6f7f3;display:grid;place-items:center;padding:24px">' +
      '<form id="authForm" style="width:min(420px,100%);background:white;border:1px solid #e6eae5;border-radius:14px;padding:32px;box-shadow:0 20px 60px #16331a1c">' +
      '<p style="font-size:10px;letter-spacing:2px;color:#82967f">KITCHEN STOCK</p><h1 style="font-size:24px;color:#263c33">店舗にログイン</h1>' +
      '<p style="font-size:12px;color:#7f8a80;line-height:1.8">共有在庫を表示するには、店舗メンバーのアカウントでログインしてください。</p>' +
      '<label style="display:grid;gap:7px;margin-top:20px;font-size:12px">メールアドレス<input id="authEmail" type="email" required autocomplete="email" style="padding:11px;border:1px solid #dce3db;border-radius:6px"></label>' +
      '<label style="display:grid;gap:7px;margin-top:14px;font-size:12px">パスワード<input id="authPassword" type="password" required minlength="6" autocomplete="current-password" style="padding:11px;border:1px solid #dce3db;border-radius:6px"></label>' +
      '<p id="authMessage" style="color:#b36d5b;font-size:11px;line-height:1.7">' + (message || '') + '</p>' +
      '<button class="primary" type="submit" style="width:100%;margin-top:8px">ログイン</button>' +
      '<button id="authSignup" type="button" style="width:100%;margin-top:10px">新しいスタッフアカウントを作成</button>' +
      '</form></div>');
    const form = document.getElementById('authForm');
    const messageNode = document.getElementById('authMessage');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;
      messageNode.textContent = 'ログインしています…';
      try { await window.KitchenCloud.signIn(email, password); location.reload(); }
      catch (error) { messageNode.textContent = error.message || 'ログインできませんでした。'; }
    });
    document.getElementById('authSignup').addEventListener('click', async () => {
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;
      if (!email || password.length < 6) { messageNode.textContent = 'メールアドレスと6文字以上のパスワードを入力してください。'; return; }
      messageNode.textContent = 'アカウントを作成しています…';
      try {
        await window.KitchenCloud.signUp(email, password);
        messageNode.textContent = '確認メールを送信しました。メール確認後、ログインしてください。';
      } catch (error) { messageNode.textContent = error.message || 'アカウントを作成できませんでした。'; }
    });
  }

  window.initCloud = async function () {
    if (!window.KitchenCloud?.enabled) { render(); return; }
    try {
      const result = await window.KitchenCloud.load();
      if (!result.authenticated) { showAuth(); return; }
      if (result.data) {
        db = result.data;
        localStorage.setItem(KEY, JSON.stringify(db));
      } else {
        await window.KitchenCloud.save(db);
      }
      render();
      window.KitchenCloud.subscribe(next => {
        db = next;
        localStorage.setItem(KEY, JSON.stringify(db));
        render();
      });
    } catch (error) {
      showAuth(error.message || '共有データを読み込めませんでした。');
    }
  };
})();
