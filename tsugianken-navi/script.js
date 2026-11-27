// 次案件ナビ：4問の入力から、案件選別デッドライン・ルート戦略・希望条件スペックシートを作り、
// メール保存（STEP 1）と有料サポート機能のニーズ調査（STEP 2）を受け付ける
(function () {
  'use strict';

  var SERVICE = 'tsugianken-navi';
  // 資金余力 → スコアの点数と、期限（契約終了日からの日数。負は終了前）
  var FUNDS = {
    '3ヶ月未満':   { pt: 0, pick: -45, last: -21 },
    '3〜6ヶ月':    { pt: 1, pick: -30, last: -14 },
    '6ヶ月〜1年':  { pt: 2, pick: 30,  last: 60 },
    '1年以上':     { pt: 3, pick: 60,  last: 90 }
  };
  var SOON = { '1ヶ月以内': 30, '2ヶ月後': 60, '3ヶ月後': 90 };
  var ADVICE = {
    S: '余裕は十分です。条件を下げず、合う案件が出るまで選びましょう。',
    A: '余裕があります。希望条件を保ったまま、早めに候補を集めましょう。',
    B: '計画的に動けば間に合います。①の期限までに面談を複数入れましょう。',
    C: '余裕は少なめです。今週中にスペックシートを送り、並行して進めましょう。',
    D: 'すぐに動く必要があります。譲れる条件を先に決め、複数ルートに同時に声をかけましょう。'
  };
  var NG_TIPS = {
    '多重下請け・丸投げ炎上案件': '商流（発注元まで何社入るか）を、提案の時点で書いてもらう。',
    'すぐ終了する短期・スポット案件': '想定の契約期間と、更新の実績を面談の前に確認する。',
    '無茶な仕様変更・連絡が雑な顧客': '開発の進め方、仕様を決める人、連絡手段を事前に聞く。',
    '面談回数が多い・決定が遅い案件': '面談の回数と合否が出るまでの日数を先に確認し、多い案件は後回しにする。'
  };

  var form = document.getElementById('checkForm');
  var endDate = document.getElementById('endDate');
  var mailForm = document.getElementById('mailForm');
  var surveyForm = document.getElementById('surveyForm');
  var userEmail = '';
  var summaryText = '';

  function gt(name, params) { if (typeof window.gtag === 'function') window.gtag('event', name, params); }
  function val(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }
  function today() { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function diffDays(a, b) { return Math.round((a - b) / 86400000); }
  function fmt(d) { return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function relative(offset) { return offset < 0 ? '終了の' + (-offset) + '日前' : '終了の' + offset + '日後'; }
  function remain(d) {
    var n = diffDays(d, today());
    return n > 0 ? 'あと' + n + '日' : n === 0 ? '今日が期限です' : '期限を' + (-n) + '日過ぎています。すぐに動きましょう';
  }
  function daysPoint(n) { return n < 30 ? 0 : n < 60 ? 1 : n < 90 ? 2 : 3; }
  function rankOf(p) { return p >= 5 ? 'S' : p === 4 ? 'A' : p === 3 ? 'B' : p === 2 ? 'C' : 'D'; }

  // 「日付を指定」のときだけ日付欄を表示して必須にする
  endDate.min = iso(today());
  form.addEventListener('change', function (e) {
    if (e.target.name === 'end_type') {
      var byDate = e.target.value === '日付を指定';
      endDate.hidden = !byDate;
      endDate.required = byDate;
    }
    if (e.target.name === 'ng' && e.target.checked) document.getElementById('ngError').hidden = true;
  });

  function strategy(a) {
    var items = [];
    if (a.funds === '3ヶ月未満') items.push('優先度：① エージェント2〜3社に同時打診 ② 知人・元の取引先への声かけを並行。決定までの速さを重視する。');
    else if (a.funds === '3〜6ヶ月') items.push('優先度：① 条件の合うエージェント2社に絞る ② 知人・元の取引先に終了予定を伝える。');
    else items.push('優先度：① 知人・元の取引先などの直ルート ② エージェントは1〜2社に絞り、条件に合う提案だけ受ける。');
    items.push('最初の連絡でスペックシートを送り、「条件に合う案件のみ」「連絡はテキストで」と伝える。電話や面談は条件の確認後にする。');
    if (a.style === 'フルリモート必須') items.push('「フルリモート」は、出社の頻度がゼロかを案件ごとに確認する。');
    a.ng.forEach(function (n) { if (NG_TIPS[n]) items.push(NG_TIPS[n]); });
    return items;
  }

  function render(a) {
    var f = FUNDS[a.funds];
    var end = null, days = null, endText, startText;
    if (a.endType === '日付を指定') {
      var p = a.endDate.split('-').map(Number);
      end = new Date(p[0], p[1] - 1, p[2]);
      endText = fmt(end);
      startText = fmt(addDays(end, 1)) + '〜';
    } else if (SOON[a.endType]) {
      end = addDays(today(), SOON[a.endType]);
      endText = a.endType + '（' + fmt(end) + 'ごろ）';
      startText = a.endType === '1ヶ月以内' ? '1ヶ月以内〜' : a.endType.replace('後', '') + 'ほど先（' + end.getFullYear() + '年' + (end.getMonth() + 1) + '月ごろ）〜';
    } else {
      endText = '未定・情報収集中';
      startText = '未定（条件の合う案件があれば相談）';
    }

    var d1, d2;
    if (end) {
      days = diffDays(end, today());
      var pick = addDays(end, f.pick), last = addDays(end, f.last);
      d1 = fmt(pick) + 'まで'; d2 = fmt(last);
      document.getElementById('d1s').textContent = remain(pick) + '（' + relative(f.pick) + '）';
      document.getElementById('d2s').textContent = remain(last) + '（' + relative(f.last) + '）';
    } else {
      d1 = relative(f.pick) + 'まで'; d2 = relative(f.last);
      document.getElementById('d1s').textContent = '終了日が決まったら、日付を指定してもう一度診断してください';
      document.getElementById('d2s').textContent = '';
    }
    document.getElementById('d1').textContent = d1;
    document.getElementById('d2').textContent = d2;
    document.getElementById('calm').hidden = f.pt < 2;

    // 終了日が未定の場合、日数の点数は2点として扱う
    var rank = rankOf(f.pt + (days === null ? 2 : daysPoint(days)));
    document.getElementById('rank').textContent = rank;
    document.getElementById('advice').textContent = ADVICE[rank];
    document.getElementById('assume').textContent =
      '契約終了予定：' + endText + '／資金余力：' + a.funds + '。期限とスコアは一般的な目安です。' +
      (SOON[a.endType] ? '終了日は今日から' + SOON[a.endType] + '日後として計算しています。' : '') +
      (end ? '' : 'スコアは、終了まで約2〜3ヶ月あるものとして計算しています。');

    var ul = document.getElementById('strategy');
    ul.innerHTML = '';
    strategy(a).forEach(function (t) { var li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });

    var rate = '月額' + a.rate.replace('〜', '以上').replace(/以上以上$/, '以上') + '（税抜）';
    var sheet = [
      '【案件紹介の希望条件（この条件に合致する案件のみご提案ください）】',
      '■ メインスキル：' + a.skill + '（' + a.role + '）',
      '■ 希望単価：' + rate,
      '■ 稼働条件：' + a.style,
      '■ 稼働開始時期：' + startText,
      '■ NG条件（以下は紹介不要です）：'
    ].concat(a.ng.map(function (n) { return '・' + n; }), ['※上記条件に合う継続性の高い案件があれば、ぜひ面談調整をお願いいたします。']).join('\n');
    document.getElementById('sheet').value = sheet;

    var result = '①厳選期限：' + d1 + '／②最終防衛ライン：' + d2 + '／交渉余裕度：' + rank;
    summaryText = '【診断結果】' + result + '\n【契約終了予定】' + endText + '\n【資金余力】' + a.funds;
    var h = { role: a.role, skill: a.skill, rate: a.rate, style: a.style, end: endText, funds: a.funds, result: result };
    Object.keys(h).forEach(function (k) { document.getElementById('h-' + k).value = h[k]; });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ng = Array.prototype.map.call(form.querySelectorAll('input[name="ng"]:checked'), function (c) { return c.value; });
    var skill = document.getElementById('skill').value.trim();
    if (!ng.length) {
      var err = document.getElementById('ngError');
      err.hidden = false; err.scrollIntoView({ block: 'center' });
      return;
    }
    if (!skill) { document.getElementById('skill').value = ''; form.reportValidity(); return; }
    render({ role: val('role'), skill: skill, rate: val('rate'), style: val('style'),
      endType: val('end_type'), endDate: endDate.value, funds: val('funds'), ng: ng });
    form.hidden = true;
    var r = document.getElementById('result');
    r.hidden = false;
    r.scrollIntoView({ block: 'start' });
    gt('diagnosis_complete', { service_name: SERVICE });
  });

  // スペックシートのコピー（クリップボードAPIが使えない場合は選択してコピー）
  document.getElementById('copyBtn').addEventListener('click', function () {
    var ta = document.getElementById('sheet'), msg = document.getElementById('copyMsg');
    function ok() { msg.textContent = 'コピーしました。LINEやメールに貼り付けて送れます。'; }
    function fallback() {
      ta.focus(); ta.select();
      var done = false;
      try { done = document.execCommand('copy'); } catch (err) {}
      if (done) ok(); else msg.textContent = 'コピーできませんでした。選択された文章を長押ししてコピーしてください。';
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(ok, fallback);
    else fallback();
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
    document.getElementById('sourceField').value = src;
  })();

  // STEP 1：メール保存。form_start / form_submit は lp-events.js が送る
  mailForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = mailForm.querySelector('button'), label = btn.textContent;
    var fd = new FormData(mailForm);
    fd.set('summary', summaryText);
    fd.set('spec_sheet', document.getElementById('sheet').value);
    btn.disabled = true; btn.textContent = '送信中…';
    fetch(mailForm.action, { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error();
        userEmail = String(fd.get('email') || '');
        document.getElementById('step1').hidden = true;
        document.getElementById('step2').hidden = false;
        document.getElementById('step2').scrollIntoView({ block: 'nearest' });
        gt('generate_lead', { service_name: SERVICE });
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = label;
        alert('送信できませんでした。時間をおいてもう一度お試しください。');
      });
  });

  // STEP 2：ニーズ調査（1つ選択）
  var surveyBtn = document.getElementById('surveyBtn');
  surveyForm.addEventListener('change', function () { surveyBtn.disabled = false; });
  surveyForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var c = surveyForm.querySelector('input[name="answer_id"]:checked');
    if (!c) return;
    var label = c.parentNode.textContent.trim();
    var fd = new FormData();
    fd.set('service', SERVICE);
    fd.set('survey_type', 'paid_solution_interest');
    fd.set('email', userEmail);
    fd.set('answer_id', c.value);
    fd.set('answer', label);
    fd.set('source', document.getElementById('sourceField').value);
    surveyBtn.disabled = true; surveyBtn.textContent = '送信中…';
    function failed() {
      surveyBtn.disabled = false; surveyBtn.textContent = '回答を送信する';
      alert('送信できませんでした。時間をおいてもう一度お試しください。');
    }
    // lp-events.js は Formspree への fetch を form_submit として数えるため、
    // アンケートは XHR で送り、form_submit が二重に数えられないようにする
    var x = new XMLHttpRequest();
    x.open('POST', mailForm.action);
    x.setRequestHeader('Accept', 'application/json');
    x.onload = function () {
      if (x.status < 200 || x.status >= 300) return failed();
      surveyForm.hidden = true;
      document.getElementById('surveyThanks').hidden = false;
      gt('survey_submit', { service_name: SERVICE, answer_id: c.value });
    };
    x.onerror = failed;
    x.send(fd);
  });
})();
