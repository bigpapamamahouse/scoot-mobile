# Microservices Migration - Quick Reference Guide

**Date:** December 7, 2025
**Status:** Planning Phase
**Full Documentation:** See [MICROSERVICES_MIGRATION_PLAN.md](./MICROSERVICES_MIGRATION_PLAN.md)

---

## TL;DR - Executive Summary

**Current:** Single 3,477-line Lambda handling all 32 endpoints
**Problem:** Feed loads take 8-30 seconds, searches timeout, can't scale
**Solution:** Split into 8 focused microservices
**Timeline:** 13 weeks
**Expected Results:** 80% faster, 8x capacity, 99.9% availability

---

## Performance Improvements At A Glance

| Endpoint | Current | Target | Improvement |
|----------|---------|--------|-------------|
| **Feed (100 followers)** | 3-8s | 0.5-1.5s | **85% faster** |
| **Feed (500 followers)** | 15-30s ⚠️ | 2-4s | **90% faster** |
| **Profile Page** | 1-4s | 300-800ms | **75% faster** |
| **Search** | 500ms-2s | 50-200ms | **10x faster** |
| **Cold Start** | 2-3s | 500-900ms | **70% faster** |

**Scalability:** 1,000 → 8,000 concurrent executions (**8x capacity**)

---

## Proposed Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                    API Gateway (Single Entry)                   │
│              https://api.scootmobile.com/*                      │
└────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │    Path-Based Routing     │
                └─────────────┬─────────────┘
                              │
        ┌────────────────┬────┴────┬────────────────┐
        │                │         │                │
   ┌────▼─────┐    ┌────▼─────┐  ┌▼────────┐  ┌───▼──────┐
   │   User   │    │   Feed   │  │  Post   │  │ Comment  │
   │ Service  │    │ Service  │  │ Service │  │ Service  │
   │          │    │          │  │         │  │          │
   │ 8 routes │    │ 1 route  │  │ 5 rts   │  │ 2 routes │
   └──────────┘    └──────────┘  └─────────┘  └──────────┘
        │                │             │             │
   ┌────▼─────┐    ┌────▼─────┐  ┌────▼─────┐  ┌───▼──────┐
   │  Follow  │    │ Reaction │  │  Search  │  │  Notif   │
   │ Service  │    │ Service  │  │ Service  │  │ Service  │
   │          │    │          │  │          │  │ (Event)  │
   │ 9 routes │    │ 2 routes │  │ 1 route  │  │ 3 routes │
   └──────────┘    └──────────┘  └──────────┘  └──────────┘
        │                                            ▲
        │                                            │
        └────────────── SNS Events ─────────────────┘
                   (follow.*, comment.*, etc)


┌────────────────────────────────────────────────────────────────┐
│                     Data Layer (DynamoDB)                       │
├────────────────┬──────────────┬───────────────┬────────────────┤
│  USERS_TABLE   │ POSTS_TABLE  │ FOLLOWS_TABLE │ COMMENTS_TABLE │
│ REACTIONS_TBL  │ NOTIFS_TABLE │ BLOCKS_TABLE  │ REPORTS_TABLE  │
└────────────────┴──────────────┴───────────────┴────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                       Cache Layer (New)                         │
├────────────────────────────────┬───────────────────────────────┤
│  ElastiCache (Redis)           │  OpenSearch                   │
│  - Follower lists              │  - User search index          │
│  - User profiles               │  - Full-text search           │
│  - Feed cache                  │                               │
└────────────────────────────────┴───────────────────────────────┘
```

---

## Service Breakdown

| # | Service | Routes | Priority | LOC | Expected Latency | Key Benefit |
|---|---------|--------|----------|-----|------------------|-------------|
| 1 | **Feed** | 1 | ⚠️ CRITICAL | 400 | 500ms-1.5s | 85% faster feeds |
| 2 | **Search** | 1 | HIGH | 200 | 50-200ms | 10x faster search |
| 3 | **Post** | 5 | HIGH | 350 | 100-300ms | Async moderation |
| 4 | **User** | 8 | MEDIUM | 600 | 20-50ms | Profile isolation |
| 5 | **Comment** | 2 | MEDIUM | 300 | 50-150ms | Separate scaling |
| 6 | **Follow** | 9 | MEDIUM | 500 | 40-120ms | Event-driven |
| 7 | **Reaction** | 2 | LOW | 250 | 30-80ms | Simple counters |
| 8 | **Notification** | 3 | LOW | 450 | Async | Event-driven |

**Total:** 31 routes distributed across 8 services

---

## Current vs. Proposed: Feed Loading

### Current Flow (Monolith)
```
User → GET /feed
  │
  ├─ Query FOLLOWS_TABLE (get all follower IDs)
  │
  ├─ FOR EACH follower (sequential):
  │   ├─ Query POSTS_TABLE (50 posts)
  │   └─ Wait...
  │
  ├─ Sort all posts in memory (100 followers × 50 = 5,000 posts)
  │
  ├─ FOR EACH post in top 50:
  │   ├─ Fetch comment count
  │   ├─ Fetch reaction counts
  │   └─ Fetch user avatar
  │
  └─ Return (5-15 seconds total)
