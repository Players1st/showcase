// うちの相続税：3問の回答から基礎控除との比較を表示し、チェックリストの案内（Formspree）を受け付ける
(function () {
  'use strict';

  // 遺産総額の帯 → 計算に使う代表値（万円）。「2億円以上」は下限の2億円で計算
  var ESTATE = { '3,000万円未満': 2500, '5,000万円前後': 5000, '8,000万円前後': 8000,
    '1億円前後': 10000, '1.5億円前後': 15000, '2億円以上': 20000 };
  // 法定相続人の人数：「N人」の数字をそのまま使う（9人以上は9人で計算）
  // 借金・葬儀費用の帯 → 代表値（万円）
  var DEBT = { 'ほとんどない（0〜100万円）': 50, '数百万程度': 300, '500万円以上': 500 };

  var form = document.getElementById('check-form');
  var optin = document.getElementById('optin-form');

  function selected(name) {
    if (name === 'q_heirs') return form.querySelector('select[name="q_heirs"]').value;
    return form.querySelector('input[name="' + name + '"]:checked').value;
  }

  function yen(man) {
    // 万円 → 「約X万円」「約X.X億円」
    var v = Math.round(man);
    if (v >= 10000) {
      var oku = Math.round(v / 1000) / 10;
      return '約' + oku + '億円';
    }
    return '約' + v.toLocaleString() + '万円';
  }

  // 速算表（万円）：[上限, 税率, 控除額]
  var TABLE = [
    [1000, 0.10, 0], [3000, 0.15, 50], [5000, 0.20, 200], [10000, 0.30, 700],
    [20000, 0.40, 1700], [30000, 0.45, 2700], [60000, 0.50, 4200], [Infinity, 0.55, 7200]
  ];
  function shareTax(x) {
    for (var i = 0; i < TABLE.length; i++) {
      if (x <= TABLE[i][0]) return x * TABLE[i][1] - TABLE[i][2];
    }
    return 0;
  }
  // 超簡易の目安：基礎控除を超えた分（課税遺産総額）を人数で等分し、速算表をあてはめる
  function roughTax(excess, n) {
    return shareTax(excess / n) * n;
  }

  function render(a) {
    var estate = ESTATE[a.estate], n = parseInt(a.heirs, 10), debt = DEBT[a.debt];
    var deduction = 3000 + 600 * n;
    var taxable = estate - debt;
    var diff = taxable - deduction;
    var out = diff > 0;

    var head = document.getElementById('r-head');
    head.textContent = out ? '課税圏内（要・詳細確認・専門家への相談推奨）' : '課税圏外（基礎控除以下・申告不要の可能性が高い）';
    document.getElementById('r-card').className = 'r-card ' + (out ? 'is-out' : 'is-in');

    document.getElementById('r-msg').textContent = out
      ? '基礎控除を超えているため、相続税が発生する可能性があります。早めの生前贈与や専門家への相談をご検討ください。'
      : '約9割の方が該当する安心の結果です。あなたの想定される遺産総額は基礎控除額に収まっており、原則として相続税の申告は不要です。';

    document.getElementById('r-rows').innerHTML =
      '<li><span>基礎控除額</span><b>' + yen(deduction) + '</b></li>' +
      '<li><span>課税対象になりうる額（遺産 − 借金・葬儀費用）</span><b>' + yen(taxable) + '</b></li>' +
      '<li><span>基礎控除との差</span><b>' + (out ? '約' + Math.round(diff).toLocaleString() + '万円 超過' : '約' + Math.round(-diff).toLocaleString() + '万円 の余裕') + '</b></li>';

    var taxBox = document.getElementById('r-tax');
    if (out) {
      var t = Math.round(roughTax(diff, n));
      taxBox.hidden = false;
      taxBox.innerHTML = '<b>超ざっくりの税額の目安：' + (t < 1 ? '数万円程度' : '約' + t.toLocaleString() + '万円') + '</b>' +
        '<span>基礎控除を超えた分を相続人で等分し、速算表をあてはめた概算です。配偶者の税額軽減や小規模宅地等の特例などは考慮していません（これらで大きく下がることがあります）。</span>';
    } else {
      taxBox.hidden = true;
    }

    document.getElementById('r-assume').textContent =
      '計算に使った値：遺産総額 ' + yen(estate) + '（' + a.estate + '）、法定相続人 ' + n + '人、借金・葬儀費用 ' + yen(debt) + '。' +
      '不動産の評価額や生前贈与、保険金などによって実際は変わります。' +
      (a.estate === '2億円以上' ? '「2億円以上」は2億円で計算しているため、実際はこれより高くなる可能性があります。' : '') +
      (a.heirs === '9人以上' ? '「9人以上」は9人で計算しています。' : '');

    document.getElementById('h-estate').value = a.estate;
    document.getElementById('h-heirs').value = a.heirs;
    document.getElementById('h-debt').value = a.debt;
    document.getElementById('h-result').value = out ? '課税圏内' : '課税圏外';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var a = { estate: selected('q_estate'), heirs: selected('q_heirs'), debt: selected('q_debt') };
    render(a);
    form.style.display = 'none';
    var r = document.getElementById('result');
    r.hidden = false;
    r.scrollIntoView({ block: 'start' });
    if (typeof window.gtag === 'function') window.gtag('event', 'diagnosis_complete', { service_name: 'uchi-souzokuzei' });
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

  // チェックリストの受け取り（メールアドレス）
  optin.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = optin.querySelector('button');
    var label = btn.textContent;
    function done() { optin.style.display = 'none'; document.getElementById('thanks').hidden = false; }
    btn.disabled = true; btn.textContent = '送信中…';
    fetch(optin.action, { method: 'POST', body: new FormData(optin), headers: { 'Accept': 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error();
        done();
        if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead', { service_name: 'uchi-souzokuzei' });
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = label;
        alert('送信できませんでした。時間をおいてもう一度お試しください。');
      });
  });
})();
