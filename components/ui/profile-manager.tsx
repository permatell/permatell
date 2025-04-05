'use client';

import React, { useState, useEffect } from 'react';
import { useAOProfile } from '@/hooks/useAOProfile';
import { useWallet, AOProfileData } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

export const ProfileManager: React.FC = () => {
  const { address, profile, profileLoading } = useWallet();
  const { loading, error, createProfile, updateProfile } = useAOProfile();
  
  const [formData, setFormData] = useState<AOProfileData>({
    userName: '',
    displayName: '',
    description: '',
    thumbnail: '',
    banner: ''
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  
  // Initialize form data when profile is loaded
  useEffect(() => {
    if (profile) {
      setFormData({
        userName: profile.userName || '',
        displayName: profile.displayName || '',
        description: profile.description || '',
        thumbnail: profile.thumbnail || '',
        banner: profile.banner || ''
      });
    }
  }, [profile]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: AOProfileData) => ({ ...prev, [name]: value }));
  };
  
  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);
    
    try {
      // Process form data to handle Arweave transaction IDs
      const processedFormData = { ...formData };
      
      // If thumbnail is just a transaction ID, don't add the gateway URL
      // The WalletContext will handle adding the gateway URL when fetching the profile
      if (processedFormData.thumbnail && processedFormData.thumbnail.startsWith('https://arweave.net/')) {
        processedFormData.thumbnail = processedFormData.thumbnail.replace('https://arweave.net/', '');
      }
      
      // If banner is just a transaction ID, don't add the gateway URL
      // The WalletContext will handle adding the gateway URL when fetching the profile
      if (processedFormData.banner && processedFormData.banner.startsWith('https://arweave.net/')) {
        processedFormData.banner = processedFormData.banner.replace('https://arweave.net/', '');
      }
      
      const profileId = await createProfile(processedFormData);
      if (profileId) {
        setFormSuccess(`Profile created successfully with ID: ${profileId}`);
        setIsCreating(false);
      } else {
        setFormError('Failed to create profile');
      }
    } catch (err) {
      console.error('Error creating profile:', err);
      setFormError('An error occurred while creating the profile');
    } finally {
      setFormLoading(false);
    }
  };
  
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) {
      setFormError('No profile ID found');
      return;
    }
    
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);
    
    try {
      // Process form data to handle Arweave transaction IDs
      const processedFormData = { ...formData };
      
      // If thumbnail is just a transaction ID, don't add the gateway URL
      // The WalletContext will handle adding the gateway URL when fetching the profile
      if (processedFormData.thumbnail && processedFormData.thumbnail.startsWith('https://arweave.net/')) {
        processedFormData.thumbnail = processedFormData.thumbnail.replace('https://arweave.net/', '');
      }
      
      // If banner is just a transaction ID, don't add the gateway URL
      // The WalletContext will handle adding the gateway URL when fetching the profile
      if (processedFormData.banner && processedFormData.banner.startsWith('https://arweave.net/')) {
        processedFormData.banner = processedFormData.banner.replace('https://arweave.net/', '');
      }
      
      const updateId = await updateProfile(profile.id, processedFormData);
      if (updateId) {
        setFormSuccess('Profile updated successfully');
        setIsEditing(false);
      } else {
        setFormError('Failed to update profile');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setFormError('An error occurred while updating the profile');
    } finally {
      setFormLoading(false);
    }
  };
  
  if (!address) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg text-white">
        <p className="text-center">Please connect your wallet to manage your profile</p>
      </div>
    );
  }
  
  if (loading || profileLoading) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg flex justify-center text-white">
        <Spinner />
        <p className="ml-2">Loading profile...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg border border-red-500">
        <p className="text-red-400">{error}</p>
        <Button 
          className="mt-2" 
          variant="outline"
          onClick={() => setIsCreating(true)}
        >
          Create New Profile
        </Button>
      </div>
    );
  }
  
  if (isCreating) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg text-white">
        <h2 className="text-xl font-bold mb-4">Create New Profile</h2>
        <form onSubmit={handleCreateProfile}>
          <div className="mb-4">
            <Label htmlFor="userName" className="text-white">Username</Label>
            <Input
              id="userName"
              name="userName"
              value={formData.userName}
              onChange={handleInputChange}
              required
              className="bg-gray-700 text-white border-gray-600"
            />
          </div>
          
          <div className="mb-4">
            <Label htmlFor="displayName" className="text-white">Display Name</Label>
            <Input
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleInputChange}
              required
              className="bg-gray-700 text-white border-gray-600"
            />
          </div>
          
          <div className="mb-4">
            <Label htmlFor="description" className="text-white">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="bg-gray-700 text-white border-gray-600"
            />
          </div>
          
          <div className="mb-4">
            <Label htmlFor="thumbnail" className="text-white">Thumbnail URL (optional)</Label>
            <Input
              id="thumbnail"
              name="thumbnail"
              value={formData.thumbnail}
              onChange={handleInputChange}
              placeholder="Arweave transaction ID or full URL"
              className="bg-gray-700 text-white border-gray-600"
            />
            <div className="text-xs text-gray-400 mt-1">
              Enter an Arweave transaction ID or full URL (https://arweave.net/YOUR_TX_ID)
            </div>
          </div>
          
          <div className="mb-4">
            <Label htmlFor="banner" className="text-white">Banner URL (optional)</Label>
            <Input
              id="banner"
              name="banner"
              value={formData.banner}
              onChange={handleInputChange}
              placeholder="Arweave transaction ID or full URL"
              className="bg-gray-700 text-white border-gray-600"
            />
            <div className="text-xs text-gray-400 mt-1">
              Enter an Arweave transaction ID or full URL (https://arweave.net/YOUR_TX_ID)
            </div>
          </div>
          
          {formError && (
            <div className="mb-4 p-2 bg-red-900/50 text-red-400 rounded">
              {formError}
            </div>
          )}
          
          {formSuccess && (
            <div className="mb-4 p-2 bg-green-900/50 text-green-400 rounded">
              {formSuccess}
            </div>
          )}
          
          <div className="flex justify-end space-x-2">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setIsCreating(false)}
              disabled={formLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={formLoading}
            >
              {formLoading ? <Spinner className="mr-2" /> : null}
              Create Profile
            </Button>
          </div>
        </form>
      </div>
    );
  }
  
  if (isEditing && profile) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg text-white">
        <h2 className="text-xl font-bold mb-4">Edit Profile</h2>
        <form onSubmit={handleUpdateProfile}>
          <div className="mb-4">
            <Label htmlFor="userName" className="text-white">Username</Label>
            <Input
              id="userName"
              name="userName"
              value={formData.userName}
              onChange={handleInputChange}
              required
              className="bg-gray-700 text-white border-gray-600"
            />
          </div>
          
          <div className="mb-4">
            <Label htmlFor="displayName" className="text-white">Display Name</Label>
            <Input
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleInputChange}
              required
              className="bg-gray-700 text-white border-gray-600"
            />
          </div>
          
          <div className="mb-4">
            <Label htmlFor="description" className="text-white">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="bg-gray-700 text-white border-gray-600"
            />
          </div>
          
          <div className="mb-4">
            <Label htmlFor="thumbnail" className="text-white">Thumbnail URL (optional)</Label>
            <Input
              id="thumbnail"
              name="thumbnail"
              value={formData.thumbnail}
              onChange={handleInputChange}
              placeholder="Arweave transaction ID or data URL"
              className="bg-gray-700 text-white border-gray-600"
            />
          </div>
          
          <div className="mb-4">
            <Label htmlFor="banner" className="text-white">Banner URL (optional)</Label>
            <Input
              id="banner"
              name="banner"
              value={formData.banner}
              onChange={handleInputChange}
              placeholder="Arweave transaction ID or data URL"
              className="bg-gray-700 text-white border-gray-600"
            />
          </div>
          
          {formError && (
            <div className="mb-4 p-2 bg-red-900/50 text-red-400 rounded">
              {formError}
            </div>
          )}
          
          {formSuccess && (
            <div className="mb-4 p-2 bg-green-900/50 text-green-400 rounded">
              {formSuccess}
            </div>
          )}
          
          <div className="flex justify-end space-x-2">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setIsEditing(false)}
              disabled={formLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={formLoading}
            >
              {formLoading ? <Spinner className="mr-2" /> : null}
              Update Profile
            </Button>
          </div>
        </form>
      </div>
    );
  }
  
  if (profile) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg text-white">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold">Your AO Profile</h2>
          <Button 
            variant="outline"
            onClick={() => setIsEditing(true)}
          >
            Edit Profile
          </Button>
        </div>
        
        {profile.banner && (
          <div className="mb-4 h-32 overflow-hidden rounded-lg">
            <img 
              src={profile.banner} 
              alt="Profile Banner" 
              className="w-full object-cover"
              onError={(e) => {
                // If image fails to load, hide it
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
        )}
        
        <div className="flex items-center mb-4">
          {profile.thumbnail ? (
            <img 
              src={profile.thumbnail} 
              alt="Profile Thumbnail" 
              className="w-16 h-16 rounded-full mr-4 object-cover"
              onError={(e) => {
                // If image fails to load, replace with default avatar
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  const div = document.createElement('div');
                  div.className = "w-16 h-16 rounded-full mr-4 bg-purple-700 flex items-center justify-center";
                  const span = document.createElement('span');
                  span.className = "text-white text-xl";
                  span.textContent = (profile.displayName?.charAt(0) || profile.userName?.charAt(0) || '?').toUpperCase();
                  div.appendChild(span);
                  parent.insertBefore(div, target);
                }
              }}
            />
          ) : (
            <div className="w-16 h-16 rounded-full mr-4 bg-purple-700 flex items-center justify-center">
              <span className="text-white text-xl">
                {profile.displayName?.charAt(0) || profile.userName?.charAt(0) || '?'}
              </span>
            </div>
          )}
          
          <div>
            <h3 className="text-lg font-semibold text-white">{profile.displayName}</h3>
            <p className="text-gray-300">@{profile.userName}</p>
          </div>
        </div>
        
        {profile.description && (
          <div className="mb-4">
            <h4 className="font-semibold mb-1 text-white">About</h4>
            <p className="text-gray-300">{profile.description}</p>
          </div>
        )}
        
        <div className="text-sm text-gray-400 mt-4 p-2 bg-gray-700/50 rounded">
          <div className="truncate" title={profile.id || ''}>
            <span className="font-semibold">Profile ID:</span> {profile.id}
          </div>
          <div className="truncate" title={address || ''}>
            <span className="font-semibold">Wallet:</span> {address}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 bg-gray-800 rounded-lg text-white">
      <p className="mb-4">You don't have an AO Profile yet.</p>
      <Button onClick={() => setIsCreating(true)}>
        Create Profile
      </Button>
    </div>
  );
};
