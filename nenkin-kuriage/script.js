// 年金、何歳から？：2問の回答から繰り下げ・繰上げ後の月額と損益分岐年齢を表示し、チェックリストの案内（Formspree）を受け付ける
(function () {
  'use strict';

  // Q1の帯 → 65歳時点の月額（万円）。「月20万円以上」は20万円で計算
  var PENSION = { '月8万円（年96万円）': 8, '月12万円（年144万円）': 12, '月16万円（年192万円）': 16, '月20万円以上（年240万円〜）': 20 };
  var DEFER = 0.007;  // 繰り下げ：1か月あたり +0.7%（最大84%）
  var EARLY = 0.004;  // 繰上げ：1か月あたり -0.4%（1962年4月2日以降生まれ）
  var AGES = [60, 65, 70, 75, 80, 85];

  var form = document.getElementById('check-form');
  var optin = document.getElementById('optin-form');
  var summaryText = '';   // メールで送る試算結果の要約（render で作る）
  var userEmail = '';     // STEP 1 で入力されたメールアドレス（STEP 2 の紐づけ用）

  function selected(name) {
    return form.querySelector('input[name="' + name + '"]:checked').value;
  }

  function man(v) { return Math.round(v).toLocaleString() + '万円'; }
  function man1(v) { return (Math.round(v * 10) / 10).toLocaleString() + '万円'; }

  // 受給開始年齢 start・増減率 r の人が、65歳受給の人の累計に追いつく年齢
  // (age-65) = (1+r)(age-start) を解く： age = ((1+r)*start - 65) / r
  function breakeven(start, r) { return ((1 + r) * start - 65) / r; }
  function ageText(x) {
    var y = Math.floor(x), m = Math.ceil((x - y) * 12 - 1e-9);
    if (m >= 12) { y += 1; m = 0; }
    return y + '歳' + (m ? m + 'か月' : '');
  }
  // age歳までの累計受給額（万円）
  function cum(monthly, start, age) { return age > start ? monthly * 12 * (age - start) : 0; }

  function render(a) {
    var m = PENSION[a.pension];
    var start = parseInt(a.age, 10);
    var early = start < 65;                        // 60・62・64歳は繰上げ、66歳〜は繰り下げ
    var months = Math.abs(start - 65) * 12;
    var r = early ? -months * EARLY : months * DEFER;   // 繰上げは負
    var newM = m * (1 + r);
    var be = breakeven(start, r);
    var pct = Math.round(Math.abs(r) * 1000) / 10;

    if (early) {
      document.getElementById('r-big').innerHTML =
        start + '歳から受給すると、毎月が<br>約' + man1(newM) + 'に減ります<small>（65歳受給より −' + man1(m - newM) + '）</small>';
      document.getElementById('r-msg').textContent =
        '早く受け取れる分、月額は一生' + pct + '％少なくなります。65歳受給の累計額が約' + ageText(be) + 'で追いつくため、それより長生きする場合は65歳受給のほうが受給総額は多くなります。' +
        '一方、' + ageText(be) + 'より前に受給が終わる場合は、繰上げのほうが多くなります。';
    } else {
      document.getElementById('r-big').innerHTML =
        start + '歳から受給すると、毎月が<br>約' + man1(newM) + '<small>（65歳受給より +' + man1(newM - m) + '）</small>';
      document.getElementById('r-msg').textContent =
        '65歳受給の累計額を「約' + ageText(be) + '」で追い抜き、それより長生きするほど受給総額がおトクになります。' +
        '一方、' + ageText(be) + 'より前に受給が終わる場合は、65歳受給のほうが多くなります。';
    }

    document.getElementById('r-rows').innerHTML =
      '<li><span>' + (early ? '減額率（' + months + 'か月 × 0.4％）' : '増額率（' + months + 'か月 × 0.7％）') + '</span><b>' + (early ? '−' : '+') + pct + '％</b></li>' +
      '<li><span>' + (early ? '減額後' : '増額後') + 'の月額／年額</span><b>' + man1(newM) + ' ／ ' + man(newM * 12) + '</b></li>' +
      '<li><span>損益分岐年齢（65歳受給と累計が入れ替わる年齢）</span><b>約' + ageText(be) + '</b></li>';

    var heads = ['65歳受給', start + (early ? '歳繰上げ' : '歳受給')];
    var html = '<table class="r-cmp"><thead><tr><th>累計（万円）</th>' + heads.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>';
    var lines = [];
    AGES.forEach(function (age) {
      var vals = [cum(m, 65, age), cum(newM, start, age)];
      var best = Math.max.apply(null, vals);
      html += '<tr><td>' + age + '歳まで</td>' + vals.map(function (v) {
        return '<td' + (v > 0 && v === best ? ' class="win"' : '') + '>' + (v > 0 ? Math.round(v).toLocaleString() : '—') + '</td>';
      }).join('') + '</tr>';
      lines.push(age + '歳まで：' + vals.map(function (v, i) { return heads[i] + ' ' + (v > 0 ? Math.round(v).toLocaleString() + '万円' : '0円'); }).join('／'));
    });
    html += '</tbody></table>';
    document.getElementById('r-table').innerHTML = html;

    summaryText = [
      '【診断条件】65歳時点の年金月額：' + a.pension + '／受給開始年齢：' + a.age,
      '【試算結果】' + start + '歳から受給すると毎月 約' + man1(newM) + '（' + (early ? '減額率 −' : '増額率 +') + pct + '％）。65歳受給との損益分岐は約' + ageText(be) + 'です。',
      '【年齢別・累計受給額（税・社会保険料を引く前）】'
    ].concat(lines).join('\n');

    var assume = '計算に使った値：65歳時点の月額 ' + m + '万円、受給開始 ' + start + '歳。色のついた数字がその年齢時点でいちばん多い受給パターンです。';
    if (a.pension.indexOf('20万円以上') !== -1) assume += '「月20万円以上」は20万円で計算しているため、実際はこれより高くなります。';
    if (early) assume += '繰上げは一生減額され、取り消せません。障害年金・遺族年金など他の年金に影響する場合もあります。';
    document.getElementById('r-assume').textContent = assume;

    document.getElementById('h-pension').value = a.pension;
    document.getElementById('h-age').value = a.age;
    document.getElementById('h-result').value = start + '歳開始：月' + man1(newM) + '／損益分岐 約' + ageText(be);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var a = { pension: selected('q_pension'), age: selected('q_age') };
    render(a);
    form.style.display = 'none';
    var r = document.getElementById('result');
    r.hidden = false;
    r.scrollIntoView({ block: 'start' });
    if (typeof window.gtag === 'function') window.gtag('event', 'diagnosis_complete', { service_name: 'nenkin-kuriage' });
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

  // STEP 1：試算結果のメール受け取り → 成功したら STEP 2（有料版ニーズ調査）に切り替える
  optin.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = optin.querySelector('button');
    var label = btn.textContent;
    var fd = new FormData(optin);
    fd.set('summary', summaryText);
    fd.set('type', 'result_mail');
    btn.disabled = true; btn.textContent = '送信中…';
    fetch(optin.action, { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error();
        userEmail = String(fd.get('email') || '');
        document.getElementById('optin-step1').hidden = true;
        document.getElementById('step2').hidden = false;
        document.getElementById('step2').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead', { service_name: 'nenkin-kuriage' });
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = label;
        alert('送信できませんでした。時間をおいてもう一度お試しください。');
      });
  });

  // STEP 2：4択を1クリックで回答 → GA4 と Formspree（メールアドレスと紐づけ）に送る
  var PLANS = {
    plan_1: '【手取り＆夫婦合算版】980円（単発）',
    plan_2: '【老後資金・貯蓄寿命連動版】1,480円（単発）',
    plan_3: '【働きながら受給・手続きロードマップ版】1,980円（単発）',
    none: '今の無料シミュレーションだけで十分（有料版は不要）'
  };
  var survey = document.getElementById('survey');
  var submitBtn = document.getElementById('survey-submit');
  var boxes = Array.prototype.slice.call(survey.querySelectorAll('input[name="plan"]'));
  function checked() { return boxes.filter(function (c) { return c.checked; }); }

  // 排他制御：「不要」をチェック → プラン①〜③を外す／プラン①〜③をチェック → 「不要」を外す
  survey.addEventListener('change', function (e) {
    var c = e.target;
    if (!c || c.name !== 'plan') return;
    if (c.checked) {
      boxes.forEach(function (o) {
        if (o !== c && ((c.value === 'none') !== (o.value === 'none'))) o.checked = false;
      });
    }
    submitBtn.disabled = checked().length === 0;
  });

  // 「この内容で回答する」：選ばれたすべてを GA4 と Formspree（メールアドレスと紐づけ）に送る
  submitBtn.addEventListener('click', function () {
    var sel = checked();
    if (!sel.length || survey.getAttribute('data-done')) return;
    survey.setAttribute('data-done', '1');
    submitBtn.disabled = true;
    var ids = sel.map(function (c) { return c.value; });
    var labels = ids.map(function (id) { return PLANS[id]; });
    if (typeof window.gtag === 'function') window.gtag('event', 'select_paid_solution', { solution_id: ids.join(', '), solution_label: labels.join(' / ') });
    // lp-events.js は fetch の Formspree 送信を form_submit として数えるため、
    // メール登録とは別物のこの送信は XHR で行い、form_submit が二重に数えられないようにする
    var fd = new FormData();
    fd.set('service', '年金、何歳から？');
    fd.set('type', 'paid_solution_survey');
    fd.set('email', userEmail);
    fd.set('solution_id', ids.join(', '));
    fd.set('solution', labels.join(' / '));
    fd.set('source', document.getElementById('source').value);
    try {
      var x = new XMLHttpRequest();
      x.open('POST', optin.action);
      x.setRequestHeader('Accept', 'application/json');
      x.send(fd);
    } catch (err) {}
    survey.hidden = true;
    document.getElementById('survey-thanks').hidden = false;
  });
})();
