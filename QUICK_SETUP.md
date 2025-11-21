# Quick Setup Guide - 5 Minutes

This is a condensed version of the setup. For detailed instructions, see `BEDROCK_SETUP.md`.

---

## 1. Enable Amazon Bedrock (2 minutes)

1. **Go to Bedrock Console**: https://console.aws.amazon.com/bedrock
2. **Switch to us-east-1** (top-right corner)
3. **Click "Model access"** (left sidebar)
4. **Click "Manage model access"**
5. **Check the box** for **"Claude 3 Haiku"**
6. **Click "Save changes"**
7. **Wait for green checkmark** (usually instant)

✅ Done!

---

## 2. Install Lambda Dependencies (3 minutes)

### Quick Method: Create Lambda Layer

**On your local machine or this environment:**

```bash
# Create layer directory
mkdir -p bedrock-layer/nodejs && cd bedrock-layer/nodejs

# Install Bedrock SDK
npm init -y
npm install @aws-sdk/client-bedrock-runtime

# Create zip
cd .. && zip -r bedrock-layer.zip nodejs/
```

**In AWS Console:**

1. Go to **Lambda Console** → **Layers** → **Create layer**
2. Name: `bedrock-runtime-sdk`
3. Upload: `bedrock-layer.zip`
4. Compatible runtimes: `Node.js 18.x`, `Node.js 20.x`
5. Click **Create**

**Attach to your Lambda:**

1. Open your Lambda function
2. Scroll to **Layers** → **Add a layer**
3. Select **Custom layers** → `bedrock-runtime-sdk`
4. Click **Add**

✅ Done!

---

## 3. Remaining Tasks (in AWS Console)

### Create DynamoDB Tables

**Reports Table:**
```
Table name: [your-project]-reports
Primary key: pk (String), sk (String)
Settings: On-demand or Provisioned (match your other tables)
```

**Blocks Table:**
```
Table name: [your-project]-blocks
Primary key: pk (String), sk (String)
Settings: On-demand or Provisioned (match your other tables)
```

### Update Lambda Environment Variables

Add these to your Lambda function:
```
REPORTS_TABLE=[your-project]-reports
BLOCKS_TABLE=[your-project]-blocks
```

### Update Lambda IAM Role

Add this policy to your Lambda execution role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:YOUR_ACCOUNT:table/YOUR_PROJECT-reports",
        "arn:aws:dynamodb:us-east-1:YOUR_ACCOUNT:table/YOUR_PROJECT-blocks"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
    }
  ]
}
```

### Deploy Backend Code

Upload the updated `backend/index.js` to your Lambda function.

---

## 4. Test Everything

**Test Bedrock:**
```bash
# Create a normal post (should work)
curl -X POST https://your-api/posts \
  -H "Authorization: Bearer TOKEN" \
  -d '{"text": "Hello world"}'
```

**Test Reporting:**
- Open app → Find a post → Tap menu → Report Post

**Test Blocking:**
- Open app → Find a post → Tap menu → Block User

**Check CloudWatch Logs:**
- Look for `[Moderation]` entries

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cannot find module bedrock-runtime" | Add Lambda layer (Step 2) |
| "AccessDeniedException" | Update IAM role with Bedrock permissions |
| "Model not found" | Enable Claude 3 Haiku in Bedrock console |
| "Wrong region" | Lambda must be in us-east-1 (or change code region) |

---

## Cost

- **Bedrock**: ~$0.0001 per post moderation
- **10,000 posts/day**: ~$30/month

---

All done! Your app now meets all App Store requirements. 🎉
