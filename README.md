# PermaTell

A decentralized storytelling platform built on AO and Arweave.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Features

- Decentralized story creation and management
- User profiles with AO Profile integration
- Story points and rewards system
- $HOOD token integration for premium features
- Collaborative storytelling with version history

## Getting Started

### Prerequisites

- Node.js 18.0 or later
- AO CLI installed (`npm install -g @permaweb/ao`)
- Arweave wallet

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/permatell.git
cd permatell
```

2. Install dependencies:

```bash
npm install
# or
yarn
```

3. Set up the CORS proxy (optional):

The application can run in two modes:
- **With CORS proxy**: For full functionality with the AO testnet
- **Without CORS proxy**: Using offline mode with limited functionality

To run with the CORS proxy:

```bash
# Start the CORS proxy in a separate terminal
node scripts/cors-proxy.js
```

4. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Offline Mode

PermaTell includes an offline mode that allows the application to function even when the AO testnet or CORS proxy is unavailable. This mode provides:

- Automatic detection of connection issues
- Graceful fallbacks to cached data
- Visual indicator when in offline mode
- Continued functionality with limited features

For more details, see the [OFFLINE_MODE_SOLUTION.md](OFFLINE_MODE_SOLUTION.md) file.

## Deployment

For deploying the application to production, see the [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) file which explains how to handle CORS in a production environment.

## AO Process Deployment

For deploying the AO processes, see the [DEPLOYMENT.md](processes/DEPLOYMENT.md) file in the processes directory.

## AO Profile Integration

PermaTell supports two methods for integrating with AO Profiles:

### Method 1: Using the @permaweb/aoprofile SDK directly (Recommended)

This method allows you to interact with AO Profiles directly from your frontend without requiring a separate process.

1. Install the @permaweb/aoprofile package:

```bash
# Run the installation script
./scripts/install-aoprofile.sh
```

2. Use the provided hooks and components:

```jsx
// Import the hook
import { useAOProfile } from '@/hooks/useAOProfile';

// Use the hook in your component
function MyComponent() {
  const { profile, createProfile, updateProfile } = useAOProfile();
  
  // ...
}
```

3. Check out the example implementation:
   - `hooks/useAOProfile.ts`: A custom hook for interacting with AO profiles
   - `components/ui/profile-manager.tsx`: A component for managing AO profiles
   - `app/profile/page.tsx`: A page demonstrating the AO profile integration

### Method 2: Using the ao-profile-integration.lua process

This method uses a separate AO process to handle profile integration.

1. Deploy the ao-profile-integration.lua process as described in [DEPLOYMENT.md](processes/DEPLOYMENT.md).
2. Use the functions provided in `lib/ao-process-api.js` to interact with the process.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