```

**Issues:**
- Sequential queries (no parallelization)
- Fetches too much data (50 posts × 100 followers = 5,000 items)
- N+1 queries for comment/reaction counts
- Times out at 500+ followers

---

### Proposed Flow (Feed Service)
```
User → GET /feed
  │
  ├─ Check Redis for follower list (cache hit: 5ms)
  │   └─ If miss: query DynamoDB → cache for 5 minutes
  │
  ├─ Parallel fetch top 10 posts per follower (Promise.all)
  │   └─ 100 followers × 10 posts = 1,000 items in 200ms
  │
  ├─ Merge & sort in-memory (1,000 → 50 items)
  │
  ├─ Batch fetch user summaries (BatchGetCommand, chunked)
  │   └─ 50 users in 2-3 parallel batches (100ms)
  │
  ├─ Batch fetch reaction/comment counts (parallel)
  │   └─ 50 queries in parallel (150ms)
  │
  └─ Return (500ms-1.5s total)
```

**Improvements:**
- Redis caching: 95% cache hit rate → 5ms follower lookup
- Parallel queries: 10x faster than sequential
- Fetch less data: 10 posts/user instead of 50
- Batch operations: Reduce round trips

**Result:** 8 seconds → 1 second (**87% faster**)

---

## Migration Timeline (13 Weeks)

```
Week  Service              Status     Expected Gain
────  ─────────────────    ────────   ──────────────
1-2   Infrastructure       Setup      N/A
      - API Gateway
      - Lambda shells
      - ElastiCache
      - OpenSearch

3-4   Feed Service         🔴 P0      85% faster feeds
      - Redis integration
      - Parallel queries
      - A/B testing

5     Search Service       🟠 P1      10x faster search
      - OpenSearch setup
      - Index sync

6     Post Service         🟠 P1      75% faster posts
      - Async moderation

7     User Service         🟡 P2      Profile isolation

8     Comment Service      🟡 P2      Separate scaling

9     Follow Service       🟡 P2      Event-driven

10    Reaction Service     🟢 P3      Simple extraction

11    Notification Svc     🟢 P3      Event-driven

12    Moderation Svc       🟢 P3      Async processing

13    Decommission         Cleanup    Remove monolith
```

**Priority Legend:**
- 🔴 P0 = Critical (feed bottleneck)
- 🟠 P1 = High (user-facing performance)
- 🟡 P2 = Medium (scaling & maintainability)
- 🟢 P3 = Low (nice-to-have)

---

## Critical Bottlenecks in Current Monolith

### 1. Feed Generation (Lines 2194-2470)
```javascript
// 🐌 SLOW: Sequential queries
for (const followerId of followerIds) {
  const posts = await queryPosts(followerId, 50);  // Blocking!
  allPosts.push(...posts);
}
```

**Impact:** 100 followers = 3-8s, 500 followers = 15-30s (timeout)
**Fix:** Parallel queries + caching

---

### 2. Profile N+1 Problem (Lines 2755-2875)
```javascript
// 🐌 SLOW: Nested loops
for (const post of posts) {                    // 50 iterations
  const comments = await getComments(post.id); // 50 queries
  for (const comment of comments) {            // 4 × 50 = 200
    const avatar = await getAvatar(comment.userId); // 200 queries
  }
}
```

**Impact:** 450+ DynamoDB queries per profile page
**Fix:** Batch fetching, GraphQL-style data loaders

---

### 3. Search Full Table Scan (Lines 3036-3098)
```javascript
// 🐌 SLOW: Scans 1,000 items
const results = await scanTable({
  Limit: 1000,
  FilterExpression: 'contains(fullName, :query)'
});
```

**Impact:** 500ms-2s (gets worse as users grow)
**Fix:** OpenSearch full-text index

---

## Cost Analysis

### Current Monthly Cost (Estimated)
```
Lambda (monolith)
  - 1M invocations × 1.5s avg × 512MB
  - $50-150/month

DynamoDB
  - On-demand pricing
  - $100-200/month

S3 + CloudFront
  - Media storage & delivery
  - $50-100/month

Total: $200-450/month
```

---

### Projected Monthly Cost (Microservices)
```
Lambda (8 services, right-sized)
  - Feed Service: 1024MB, 200k invocations × 1s = $30
  - User Service: 256MB, 300k invocations × 100ms = $15
  - Post Service: 512MB, 100k invocations × 300ms = $10
  - Others: 128-256MB, lower traffic = $30
  - Subtotal: $85/month

ElastiCache (cache.t3.small)
  - $30/month

OpenSearch (t3.small.search)
  - $40/month

DynamoDB
  - Same usage, better patterns
  - $80-150/month (20% reduction from efficiency)

S3 + CloudFront
  - Same
  - $50-100/month

SNS/SQS
  - Event messaging
  - $5-10/month

