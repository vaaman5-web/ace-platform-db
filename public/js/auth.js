/* ACE — multi-method authentication (one method per account).
 * Methods: Google, Facebook, X, LinkedIn (OAuth), Mobile OTP, Email+password. */
(function () {
  'use strict';

  var TOKEN_KEY = 'ace_token';
  var USER_KEY = 'ace_user';
  var SOCIAL_DEMO_IDS = { google: 'demo', facebook: 'demo', x: 'demo', linkedin: 'demo' };

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

  function showPane(id) {
    ['methodPane', 'otpPane', 'emailPane'].forEach(function (p) { var e = $(p); if (e) e.hidden = (p !== id); });
    el('authTitle').textContent = id === 'methodPane' ? 'Sign in to ACE' : (id === 'otpPane' ? 'Continue with Mobile' : 'Email Sign-in');
    hideError();
  }

  /* ---------- social providers ---------- */
  function isProviderConfigured(name) {
    try {
      var raw = (document.documentElement.getAttribute('data-oauth-configured') || '').toLowerCase();
      if (raw.indexOf(name) !== -1) return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  function socialSignIn(provider) {
    var configured = isProviderConfigured(provider);
    var pid;
    if (configured) {
      // Real OAuth flow: the backend redirect handler stores the temp code under this key.
      pid = sessionStorage.getItem('ace_oauth_code_' + provider);
      if (!pid) {
        window.location.href = '/auth/' + provider + '/start';
        return;
      }
    } else {
      pid = SOCIAL_DEMO_IDS[provider] + '-' + provider + '-user';
      var existing = localStorage.getItem('ace_demo_pid_' + provider);
      if (existing) pid = existing;
    }
    var email = null;
    var name = null;
    if (!configured) {
      name = prompt('Sign in with ' + provider.charAt(0).toUpperCase() + provider.slice(1) + ' — enter your name:', 'Alex Mercer');
      if (name === null) return; // cancelled
      email = prompt('Your email (from ' + provider + ' account):', 'student@example.com');
      if (email === null) return;
      email = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('Enter a valid email to continue with ' + provider + '.'); return; }
      localStorage.setItem('ace_demo_pid_' + provider, pid);
    }
    api('/auth/oauth/' + provider, {
      method: 'POST',
      body: JSON.stringify({ provider_id: pid, email: email, full_name: name })
    }).then(function (r) {
      saveSession(r.token, r.user);
      closeModal();
      toast(r.created ? 'Account created with ' + provider + ' — welcome, ' + (r.user.full_name || 'student') + '!' : 'Welcome back, ' + (r.user.full_name || 'student') + '!');
    }).catch(function (err) {
      showError(err.message);
      if (err.data && err.data.registered_with) {
        setTimeout(function () { showPane('methodPane'); }, 1800);
      }
    });
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
        else socialSignIn(p);
      });
    });

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
