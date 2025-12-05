#!/bin/bash
# Test script for DELETE /media endpoint
# Replace these values:
API_URL="YOUR_API_URL"  # e.g., https://abc123.execute-api.us-east-1.amazonaws.com/prod
AUTH_TOKEN="YOUR_AUTH_TOKEN"  # Get from app or cognito
TEST_KEY="u/test-user/test-file.jpg"  # A test key (doesn't need to exist in S3)

echo "Testing DELETE /media endpoint..."
echo "URL: $API_URL/media/$(echo -n "$TEST_KEY" | jq -sRr @uri)"
echo ""

curl -X DELETE \
  "$API_URL/media/$(echo -n "$TEST_KEY" | jq -sRr @uri)" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -v
