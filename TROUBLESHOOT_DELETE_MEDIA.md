# Troubleshooting DELETE /media 404 Error

## Quick Checklist

### 1. ✅ Backend Deployed?
The Lambda function must have the updated `backend/index.js` code.

**Verify in AWS Console:**
1. Go to Lambda Console
2. Open your function
3. Check the code includes the DELETE /media endpoint (around line 2457)
4. Look for: `if (method === 'DELETE' && path.startsWith('/media/'))`

### 2. ✅ API Gateway Method Enabled?

API Gateway must allow DELETE requests for the /media/* path.

**For REST API:**
1. Go to API Gateway Console
2. Find your API
3. Look for the `/media/{proxy+}` or `/{proxy+}` resource
4. Verify "DELETE" method exists
5. If not, create it:
   - Click "Actions" → "Create Method" → "DELETE"
   - Integration type: Lambda Function
   - Select your Lambda function
   - Deploy to your stage (e.g., "prod")

**For HTTP API:**
1. Go to API Gateway Console (HTTP APIs section)
2. Find your API
3. Click "Routes"
4. Verify you have a catch-all route like: `DELETE /{proxy+}` or `ANY /{proxy+}`
5. If using `ANY`, it should already work
6. If not, add the DELETE route

### 3. ✅ CORS Configured?

If using a REST API, CORS must allow DELETE:

```json
{
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Origin": "*"
}
```

### 4. ✅ Test the Endpoint Directly

Use the test script:
```bash
# Edit test-delete-endpoint.sh with your values
./test-delete-endpoint.sh
```

Expected responses:
- **200**: Success (or 403 if key doesn't belong to user)
- **401**: Not authenticated
- **404**: Endpoint not configured or not deployed

## Common Issues

### Issue: "404 Not Found"
**Cause**: Endpoint not deployed or API Gateway not configured
**Fix**:
1. Deploy Lambda code
2. Add DELETE method to API Gateway
3. Deploy API Gateway stage

### Issue: "403 Forbidden"
**Cause**: User doesn't own the S3 key
**Fix**: Key must start with `u/{userId}/` or `a/{userId}/`

### Issue: "401 Unauthorized"
**Cause**: Missing or invalid auth token
**Fix**: Check Authorization header contains valid Bearer token

## Verification Steps

1. **Check Lambda Logs** (CloudWatch):
   ```
   Look for: [DELETE /media] logs
   If missing: Lambda not receiving requests
   If present: Check what error is logged
   ```

2. **Check API Gateway Logs**:
   ```
   Enable execution logging in API Gateway
   Check if DELETE requests reach the API
   ```

3. **Check Network Tab** (in app):
   ```
   - What URL is being called?
   - What method is being used?
   - What's the response status?
   - Are headers correct?
   ```

## Quick Fix

If you're in a hurry, you can temporarily disable cleanup:

```typescript
// In ComposePostScreen.tsx - comment out cleanup
/*
React.useEffect(() => {
  return () => {
    if (imageKey && !posted) {
      deleteMedia(imageKey)...
    }
  };
}, [imageKey, posted]);
*/
```

But remember: **This will cause orphaned S3 uploads!**
