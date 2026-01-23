#!/bin/bash
set -e

# ScooterBooter Microservices Local Development
# Usage: ./scripts/local.sh [command]
#
# Commands:
#   api       Start local API Gateway (default)
#   invoke    Invoke a function locally
#   build     Build the application

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

COMMAND="${1:-api}"

# Load environment variables from .env if exists
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(cat "$PROJECT_DIR/.env" | grep -v '^#' | xargs)
fi

case $COMMAND in
    api)
        echo "Starting local API Gateway..."
        echo "API will be available at http://127.0.0.1:3000"
        echo ""

        # Build first
        sam build --parallel

        # Start local API
        sam local start-api \
            --warm-containers EAGER \
            --port 3000 \
            --env-vars env.json
        ;;

    invoke)
        FUNCTION="${2:-UsersFunction}"
        EVENT="${3:-events/get-me.json}"

        echo "Invoking $FUNCTION with $EVENT..."

        sam build --parallel
        sam local invoke "$FUNCTION" \
            --event "$EVENT" \
            --env-vars env.json
        ;;

    build)
        echo "Building SAM application..."
        sam build --parallel
        ;;

    *)
        echo "Unknown command: $COMMAND"
        echo "Usage: ./scripts/local.sh [api|invoke|build]"
        exit 1
        ;;
esac
