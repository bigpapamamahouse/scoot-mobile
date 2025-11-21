#!/bin/bash
# Build Lambda Layer for Bedrock SDK

echo "Creating Lambda layer structure..."
mkdir -p bedrock-layer/nodejs

cd bedrock-layer/nodejs

echo "Initializing npm..."
npm init -y

echo "Installing Bedrock SDK..."
npm install @aws-sdk/client-bedrock-runtime

cd ..

echo "Creating zip file..."
zip -r bedrock-layer.zip nodejs/

echo ""
echo "✅ Done! Lambda layer created at: bedrock-layer/bedrock-layer.zip"
ls -lh bedrock-layer.zip
