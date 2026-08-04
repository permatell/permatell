"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FaUpload } from "react-icons/fa";
import { toast } from "sonner";
import { uploadToArweave, getArweaveUrl } from "@/lib/arweave";
import { getPrimaryArn, getAllArns } from "@/lib/arns";

interface ProfileManagerProps {
  onSave?: () => void;
  onCancel?: () => void;
}

export function ProfileManager({ onSave, onCancel }: ProfileManagerProps) {
  const { profile, createProfile, updateProfile, address } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<"thumbnail" | "banner" | null>(null);
  const [arnName, setArnName] = useState<string | null>(null);
  const [allArns, setAllArns] = useState<string[]>([]);
  const [checkingArn, setCheckingArn] = useState(false);
  const [formData, setFormData] = useState({
    userName: profile?.userName || "",
    displayName: profile?.displayName || "",
    description: profile?.description || "",
    thumbnail: profile?.thumbnail || "",
    banner: profile?.banner || "",
    social_links: profile?.social_links || {
      twitter: "",
      github: "",
      website: ""
    }
  });

  const thumbnailUrl = getArweaveUrl(formData.thumbnail);
  const bannerUrl = getArweaveUrl(formData.banner);

  // Check for ARN when component mounts
  useEffect(() => {
    const checkArns = async () => {
      if (!address) return;
      
      setCheckingArn(true);
      try {
        // Get primary ARN
        const primaryArn = await getPrimaryArn(address);
        if (primaryArn) {
          setArnName(primaryArn);
          // Use ARN as username if available
          setFormData(prev => ({
            ...prev,
            userName: primaryArn
          }));
        }
        
        // Get all ARNs
        const arns = await getAllArns(address);
        setAllArns(arns);
      } catch (error) {
        console.error("Error checking ARNs:", error);
        // Don't show an error to the user, just continue without ARNs
      } finally {
        setCheckingArn(false);
      }
    };
    
    checkArns();
  }, [address]);

  // Update form data when profile changes
  useEffect(() => {
    if (profile) {
      setFormData({
        userName: profile.userName || "",
        displayName: profile.displayName || "",
        description: profile.description || "",
        thumbnail: profile.thumbnail || "",
        banner: profile.banner || "",
        social_links: profile.social_links || {
          twitter: "",
          github: "",
          website: ""
        }
      });
    }
  }, [profile]);

  const handleImageUpload = useCallback(async (file: File, type: "thumbnail" | "banner") => {
    try {
      setUploadingImage(type);
      
      // Create a data URL for immediate preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          [type]: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
      
      // Upload to Arweave
      const txId = await uploadToArweave(file, [
        { name: 'Type', value: type },
        { name: 'App-Name', value: 'PermaTell' }
      ]);
      
      // Update the form data with the Arweave transaction ID
      setFormData(prev => ({
        ...prev,
        [type]: txId
      }));
      
      toast.success(`${type === "thumbnail" ? "Profile picture" : "Banner"} uploaded successfully`);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error(`Failed to upload ${type === "thumbnail" ? "profile picture" : "banner"}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploadingImage(null);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Prepare profile data
      const profileData = {
        userName: formData.userName,
        displayName: formData.displayName,
        description: formData.description,
        thumbnail: formData.thumbnail,
        banner: formData.banner,
        social_links: formData.social_links
      };

      if (profile?.id) {
        // Update existing profile
        const updateId = await updateProfile(profile.id, profileData);
        if (updateId) {
          toast.success("Profile updated successfully");
          onSave?.();
        } else {
          toast.error("Failed to update profile");
        }
      } else {
        // Create new profile
        const profileId = await createProfile(profileData);
        if (profileId) {
          toast.success("Profile created successfully");
          onSave?.();
        } else {
          toast.error("Failed to create profile");
        }
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Input
            label="Username"
            value={formData.userName}
            onChange={(e) => setFormData(prev => ({ ...prev, userName: e.target.value }))}
            placeholder="Enter your username"
            required
            disabled={!!arnName}
          />
          {arnName && (
            <p className="text-sm text-gray-400">
              Using your ARN: <span className="font-medium text-purple-400">{arnName}</span>
            </p>
          )}
          
          {allArns.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-gray-400 mb-1">Your ARNs:</p>
              <div className="flex flex-wrap gap-2">
                {allArns.map((arn, index) => (
                  <span 
                    key={index} 
                    className={`px-2 py-1 rounded text-xs ${
                      arn === arnName 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {arn}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <Input
          label="Display Name"
          value={formData.displayName}
          onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
          placeholder="Enter your display name"
          required
        />

        <Textarea
          label="Bio"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Tell us about yourself"
          rows={4}
        />

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Social Links</h3>
          <div className="space-y-2">
            <Input
              label="Twitter"
              value={formData.social_links.twitter || ""}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                social_links: {
                  ...prev.social_links,
                  twitter: e.target.value
                }
              }))}
              placeholder="Your Twitter handle"
            />
            <Input
              label="GitHub"
              value={formData.social_links.github || ""}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                social_links: {
                  ...prev.social_links,
                  github: e.target.value
                }
              }))}
              placeholder="Your GitHub username"
            />
            <Input
              label="Website"
              value={formData.social_links.website || ""}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                social_links: {
                  ...prev.social_links,
                  website: e.target.value
                }
              }))}
              placeholder="Your website URL"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-200">
            Profile Picture
          </label>
          <div className="flex items-center space-x-4">
            {formData.thumbnail ? (
              <img
                src={thumbnailUrl}
                alt="Profile"
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gray-800 flex items-center justify-center">
                <span className="text-gray-400">No image</span>
              </div>
            )}
            <div className="w-full">
              <input
                id="profile-thumbnail-upload"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, "thumbnail");
                }}
                className="sr-only"
                disabled={uploadingImage !== null}
              />
              <Label
                htmlFor="profile-thumbnail-upload"
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-purple-500/35 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-100 transition-colors hover:bg-purple-500/15"
              >
                <FaUpload className="h-3.5 w-3.5" />
                {uploadingImage === "thumbnail"
                  ? "Uploading..."
                  : formData.thumbnail
                  ? "Replace Picture"
                  : "Upload Picture"}
              </Label>
              <p className="mt-2 text-xs text-gray-400">
                Uploads to Arweave and saves the transaction id on your AO
                profile.
              </p>
            </div>
            {uploadingImage === "thumbnail" && (
              <div className="ml-2">
                <Spinner size="sm" />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-200">
            Banner Image
          </label>
          <div className="space-y-2">
            {formData.banner ? (
              <img
                src={bannerUrl}
                alt="Banner"
                className="w-full h-32 object-cover rounded-lg"
              />
            ) : (
              <div className="h-32 w-full rounded-lg bg-gray-800 flex items-center justify-center">
                <span className="text-gray-400">No banner</span>
              </div>
            )}
            <div className="w-full">
              <input
                id="profile-banner-upload"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, "banner");
                }}
                className="sr-only"
                disabled={uploadingImage !== null}
              />
              <Label
                htmlFor="profile-banner-upload"
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-purple-500/35 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-100 transition-colors hover:bg-purple-500/15"
              >
                <FaUpload className="h-3.5 w-3.5" />
                {uploadingImage === "banner"
                  ? "Uploading..."
                  : formData.banner
                  ? "Replace Banner"
                  : "Upload Banner"}
              </Label>
              <p className="mt-2 text-xs text-gray-400">
                Recommended: a wide image for best profile header display.
              </p>
            </div>
            {uploadingImage === "banner" && (
              <div className="mt-2">
                <Spinner size="sm" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white shadow-[0_4px_14px_0_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)] transition-all duration-300"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={isLoading}
          className="shadow-[0_4px_14px_0_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)] transition-all duration-300"
        >
          {profile?.id ? "Update Profile" : "Create Profile"}
        </Button>
      </div>
    </form>
  );
} 
