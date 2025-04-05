"use client";

import React, { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { ProfileManager } from "@/components/ui/profile-manager";
import { PageHeader } from "@/components/ui/page-header";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { FaUser, FaEdit, FaTwitter, FaGithub, FaGlobe } from "react-icons/fa";
import { motion } from "framer-motion";

export default function ProfilePage() {
  const { address, profile, profileLoading } = useWallet();
  const [isEditing, setIsEditing] = useState(false);

  if (!address) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white">Connect Wallet</h2>
            <p className="mt-2 text-gray-400">Please connect your wallet to view and edit your profile.</p>
          </div>
        </div>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-center items-center py-10">
            <Spinner className="text-purple-500" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <PageHeader title="Profile" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-8"
        >
          {isEditing ? (
            <div className="bg-black/40 backdrop-blur-md border border-gray-800/50 rounded-lg p-6 shadow-lg">
              <ProfileManager
                onSave={() => setIsEditing(false)}
                onCancel={() => setIsEditing(false)}
              />
            </div>
          ) : (
            <div className="bg-black/40 backdrop-blur-md border border-gray-800/50 rounded-lg p-6 shadow-lg">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    {profile?.thumbnail ? (
                      <img
                        src={profile.thumbnail}
                        alt={profile.displayName || "Profile"}
                        className="h-20 w-20 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-full bg-black/60 flex items-center justify-center">
                        <FaUser size={40} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">
                      {profile?.displayName || "Anonymous"}
                    </h3>
                    <p className="text-gray-400">@{profile?.userName || "username"}</p>
                  </div>
                </div>
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <FaEdit className="mr-2" />
                  Edit Profile
                </Button>
              </div>

              {profile?.banner && (
                <div className="mb-6 rounded-lg overflow-hidden h-48">
                  <img
                    src={profile.banner}
                    alt="Banner"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Bio</h4>
                  <p className="text-gray-300">
                    {profile?.description || "No bio provided"}
                  </p>
                </div>

                {profile?.social_links && (
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-2">Social Links</h4>
                    <div className="space-y-2">
                      {profile.social_links.twitter && (
                        <a
                          href={`https://twitter.com/${profile.social_links.twitter}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-purple-400 hover:text-purple-300"
                        >
                          <FaTwitter className="mr-2" />
                          @{profile.social_links.twitter}
                        </a>
                      )}
                      {profile.social_links.github && (
                        <a
                          href={`https://github.com/${profile.social_links.github}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-purple-400 hover:text-purple-300"
                        >
                          <FaGithub className="mr-2" />
                          {profile.social_links.github}
                        </a>
                      )}
                      {profile.social_links.website && (
                        <a
                          href={profile.social_links.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-purple-400 hover:text-purple-300"
                        >
                          <FaGlobe className="mr-2" />
                          {profile.social_links.website}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Wallet Address</h4>
                  <p className="text-gray-300 font-mono">
                    {address}
                  </p>
                </div>

                {profile?.created_at && (
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-2">Member Since</h4>
                    <p className="text-gray-300">
                      {new Date(profile.created_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
} 