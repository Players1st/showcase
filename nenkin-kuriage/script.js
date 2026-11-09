// 年金、何歳から？：3問の回答から繰り下げ後の月額と損益分岐年齢を表示し、チェックリストの案内（Formspree）を受け付ける
(function () {
  'use strict';

  // Q1の帯 → 65歳時点の月額（万円）。「月20万円以上」は20万円で計算
  var PENSION = { '月8万円（年96万円）': 8, '月12万円（年144万円）': 12, '月16万円（年192万円）': 16, '月20万円以上（年240万円〜）': 20 };
  var DEFER = 0.007;  // 繰り下げ：1か月あたり +0.7%（最大84%）
  var EARLY = 0.004;  // 繰上げ：1か月あたり -0.4%（1962年4月2日以降生まれ）
  var EARLY_AGE = 60;
  var AGES = [75, 80, 85, 90, 95];

  var form = document.getElementById('check-form');
  var optin = document.getElementById('optin-form');

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
    var months = (start - 65) * 12;
    var r = months * DEFER;
    var newM = m * (1 + r);
    var be = breakeven(start, r);
    var early = a.compare.indexOf('60歳') === 0;

    document.getElementById('r-big').innerHTML =
      start + '歳から受給すると、毎月が<br>約' + man1(newM) + '<small>（65歳受給より +' + man1(newM - m) + '）</small>';
    document.getElementById('r-msg').textContent =
      '65歳受給の累計額を「約' + ageText(be) + '」で追い抜き、それより長生きするほど受給総額がおトクになります。' +
      '一方、' + ageText(be) + 'より前に受給が終わる場合は、65歳受給のほうが多くなります。';

    document.getElementById('r-rows').innerHTML =
      '<li><span>増額率（' + months + 'か月 × 0.7％）</span><b>+' + (Math.round(r * 1000) / 10) + '％</b></li>' +
      '<li><span>増額後の月額／年額</span><b>' + man1(newM) + ' ／ ' + man(newM * 12) + '</b></li>' +
      '<li><span>損益分岐年齢（65歳受給を追い抜く年齢）</span><b>約' + ageText(be) + '</b></li>';

    var rm = m * (1 - EARLY * (65 - EARLY_AGE) * 12);
    var html = '<table class="r-cmp"><thead><tr><th>累計（万円）</th><th>65歳受給</th><th>' + start + '歳受給</th>' + (early ? '<th>60歳繰上げ</th>' : '') + '</tr></thead><tbody>';
    AGES.forEach(function (age) {
      if (age < start) return;
      var c65 = cum(m, 65, age), cd = cum(newM, start, age), ce = early ? cum(rm, EARLY_AGE, age) : -1;
      var best = Math.max(c65, cd, ce);
      function td(v) { return '<td' + (v === best ? ' class="win"' : '') + '>' + Math.round(v).toLocaleString() + '</td>'; }
      html += '<tr><td>' + age + '歳まで</td>' + td(c65) + td(cd) + (early ? td(ce) : '') + '</tr>';
    });
    html += '</tbody></table>';
    document.getElementById('r-table').innerHTML = html;

    var assume = '計算に使った値：65歳時点の月額 ' + m + '万円、受給開始 ' + start + '歳。色のついた数字がその年齢時点でいちばん多い受給パターンです。';
    if (a.pension.indexOf('20万円以上') !== -1) assume += '「月20万円以上」は20万円で計算しているため、実際はこれより高くなります。';
    if (early) {
      var beE = breakeven(EARLY_AGE, -EARLY * (65 - EARLY_AGE) * 12);
      assume += '60歳繰上げは月額が' + Math.round((1 - EARLY * 60) * 100) + '％（月 約' + man1(rm) + '）になり、65歳受給が追い抜くのは約' + ageText(beE) + 'です。繰上げは一生減額され、取り消せません。';
    }
    document.getElementById('r-assume').textContent = assume;

    document.getElementById('h-pension').value = a.pension;
    document.getElementById('h-age').value = a.age;
    document.getElementById('h-compare').value = a.compare;
    document.getElementById('h-result').value = start + '歳開始：月' + man1(newM) + '／損益分岐 約' + ageText(be);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var a = { pension: selected('q_pension'), age: selected('q_age'), compare: selected('q_compare') };
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
        if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead', { service_name: 'nenkin-kuriage' });
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = label;
        alert('送信できませんでした。時間をおいてもう一度お試しください。');
      });
  });
})();
