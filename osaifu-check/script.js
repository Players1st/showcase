// 親の介護おサイフ診断：3問の回答から結果を表示し、事前登録（Formspree）を受け付ける
(function () {
  'use strict';

  // 全国平均の自己負担の目安（万円／月）。出典：生命保険文化センター2024年度調査
  var HOME = 5.3, FACILITY = 13.8;
  // 貯蓄の帯 → 計算に使う代表値（万円）
  var SAVINGS = { '500万円未満': 300, '500〜1,500万円': 1000, '1,500万円以上': 2000 };

  var form = document.getElementById('check-form');
  var optin = document.getElementById('optin-form');

  function selected(name) {
    return form.querySelector('input[name="' + name + '"]:checked').value;
  }

  // 月数 → 「約X年Yか月」。20年を超える場合は「20年以上」
  function span(months) {
    if (months >= 240) return '20年以上';
    var y = Math.floor(months / 12), m = Math.round(months - y * 12);
    if (m === 12) { y += 1; m = 0; }
    if (y === 0) return '約' + m + 'か月';
    return '約' + y + '年' + (m ? m + 'か月' : '');
  }

  function bar(label, months) {
    var pct = Math.min(100, months / 240 * 100);
    return '<div class="row"><span>' + label + '</span><b>' + span(months) + '</b></div>' +
      '<div class="track"><div class="fill" style="width:' + pct.toFixed(0) + '%"></div></div><div style="height:10px"></div>';
  }

  function render(a) {
    var savings = SAVINGS[a.savings];
    var homeMonths = savings / HOME, facMonths = savings / FACILITY;

    var life = document.getElementById('r-life');
    life.innerHTML = bar('在宅で介護する場合', homeMonths) + bar('施設に入る場合', facMonths);
    document.getElementById('r-assume').textContent =
      '貯蓄の帯の代表値（' + savings.toLocaleString() + '万円）を、年金などの収入を考慮せず自己負担だけにあてた場合の目安です。' +
      '実際は収入や介護度、住まいによって大きく変わります。';

    var todo = ['① お金の管理を、誰にどこまで任せるか', '② 緊急連絡先と、まとめておく書類の場所'];
    if (a.style === '施設中心') todo.push('③ 入りたい施設の種類と費用の目安を、早めに家族で確認しておく');
    else if (a.style === '在宅中心') todo.push('③ 在宅を続けるために、誰がどこまで関わるかを家族で言葉にしておく');
    else todo.push('③ 「在宅か施設か」で迷っている点を、家族で書き出しておく');
    if (a.age === '80代以上') todo[0] += '（80代以上は、早めの話し合いがおすすめです）';
    var ol = document.getElementById('r-todo');
    ol.innerHTML = '';
    todo.forEach(function (t) { var li = document.createElement('li'); li.textContent = t; ol.appendChild(li); });

    document.getElementById('h-age').value = a.age;
    document.getElementById('h-savings').value = a.savings;
    document.getElementById('h-style').value = a.style;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var a = { age: selected('q_age'), savings: selected('q_savings'), style: selected('q_style') };
    render(a);
    form.style.display = 'none';
    var r = document.getElementById('result');
    r.hidden = false;
    r.scrollIntoView({ block: 'start' });
    if (typeof window.gtag === 'function') window.gtag('event', 'diagnosis_complete', { service_name: 'osaifu-check' });
  });

  // 流入元：utm_source → referrer のホスト名 → "direct"
  (function () {
    var src = 'direct';
    try {
      var utm = new URLSearchParams(window.location.search).get('utm_source');
      if (utm) src = utm;
      else if (document.referrer) {
        var host = new URL(document.referrer).hostname;
        if (host && host !== window.location.hostname) src = host;
      }
    } catch (err) {}
    document.getElementById('source').value = src;
  })();

  // 事前登録（メールアドレス）。Formspree のフォームIDが未設定の間はモック動作（送信せず完了表示のみ）
  optin.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = optin.querySelector('button');
    function done() { optin.style.display = 'none'; document.getElementById('thanks').hidden = false; }
    if (optin.action.indexOf('YOUR_FORM_ID') !== -1) { console.warn('Formspree form ID is not set: mock mode'); done(); return; }
    btn.disabled = true; btn.textContent = '送信中…';
    fetch(optin.action, { method: 'POST', body: new FormData(optin), headers: { 'Accept': 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error();
        done();
        if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead', { service_name: 'osaifu-check' });
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = '詳細レポートの案内を受け取る（事前登録）';
        alert('送信できませんでした。時間をおいてもう一度お試しください。');
      });
  });
})();
