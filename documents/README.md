# $HOOD Token Fair Launch Documentation

This folder contains the necessary documentation for the $HOOD token fair launch. These documents outline the token distribution, emission schedule, and community communications for the PermaTell ecosystem token.

## Contents

- **hood-token-breakdown.md** - Comprehensive breakdown of the $HOOD token, including supply, distribution, emission schedule, and benefits.
- **hood-twitter-thread.md** - Twitter thread announcement for the $HOOD fair launch.
- **hood-discord-announcement.md** - Discord announcement for the $HOOD fair launch.

## $HOOD Token Overview

- **Total Supply**: 21,000,000 $HOOD
- **Fair Launch Allocation**: 70% (14,700,000 $HOOD)
- **Community & Ecosystem Fund**: 20% (4,200,000 $HOOD)
  - **Goddesses NFT Holders**: 4% (840,000 $HOOD)
  - **Public Contributors**: 16% (3,360,000 $HOOD)
- **Platform Development Fund**: 10% (2,100,000 $HOOD)

## Token Contract Details

- **Token Contract ID**: Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE
- **Explorer**: [https://www.ao.link/#/token/Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE](https://www.ao.link/#/token/Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE)
- **DEX**: [https://botega.arweave.net/#/swap?from=xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10&to=Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE](https://botega.arweave.net/#/swap?from=xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10&to=Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE)

## Implementation

The $HOOD token distribution and minting mechanism is implemented in the hood-minting.lua process file. This process handles:

1. AO yield allocations from users
2. Token emission based on the defined schedule
3. Daily minting to participant wallets based on their allocation percentage

Frontend implementation for allocating AO yield is available in the mint-allocation.tsx component.

## Goddesses NFT Holder Benefits

The Goddesses NFT collection (ID: 1NOj1dFvK_ZdXrx8zYlQniXkC3eOUaO7pV8m2-2g1E0) on BazAR receives special benefits:

- Dedicated allocation of 840,000 $HOOD tokens (4% of total supply)
- Enhanced rewards for creating stories and contributing to the platform
- Verification process for connecting wallet and proving ownership
- Additional incentives for active participation in the ecosystem

Collection Link: [https://bazar.arweave.net/#/collection/1NOj1dFvK_ZdXrx8zYlQniXkC3eOUaO7pV8m2-2g1E0/assets/](https://bazar.arweave.net/#/collection/1NOj1dFvK_ZdXrx8zYlQniXkC3eOUaO7pV8m2-2g1E0/assets/)

## Token Benefits

$HOOD token holders receive special benefits on the PermaTell platform:

- 2x story points for all actions
- 20% reduction in reward threshold requirements
- Increased storage capacity (100 stories vs 10 for standard users)
- Access to premium features and future governance rights
