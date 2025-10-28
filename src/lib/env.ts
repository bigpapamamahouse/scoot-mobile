
const rawEnv = {
  EXPO_PUBLIC_API_URL: "https://xb7l24zhn0.execute-api.us-east-1.amazonaws.com/prod",
  EXPO_PUBLIC_USER_POOL_ID: "us-east-1_XV8NWV6Qi",
  EXPO_PUBLIC_USER_POOL_CLIENT_ID: "e9l2smd2r9amitgt846in4eno",
  EXPO_PUBLIC_MEDIA_BASE_URL: "d1ixzryozy81x4.cloudfront.net",
  REGION: "us-east-1"
} as const;

// Export with both the EXPO_PUBLIC_ prefixed names and convenient aliases
export const ENV = {
  ...rawEnv,
  // Convenient aliases
  API_URL: rawEnv.EXPO_PUBLIC_API_URL,
  USER_POOL_ID: rawEnv.EXPO_PUBLIC_USER_POOL_ID,
  USER_POOL_CLIENT_ID: rawEnv.EXPO_PUBLIC_USER_POOL_CLIENT_ID,
  MEDIA_BASE: rawEnv.EXPO_PUBLIC_MEDIA_BASE_URL,
} as const;
