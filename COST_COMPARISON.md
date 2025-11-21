# Cost Comparison: Claude 3 Haiku vs Claude Sonnet 4

Your code currently uses **Claude 3 Haiku** - the cost-effective choice for content moderation.

---

## Cost Breakdown

### Claude 3 Haiku (Current - Recommended ✅)
- **Input**: $0.25 per 1M tokens
- **Output**: $1.25 per 1M tokens
- **Cost per moderation check**: ~$0.0001 (1/100th of a cent)
- **10,000 checks/day**: ~$30/month

### Claude Sonnet 4 (Alternative)
- **Input**: $3.00 per 1M tokens
- **Output**: $15.00 per 1M tokens
- **Cost per moderation check**: ~$0.0012 (about 1/10th of a cent)
- **10,000 checks/day**: ~$360/month

---

## Comparison

| Metric | Haiku (Current) | Sonnet 4 |
|--------|-----------------|----------|
| Cost per check | $0.0001 | $0.0012 |
| 100 posts/day | $0.30/mo | $3.60/mo |
| 1,000 posts/day | $3/mo | $36/mo |
| 10,000 posts/day | $30/mo | $360/mo |
| 100,000 posts/day | $300/mo | $3,600/mo |
| **Cost Difference** | **Baseline** | **12x more expensive** |

---

## When to Use Each

### Use Claude 3 Haiku (Current - Recommended ✅):
- ✅ Production deployment
- ✅ Any volume of posts
- ✅ Cost-effective
- ✅ Fast response times (200-400ms)
- ✅ Very good accuracy for content moderation

### Use Claude Sonnet 4 (Alternative):
- ✅ Need absolute best accuracy
- ✅ Complex multi-language content
- ✅ Edge cases requiring nuanced understanding
- ✅ Cost is not a concern

---

## How to Switch to Sonnet 4 (If Needed)

Only do this if you need the absolute best accuracy and don't mind 12x higher costs.

### 1. Update Backend Code

In `backend/index.js` line 313, change:
```javascript
// Current (Haiku)
modelId: "anthropic.claude-3-haiku-20240307-v1:0",

// Change to (Sonnet 4)
modelId: "anthropic.claude-sonnet-4-20250514-v1:0",
```

### 2. Update IAM Policy

In your Lambda execution role policy, change the Resource ARN from:
```
arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0
```

To:
```
arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0
```

### 3. Deploy & Test

- Deploy updated backend code
- Test with a post creation
- Check CloudWatch logs for `[Moderation]` entries
- Monitor costs in AWS Cost Explorer

---

## Performance Comparison

Both models are fast enough for content moderation:

| Model | Latency | Quality |
|-------|---------|---------|
| Haiku | ~200-400ms | Very Good |
| Sonnet 4 | ~500-800ms | Excellent |

**For content moderation**: Haiku is more than sufficient and **2x faster**.

---

## Recommendation

✅ **Use Haiku (current configuration)** - Best balance of cost and performance

❌ **Don't switch to Sonnet 4** unless you have a specific need for maximum accuracy

For a social media app with 10,000 posts/day, Haiku saves you **$330/month** compared to Sonnet 4!

---

## Current Configuration

Your app is configured with:
- ✅ Model: **Claude 3 Haiku** (`anthropic.claude-3-haiku-20240307-v1:0`)
- ✅ Region: **us-east-1**
- ✅ Cost: **~$30/month** for 10,000 posts/day
- ✅ Status: **Ready to deploy**

This is the recommended configuration for production use! 🚀
