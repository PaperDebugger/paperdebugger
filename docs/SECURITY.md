# PaperDebugger Security Guidelines

## 🔒 Secret Management Best Practices

### What NOT to commit to the repository:

❌ **Never commit these types of secrets:**
- API keys (OpenAI, Google, etc.)
- Database passwords or connection strings with credentials
- JWT signing keys
- OAuth client secrets (client IDs are usually OK)
- Personal access tokens (GitHub, etc.)
- Private keys or certificates
- Any production credentials

### ✅ What IS safe to commit:

- OAuth client IDs (public by design)
- Dummy/placeholder values for development
- Configuration templates without secrets
- Public endpoints and URLs

## 🛡️ How to Handle Secrets Properly

### 1. Environment Variables
Use environment variables for all sensitive configuration:

```bash
# Good - read from environment
OPENAI_API_KEY="${OPENAI_API_KEY}"
JWT_SIGNING_KEY="${JWT_SIGNING_KEY}"

# Bad - hardcoded secret
OPENAI_API_KEY="sk-real-api-key-here"
```

### 2. Helm Templates
Use Helm template parameters for secrets in Kubernetes manifests:

```yaml
# Good - templated
data:
  token: {{ .Values.secret_token | b64enc }}

# Bad - hardcoded
data:
  token: bXktc2VjcmV0LXRva2Vu
```

### 3. Development vs Production
- Use dummy values in default configuration files
- Use real secrets only in production deployment scripts
- Document required environment variables

## 🔍 Before Committing - Security Checklist

- [ ] Run `git diff` to review all changes
- [ ] Search for patterns like `sk-`, `ghp_`, `AIza`, long hex strings
- [ ] Verify no real passwords or tokens are included
- [ ] Check that `.env` files are in `.gitignore`
- [ ] Ensure dummy values are used in default configs

## 🚨 If You Accidentally Commit a Secret

1. **Immediately revoke the secret** (generate a new API key, token, etc.)
2. Remove the secret from git history:
   ```bash
   git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch path/to/file' --prune-empty --tag-name-filter cat -- --all
   ```
3. Force push to remote (if you have permissions)
4. Notify the team about the incident

## 🔧 Current Secret Configuration

### Environment Variables Required:
- `OPENAI_API_KEY` - OpenAI API key for AI features
- `JWT_SIGNING_KEY` - Key for signing JWT tokens
- `PD_MONGO_URI` - MongoDB connection string
- `MCP_BASIC_KEY` - MCP basic service key
- `MCP_PAPERSCORE_KEY` - MCP paper scoring service key
- `GHCR_DOCKER_CONFIG` - GitHub Container Registry auth config
- `CLOUDFLARE_TUNNEL_TOKEN` - Cloudflare tunnel token

### OAuth Configuration (Public):
- Google Client ID: `259796927285-cdkkp6i69elf660ei3strgj0qrftu6ud.apps.googleusercontent.com`
- Apple Client ID: `dev.junyi.PaperDebugger.si`

Note: OAuth Client IDs are designed to be public and are safe to include in frontend code.

## 📞 Security Contact

If you discover a security vulnerability, please report it responsibly:
- Email: paperdebugger@gmail.com
- Create a private GitHub issue
- Do not disclose publicly until reviewed and fixed