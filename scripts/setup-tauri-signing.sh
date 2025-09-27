#!/bin/bash
# Setup Tauri Signing for CI/CD

set -e

echo "=== Tauri Signing Setup ==="
echo "Generating CI-compatible signing keys (no password)..."

# Generate keys
npx @tauri-apps/cli signer generate --ci -w tauri.key

if [ -f "tauri.key" ]; then
    # Extract public key for tauri.conf.json
    PUBLIC_KEY=$(cat tauri.key.pub)
    echo "
✅ Keys generated successfully!

Next steps:
1. Add to GitHub Secrets:
   - TAURI_SIGNING_PRIVATE_KEY: $(cat tauri.key)
   - TAURI_SIGNING_PRIVATE_KEY_PASSWORD: (empty)

2. Update tauri.conf.json with public key:
   $PUBLIC_KEY

3. Add tauri.key to .gitignore
"

    # Add to .gitignore if not present
    grep -q "tauri.key" .gitignore 2>/dev/null || echo "tauri.key" >> .gitignore
else
    echo "❌ Failed to generate keys"
    exit 1
fi