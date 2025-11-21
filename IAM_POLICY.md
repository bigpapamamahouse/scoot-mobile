# IAM Policy for Lambda - Bedrock and DynamoDB Access

This document contains the IAM policy you need to add to your Lambda execution role.

---

## Complete IAM Policy (Copy-Paste Ready)

Replace the following placeholders:
- `YOUR_AWS_ACCOUNT_ID` - Your AWS account ID (e.g., 123456789012)
- `YOUR_AWS_REGION` - Your AWS region (e.g., us-east-1)
- `YOUR_PROJECT_NAME` - Your project name prefix for DynamoDB tables

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInvokeModel",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
      ]
    },
    {
      "Sid": "DynamoDBModerationTables",
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
        "arn:aws:dynamodb:YOUR_AWS_REGION:YOUR_AWS_ACCOUNT_ID:table/YOUR_PROJECT_NAME-reports",
        "arn:aws:dynamodb:YOUR_AWS_REGION:YOUR_AWS_ACCOUNT_ID:table/YOUR_PROJECT_NAME-blocks"
      ]
    }
  ]
}
```

---

## Step-by-Step: Add Policy to Lambda Role

### Option 1: AWS Console (Easiest)

1. **Go to Lambda Console**: https://console.aws.amazon.com/lambda
2. **Open your Lambda function**
3. **Click "Configuration" tab** → **"Permissions"**
4. **Click on the Role name** (under "Execution role") - This opens IAM console
5. **Click "Add permissions"** → **"Create inline policy"**
6. **Click "JSON" tab**
7. **Paste the policy above** (with your values replaced)
8. **Click "Review policy"**
9. **Name it**: `BedrockAndModerationAccess`
10. **Click "Create policy"**

✅ Done!

---

### Option 2: AWS CLI

```bash
# Save the policy to a file
cat > lambda-moderation-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInvokeModel",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
      ]
    },
    {
      "Sid": "DynamoDBModerationTables",
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
        "arn:aws:dynamodb:us-east-1:YOUR_ACCOUNT_ID:table/YOUR_PROJECT-reports",
        "arn:aws:dynamodb:us-east-1:YOUR_ACCOUNT_ID:table/YOUR_PROJECT-blocks"
      ]
    }
  ]
}
EOF

# Get your Lambda function's role name
aws lambda get-function --function-name YOUR_FUNCTION_NAME --query 'Configuration.Role'

# Extract the role name from the ARN (it's the part after 'role/')
# Example: arn:aws:iam::123456789012:role/MyLambdaRole -> MyLambdaRole

# Create the inline policy
aws iam put-role-policy \
  --role-name YOUR_LAMBDA_ROLE_NAME \
  --policy-name BedrockAndModerationAccess \
  --policy-document file://lambda-moderation-policy.json
```

---

## Minimal Policy (Bedrock Only)

If you only want to add Bedrock access and handle DynamoDB separately:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
    }
  ]
}
```

---

## Finding Your Values

### 1. AWS Account ID
```bash
# Via AWS CLI
aws sts get-caller-identity --query Account --output text

# Or look in the top-right of AWS Console (account dropdown)
```

### 2. Lambda Role Name
```bash
# Via AWS CLI
aws lambda get-function --function-name YOUR_FUNCTION_NAME \
  --query 'Configuration.Role' --output text

# Or in Lambda Console → Configuration → Permissions → Role name
```

### 3. Your Region
- Check where your Lambda function is deployed
- Most likely: `us-east-1` (required for Bedrock)

### 4. DynamoDB Table Names
- Check your DynamoDB console
- Or use the names you set in Lambda environment variables:
  - `REPORTS_TABLE`
  - `BLOCKS_TABLE`

---

## Example with Real Values

Here's an example with placeholder values filled in:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInvokeModel",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
      ]
    },
    {
      "Sid": "DynamoDBModerationTables",
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
        "arn:aws:dynamodb:us-east-1:123456789012:table/scooterbooter-reports",
        "arn:aws:dynamodb:us-east-1:123456789012:table/scooterbooter-blocks"
      ]
    }
  ]
}
```

---

## Verify Policy is Applied

After adding the policy:

1. **Wait 30 seconds** for IAM changes to propagate
2. **Test your Lambda** by creating a post
3. **Check CloudWatch Logs** for any permission errors
4. Look for `[Moderation]` log entries indicating Bedrock is being called

---

## Troubleshooting

### Error: "User is not authorized to perform: bedrock:InvokeModel"
- ✅ Policy is not attached to the role
- ✅ Wrong region in the policy (must match Bedrock region)
- ✅ Typo in model ARN

### Error: "User is not authorized to perform: dynamodb:PutItem"
- ✅ DynamoDB resources not included in policy
- ✅ Wrong table names or account ID

### Policy looks correct but still getting errors
- Wait 1-2 minutes for IAM to propagate
- Check the role is the actual execution role of your Lambda
- Verify the Lambda is in the correct region (us-east-1 for Bedrock)

---

## Security Best Practices

✅ **Use specific resources** - Don't use `"Resource": "*"`
✅ **Minimum permissions** - Only grant actions you need
✅ **Model-specific ARN** - Only allow the specific Claude model
✅ **Table-specific ARNs** - Only allow access to moderation tables

---

## Additional Resources

- **Bedrock Permissions**: https://docs.aws.amazon.com/bedrock/latest/userguide/security-iam.html
- **DynamoDB Permissions**: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/iam-policy-structure.html
- **Lambda Execution Role**: https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html

---

**Need help?** Check the AWS IAM Policy Simulator to test your policy:
https://policysim.aws.amazon.com/
