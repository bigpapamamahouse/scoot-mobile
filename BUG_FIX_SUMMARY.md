# Critical Bug Fix: Profile Picture Upload Data Loss

## Bug Description
When uploading a new profile picture in the Settings page, the user's `fullName` and `handle` fields were being wiped out in DynamoDB.

## Root Cause
**File:** Lambda function handler
**Endpoint:** `POST /me/avatar`
**Lines:** Original lines ~245-248

### The Problem
The Lambda function was using `PutCommand` instead of `UpdateCommand`:

```javascript
// ❌ BUGGY CODE - Replaces entire item
await ddb.send(new PutCommand({
  TableName: USERS_TABLE,
  Item: { pk: `USER#${userId}`, avatarKey: key, userId },
}));
```

**Why this causes data loss:**
- `PutCommand` in DynamoDB **replaces the entire item** with the new data
- The new item only contained: `pk`, `avatarKey`, and `userId`
- All other fields (`fullName`, `handle`, etc.) were **destroyed**

## The Fix

Replace `PutCommand` with `UpdateCommand` to update only the avatar field:

```javascript
// ✅ FIXED CODE - Updates only avatarKey field
await ddb.send(new UpdateCommand({
  TableName: USERS_TABLE,
  Key: { pk: `USER#${userId}` },
  UpdateExpression: 'SET avatarKey = :key, userId = :uid',
  ExpressionAttributeValues: { ':key': key, ':uid': userId },
}));
```

**Why this fixes the bug:**
- `UpdateCommand` only modifies the specified fields
- All other user data (`fullName`, `handle`) is preserved
- This is the correct DynamoDB operation for partial updates

## Additional Fix
The same issue existed when updating the `HANDLE#` mapping row. Applied the same fix:

```javascript
// ✅ FIXED CODE for HANDLE mapping
if (u.Item?.handle) {
  await ddb.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { pk: `HANDLE#${u.Item.handle}` },
    UpdateExpression: 'SET avatarKey = :key, userId = :uid',
    ExpressionAttributeValues: { ':key': key, ':uid': userId },
  }));
}
```

## Files Modified
- `lambda-fixed.js` - Fixed Lambda function (lines ~470-490)

## Testing Recommendations
1. Upload a new profile picture through the Settings page
2. Verify that `fullName` and `handle` are preserved after upload
3. Check DynamoDB directly to confirm all user fields remain intact
4. Test edge cases:
   - User with no handle set
   - User with no fullName set
   - User updating avatar multiple times

## Impact
- **Severity:** Critical - Data loss bug
- **Affected Users:** All users who uploaded profile pictures
- **Data Recovery:** Users who lost data will need to re-enter their fullName

## Prevention
Always use `UpdateCommand` for partial updates in DynamoDB. Only use `PutCommand` when creating entirely new items or when you intentionally want to replace all data.
