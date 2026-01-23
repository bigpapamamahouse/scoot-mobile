#!/bin/bash
set -e

# ScooterBooter Microservices Deployment Script
# Usage: ./scripts/deploy.sh [environment] [--guided]
#
# Environments: dev, staging, prod
# Options:
#   --guided    Run interactive guided deployment

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Default environment
ENV="${1:-dev}"
GUIDED=""

# Parse arguments
for arg in "$@"; do
    case $arg in
        --guided)
            GUIDED="--guided"
            shift
            ;;
        dev|staging|prod)
            ENV="$arg"
            shift
            ;;
    esac
done

echo "========================================"
echo "ScooterBooter Microservices Deployment"
echo "========================================"
echo "Environment: $ENV"
echo "Project Dir: $PROJECT_DIR"
echo ""

# Check for SAM CLI
if ! command -v sam &> /dev/null; then
    echo "Error: AWS SAM CLI is not installed."
    echo "Install it with: pip install aws-sam-cli"
    exit 1
fi

# Check for AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "Error: AWS credentials not configured."
    echo "Run: aws configure"
    exit 1
fi

# Install shared layer dependencies
echo "Installing shared layer dependencies..."
cd "$PROJECT_DIR/layers/shared/nodejs"
npm install --production
cd "$PROJECT_DIR"

# Build
echo ""
echo "Building SAM application..."
sam build --parallel

# Deploy
echo ""
echo "Deploying to $ENV environment..."

if [ -n "$GUIDED" ]; then
    sam deploy --guided --config-env "$ENV"
else
    sam deploy --config-env "$ENV"
fi

echo ""
echo "========================================"
echo "Deployment complete!"
echo "========================================"

# Get the API endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name "scooterbooter-microservices-$ENV" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -n "$API_ENDPOINT" ]; then
    echo ""
    echo "API Endpoint: $API_ENDPOINT"
fi
