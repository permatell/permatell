# Enhanced AO Process Smart Contracts

This directory contains the enhanced AO Process smart contracts for the Permatell dapp. The changes make the dapp more flexible, provide more functionality for $HOOD token holders, and implement per-user processes for better storage and decentralization.

## Overview of Changes

### 1. Decentralized Architecture

The system now supports a decentralized architecture where each user has their own story process with 4GB of RAM. This allows for:

- Better storage capacity (4GB per user instead of 4GB shared)
- More decentralization (users control their own data)
- Better scalability (load is distributed across multiple processes)

### 2. $HOOD Token Integration

$HOOD token holders now receive special benefits:

- 2x story points for all actions
- 20% reduction in reward threshold requirements
- Increased storage capacity (100 stories vs 10 for standard users)
- Access to premium features

### 3. AO Profile Integration

Users can now link their AO profiles to the application using the @permaweb/aoprofile SDK. This allows for:

- Consistent identity across AO applications
- Profile information sharing
- Better user experience

## Smart Contracts

### stories.lua

The main stories process that serves as a registry and router for user story processes. It maintains backward compatibility with the old API while supporting the new decentralized architecture. This process is responsible for managing the creation, retrieval, and updating of stories across the platform.

### user-story-process.lua

A process that is spawned for each user to store their stories. Each process has 4GB of RAM and is controlled by the user.

### user-profile.lua

Manages user profiles, links to AO profiles, and tracks user's stories. It also provides special features for $HOOD token holders.

### story-points.lua

Manages user points and rewards. It now supports $HOOD token integration and provides additional benefits for token holders. This process tracks user engagement, awards points for various activities, and handles the redemption of rewards based on accumulated points.

### ao-profile-integration.lua

Handles integration with the @permaweb/aoprofile SDK, allowing users to link their AO profiles to the application.

### hood-minting.lua

Manages the minting of $HOOD tokens by allowing users to allocate a percentage of their AO yield. This process implements a similar mechanism to the APUS minting process, where users can choose what percentage of their AO yield they want to allocate to mint $HOOD tokens.

## JavaScript API

A JavaScript API is provided in `lib/ao-process-api.js` to make it easy for the frontend to interact with the AO processes.

## Usage

### Initialization

Before using the system, you need to initialize the processes with the correct addresses:

1. Deploy the user-profile.lua process
2. Deploy the ao-profile-integration.lua process
3. Deploy the hood-minting.lua process
4. Deploy the user-story-process.lua as a module (not a process)
5. Update the stories.lua process with the addresses of the user-profile process and the user-story-process module
6. Update the story-points.lua process with the address of the user-profile process
7. Update the hood-minting.lua process with the address of the user-profile process

### Creating a User Profile

```javascript
import { createUserProfile } from '../lib/ao-process-api';

// Create a user profile
const result = await createUserProfile({
  displayName: 'John Doe',
  hoodTokenBalance: 100 // Set to 0 if not a $HOOD token holder
});
```

### Creating a Story

```javascript
import { createStory } from '../lib/ao-process-api';

// Create a story
const result = await createStory({
  title: 'My Story',
  content: 'Once upon a time...',
  coverImage: 'https://example.com/image.jpg',
  category: 'fiction',
  isPublic: true,
  tags: ['fantasy', 'adventure'],
  metadata: { language: 'en' }
});
```

### Linking an AO Profile

```javascript
import { createAOProfile, linkAOProfile } from '../lib/ao-process-api';

// Create an AO profile
const createResult = await createAOProfile({
  username: 'johndoe',
  displayName: 'John Doe',
  description: 'I am a writer',
  thumbnail: 'https://example.com/thumbnail.jpg',
  banner: 'https://example.com/banner.jpg'
});

// Or link an existing AO profile
const linkResult = await linkAOProfile('existing-profile-id');
```

### Getting User Benefits

```javascript
import { getUserBenefits } from '../lib/ao-process-api';

// Get user benefits
const benefits = await getUserBenefits('user-address');
```

### Claiming Rewards

```javascript
import { claimReward } from '../lib/ao-process-api';

// Claim a reward
const result = await claimReward('BASIC');
```

### Minting $HOOD Tokens

```javascript
import { updateHoodAllocation, getHoodAllocation } from '../lib/ao-process-api';

// Allocate 25% of AO yield to mint $HOOD tokens
const updateResult = await updateHoodAllocation(25);

// Get current allocation and predicted tokens
const allocationResult = await getHoodAllocation();
```

## Backward Compatibility

The system maintains backward compatibility with the old API. Existing stories will continue to work, and new stories will be created in the user's personal story process.

## Migration

To migrate existing stories to the new system, you can use the following steps:

1. Get all stories from the old system
2. For each story, create a new story in the user's personal story process
3. Copy all versions and metadata

This migration can be done gradually, as the old system will continue to work alongside the new system.
