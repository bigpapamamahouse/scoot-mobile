# Amazon Bedrock Setup Guide

This guide walks you through enabling Amazon Bedrock and installing the required Lambda dependencies.

---

## Part 1: Enable Amazon Bedrock

### Step 1: Access AWS Bedrock Console

1. **Sign in to AWS Console**: https://console.aws.amazon.com/
2. **Navigate to Amazon Bedrock**:
   - In the search bar at the top, type "Bedrock"
   - Click on "Amazon Bedrock" in the results
   - Or go directly to: https://console.aws.amazon.com/bedrock

### Step 2: Check Region

**IMPORTANT**: Amazon Bedrock is only available in specific regions. The code uses `us-east-1`.

1. Check your current region in the top-right corner of the AWS Console
2. If you're not in `us-east-1`, click the region dropdown and select **US East (N. Virginia) us-east-1**

**Bedrock-Enabled Regions** (as of 2024):
- `us-east-1` (N. Virginia) ✅ Recommended
- `us-west-2` (Oregon)
- `eu-central-1` (Frankfurt)
- `ap-northeast-1` (Tokyo)
- `ap-southeast-1` (Singapore)

### Step 3: Enable Model Access

1. In the Bedrock console, look at the left sidebar
2. Click on **"Model access"** (under "Foundation models")
3. Click the **"Manage model access"** button (orange button on the right)
4. You'll see a list of available models

### Step 4: Enable Claude 3 Haiku

1. **Find Anthropic models** in the list
2. Check the box next to **"Claude 3 Haiku"**
   - Model ID should be: `anthropic.claude-3-haiku-20240307-v1:0`
3. Scroll down and click **"Request model access"** or **"Save changes"**

### Step 5: Wait for Approval

- **For most accounts**: Approval is **instant** ✅
- You'll see the status change from "Requested" to "Available" (green checkmark)
- If approval is pending, it usually takes 5-10 minutes

### Step 6: Verify Access

1. Once approved, you'll see "Access granted" with a green checkmark
2. You can test the model using the Bedrock Playground:
   - Go to **"Playgrounds"** → **"Chat"** in the left sidebar
   - Select **Claude 3 Haiku** from the dropdown
   - Type a test message to verify it works

---

## Part 2: Install Lambda Dependencies

Your Lambda function needs the `@aws-sdk/client-bedrock-runtime` package to call Bedrock.

### Option A: Check if SDK is Already Available (Fastest)

AWS Lambda runtime already includes some AWS SDK v3 packages. Let's check if Bedrock is included:

1. Go to **AWS Lambda Console**: https://console.aws.amazon.com/lambda
2. Find your Lambda function (the one that handles your API)
3. Click on it to open
4. Scroll to the **"Code"** tab
5. In the code editor, create a test file or look at existing code
6. Check if your Lambda runtime is **Node.js 18.x or newer**

**If your runtime is Node.js 18.x or newer**, the Bedrock SDK **might** already be included. You can test this by deploying your code and checking the CloudWatch logs.

---

### Option B: Add Bedrock SDK via Lambda Layer (Recommended)

This is the cleanest approach for adding dependencies.

#### Step 1: Create the Layer Package Locally

On your local machine (or in this environment):

```bash
# Create a directory for the layer
mkdir -p bedrock-layer/nodejs
cd bedrock-layer/nodejs

# Initialize npm (creates package.json)
npm init -y

# Install the Bedrock SDK
npm install @aws-sdk/client-bedrock-runtime

# Go back to parent directory
cd ..

# Create a zip file
zip -r bedrock-layer.zip nodejs/
```

#### Step 2: Upload Layer to AWS

1. Go to **AWS Lambda Console** → **Layers** (in left sidebar)
2. Click **"Create layer"**
3. Fill in the details:
   - **Name**: `bedrock-runtime-sdk` (or any name)
   - **Description**: `AWS SDK for Bedrock Runtime`
   - **Upload**: Click "Upload" and select `bedrock-layer.zip`
   - **Compatible runtimes**: Select `Node.js 18.x` and `Node.js 20.x`
4. Click **"Create"**

#### Step 3: Attach Layer to Your Lambda

1. Go back to your Lambda function
2. Scroll down to **"Layers"** section
3. Click **"Add a layer"**
4. Select **"Custom layers"**
5. Choose your newly created `bedrock-runtime-sdk` layer
6. Select the latest version
7. Click **"Add"**

#### Step 4: Verify

Your Lambda function should now have access to the Bedrock SDK. The layer will appear in the "Layers" section of your function.

---

### Option C: Bundle with Lambda Function (Alternative)

If you prefer to bundle dependencies directly with your Lambda code:

#### Step 1: Create Deployment Package

