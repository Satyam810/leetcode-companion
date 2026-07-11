// github-api.js – Wrapper for the GitHub REST API

export class GitHubAPI {
  /**
   * @param {string} token  - Personal Access Token with repo scope
   * @param {string} repo   - "owner/repo" format
   * @param {string} branch - target branch (default: "main")
   */
  constructor(token, repo, branch = 'main') {
    this.token  = token;
    this.repo   = repo;
    this.branch = branch;
    this.base   = 'https://api.github.com';
  }

  get headers() {
    return {
      Authorization:        `token ${this.token}`,
      Accept:               'application/vnd.github.v3+json',
      'Content-Type':       'application/json',
    };
  }

  // ── Get current file SHA (needed for updates) ──────────────────────────────
  async getFileSHA(path) {
    const url = `${this.base}/repos/${this.repo}/contents/${path}?ref=${this.branch}`;
    const res = await fetch(url, { headers: this.headers });
    if (res.status === 404) return null;
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`GitHub: ${err.message}`);
    }
    const data = await res.json();
    return data.sha;
  }

  // ── Create or update a file ────────────────────────────────────────────────
  async createOrUpdateFile(path, content, message) {
    const sha = await this.getFileSHA(path);
    const url = `${this.base}/repos/${this.repo}/contents/${path}`;

    const body = {
      message,
      content: btoa(unescape(encodeURIComponent(content))), // UTF-8 → base64
      branch:  this.branch,
    };
    if (sha) body.sha = sha; // required for updates

    const res = await fetch(url, {
      method:  'PUT',
      headers: this.headers,
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`GitHub: ${err.message}`);
    }
    return res.json();
  }

  // ── List files in a folder ────────────────────────────────────────────────
  async listFolder(path = '') {
    const url = `${this.base}/repos/${this.repo}/contents/${path}?ref=${this.branch}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`GitHub: ${err.message}`);
    }
    return res.json(); // array of file/dir objects
  }

  // ── Verify token & repo access ────────────────────────────────────────────
  async ping() {
    const url = `${this.base}/repos/${this.repo}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`GitHub: ${err.message}`);
    }
    return res.json();
  }
}
