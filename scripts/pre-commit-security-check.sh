#!/bin/bash

# Pre-commit hook to detect potential secrets
# To install: cp scripts/pre-commit-security-check.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Running security check..."

# Get list of files to be committed
files=$(git diff --cached --name-only --diff-filter=ACM)

# Secret patterns to check for
secret_patterns=(
    "sk-[a-zA-Z0-9]{48,}"                    # OpenAI API keys
    "ghp_[a-zA-Z0-9]{36,}"                   # GitHub personal access tokens
    "xox[abp]-[a-zA-Z0-9-]{10,}"             # Slack tokens
    "AIza[0-9A-Za-z\\-_]{35}"                # Google API keys
    "ya29\\.[0-9A-Za-z\\-_]+"                # Google OAuth access tokens
    "AKIA[0-9A-Z]{16}"                       # AWS access keys
    "[a-f0-9]{64}"                           # Generic 64-char hex (potential secrets)
    "password.*['\"][^'\"]{8,}['\"]"         # Quoted passwords
    "secret.*['\"][^'\"]{8,}['\"]"           # Quoted secrets
)

found_secrets=false

# Check each file being committed
for file in $files; do
    if [[ -f "$file" ]]; then
        # Skip binary files and common non-sensitive files
        if file "$file" | grep -q "text\|ASCII"; then
            for pattern in "${secret_patterns[@]}"; do
                if grep -qE "$pattern" "$file"; then
                    echo -e "${RED}⚠️  Potential secret found in $file${NC}"
                    echo -e "${YELLOW}Pattern: $pattern${NC}"
                    grep -nE "$pattern" "$file" | head -3
                    echo ""
                    found_secrets=true
                fi
            done
        fi
    fi
done

# Check for hardcoded credentials in specific contexts
for file in $files; do
    if [[ "$file" =~ \.(yaml|yml|json)$ ]]; then
        # Check for base64 encoded content that might be secrets
        if grep -qE "data:|token:|password:|secret:" "$file"; then
            # Look for suspiciously long base64 strings
            if grep -qE "[A-Za-z0-9+/]{40,}={0,2}" "$file"; then
                echo -e "${YELLOW}⚠️  Found base64 content in $file - please verify it's not a real secret${NC}"
            fi
        fi
    fi
done

if $found_secrets; then
    echo -e "${RED}❌ Commit blocked: Potential secrets detected!${NC}"
    echo -e "${YELLOW}If these are dummy/fake values, please:"
    echo "1. Add 'dummy', 'fake', or 'test' prefix to make it clear"
    echo "2. Add a comment explaining the value"
    echo "3. Use environment variables for real secrets"
    echo ""
    echo "To bypass this check (use carefully): git commit --no-verify${NC}"
    exit 1
else
    echo -e "✅ No secrets detected - commit allowed"
fi