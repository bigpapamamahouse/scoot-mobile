# Cost Comparison: Claude Sonnet 4 vs Claude 3 Haiku

Your code currently uses **Claude Sonnet 4** because it's already enabled in your AWS account.

---

## Cost Breakdown

### Claude Sonnet 4 (Current)
- **Input**: $3.00 per 1M tokens
- **Output**: $15.00 per 1M tokens
- **Cost per moderation check**: ~$0.0012 (about 1/10th of a cent)
- **10,000 checks/day**: ~$360/month

### Claude 3 Haiku (Recommended for Production)
- **Input**: $0.25 per 1M tokens
- **Output**: $1.25 per 1M tokens
- **Cost per moderation check**: ~$0.0001 (1/100th of a cent)
- **10,000 checks/day**: ~$30/month

---

## Comparison

| Metric | Sonnet 4 | Haiku |
|--------|----------|-------|
| Cost per check | $0.0012 | $0.0001 |
| 100 posts/day | $3.60/mo | $0.30/mo |
| 1,000 posts/day | $36/mo | $3/mo |
| 10,000 posts/day | $360/mo | $30/mo |
| 100,000 posts/day | $3,600/mo | $300/mo |
| **Savings** | — | **12x cheaper** |

---

## When to Use Each

### Use Claude Sonnet 4 (Current):
- ✅ Testing immediately (already have access)
- ✅ Low volume (< 1,000 posts/day)
- ✅ Need most accurate moderation
- ✅ Handling complex multi-language content

### Switch to Claude 3 Haiku:
- ✅ Production deployment
- ✅ High volume (> 1,000 posts/day)
- ✅ Cost-sensitive
- ✅ Simple text moderation

---

## How to Switch to Haiku (Recommended Before Launch)

### 1. Request Access
1. Go to **Bedrock Console**: https://console.aws.amazon.com/bedrock
2. Navigate to **Foundation models** → **Anthropic Claude 3 Haiku**
3. Click **"Request model access"**
4. Wait for approval (usually instant)

### 2. Update Backend Code

In `backend/index.js` line 313, change:
```javascript
// Current (Sonnet 4)
modelId: "anthropic.claude-sonnet-4-20250514-v1:0",

// Change to (Haiku)
modelId: "anthropic.claude-3-haiku-20240307-v1:0",
```

### 3. Update IAM Policy

In your Lambda execution role policy, change the Resource ARN from:
```
arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0
```

To:
```
arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0
```

### 4. Deploy & Test

- Deploy updated backend code
- Test with a post creation
- Check CloudWatch logs for `[Moderation]` entries
- Verify moderation still works correctly

---

## Performance Comparison

Both models are fast enough for content moderation:

| Model | Latency | Quality |
|-------|---------|---------|
| Sonnet 4 | ~500-800ms | Excellent |
| Haiku | ~200-400ms | Very Good |

**For content moderation**: Haiku is more than sufficient and **2x faster**.

---

## Recommendation

✅ **Use Sonnet 4 for now** to test and verify everything works

✅ **Switch to Haiku before launch** to save 12x on costs

For a social media app with 10,000 posts/day, that's **$330/month in savings**!

---

## Current Configuration

Your app is configured with:
- ✅ Model: **Claude Sonnet 4** (`anthropic.claude-sonnet-4-20250514-v1:0`)
- ✅ Region: **us-east-1**
- ✅ Status: **Ready to test**

When ready for production, request Haiku access and make the 2-minute code change above.
