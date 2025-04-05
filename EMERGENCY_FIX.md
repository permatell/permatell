# Emergency Fix: AO Testnet Connection Issues

## Problem

The application was experiencing connection issues with the AO testnet, causing constant 404 errors and excessive requests. This was affecting performance and potentially causing rate limiting issues.

Error messages observed:
```
POST /api/ao/?endpoint=%2Fdry-run%3Fprocess-id%3DgUp8l-EyEVG1wHkyjTY2PLX3kfNOttXdUTsQFgL8gfI 404 in 84ms
POST /api/ao/?endpoint=%2Fdry-run%3Fprocess-id%3DgUp8l-EyEVG1wHkyjTY2PLX3kfNOttXdUTsQFgL8gfI 404 in 82ms
...
```

Additionally, we observed CORS errors and rate limiting issues when trying to directly access the AO testnet:
```
Access to fetch at 'https://cu102.ao-testnet.xyz/dry-run?process-id=gUp8l-EyEVG1wHkyjTY2PLX3kfNOttXdUTsQFgL8gfI' (redirected from 'https://cu.ao-testnet.xyz/dry-run?process-id=gUp8l-EyEVG1wHkyjTY2PLX3kfNOttXdUTsQFgL8gfI') from origin 'http://localhost:3000' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.

POST https://cu102.ao-testnet.xyz/dry-run?process-id=gUp8l-EyEVG1wHkyjTY2PLX3kfNOttXdUTsQFgL8gfI net::ERR_FAILED 429 (Too Many Requests)
```

## Solution

We fixed the connection issues by:
1. Removing the offline mode functionality
2. Removing the unnecessary CORS proxy files and configuration
3. Drastically reducing the number of requests to the AO testnet
4. Improving the API route to implement caching and rate limiting

### Changes Made:

1. **Context Files Updates**:
   - Removed all references to `isOfflineMode` in the StoriesProcessContext.tsx file
   - Improved error handling to better handle network errors and rate limiting
   - Added better caching for API responses

2. **Removed Unnecessary Files**:
   - Removed `scripts/cors-proxy.js` - This was an unnecessary CORS proxy server
   - Removed `scripts/setup-cors-proxy.js` - This was a setup script for the CORS proxy
   - Removed `.env.local` with the `NEXT_PUBLIC_CORS_PROXY` environment variable

3. **Reduced API Requests**:
   - Updated `components/ui/loading-screen.tsx` to completely skip loading data during the loading screen
   - The loading screen now just shows a progress bar and redirects to the dashboard after 3 seconds
   - This prevents hundreds of unnecessary API requests during the initial loading phase

4. **Improved API Route**:
   - Updated `app/api/ao/route.js` to add caching and rate limiting
   - Implemented a 5-minute cache for API responses
   - Added rate limiting to prevent too many requests to the AO testnet
   - Added fallback to cached data when rate limits are hit

### Technical Details:

1. **Process IDs**:
   - The application uses different process IDs for different functionalities:
     - Stories: `gUp8l-EyEVG1wHkyjTY2PLX3kfNOttXdUTsQFgL8gfI`
     - Story Points: `UwYxEKXxEmbd9-sIJtSVgAPMj85QQC7ExMt1VeLxXsA`
     - User Profile: `il72h8w_dG4J6CPB-IdlBD8QCZsv0xdR3yHGH35gmPg`
     - AO Profile Integration: `cghQLblfE5PFF44Eb9zsQvxXtbn3zt9FmwWEh3gHWGA`
     - HOOD Minting: `N-cNO2ryesWjEdXrx4h19E0uewSCEmAsBmaXaP8f9Jg`

2. **Dashboard Optimization**:
   - The dashboard page already had optimizations to load data efficiently:
     ```typescript
     useEffect(() => {
       const loadInitialData = async () => {
         // Only load data if we don't already have it
         if (stories.length === 0 && !loading) {
           await getStories();
         }
         
         // Wait a bit before loading story points to avoid rate limiting
         setTimeout(() => {
           if (Object.keys(allUsersStoryPoints).length === 0) {
             getAllStoryPoints();
           }
         }, 2000); // 2 second delay
       };
       
       loadInitialData();
       
       // Set up a refresh interval (every 30 seconds)
       const refreshInterval = setInterval(() => {
         console.log("Refreshing data...");
         if (!loading) {
           getStories();
         }
       }, 30000); // 30 seconds
       
       return () => clearInterval(refreshInterval);
     }, []);
     ```

3. **Loading Screen Improvement**:
   - Completely removed data loading from the loading screen:
     ```typescript
     useEffect(() => {
       // Don't load any data during the loading screen
       // Just show a progress bar and redirect to dashboard
       
       // Set a maximum loading time of 3 seconds
       const maxLoadingTimeout = setTimeout(() => {
         console.log("Loading time complete, proceeding to dashboard");
         setProgress(100);
         setIsLoading(false);
       }, 3000);

       return () => clearTimeout(maxLoadingTimeout);
     }, []);
     ```

4. **API Route Improvements**:
   - Added caching to reduce the number of requests to the AO testnet:
     ```javascript
     // Simple in-memory cache
     const cache = new Map();
     const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
     ```
   - Added rate limiting to prevent too many requests:
     ```javascript
     // Rate limiting
     const requestCounts = new Map();
     const RATE_LIMIT = 10; // requests per minute
     const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
     ```
   - Added fallback to cached data when rate limits are hit:
     ```javascript
     // If we have cached data, return it even if expired
     if (cache.has(cacheKey)) {
       console.log(`Using expired cache due to rate limiting for ${url}`);
       return cache.get(cacheKey).data;
     }
     ```

