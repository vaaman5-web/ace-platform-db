const ACE_API = {
  get token() { return localStorage.getItem('ace_token') || null; },
  set token(v) { if (v) localStorage.setItem('ace_token', v); else localStorage.removeItem('ace_token'); },
  async request(path, opts = {}) {
    opts.headers = { 'Content-Type': 'application/json', ...(this.token ? { 'Authorization': 'Bearer ' + this.token } : {}) };
    const res = await fetch('/api' + path, opts);
    return res.json();
  },
  async login(email, password) {
    const r = await this.request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (r.token) { this.token = r.token; }
    return r;
  },
  runAnalysis(data) {
    return this.request('/analysis', { method: 'POST', body: JSON.stringify(data) });
  }
};
