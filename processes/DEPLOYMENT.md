# PermaTell Processes Deployment Guide

This guide provides step-by-step instructions for deploying all PermaTell processes and integrating them with your infrastructure.

## Prerequisites

- AO CLI installed (`npm install -g @permaweb/ao`)
- Access to the wallet that will own the processes
- Understanding of the process dependencies (see deployment order below)

## Deployment Order

For proper functionality, processes should be deployed in the following order:

1. user-profile.lua
2. story-points.lua
3. stories.lua
4. hood-minting.lua

Note: The ao-profile-integration.lua process is optional if you're using the @permaweb/aoprofile SDK directly from your frontend. The SDK provides all the necessary functionality to interact with AO profiles without requiring a separate process.

This order ensures that dependent processes can be properly configured with the process IDs of their dependencies.

## Deployment Steps

### 1. Deploy the user-profile.lua Process

```bash
# Navigate to your project directory
cd /Users/perse/permatell

# Deploy the user-profile process
ao process deploy \
  --process-src=./processes/user-profile.lua \
  --init-message='{"Action": "Initialize"}' \
  --tags='{"Name": "user-profile", "App": "PermaTell", "Version": "0.0.1"}'
```

This will output a process ID. Save this as `USER_PROFILE_PROCESS_ID`.

### 2. (Optional) Deploy the ao-profile-integration.lua Process

This step is optional if you're using the @permaweb/aoprofile SDK directly from your frontend. The SDK provides all the necessary functionality to interact with AO profiles.

If you prefer to have a server-side interface for AO profiles, you can deploy the ao-profile-integration.lua process:

```bash
# Deploy the ao-profile-integration process
ao process deploy \
  --process-src=./processes/ao-profile-integration.lua \
  --init-message='{"Action": "Initialize"}' \
  --tags='{"Name": "ao-profile-integration", "App": "PermaTell", "Version": "0.0.1"}'
```

This will output a process ID. Save this as `AO_PROFILE_INTEGRATION_PROCESS_ID`.

#### Using the @permaweb/aoprofile SDK Directly

If you choose to use the SDK directly instead of deploying the ao-profile-integration.lua process, you can integrate it in your frontend code:

```javascript
// In your frontend code
import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import Arweave from 'arweave';
import AOProfile from '@permaweb/aoprofile';

// Initialize the SDK
const ao = connect();
const signer = createDataItemSigner(window.arweaveWallet);

const { 
  createProfile, 
  updateProfile, 
  getProfileById, 
  getProfileByWalletAddress, 
  getRegistryProfiles 
} = AOProfile.init({ ao, signer, arweave: Arweave.init({}) });

// Example: Create a profile
const profileId = await createProfile({
  userName: 'Username',
  displayName: 'Display Name',
  description: 'Description',
  thumbnail: 'Profile image data or Arweave txid',
  banner: 'Cover image data or Arweave txid',
});

// Example: Get a profile by ID
const profile = await getProfileById({ profileId });
```

### 3. Deploy the story-points.lua Process

```bash
# Deploy the story-points process
ao process deploy \
  --process-src=./processes/story-points.lua \
  --init-message='{"Action": "Initialize"}' \
  --tags='{"Name": "story-points", "App": "PermaTell", "Version": "0.0.1"}'
```

This will output a process ID. Save this as `STORY_POINTS_PROCESS_ID`.

#### 3.1 Configure the story-points Process

```bash
# Set the user profile process ID
ao message send \
  --process=STORY_POINTS_PROCESS_ID \
  --tags='{"Action": "SetUserProfileProcess"}' \
  --data='{"process_address": "USER_PROFILE_PROCESS_ID"}'
```

### 4. Deploy the stories.lua Process

```bash
# Deploy the stories process
ao process deploy \
  --process-src=./processes/stories.lua \
  --init-message='{"Action": "Initialize"}' \
  --tags='{"Name": "stories", "App": "PermaTell", "Version": "0.0.1"}'
```

This will output a process ID. Save this as `STORIES_PROCESS_ID`.

#### 4.1 Deploy the user-story-process.lua as a Module

```bash
# Deploy the user-story-process as a module
ao module create \
  --module-src=./processes/user-story-process.lua \
  --tags='{"Name": "user-story-process", "App": "PermaTell", "Version": "0.0.1"}'
```

