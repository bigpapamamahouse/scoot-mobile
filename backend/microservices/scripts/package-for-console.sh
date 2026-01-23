#!/bin/bash
set -e

# ScooterBooter Microservices Console Packaging Script
# Creates ZIP files ready for AWS Console upload

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_DIR/dist"

echo "========================================"
echo "ScooterBooter Console Packaging"
echo "========================================"
echo ""

# Create output directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Install shared layer dependencies
echo "Installing shared layer dependencies..."
cd "$PROJECT_DIR/layers/shared/nodejs"
npm install --production --silent
cd "$PROJECT_DIR"

# Package shared layer
echo "Packaging shared layer..."
cd "$PROJECT_DIR/layers/shared"
zip -r "$OUTPUT_DIR/layer-shared.zip" nodejs -x "*.DS_Store" > /dev/null
cd "$PROJECT_DIR"
echo "  ✓ layer-shared.zip"

# Package each service
SERVICES=("users" "posts" "social" "media" "notifications" "scoops")

for SERVICE in "${SERVICES[@]}"; do
    echo "Packaging $SERVICE service..."
    cd "$PROJECT_DIR/services/$SERVICE"
    zip -r "$OUTPUT_DIR/service-$SERVICE.zip" . -x "*.DS_Store" > /dev/null
    cd "$PROJECT_DIR"
    echo "  ✓ service-$SERVICE.zip"
done

echo ""
echo "========================================"
echo "Packaging complete!"
echo "========================================"
echo ""
echo "Output files in: $OUTPUT_DIR"
echo ""
ls -lh "$OUTPUT_DIR"
echo ""
echo "Next steps:"
echo "1. Upload layer-shared.zip as a Lambda Layer"
echo "2. Upload each service-*.zip to its Lambda function"
echo "3. See README-CONSOLE-DEPLOY.md for detailed instructions"