```bash
# Navigate to backend directory
cd /home/user/scoot-mobile/backend

# Create a temporary directory for bundling
mkdir deployment
cd deployment

# Copy your Lambda function
cp ../index.js .

# Initialize npm
npm init -y

# Install Bedrock SDK
npm install @aws-sdk/client-bedrock-runtime

# Create deployment zip
zip -r lambda-deployment.zip index.js node_modules/
```

#### Step 2: Upload to Lambda

1. Go to your Lambda function in the AWS Console
2. Click **"Upload from"** → **".zip file"**
3. Select the `lambda-deployment.zip` file
4. Click **"Save"**

**Note**: If your package is over 50MB, you'll need to upload to S3 first and deploy from there.

---

### Option D: Using AWS CLI (For Advanced Users)

If you have AWS CLI configured:

```bash
# Create layer
cd /home/user/scoot-mobile
mkdir -p bedrock-layer/nodejs
cd bedrock-layer/nodejs
npm init -y
npm install @aws-sdk/client-bedrock-runtime
cd ..
zip -r bedrock-layer.zip nodejs/

# Publish layer
aws lambda publish-layer-version \
  --layer-name bedrock-runtime-sdk \
  --description "AWS SDK for Bedrock Runtime" \
  --zip-file fileb://bedrock-layer.zip \
  --compatible-runtimes nodejs18.x nodejs20.x

# Attach to Lambda (replace with your function name and layer ARN)
aws lambda update-function-configuration \
  --function-name your-function-name \
  --layers arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:layer:bedrock-runtime-sdk:1
```

---

## Verification

### Test Your Setup

After enabling Bedrock and installing dependencies:

1. **Deploy your updated Lambda code** (`backend/index.js`)
2. **Test content moderation** by creating a post:

```bash
# Using curl (replace with your API endpoint and token)
curl -X POST https://your-api-endpoint.com/posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "This is a test post"}'
```

3. **Check CloudWatch Logs**:
   - Go to Lambda console → your function
   - Click "Monitor" tab → "View logs in CloudWatch"
   - Look for `[Moderation]` log entries
   - You should see logs about content being moderated

### Expected Behavior

✅ **Normal post**: Should be created successfully
✅ **Post with test objectionable content**: Should be rejected with 403 error

### Troubleshooting

If you get errors:

**Error: "Cannot find module '@aws-sdk/client-bedrock-runtime'"**
- Solution: The SDK is not installed. Use Option B (Layer) or Option C (Bundle)

**Error: "AccessDeniedException: User is not authorized to perform: bedrock:InvokeModel"**
- Solution: Update your Lambda execution role with Bedrock permissions (see MODERATION_SETUP.md)

**Error: "ValidationException: The provided model identifier is invalid"**
- Solution: Make sure you enabled Claude 3 Haiku in the Bedrock console

**Error: "Bedrock is not available in this region"**
- Solution: Your Lambda must be in a Bedrock-enabled region (us-east-1 recommended)

---

## Cost Estimate

### Amazon Bedrock Pricing (Claude 3 Haiku)

- **Input tokens**: $0.00025 per 1K tokens
- **Output tokens**: $0.00125 per 1K tokens

**Per moderation check** (approximate):
- Input: ~100 tokens = $0.000025
- Output: ~50 tokens = $0.0000625
- **Total per check**: ~$0.0001 (one-hundredth of a cent)

**Monthly estimates**:
| Posts per day | Moderation calls per day | Monthly cost |
|--------------|-------------------------|--------------|
| 100 | 100 | $0.30 |
| 1,000 | 1,000 | $3.00 |
| 10,000 | 10,000 | $30.00 |
| 100,000 | 100,000 | $300.00 |

**Note**: Comments are also moderated, so actual costs may be higher.

### Lambda Costs

- Free tier: 1M requests/month and 400,000 GB-seconds
- Additional: $0.20 per 1M requests
- The Bedrock SDK adds ~5-10MB to your Lambda package

---

## Next Steps

After completing this setup:

1. ✅ Bedrock enabled
2. ✅ Lambda dependencies installed
3. ⬜ Create DynamoDB tables (REPORTS_TABLE, BLOCKS_TABLE)
4. ⬜ Update Lambda environment variables
5. ⬜ Update Lambda IAM permissions
6. ⬜ Deploy updated backend code
7. ⬜ Test the full flow

See `MODERATION_SETUP.md` for the complete deployment checklist.

---

## Support

If you encounter issues:

1. **Check CloudWatch Logs** for detailed error messages
2. **Verify region** - Lambda and Bedrock must be in the same region
3. **Check IAM permissions** - Lambda role needs Bedrock access
4. **Test Bedrock directly** using the AWS Console Playground

For questions about Bedrock: https://docs.aws.amazon.com/bedrock/
For Lambda layers: https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html
