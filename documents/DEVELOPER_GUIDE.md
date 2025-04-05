# PermaTell Developer Guide

This document provides an overview of the PermaTell application architecture, TypeScript usage, and guidelines for adding new features.

## Table of Contents

1. [Application Overview](#application-overview)
2. [TypeScript Basics](#typescript-basics)
3. [Project Structure](#project-structure)
4. [AO Integration](#ao-integration)
5. [Key Components and Hooks](#key-components-and-hooks)
6. [Adding New Features](#adding-new-features)
7. [Deployment Process](#deployment-process)

## Application Overview

PermaTell is a decentralized storytelling platform built on AO and Arweave. It allows users to create, share, and collaborate on stories, while earning $HOOD tokens for their contributions. The application uses:

- **Next.js**: React framework providing server-side rendering and routing
- **TypeScript**: Strongly typed JavaScript for safer code
- **AO**: For decentralized processes and token functionality
- **Tailwind CSS**: For styling components

The application connects to several AO processes for different functionalities:
- User profiles
- Story management
- Token management ($HOOD)
- Story points and rewards

## TypeScript Basics

TypeScript extends JavaScript by adding static type definitions. Here's a quick primer:

### 1. Basic Type Annotations

```typescript
// Basic types
let userName: string = "John";
let tokenCount: number = 5;
let isVerified: boolean = true;

// Arrays
let storyIds: string[] = ["story1", "story2"];
let pointValues: Array<number> = [10, 20, 30];

// Objects
let user: { address: string; points: number } = {
  address: "abc123",
  points: 100
};

// Functions with type annotations
function calculateRewards(points: number, multiplier: number = 1): number {
  return points * multiplier;
}
```

### 2. Interfaces (Define Object Shapes)

```typescript
// Define an interface for a Story
interface Story {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: number;
  isPublic: boolean;
  tags?: string[]; // ? means optional
}

// Use the interface
const myStory: Story = {
  id: "story1",
  title: "My First Story",
  content: "Once upon a time...",
  author: "user123",
  createdAt: Date.now(),
  isPublic: true
};
```

### 3. Type Aliases

```typescript
// Define a type alias for token amounts
type TokenAmount = string; // Using string for big integers
type StoryId = string;

// Use the types
let balance: TokenAmount = "1000000";
let currentStory: StoryId = "story_abc123";
```

### 4. React with TypeScript

```typescript
// Function component with props interface
interface ButtonProps {
  text: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ 
  text, 
  onClick, 
  disabled = false,
  className = ""
}) => {
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={className}
    >
      {text}
    </button>
  );
};
```

### 5. React Hooks with TypeScript

```typescript
// useState with type
const [count, setCount] = useState<number>(0);

// Custom hook with TypeScript
function useTokenBalance(address: string) {
  const [balance, setBalance] = useState<string>("0");
  const [loading, setLoading] = useState<boolean>(true);
  
  useEffect(() => {
    // Fetch token balance logic here
  }, [address]);
  
  return { balance, loading };
}
```

## Project Structure

The PermaTell project follows a standard Next.js structure with additional organization for AO processes:

```
permatell/
├── app/                  # Next.js app router
│   ├── api/              # API routes
│   │   └── ao/           # AO-related API endpoints
│   ├── dashboard/        # Dashboard page
│   ├── mint/             # Mint page
│   ├── profile/          # Profile page
│   └── story/            # Story pages
├── components/           # React components
│   └── ui/               # UI components
├── contexts/             # React contexts
├── hooks/                # Custom React hooks
├── interfaces/           # TypeScript interfaces
├── lib/                  # Utility libraries
├── processes/            # AO processes (Lua)
├── public/               # Static assets
├── scripts/              # Build/deployment scripts
├── types/                # TypeScript types
└── documents/            # Documentation
```

## AO Integration

The application interacts with AO processes through the `ao-process-api.js` file, which provides a clean API for all AO-related operations.

### AO Process IDs

Process IDs are stored in a central object and can be initialized at app startup:

```typescript
// From lib/ao-process-api.js
const PROCESS_IDS = {
  STORIES: "gUp8l-EyEVG1wHkyjTY2PLX3kfNOttXdUTsQFgL8gfI",
  STORY_POINTS: "UwYxEKXxEmbd9-sIJtSVgAPMj85QQC7ExMt1VeLxXsA",
  USER_PROFILE: "il72h8w_dG4J6CPB-IdlBD8QCZsv0xdR3yHGH35gmPg",
  AO_PROFILE_INTEGRATION: "cghQLblfE5PFF44Eb9zsQvxXtbn3zt9FmwWEh3gHWGA",
  HOOD_MINTING: "N-cNO2ryesWjEdXrx4h19E0uewSCEmAsBmaXaP8f9Jg",
};

export function initializeApi(processIds) {
  // Update process IDs if provided
}
```

### CORS Handling

Since the browser cannot directly communicate with AO due to CORS restrictions, we implemented proxy API routes:

1. `/api/ao/route.js` - General AO process proxy
2. `/api/ao/token-balance/route.js` - Token balance checking
3. `/api/ao/verify-nft-ownership/route.js` - NFT ownership verification

These routes handle the communication with AO processes server-side, avoiding CORS issues.

### Process Communication Pattern

```typescript
// Client-side request
const result = await getHoodAllocation(address);

// Function in ao-process-api.js
export async function getHoodAllocation(address) {
  return sendMessage(PROCESS_IDS.HOOD_MINTING, {
    Action: "GetAllocation",
    address: address
  });
}

// sendMessage helper (simplified)
async function sendMessage(processId, message) {
  // Create tags from message
  const tags = [{ name: "Action", value: message.Action }];
  
  // Send message to AO process
  const result = await ao.message({
    process: processId,
    tags,
    data: message
  });
  
  return result;
}
```

## Key Components and Hooks

### React Contexts

1. **WalletContext** (`contexts/WalletContext.tsx`)
   - Manages wallet connection and address state
   - Provides address and connection functions to all components

2. **StoriesProcessContext** (`contexts/StoriesProcessContext.tsx`) 
   - Manages the Stories process state
   - Provides functions for story operations

3. **StoryPointsProcessContext** (`contexts/StoryPointsProcessContext.tsx`)
   - Manages the Story Points process state
   - Provides functions for points and rewards

### Custom Hooks

1. **useTokenGating** (`hooks/useTokenGating.ts`)
   - Checks if a user owns sufficient $HOOD tokens
   - Provides `isAuthorized`, `loading`, and `error` states

2. **useAOProfile** (`hooks/useAOProfile.ts`)
   - Manages integration with AO Profiles
   - Provides profile data and operations

3. **useGoddessesNFT** (`hooks/useGoddessesNFT.ts`)
   - Verifies ownership of Goddesses NFTs
   - Provides verification status and NFT count

### UI Components

The UI components are organized in the `components/ui/` directory. Key components include:

1. **MintAllocation** (`components/ui/mint-allocation.tsx`)
   - Allows users to allocate AO yield to mint $HOOD tokens

2. **GoddessesVerification** (`components/ui/goddesses-verification.tsx`)
   - Verifies and displays Goddesses NFT ownership

3. **WalletStatus** (`components/ui/wallet-status.tsx`)
   - Shows wallet connection status and $HOOD balance

## Adding New Features

### 1. Extending an AO Process

To add a new feature to an AO process:

1. **Modify the Lua process**:

```lua
-- Example: Adding a new handler to hood-minting.lua
Handlers.add("new_feature",
  Handlers.utils.hasMatchingTag("Action", "NewFeature"),
  function(msg)
    -- Implementation
    local response = { Data = "Feature processed successfully" }
    if msg.reply then
      msg.reply(response)
    else
      ao.send({ Target = msg.From, Data = "Feature processed successfully" })
    end
  end
)
```

2. **Add API function to `ao-process-api.js`**:

```javascript
export async function useNewFeature(param1, param2) {
  return sendMessage(PROCESS_IDS.HOOD_MINTING, {
    Action: "NewFeature",
    param1: param1,
    param2: param2
  });
}
```

3. **Create a proxy API route if needed**:

```javascript
// app/api/ao/new-feature/route.js
export async function POST(request) {
  try {
    const data = await request.json();
    // Process data and call AO
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### 2. Creating a New UI Component

1. **Create a TypeScript interface for props**:

```typescript
// components/ui/new-feature.tsx
interface NewFeatureProps {
  param1: string;
  param2?: number; // Optional parameter
  onAction: (result: any) => void;
  className?: string;
}
```

2. **Implement the component**:

```typescript
export const NewFeature: React.FC<NewFeatureProps> = ({ 
  param1, 
  param2 = 0, 
  onAction, 
  className = "" 
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleAction = async () => {
    setLoading(true);
    try {
      const result = await useNewFeature(param1, param2);
      onAction(result);
    } catch (err) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className={`bg-black/40 backdrop-blur-md p-4 ${className}`}>
      {/* Component UI */}
      <button onClick={handleAction} disabled={loading}>
        {loading ? "Processing..." : "Execute Action"}
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
};
```

3. **Create a custom hook if needed**:

```typescript
// hooks/useNewFeature.ts
export const useNewFeature = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const executeFeature = async (param1: string, param2: number) => {
    setLoading(true);
    try {
      // Call API
      const result = await fetch('/api/ao/new-feature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ param1, param2 })
      });
      
      if (!result.ok) {
        throw new Error(`HTTP error! Status: ${result.status}`);
      }
      
      const data = await result.json();
      setData(data);
      return data;
    } catch (err) {
      setError(err.message || "Unknown error");
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  return { data, loading, error, executeFeature };
};
```

### 3. Adding a New Page

1. **Create a new page in the app directory**:

```typescript
// app/new-feature/page.tsx
"use client";

import { PageHeader } from "@/components/ui/page-header";
import { NewFeature } from "@/components/ui/new-feature";
import { useWallet } from "@/contexts/WalletContext";
import { useState } from "react";

export default function NewFeaturePage() {
  const { address } = useWallet();
  const [result, setResult] = useState<any>(null);
  
  const handleFeatureAction = (actionResult: any) => {
    setResult(actionResult);
  };
  
  return (
    <div className="container mx-auto py-6 px-4">
      <PageHeader title="New Feature">
        {/* Page header content */}
      </PageHeader>
      
      <div className="max-w-3xl mx-auto mt-6">
        {address ? (
          <NewFeature
            param1="example"
            param2={42}
            onAction={handleFeatureAction}
            className="w-full mb-6"
          />
        ) : (
          <p>Please connect your wallet to use this feature.</p>
        )}
        
        {result && (
          <div className="mt-4">
            <h3>Result:</h3>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
```

## Deployment Process

### 1. AO Process Deployment

AO processes must be deployed to the AO network. This is done using the AO CLI:

```bash
# Deploy a process
ao process deploy \
  --process-src=./processes/your-process.lua \
  --init-message='{"Action": "Initialize"}' \
  --tags='{"Name": "your-process", "App": "PermaTell", "Version": "0.0.1"}'
```

### 2. Frontend Deployment

The frontend is deployed using standard Next.js deployment methods:

```bash
# Build the application
npm run build

# Deploy to hosting service
# This depends on your hosting provider (Vercel, Netlify, etc.)
```

### 3. Environment Configuration

Ensure that your `.env` file or hosting environment variables are properly configured:

```
# Example .env.production
NEXT_PUBLIC_AO_STORIES_PROCESS=process-id-here
NEXT_PUBLIC_AO_STORY_POINTS_PROCESS=process-id-here
NEXT_PUBLIC_AO_USER_PROFILE_PROCESS=process-id-here
NEXT_PUBLIC_AO_HOOD_MINTING_PROCESS=process-id-here
```

## Common Patterns and Best Practices

1. **Use TypeScript interfaces for all component props**:
   ```typescript
   interface MyComponentProps {
     // Define props here
   }
   ```

2. **Separate business logic into custom hooks**:
   ```typescript
   // Instead of putting logic in components
   function useMyFeature() {
     // Logic here
     return { data, loading, error, actions };
   }
   ```

3. **Handle loading and error states consistently**:
   ```typescript
   // In components
   {loading && <Spinner />}
   {error && <ErrorMessage error={error} />}
   {!loading && !error && data && <Content data={data} />}
   ```

4. **Use contexts for application-wide state**:
   ```typescript
   // Create a context
   const MyContext = createContext<MyContextType | undefined>(undefined);
   
   // Use a hook to access it
   function useMyContext() {
     const context = useContext(MyContext);
     if (context === undefined) {
       throw new Error("useMyContext must be used within a MyProvider");
     }
     return context;
   }
   ```

5. **Create proxy API routes for external API calls**:
   - Avoid CORS issues
   - Keep API keys server-side
   - Simplify error handling

6. **Test your components and hooks**:
   - Use Jest and React Testing Library
   - Test loading, error, and success states
   - Mock API calls

By following these patterns and understanding the architecture, you can efficiently add features to the PermaTell application.