This will output a module ID. Save this as `USER_STORY_PROCESS_MODULE_ID`.

#### 4.2 Configure the stories Process

```bash
# Set the user profile process ID
ao message send \
  --process=STORIES_PROCESS_ID \
  --tags='{"Action": "SetUserProfileProcess"}' \
  --data='{"process_address": "USER_PROFILE_PROCESS_ID"}'

# Set the user story process module ID
ao message send \
  --process=STORIES_PROCESS_ID \
  --tags='{"Action": "SetUserStoryProcessModule"}' \
  --data='{"module_address": "USER_STORY_PROCESS_MODULE_ID"}'
```

### 5. Deploy the hood-minting.lua Process

```bash
# Navigate to your project directory
cd /Users/perse/permatell

# Deploy the hood-minting process
ao process deploy \
  --process-src=./processes/hood-minting.lua \
  --init-message='{"Action": "Initialize"}' \
  --tags='{"Name": "hood-minting", "App": "PermaTell", "Version": "0.0.1"}'
```

This will output a process ID. Save this as `HOOD_MINTING_PROCESS_ID`.

#### 5.1 Configure the hood-minting Process

```bash
# Set the user profile process ID
ao message send \
  --process=HOOD_MINTING_PROCESS_ID \
  --tags='{"Action": "SetUserProfileProcess"}' \
  --data='{"process_address": "USER_PROFILE_PROCESS_ID"}'

# Set $HOOD Token Contract ID
ao message send \
  --process=HOOD_MINTING_PROCESS_ID \
  --tags='{"Action": "SetHoodTokenContract"}' \
  --data='{"contract_address": "Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE"}'

# (Optional) Set Minimum Allocation Percentage
ao message send \
  --process=HOOD_MINTING_PROCESS_ID \
  --tags='{"Action": "SetMinAllocationPercentage"}' \
  --data='{"percentage": 5}'
```

#### 5.2 Transfer Tokens to the Minting Process

```bash
# Transfer tokens to the minting process
ao message send \
  --process=Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE \
  --tags='{"Action": "Transfer"}' \
  --data='{"Recipient": "HOOD_MINTING_PROCESS_ID", "Quantity": "70000000"}'
```

Adjust the quantity based on your total token supply and desired allocation.

#### 5.3 Set Up Periodic Minting Using AO Cron

AO has built-in functionality to generate messages on a specified interval. This can be used to set up periodic minting without relying on external cron jobs:

```bash
# Set up the hood-minting process with a daily cron (24-hours)
aos HOOD_MINTING_PROCESS_ID --cron 24-hours
```

Then, in the AO console, start monitoring to activate the cron:

```bash
aos HOOD_MINTING_PROCESS_ID
> .monitor
```

Make sure the hood-minting.lua process includes a handler for cron messages:

```lua
-- In hood-minting.lua
Handlers.add(
  "CronMinting", 
  Handlers.utils.hasMatchingTag("Action", "Cron"), 
  function () 
    -- Trigger the minting process
    -- Distribute tokens to users based on their allocations
    -- Update balances
  end
)
```

This will automatically trigger the minting process every 24 hours without requiring any external scheduling systems.

### 6. Update User Profile Process with All Dependencies

After all processes are deployed, update the user-profile process with all the necessary process IDs:

```bash
# If you deployed the ao-profile-integration process, set its ID
if [ -n "$AO_PROFILE_INTEGRATION_PROCESS_ID" ]; then
  ao message send \
    --process=USER_PROFILE_PROCESS_ID \
    --tags='{"Action": "SetAOProfileIntegrationProcess"}' \
    --data='{"process_address": "AO_PROFILE_INTEGRATION_PROCESS_ID"}'
fi

# Set the story-points process ID
ao message send \
  --process=USER_PROFILE_PROCESS_ID \
  --tags='{"Action": "SetStoryPointsProcess"}' \
  --data='{"process_address": "STORY_POINTS_PROCESS_ID"}'

# Set the stories process ID
ao message send \
  --process=USER_PROFILE_PROCESS_ID \
  --tags='{"Action": "SetStoriesProcess"}' \
  --data='{"process_address": "STORIES_PROCESS_ID"}'

# Set the hood-minting process ID
ao message send \
  --process=USER_PROFILE_PROCESS_ID \
  --tags='{"Action": "SetHoodMintingProcess"}' \
  --data='{"process_address": "HOOD_MINTING_PROCESS_ID"}'
```

