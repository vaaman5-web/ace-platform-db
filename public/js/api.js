const ACE_API = {
  token: localStorage.getItem('ace_token') || null,
  async request(path, opts = {}) {
    opts.headers = { 'Content-Type': 'application/json', ...(this.token ? { 'Authorization': 'Bearer ' + this.token } : {}) };
    const res = await fetch('/api' + path, opts);
    return res.json();
  },
  async login(email, password) {
    const r = await this.request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (r.token) { this.token = r.token; localStorage.setItem('ace_token', r.token); }
    return r;
  },
  runAnalysis(data) {
    return this.request('/analysis', { method: 'POST', body: JSON.stringify(data) });
  }
};