## Benefits

1. **Improved Performance**: The application no longer makes excessive requests to the AO testnet.
2. **Better User Experience**: Users will experience fewer errors and faster response times.
3. **More Reliable**: By removing the offline mode, the application will always attempt to connect to the AO testnet, providing a more consistent experience.
4. **Simplified Architecture**: By removing the CORS proxy server and related files, we've simplified the application architecture.
5. **Reduced Rate Limiting**: By eliminating unnecessary requests and implementing caching and rate limiting, we've reduced the likelihood of hitting rate limits.

## Future Considerations

1. **Monitoring**: Add monitoring to track API usage and performance.
2. **Error Recovery**: Enhance error recovery mechanisms to gracefully handle AO testnet outages.
3. **Distributed Caching**: Consider implementing a distributed caching solution for multi-server deployments.
4. **Advanced Rate Limiting**: Implement more advanced rate limiting strategies based on user behavior.

## Additional Fixes

### Process ID Mismatch Fix

We discovered a critical issue where both the StoriesProcessContext and StoryPointsProcessContext were using the same process ID:

```javascript
const PROCESS_ID = "gUp8l-EyEVG1wHkyjTY2PLX3kfNOttXdUTsQFgL8gfI";
```

However, according to the ao-process-api.js file, this ID should only be used for the STORIES process. The STORY_POINTS process should use a different ID:

```javascript
const PROCESS_IDS = {
  STORIES: "gUp8l-EyEVG1wHkyjTY2PLX3kfNOttXdUTsQFgL8gfI", // Main stories process
  STORY_POINTS: "UwYxEKXxEmbd9-sIJtSVgAPMj85QQC7ExMt1VeLxXsA", // Story points process
  USER_PROFILE: "il72h8w_dG4J6CPB-IdlBD8QCZsv0xdR3yHGH35gmPg", // User profile process
  AO_PROFILE_INTEGRATION: "cghQLblfE5PFF44Eb9zsQvxXtbn3zt9FmwWEh3gHWGA", // AO profile integration process
  HOOD_MINTING: "N-cNO2ryesWjEdXrx4h19E0uewSCEmAsBmaXaP8f9Jg", // $HOOD minting process
};
```

This was causing both contexts to send requests to the same process ID, which was likely causing the rate limiting issues and CORS errors. We fixed this by updating the StoryPointsProcessContext.tsx file to use the correct process ID:

```javascript
const PROCESS_ID = "UwYxEKXxEmbd9-sIJtSVgAPMj85QQC7ExMt1VeLxXsA";
```

This fix should significantly reduce the number of requests to the STORIES process and distribute the load between the correct processes.

### Token Balance Retry Mechanism

We added a retry mechanism to the useTokenGating.ts hook to handle cases where the token balance check fails. This should help with the issue where the $HOOD token balance doesn't show up initially after connecting a wallet.

The retry mechanism will:
1. Attempt to check the token balance up to 3 times
2. Wait 2 seconds between each attempt
3. Periodically refresh the token balance every 30 seconds, but only if the balance is zero or there was an error

This should ensure that the token balance is eventually displayed correctly, even if there are temporary network issues or rate limiting problems.

### Stories Process Retry Mechanism

We've also added a retry mechanism to the StoriesProcessContext.tsx file to handle cases where the dryrun function fails. This should help with the issue where stories are not being created or loaded correctly.

The retry mechanism will:
1. Attempt to run the dryrun function up to 3 times
2. Use exponential backoff with jitter to wait between attempts (1-8 seconds)
3. Return a fallback empty result if all retries fail

This should ensure that the stories are eventually loaded correctly, even if there are temporary network issues or rate limiting problems.

### Reduced Dashboard Refresh Frequency

We've reduced the frequency of the dashboard refresh interval from 30 seconds to 2 minutes, and added a check to avoid refreshing if it's been less than 2 minutes since the last refresh. This significantly reduces the number of API calls made to the AO testnet.

```javascript
// Set up a refresh interval (every 2 minutes)
const refreshInterval = setInterval(() => {
  console.log("Refreshing data...");
  if (!loading) {
    // Use a timestamp to avoid refreshing too frequently
    const lastRefresh = localStorage.getItem('lastStoriesRefresh');
    const now = Date.now();
    
    // Only refresh if it's been more than 2 minutes since the last refresh
    if (!lastRefresh || now - parseInt(lastRefresh) > 120000) {
      console.log("Refreshing stories data...");
      getStories();
      localStorage.setItem('lastStoriesRefresh', now.toString());
    } else {
      console.log("Skipping refresh, last refresh was too recent");
    }
  }
}, 120000); // 2 minutes
```

### Optimized Story Points Fetching

We've also optimized the story points fetching in the StoriesProcessContext.tsx file to avoid unnecessary API calls. Previously, the hook was fetching story points every time the stories were fetched. Now it only fetches story points once per session:

```javascript
// Only call getUserStoryPoints once per session, not on every request
// And only if we don't already have story points data
if (address && tags[0]?.value === "GetStories" && !resultCache.has("getUserStoryPoints-" + address)) {
  getUserStoryPoints(address);
  // Mark that we've called getUserStoryPoints for this address
  resultCache.set("getUserStoryPoints-" + address, true);
}
```

This change significantly reduces the number of API calls made to the AO testnet, which helps prevent rate limiting issues and improves overall performance.
