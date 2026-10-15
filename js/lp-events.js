// GA4 funnel events shared by every LP (#152).
//   cta_click   – a link/button that scrolls to the signup form was clicked
//   form_start  – first focus on a signup field (once per page view)
//   form_submit – Formspree accepted a submission (response.ok)
//   scroll_75   – 75% of the page was reached (once per page view)
// Every event carries `lp` (the LP's directory name). Load after the page's gtag snippet.
(function () {
  'use strict';

  var parts = location.pathname.split('/').filter(Boolean);
  if (parts.length && /\.html?$/.test(parts[parts.length - 1])) parts.pop();
  var LP = parts.length ? parts[parts.length - 1] : 'top';

  function send(name) {
    if (typeof window.gtag === 'function') window.gtag('event', name, { lp: LP });
  }

  // The signup area is whatever contains the email field: a <form> on most LPs,
  // a plain container on the formless ones (cospalunch, fareflow).
  function isSignupArea(el) {
    return !!(el && el.querySelector && el.querySelector('input[type="email"]'));
  }

  function scrollTargetId(el) {
    var a = el.closest('a[href^="#"]');
    if (a) return a.getAttribute('href').slice(1);
    var b = el.closest('[onclick*="scrollIntoView"]');
    if (b) {
      var m = b.getAttribute('onclick').match(/getElementById\(['"]([^'"]+)['"]\)/);
      if (m) return m[1];
    }
    return null;
  }

  document.addEventListener('click', function (e) {
    var id = scrollTargetId(e.target);
    if (id && isSignupArea(document.getElementById(id))) send('cta_click');
  }, true);

  var started = false;
  document.addEventListener('focusin', function (e) {
    if (started) return;
    var el = e.target;
    if (!el.matches || !el.matches('input:not([type="hidden"]), select, textarea')) return;
    var area = el.closest('form') || el.closest('section');
    if (isSignupArea(area)) {
      started = true;
      send('form_start');
    }
  }, true);

  // Observe Formspree responses without changing what the page's own code receives.
  if (typeof window.fetch === 'function') {
    var origFetch = window.fetch;
    window.fetch = function (input, init) {
      var p = origFetch.apply(this, arguments);
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      if (url.indexOf('formspree.io') !== -1 && method === 'POST') {
        p.then(function (res) { if (res && res.ok) send('form_submit'); }, function () {});
      }
      return p;
    };
  }

  var scrolled = false;
  function checkScroll() {
    if (scrolled) return;
    var doc = document.documentElement;
    var reached = (window.scrollY + window.innerHeight) / Math.max(doc.scrollHeight, 1);
    if (reached >= 0.75) {
      scrolled = true;
      send('scroll_75');
      window.removeEventListener('scroll', checkScroll);
    }
  }
  window.addEventListener('scroll', checkScroll, { passive: true });
})();
