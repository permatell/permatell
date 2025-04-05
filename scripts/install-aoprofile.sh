#!/bin/bash

# Script to install the @permaweb/aoprofile package and its dependencies

echo "Installing @permaweb/aoprofile package..."

# Check if yarn.lock exists to determine if the project uses yarn or npm
if [ -f "yarn.lock" ]; then
  echo "Using yarn to install packages..."
  yarn add @permaweb/aoprofile
else
  echo "Using npm to install packages..."
  npm install @permaweb/aoprofile
fi

echo "Installation complete!"
echo ""
echo "IMPORTANT: After installing the package, you need to update the WalletContext.tsx file"
echo "to use the actual @permaweb/aoprofile SDK instead of the simulation mode."
echo ""
echo "To do this, open contexts/WalletContext.tsx and:"
echo "1. Uncomment the line: // AOProfile = require('@permaweb/aoprofile').default;"
echo "2. Remove or comment out the simulation mode code in the initSDK function"
echo "3. Uncomment the real implementation code that uses the SDK"
echo ""
echo "You can now use the @permaweb/aoprofile SDK directly in your frontend."
echo "Check out the example implementation in:"
echo "- hooks/useAOProfile.ts: A custom hook for interacting with AO profiles"
echo "- components/ui/profile-manager.tsx: A component for managing AO profiles"
echo "- app/profile/page.tsx: A page demonstrating the AO profile integration"
echo ""
echo "To use the SDK, you need to:"
echo "1. Import the useAOProfile hook: import { useAOProfile } from '@/hooks/useAOProfile';"
echo "2. Use the hook in your component: const { profile, createProfile, updateProfile } = useAOProfile();"
echo ""
echo "Note: The ao-profile-integration.lua process is now optional. You can use the SDK directly in your frontend."
