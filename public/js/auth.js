/* ACE — multi-method authentication (one method per account).
 * Methods: Google, Facebook, X, LinkedIn (OAuth), Mobile OTP, Email+password. */
(function () {
  'use strict';

  var TOKEN_KEY = 'ace_token';
  var USER_KEY = 'ace_user';

  function $(id) { return document.getElementById(id); }
  function el(id) { var e = $(id); if (!e) throw new Error('missing element #' + id); return e; }

  var TOKEN = null;
  var USER = null;

  try { TOKEN = localStorage.getItem(TOKEN_KEY); USER = JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { /* private mode */ }

  function saveSession(token, user) {
    TOKEN = token; USER = user;
    try { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch (e) { /* ignore */ }
    renderHeader();
  }

  function clearSession() {
    TOKEN = null; USER = null;
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch (e) { /* ignore */ }
    renderHeader();
  }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, TOKEN ? { 'Authorization': 'Bearer ' + TOKEN } : {}, opts.headers || {});
    return fetch('/api' + path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || ('Request failed (' + res.status + ')'));
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  function toast(msg) {
    var t = $('fbToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { t.classList.remove('show'); }, 3000);
  }

  function showError(msg) {
    var box = el('authError');
    box.textContent = msg;
    box.classList.add('show');
  }

  function hideError() {
    var box = $('authError');
    if (box) { box.textContent = ''; box.classList.remove('show'); }
  }

  /* ---------- header ---------- */
  function initials(name) {
    return String(name || '?').trim().split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
  }

  function renderHeader() {
    var chipWrap = $('userChipWrap');
    var loginBtn = $('loginBtn');
    if (!chipWrap || !loginBtn) return;
    if (USER) {
      chipWrap.hidden = false;
      loginBtn.style.display = 'none';
      var nameEl = $('userChipName');
      var avEl = $('userAvatar');
      if (nameEl) nameEl.textContent = USER.full_name || 'Student';
      if (avEl) {
        if (USER.avatar_url) {
          avEl.innerHTML = '<img src="' + USER.avatar_url + '" alt="">';
        } else {
          avEl.textContent = initials(USER.full_name);
        }
      }
    } else {
      chipWrap.hidden = true;
      loginBtn.style.display = '';
    }
  }

  /* ---------- modal ---------- */
  var MODE_EMAIL = 'login';

  function openModal() {
    hideError();
    showPane('methodPane');
    el('authOverlay').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    el('authOverlay').hidden = true;
    document.body.style.overflow = '';
    hideError();
  }

  var PROVIDER_META = {
    google: { label: 'Google', badgeClass: 'google', title: 'Sign in with Google', subtitle: 'Verify it\u2019s you with your email', emailPlaceholder: 'you@gmail.com', userLabel: 'Username', emailNote: 'Google', flow: 'code' },
    linkedin: { label: 'LinkedIn', badgeClass: 'linkedin', title: 'Sign in with LinkedIn', subtitle: 'Verify it\u2019s you with your email', emailPlaceholder: 'you@company.com', userLabel: 'Username', emailNote: 'LinkedIn', flow: 'code' },
    facebook: { label: 'Facebook', badgeClass: 'facebook', title: 'Sign in with Facebook', subtitle: 'Use your account username and password', userLabel: 'Username', credsNote: 'Facebook', flow: 'creds' },
    x: { label: 'X (Twitter)', badgeClass: 'x', title: 'Sign in with X', subtitle: 'Use your account username and password', userLabel: 'Username', credsNote: 'X', flow: 'creds' }
  };

  var PROVIDER_ICONS = {
    google: '<path fill="#FFF" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#FFF" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FFF" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#FFF" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>',
    facebook: '<path fill="#FFF" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.09 24 18.1 24 12.07z"/>',
    x: '<path fill="#FFF" d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z"/>',
    linkedin: '<path fill="#FFF" d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/>'
  };

  function showPane(id) {
    ['methodPane', 'otpPane', 'emailPane', 'providerCodePane', 'providerCredsPane'].forEach(function (p) { var e = $(p); if (e) e.hidden = (p !== id); });
    el('authTitle').textContent = id === 'methodPane' ? 'Sign in to ACE'
      : id === 'otpPane' ? 'Continue with Mobile'
      : id === 'emailPane' ? 'Email Sign-in'
      : ''; /* provider panes render their own branded headline */
    hideError();
  }

  /* ---------- provider verification flows (Google/LinkedIn: email code · Facebook/X: credentials) ---------- */
  var currentProvider = null;

  function openProviderFlow(provider) {
    var meta = PROVIDER_META[provider];
    if (!meta) return;
    currentProvider = provider;
    if (meta.flow === 'code') {
      // Google / LinkedIn: email + verification code, 2-step wizard
      el('providerCodePane').hidden = false;
      el('otpPane').hidden = true;
      el('emailPane').hidden = true;
      el('methodPane').hidden = true;
      var badge = el('pvCodeBadge');
      badge.className = 'pv-brand-badge ' + meta.badgeClass;
      el('pvCodeIcon').innerHTML = PROVIDER_ICONS[provider];
      el('pvCodeTitle').textContent = meta.title;
      el('pvCodeSubtitle').textContent = meta.subtitle;
      el('pvCodeNoteProvider').textContent = meta.emailNote;
      el('pvCodeEmail').value = '';
      el('pvCodeEmail').placeholder = meta.emailPlaceholder;
      el('pvCodeInput').value = '';
      el('pvCodeName').value = '';
      el('pvCodeEmailStep').hidden = false;
      el('pvCodeVerifyStep').hidden = true;
      setCodeSteps(1);
      el('pvCodeEmail').focus();
    } else {
      // Facebook / X: username + password
      el('providerCredsPane').hidden = false;
      el('otpPane').hidden = true;
      el('emailPane').hidden = true;
      el('methodPane').hidden = true;
      var badge2 = el('pvCredsBadge');
      badge2.className = 'pv-brand-badge ' + meta.badgeClass;
      el('pvCredsIcon').innerHTML = PROVIDER_ICONS[provider];
      el('pvCredsTitle').textContent = meta.title;
      el('pvCredsSubtitle').textContent = meta.subtitle;
      el('pvCredsNoteProvider').textContent = meta.credsNote;
      el('pvCredsUser').value = '';
      el('pvCredsPass').value = '';
      el('pvCredsName').value = '';
      el('pvCredsUser').focus();
    }
    hideError();
  }

  function setCodeSteps(step) {
    var s1 = el('pvCodeStep1'), s2 = el('pvCodeStep2');
    s1.className = 'pv-step ' + (step >= 1 ? (step > 1 ? 'done' : 'active') : '');
    s2.className = 'pv-step ' + (step >= 2 ? 'active' : '');
    el('pvCodeStepLabel').textContent = step === 1 ? 'Step 1 of 2 — Confirm your email' : 'Step 2 of 2 — Enter verification code';
  }

  function startResendCooldown() {
    var link = el('pvCodeResend');
    var secs = 30;
    link.classList.add('disabled');
    var timer = setInterval(function () {
      secs--;
      link.textContent = 'Resend code (' + secs + 's)';
      if (secs <= 0) {
        clearInterval(timer);
        link.classList.remove('disabled');
        link.textContent = 'Resend code';
      }
    }, 1000);
  }

  function pvCodeSend() {
    var meta = PROVIDER_META[currentProvider];
    var email = el('pvCodeEmail').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('Enter a valid email address.'); return; }
    hideError();
    var btn = el('pvCodeSendBtn');
    btn.disabled = true; btn.textContent = 'Sending…';
    api('/auth/email-code/request', { method: 'POST', body: JSON.stringify({ provider: currentProvider, email: email }) })
      .then(function (r) {
        toast(r.message || 'Verification code sent to ' + email);
        if (r.dev_code) toast('Dev code: ' + r.dev_code);
        el('pvCodeEmailChipText').textContent = email;
        el('pvCodeEmailStep').hidden = true;
        el('pvCodeVerifyStep').hidden = false;
        setCodeSteps(2);
        startResendCooldown();
        el('pvCodeInput').focus();
      })
      .catch(showError)
      .finally(function () { btn.disabled = false; btn.textContent = 'Send verification code'; });
  }

  function pvCodeVerify() {
    var email = el('pvCodeEmail').value.trim().toLowerCase();
    var code = el('pvCodeInput').value.trim();
    var name = el('pvCodeName').value.trim();
    if (!/^\d{6}$/.test(code)) { showError('Enter the 6-digit verification code.'); return; }
    hideError();
    var btn = el('pvCodeVerifyBtn');
    btn.disabled = true; btn.textContent = 'Verifying…';
    api('/auth/email-code/verify', { method: 'POST', body: JSON.stringify({ provider: currentProvider, email: email, code: code, full_name: name || undefined }) })
      .then(function (r) {
        saveSession(r.token, r.user);
        closeModal();
        toast(r.created ? 'Email verified — welcome, ' + (r.user.full_name || 'student') + '!' : 'Welcome back, ' + (r.user.full_name || 'student') + '!');
      })
      .catch(showError)
      .finally(function () { btn.disabled = false; btn.textContent = 'Verify & continue'; });
  }

  function pvCredsSubmit() {
    var meta = PROVIDER_META[currentProvider];
    var username = el('pvCredsUser').value.trim();
    var password = el('pvCredsPass').value;
    var name = el('pvCredsName').value.trim();
    if (username.length < 3) { showError('Enter your ' + meta.credsNote + ' username (min 3 characters).'); return; }
    if (password.length < 6) { showError('Password must be at least 6 characters.'); return; }
    hideError();
    var btn = el('pvCredsSubmitBtn');
    btn.disabled = true; btn.textContent = 'Signing in…';
    api('/auth/provider/credentials', { method: 'POST', body: JSON.stringify({ provider: currentProvider, username: username, password: password, full_name: name || undefined }) })
      .then(function (r) {
        saveSession(r.token, r.user);
        closeModal();
        toast(r.created ? meta.label + ' account linked — welcome, ' + (r.user.full_name || 'student') + '!' : 'Welcome back, ' + (r.user.full_name || 'student') + '!');
      })
      .catch(showError)
      .finally(function () { btn.disabled = false; btn.textContent = 'Sign in'; });
  }

  /* ---------- mobile OTP ---------- */
  function sendOtp() {
    var phone = el('otpPhone').value.trim();
    if (!/^\+?[1-9]\d{7,14}$/.test(phone)) { showError('Enter a valid mobile number with country code, e.g. +919876543210'); return; }
    hideError();
    var btn = el('sendOtpBtn');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    api('/auth/phone/request-otp', { method: 'POST', body: JSON.stringify({ phone: phone }) })
      .then(function (r) {
        toast(r.message || 'OTP sent');
        if (r.dev_otp) toast('Dev OTP: ' + r.dev_otp);
        el('otpCode').focus();
      })
      .catch(showError)
      .finally(function () { btn.disabled = false; btn.textContent = 'Send OTP'; });
  }

  function verifyOtp() {
    var phone = el('otpPhone').value.trim();
    var otp = el('otpCode').value.trim();
    var name = el('otpName').value.trim();
    if (!/^\d{6}$/.test(otp)) { showError('Enter the 6-digit OTP.'); return; }
    hideError();
    var btn = el('verifyOtpBtn');
    btn.disabled = true;
    btn.textContent = 'Verifying…';
    api('/auth/phone/verify-otp', { method: 'POST', body: JSON.stringify({ phone: phone, otp: otp, full_name: name || undefined }) })
      .then(function (r) {
        saveSession(r.token, r.user);
        closeModal();
        toast(r.created ? 'Account created — welcome, ' + (r.user.full_name || 'student') + '!' : 'Welcome back, ' + (r.user.full_name || 'student') + '!');
      })
      .catch(showError)
      .finally(function () { btn.disabled = false; btn.textContent = 'Verify & Continue'; });
  }

  /* ---------- email ---------- */
  function emailSubmit() {
    var email = el('emailInput').value.trim().toLowerCase();
    var password = el('passwordInput').value;
    var name = el('emailNameInput').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('Enter a valid email address.'); return; }
    if (!password || password.length < 6) { showError('Password must be at least 6 characters.'); return; }
    hideError();
    var btn = el('emailSubmitBtn');
    btn.disabled = true;
    var path = MODE_EMAIL === 'login' ? '/auth/login' : '/auth/register';
    var body = MODE_EMAIL === 'login' ? { email: email, password: password } : { email: email, password: password, full_name: name || email.split('@')[0] };
    api(path, { method: 'POST', body: JSON.stringify(body) })
      .then(function (r) {
        saveSession(r.token, r.user);
        closeModal();
        toast(MODE_EMAIL === 'login' ? 'Welcome back, ' + (r.user.full_name || 'student') + '!' : 'Account created — welcome!');
      })
      .catch(function (err) {
        showError(err.message);
        if (err.data && err.data.registered_with && err.data.registered_with !== 'email') {
          setTimeout(function () { showPane('methodPane'); }, 2000);
        }
      })
      .finally(function () { btn.disabled = false; btn.textContent = 'Continue'; });
  }

  /* ---------- wiring ---------- */
  function init() {
    var loginBtn = $('loginBtn');
    if (loginBtn) loginBtn.addEventListener('click', openModal);
    var closeBtn = $('authCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    var overlay = $('authOverlay');
    if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay && !overlay.hidden) closeModal(); });

    document.querySelectorAll('.provider-btn[data-provider]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = btn.getAttribute('data-provider');
        if (p === 'phone') { showPane('otpPane'); el('otpPhone').focus(); }
        else openProviderFlow(p);
      });
    });

    var pvCodeSendBtn = $('pvCodeSendBtn');
    if (pvCodeSendBtn) pvCodeSendBtn.addEventListener('click', pvCodeSend);
    var pvCodeVerifyBtn = $('pvCodeVerifyBtn');
    if (pvCodeVerifyBtn) pvCodeVerifyBtn.addEventListener('click', pvCodeVerify);
    var pvCodeResend = $('pvCodeResend');
    if (pvCodeResend) pvCodeResend.addEventListener('click', function () {
      if (pvCodeResend.classList.contains('disabled')) return;
      pvCodeSend();
    });
    var pvCodeBack = $('pvCodeBack');
    if (pvCodeBack) pvCodeBack.addEventListener('click', function () { showPane('methodPane'); });

    var pvCredsSubmitBtn = $('pvCredsSubmitBtn');
    if (pvCredsSubmitBtn) pvCredsSubmitBtn.addEventListener('click', pvCredsSubmit);
    var pvCredsBack = $('pvCredsBack');
    if (pvCredsBack) pvCredsBack.addEventListener('click', function () { showPane('methodPane'); });

    // Enter-key submits
    var pvce = $('pvCodeEmail');
    if (pvce) pvce.addEventListener('keydown', function (e) { if (e.key === 'Enter') pvCodeSend(); });
    var pvc = $('pvCodeInput');
    if (pvc) pvc.addEventListener('keydown', function (e) { if (e.key === 'Enter') pvCodeVerify(); });
    var pvcn = $('pvCodeName');
    if (pvcn) pvcn.addEventListener('keydown', function (e) { if (e.key === 'Enter') pvCodeVerify(); });
    var pvcu = $('pvCredsUser');
    if (pvcu) pvcu.addEventListener('keydown', function (e) { if (e.key === 'Enter') el('pvCredsPass').focus(); });
    var pvcp = $('pvCredsPass');
    if (pvcp) pvcp.addEventListener('keydown', function (e) { if (e.key === 'Enter') pvCredsSubmit(); });
    var pvcnm = $('pvCredsName');
    if (pvcnm) pvcnm.addEventListener('keydown', function (e) { if (e.key === 'Enter') pvCredsSubmit(); });

    var sendBtn = $('sendOtpBtn');
    if (sendBtn) sendBtn.addEventListener('click', sendOtp);
    var verifyBtn = $('verifyOtpBtn');
    if (verifyBtn) verifyBtn.addEventListener('click', verifyOtp);
    var backOtp = $('backToMethods');
    if (backOtp) backOtp.addEventListener('click', function () { showPane('methodPane'); });

    var emailPaneLink = $('emailPaneLink');
    if (emailPaneLink) emailPaneLink.addEventListener('click', function () { showPane('emailPane'); });
    var backEmail = $('backToMethodsEmail');
    if (backEmail) backEmail.addEventListener('click', function () { showPane('methodPane'); });

    var toggleSignup = $('emailToggleSignup');
    if (toggleSignup) toggleSignup.addEventListener('click', function () {
      MODE_EMAIL = (MODE_EMAIL === 'login') ? 'signup' : 'login';
      $('emailNameGroup').hidden = (MODE_EMAIL !== 'signup');
      toggleSignup.textContent = (MODE_EMAIL === 'login') ? 'Create an account' : 'I already have an account';
      el('authTitle').textContent = (MODE_EMAIL === 'login') ? 'Email Sign-in' : 'Create your account';
      hideError();
    });

    var emailSubmitBtn = $('emailSubmitBtn');
    if (emailSubmitBtn) emailSubmitBtn.addEventListener('click', emailSubmit);

    var logoutBtn = $('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', function () {
      clearSession();
      toast('Logged out. Your local analysis history stays on this device.');
    });

    renderHeader();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* expose minimal API for other scripts */
  window.ACEAuth = {
    getUser: function () { return USER; },
    getToken: function () { return TOKEN; },
    logout: clearSession,
    open: openModal
  };
})();