### 7. Update Frontend Configuration

Update your frontend configuration to include all process IDs:

```javascript
// In your initialization code (e.g., in _app.tsx or a similar entry point)
import { initializeApi } from '@/lib/ao-process-api';

initializeApi({
  USER_PROFILE: "USER_PROFILE_PROCESS_ID",
  // Include this only if you deployed the ao-profile-integration process
  // AO_PROFILE_INTEGRATION: "AO_PROFILE_INTEGRATION_PROCESS_ID",
  STORY_POINTS: "STORY_POINTS_PROCESS_ID",
  STORIES: "STORIES_PROCESS_ID",
  HOOD_MINTING: "HOOD_MINTING_PROCESS_ID",
  USER_STORY_PROCESS_MODULE: "USER_STORY_PROCESS_MODULE_ID"
});
```

## Verification Steps

After deployment, verify that everything is working correctly:

### 1. Verify the story-points Process

```bash
# Check that the story-points process is configured correctly
ao message send \
  --process=STORY_POINTS_PROCESS_ID \
  --tags='{"Action": "GetUserProfileProcess"}' \
  --data='{}'
```

### 2. Verify the stories Process

```bash
# Check that the stories process is configured correctly
ao message send \
  --process=STORIES_PROCESS_ID \
  --tags='{"Action": "GetUserProfileProcess"}' \
  --data='{}'

# Check that the user story process module is configured correctly
ao message send \
  --process=STORIES_PROCESS_ID \
  --tags='{"Action": "GetUserStoryProcessModule"}' \
  --data='{}'
```

### 3. Verify the hood-minting Process

```bash
# Check that the hood-minting process is deployed and configured
ao message send \
  --process=HOOD_MINTING_PROCESS_ID \
  --tags='{"Action": "GetAllAllocations"}' \
  --data='{}'

# Verify that the token transfer was successful
ao message send \
  --process=Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE \
  --tags='{"Action": "Balance"}' \
  --data='{"Target": "HOOD_MINTING_PROCESS_ID"}'

# Test the minting process by allocating some AO yield
ao message send \
  --process=HOOD_MINTING_PROCESS_ID \
  --tags='{"Action": "UpdateAllocation"}' \
  --data='{"percentage": 25}'

# Trigger a minting event
ao message send \
  --process=HOOD_MINTING_PROCESS_ID \
  --tags='{"Action": "TriggerMinting"}' \
  --data='{}'

# Check your balance
ao message send \
  --process=Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE \
  --tags='{"Action": "Balance"}' \
  --data='{"Target": "YOUR_WALLET_ADDRESS"}'
```

## Troubleshooting

### Process Not Responding

If a process is not responding, check that it was deployed correctly:

```bash
ao process get --process=PROCESS_ID
```

### Token Transfer Failed

If the token transfer failed, check that you have the correct permissions:

```bash
ao message send \
  --process=Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE \
  --tags='{"Action": "Owner"}' \
  --data='{}'
```

### Minting Not Working

If minting is not working, check that the process is configured correctly:

```bash
ao message send \
  --process=HOOD_MINTING_PROCESS_ID \
  --tags='{"Action": "GetAllocation"}' \
  --data='{"address": "YOUR_WALLET_ADDRESS"}'
```

## AO/Arweave Fair Launch Model

The AO/Arweave Fair Launch model is designed to ensure a fair distribution of tokens without pre-mines or unfair advantages. Here's how the $HOOD token follows this model:

1. **Token Distribution**:
   - 70% allocated to the minting process (users allocate AO yield to mint $HOOD)
   - 15% allocated to the community (early adopters, contributors, etc.)
   - 15% allocated to the team (with optional vesting)

2. **No Pre-mine**: The majority of tokens are minted through the fair launch process, not pre-mined.

3. **Transparent Allocation**: All allocations are transparent and can be verified on-chain.

4. **Equal Access**: Anyone with AO yield can participate in the minting process.

5. **No VCs**: The project is funded through the fair launch model, not venture capital.

By following this model, $HOOD ensures a fair and transparent distribution of tokens, aligning incentives between users, the community, and the team.
