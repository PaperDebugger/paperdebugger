# PaperDebugger Security Audit Report

**Date:** December 19, 2024  
**Audited by:** GitHub Copilot Security Scanner  
**Repository:** PaperDebugger/paperdebugger

## Executive Summary

This security audit identified several sensitive strings and potential security vulnerabilities in the PaperDebugger project. While some findings are low-risk development configurations, others require immediate attention to prevent potential security breaches.

## Critical Findings

### 1. 🚨 **CRITICAL: Hardcoded GitHub Personal Access Token**
- **File:** `helm-chart/templates/secret.yaml`
- **Issue:** Base64-encoded Docker registry secret contains a hardcoded GitHub Personal Access Token
- **Token:** `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`
- **Risk Level:** HIGH
- **Details:** 
  ```yaml
  data:
    .dockerconfigjson: ewogICAgImF1dGhzIjogewogICAgICAgICJnaGNyLmlvIjogewogICAgICAgICAgICAidXNlcm5hbWUiOiAicGFwZXJkZWJ1Z2dlci1ib3QiLAogICAgICAgICAgICAicGFzc3dvcmQiOiAiZ2hwXzhpZXFPN2VpeFFFdkJwR25GNWdvZHdZMDNZZ2F0dTRhVTRRaiIKICAgICAgICB9CiAgICB9Cn0=
  ```
  Decodes to:
  ```json
  {
    "auths": {
      "ghcr.io": {
        "username": "paperdebugger-bot",
        "password": "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"
      }
    }
  }
  ```

### 2. 🔴 **HIGH: Weak JWT Signing Key**
- **File:** `helm-chart/values.yaml`
- **Issue:** JWT signing key is set to the predictable value "paperdebugger"
- **Risk Level:** HIGH
- **Details:**
  ```yaml
  jwt_signing_key: paperdebugger
  ```
- **Impact:** This weak signing key could allow attackers to forge JWT tokens and impersonate users

## Medium Findings

### 3. 🟡 **MEDIUM: Hardcoded Google Analytics API Secret**
- **Files:** 
  - `webapp/_webapp/vite.config.ts` (line 25)
  - `webapp/_webapp/vite.config.dev.ts`
- **Issue:** Google Analytics API secret is hardcoded in build configuration
- **Risk Level:** MEDIUM
- **Details:**
  ```typescript
  PD_GA_API_SECRET: process.env.PD_GA_API_SECRET || "V6Cpx7cJRlK_W2j2LWx7yw"
  ```

## Low Findings

### 4. 🟢 **LOW: Dummy API Keys in Scripts**
- **Files:** 
  - `hack/dev-apply.sh`
  - `hack/stg.sh`  
  - `hack/prd.sh`
  - `.env.example`
- **Issue:** Default values for API keys use "dummy" or predictable patterns
- **Risk Level:** LOW (Development configuration)
- **Details:**
  ```bash
  OPENAI_API_KEY=${OPENAI_API_KEY:-sk-dummy-OPENAI_API_KEY}
  MCP_BASIC_KEY=${MCP_BASIC_KEY:-sk-dummy-MCP_BASIC_KEY}
  MCP_PAPERSCORE_KEY=${MCP_PAPERSCORE_KEY:-sk-dummy-MCP_PAPERSCORE_KEY}
  ```

### 5. 🟢 **LOW: Hardcoded Google Analytics Tracking ID**
- **Files:** `webapp/_webapp/vite.config.ts`
- **Issue:** GA tracking ID is hardcoded
- **Risk Level:** LOW (Public information)
- **Details:**
  ```typescript
  PD_GA_TRACKING_ID: process.env.PD_GA_TRACKING_ID || "G-6Y8G18CCMP"
  ```

## Recommendations

### Immediate Actions Required

1. **🚨 URGENT: Revoke GitHub Personal Access Token**
   - Immediately revoke the token `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` from GitHub
   - Generate a new token and store it securely in your deployment system
   - Update the Helm chart to reference the token as a Kubernetes secret rather than hardcoding it

2. **🚨 URGENT: Generate Strong JWT Signing Key**
   - Generate a cryptographically secure random key (at least 256 bits)
   - Store it as a Kubernetes secret or environment variable
   - Update the Helm values to reference the secret

### Security Best Practices

3. **Move Secrets to Environment Variables**
   - Remove the hardcoded Google Analytics API secret
   - Use environment variables for all sensitive configuration

4. **Implement Secret Management**
   - Use Kubernetes secrets for all sensitive data
   - Consider using external secret management solutions (e.g., HashiCorp Vault, AWS Secrets Manager)
   - Implement secret rotation policies

5. **Code Review Process**
   - Implement pre-commit hooks to scan for sensitive strings
   - Add security scanning to CI/CD pipeline
   - Regular security audits of configuration files

### Monitoring and Detection

6. **Set up Secret Scanning**
   - Enable GitHub Advanced Security features
   - Implement automated secret scanning in CI/CD
   - Monitor for accidental commits of sensitive data

## Files Requiring Changes

1. `helm-chart/templates/secret.yaml` - Remove hardcoded credentials
2. `helm-chart/values.yaml` - Use secure JWT signing key
3. `webapp/_webapp/vite.config.ts` - Remove hardcoded GA API secret
4. `webapp/_webapp/vite.config.dev.ts` - Remove hardcoded GA API secret

## Additional Findings (Informational)

### 6. 🔵 **INFO: Email Addresses Found**
- **File:** `webapp/_webapp/src/manifest.json`
- **Content:** `"author": "paperdebugger@gmail.com"`
- **Risk Level:** INFORMATIONAL
- **Note:** This is likely a legitimate contact email and not sensitive

### 7. 🔵 **INFO: Chrome Extension ID**
- **File:** `.github/workflows/release.yml`
- **Content:** `extension_id: 'dfkedikhakpapbfcnbpmfhpklndgiaog'`
- **Risk Level:** INFORMATIONAL  
- **Note:** Extension IDs are public information

## Security Best Practices Observed

✅ **GitHub Actions properly use secret references** (`${{ secrets.* }}`) instead of hardcoded values  
✅ **Database connection strings** use environment variables without embedded credentials  
✅ **The Apple Auth library** is a legitimate third-party library without hardcoded secrets  
✅ **Overleaf socket interfaces** properly handle authentication through parameters  
✅ **No SSH keys, credit card numbers, or private keys** found in the codebase  
✅ **No URLs with embedded credentials** found  

## Additional Notes

- The Apple Auth library (`webapp/_webapp/src/libs/apple-auth.js`) appears to be a third-party library and doesn't contain sensitive hardcoded values
- The Overleaf socket interfaces are properly designed to handle authentication cookies through parameters rather than hardcoded values
- Database connection strings are properly configured to use environment variables without embedded credentials
- GitHub workflow files properly use GitHub Secrets for sensitive data rather than hardcoding credentials

## Conclusion

The most critical issue is the hardcoded GitHub Personal Access Token which poses an immediate security risk. The weak JWT signing key is also a high-priority concern. All other findings are lower risk but should be addressed as part of security hardening efforts.

**Recommended timeline:**
- **Immediate (within 24 hours):** Revoke GitHub token and fix JWT signing key
- **Within 1 week:** Address hardcoded API secrets  
- **Within 2 weeks:** Implement comprehensive secret management strategy