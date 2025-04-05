'use client';

import React from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { ProfileManager } from '@/components/ui/profile-manager';
import { ProcessStatusIndicator } from '@/components/ui/process-status-indicator';
import { Spinner } from '@/components/ui/spinner';

export default function ProfilePage() {
  const { address, loading } = useWallet();

  if (loading) {
    return (
      <div className="container mx-auto py-8 flex justify-center items-center h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!address) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">AO Profile Management</h1>
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center">
          <h3 className="text-xl font-semibold mb-4">Connect your wallet</h3>
          <p className="text-slate-600 dark:text-slate-400">
            Please connect your Arweave wallet to view and manage your profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">AO Profile Management</h1>
      
      {/* Process Status Indicator - Shows if user has a story process */}
      <ProcessStatusIndicator />
      
      <p className="mb-6 text-gray-600">
        This page demonstrates how to use the @permaweb/aoprofile SDK directly in your frontend
        without requiring a separate ao-profile-integration.lua process.
      </p>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Your AO Profile</h2>
        <ProfileManager />
      </div>
      
      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">About AO Profiles</h2>
        <p className="mb-4">
          AO Profiles are a digital representation of entities, such as users, organizations, or channels.
          These profiles include specific metadata that describes the entity and can be associated with
          various digital assets and collections.
        </p>
        
        <h3 className="text-lg font-semibold mb-2">Implementation Details</h3>
        <p className="mb-2">
          This implementation uses the @permaweb/aoprofile SDK directly in the frontend, which provides
          the following benefits:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>No need for a separate ao-profile-integration.lua process</li>
          <li>Direct interaction with the AO profile registry</li>
          <li>Simplified deployment and maintenance</li>
          <li>Reduced latency by eliminating an extra hop through a process</li>
        </ul>
        
        <p>
          The SDK is initialized in the useAOProfile hook, which provides a simple interface for
          creating, updating, and fetching profiles.
        </p>
      </div>
    </div>
  );
}