Total: $290-425/month
```

**Cost Change:** +$90/month (+30%)
**Capacity Change:** +800% (8x concurrent executions)
**Cost Efficiency:** **6x better per request**

---

## Risk Mitigation Strategies

| Risk | Mitigation |
|------|------------|
| **Data consistency** | DynamoDB transactions, idempotency keys |
| **Service discovery** | API Gateway (managed), no custom discovery |
| **Distributed debugging** | X-Ray tracing, correlation IDs |
| **Cache invalidation** | Event-driven cache clearing via SNS |
| **Deployment failures** | Canary deployments (5% → 50% → 100%) |
| **Rollback complexity** | Feature flags (instant toggle) |

---

## Key Decisions & Trade-offs

### Decision 1: Lambda vs. ECS/Fargate
**Chosen:** Lambda
**Rationale:** Current scale (< 50k users) doesn't justify container overhead. Lambda provides:
- $0 cost at low traffic
- Auto-scaling without configuration
- No baseline infrastructure cost

**Revisit at:** 100k+ users or sustained high traffic

---

### Decision 2: DynamoDB vs. RDS
**Chosen:** Keep DynamoDB
**Rationale:** Already using DynamoDB effectively. Migration would add 6+ weeks with no performance benefit for current access patterns.

**Revisit if:** Complex joins become necessary (unlikely for social app)

---

### Decision 3: OpenSearch vs. Algolia
**Chosen:** OpenSearch (AWS)
**Rationale:**
- Lower cost ($40/month vs $100/month)
- Same AWS region (low latency)
- Full control over indexing

**Trade-off:** More setup time (1 week vs 1 day)

---

### Decision 4: Synchronous vs. Event-Driven
**Chosen:** Hybrid
- **Synchronous:** User-facing reads/writes (User, Feed, Post, Search)
- **Event-Driven:** Background tasks (Notifications, Moderation)

**Rationale:** Balance between simplicity and performance

---

## Success Metrics

### Performance Targets
- [x] Feed load (100 followers): < 1.5s (P95)
- [x] Feed load (500 followers): < 4s (P95)
- [x] Profile page: < 800ms (P95)
- [x] Search: < 200ms (P50)
- [x] Cold start: < 900ms (P50)

### Business Targets
- [x] User engagement: +15%
- [x] Session duration: +20%
- [x] Speed-related complaints: -80%

### Operational Targets
- [x] Deploy frequency: 2x (4/week)
- [x] MTTR: 5x faster (2 min)
- [x] Availability: 99.9% per service

---

## Recommended Next Steps

### This Week
1. **Review this plan** with engineering team
2. **Allocate resources:** 2 engineers × 50% capacity
3. **Set up tracking:** Create tickets for Weeks 1-4
4. **Approve budget:** ~$100/month additional AWS spend

### Week 1 (Infrastructure)
1. Create API Gateway with placeholder routes
2. Set up Lambda function shells (empty handlers)
3. Configure DynamoDB access policies per service
4. Set up X-Ray tracing
5. Create CI/CD pipeline template

### Week 2-3 (Feed Service - Highest ROI)
1. Extract feed generation logic
2. Set up ElastiCache Redis cluster
3. Implement parallel query pattern
4. Add Redis caching for follower lists
5. Deploy to staging
6. Run load tests
7. A/B test with 5% production traffic

### Alternative: Hybrid Approach
If 13 weeks feels too long:

**Extract only Feed Service + Search Service (4 weeks)**
- Gets 80% of performance benefit
- Lowest risk
- Keeps monolith for other features

---

## FAQ

**Q: Why not optimize the monolith instead?**
A: We could optimize queries, but fundamental limits remain:
- Single scaling dimension
- Cold start affects all endpoints
- 1,000 concurrent execution limit (shared)
- Can't right-size memory per endpoint

**Q: Can we do this faster?**
A: Yes, but with higher risk. "Hybrid approach" (Feed + Search only) takes 4 weeks and captures 80% of benefit.

**Q: What if we just cache everything?**
A: Caching helps (and we'll add it), but doesn't solve:
- Scaling limits (1,000 concurrent)
- Cold start times
- Deployment risk (single failure domain)

**Q: How do we handle rollback?**
A: Three mechanisms:
1. Canary deployments (5% → 50% → 100%)
2. Feature flags (instant toggle)
3. Keep monolith running during migration (dual-write)

**Q: What about data consistency?**
A: Use DynamoDB transactions for multi-table operations. Add idempotency keys to prevent duplicate events.

---

## Contact & Resources

**Full Plan:** [MICROSERVICES_MIGRATION_PLAN.md](./MICROSERVICES_MIGRATION_PLAN.md)
**Codebase:** `backend/index.js` (current monolith)
**Questions:** Contact engineering team lead

**Useful References:**
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [DynamoDB Transactions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transactions.html)
- [Strangler Fig Pattern](https://martinfowler.com/bliki/StranglerFigApplication.html)
- [API Gateway Lambda Integration](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-integrations.html)

---

**Last Updated:** December 7, 2025
**Document Version:** 1.0
**Status:** Draft - Pending Engineering Review
