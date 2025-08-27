#!/bin/bash

# PaperDebugger Security Scanner
# This script scans for common sensitive strings in the codebase

set -e

echo "🔍 PaperDebugger Security Scanner"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Function to print findings
print_finding() {
    local level=$1
    local message=$2
    local color=$3
    echo -e "${color}[${level}] ${message}${NC}"
}

echo "Scanning for sensitive strings..."
echo ""

# Check for suspicious API key patterns
echo "🔑 Checking for suspicious API key patterns..."
api_key_patterns=$(grep -r -E "(sk-[a-zA-Z0-9]{20,}|AIza[a-zA-Z0-9]{35}|ya29\.|AKIA[0-9A-Z]{16})" --include="*.go" --include="*.js" --include="*.ts" --include="*.json" --include="*.yaml" --include="*.yml" --include="*.sh" . 2>/dev/null | grep -v ".git" | grep -v "dummy" | wc -l)
if [ $api_key_patterns -gt 0 ]; then
    print_finding "HIGH" "Found $api_key_patterns suspicious API key patterns!" $RED
    grep -r -E "(sk-[a-zA-Z0-9]{20,}|AIza[a-zA-Z0-9]{35}|ya29\.|AKIA[0-9A-Z]{16})" --include="*.go" --include="*.js" --include="*.ts" --include="*.json" --include="*.yaml" --include="*.yml" --include="*.sh" . 2>/dev/null | grep -v ".git" | grep -v "dummy"
    echo ""
fi

# Check for hardcoded secrets (more targeted)
echo "🔐 Checking for hardcoded secrets..."
secrets=$(grep -r -E "(password|secret|token).*[:=].*[\"'][^\"']{8,}" --include="*.go" --include="*.js" --include="*.ts" --include="*.json" --include="*.yaml" --include="*.yml" --include="*.sh" . 2>/dev/null | grep -v ".git" | grep -v "dummy" | grep -v "example" | grep -v "placeholder" | wc -l)
if [ $secrets -gt 0 ]; then
    print_finding "WARN" "Found $secrets potential hardcoded secrets" $YELLOW
    grep -r -E "(password|secret|token).*[:=].*[\"'][^\"']{8,}" --include="*.go" --include="*.js" --include="*.ts" --include="*.json" --include="*.yaml" --include="*.yml" --include="*.sh" . 2>/dev/null | grep -v ".git" | grep -v "dummy" | grep -v "example" | grep -v "placeholder" | head -3
    echo ""
fi

# Check for GitHub tokens
echo "🔑 Checking for GitHub tokens..."
github_tokens=$(grep -r "ghp_" . 2>/dev/null | wc -l)
if [ $github_tokens -gt 0 ]; then
    print_finding "CRITICAL" "Found $github_tokens GitHub personal access tokens!" $RED
    grep -r "ghp_" . 2>/dev/null
    echo ""
fi

# Check for base64 encoded secrets  
echo "🔍 Checking for base64 encoded data..."
base64_data=$(grep -r "data:" --include="*.yaml" --include="*.yml" . 2>/dev/null | grep -E "[A-Za-z0-9+/]{20,}={0,2}" | wc -l)
if [ $base64_data -gt 0 ]; then
    print_finding "WARN" "Found $base64_data potential base64 encoded data blocks" $YELLOW
    echo "  (These should be reviewed manually for sensitive content)"
    echo ""
fi

# Check for weak JWT keys
echo "🔐 Checking for weak JWT signing keys..."
weak_jwt=$(grep -r "jwt.*key.*paperdebugger\|jwt_signing_key.*paperdebugger" --include="*.yaml" --include="*.yml" . 2>/dev/null | wc -l)
if [ $weak_jwt -gt 0 ]; then
    print_finding "HIGH" "Found weak JWT signing key!" $RED
    grep -r "jwt.*key.*paperdebugger\|jwt_signing_key.*paperdebugger" --include="*.yaml" --include="*.yml" . 2>/dev/null
    echo ""
fi

# Check for hardcoded URLs
echo "🌐 Checking for hardcoded URLs with credentials..."
url_creds=$(grep -r -E "(https?://[^:]+:[^@]+@|ftp://[^:]+:[^@]+@)" . 2>/dev/null | wc -l)
if [ $url_creds -gt 0 ]; then
    print_finding "HIGH" "Found $url_creds URLs with embedded credentials!" $RED
    grep -r -E "(https?://[^:]+:[^@]+@|ftp://[^:]+:[^@]+@)" . 2>/dev/null
    echo ""
fi

# Check for SSH keys (exclude false positives)
echo "🔑 Checking for SSH keys..."
ssh_keys=$(grep -r -E "(ssh-rsa [A-Za-z0-9+/]{100,}|ssh-ed25519 [A-Za-z0-9+/]{60,}|-----BEGIN.*PRIVATE KEY-----)" . 2>/dev/null | grep -v "security-scan.sh" | wc -l)
if [ $ssh_keys -gt 0 ]; then
    print_finding "HIGH" "Found $ssh_keys SSH keys!" $RED
    grep -r -E "(ssh-rsa [A-Za-z0-9+/]{100,}|ssh-ed25519 [A-Za-z0-9+/]{60,}|-----BEGIN.*PRIVATE KEY-----)" . 2>/dev/null | grep -v "security-scan.sh"
    echo ""
fi

echo "🎉 Security scan complete!"
echo ""
echo "📋 Summary:"
echo "  - Run this script regularly to catch new sensitive strings"
echo "  - Review all findings manually for context"
echo "  - Use environment variables and secret management for sensitive data"
echo "  - Never commit real secrets to version control"
echo ""
echo "For detailed findings and remediation steps, see SECURITY_AUDIT_REPORT.md"