"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { ProfileManager } from "@/components/ui/profile-manager";
import { PageHeader } from "@/components/ui/page-header";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { FaUser, FaEdit, FaTwitter, FaGithub, FaGlobe } from "react-icons/fa";
import { motion } from "framer-motion";
import { useStoriesProcess } from "@/contexts/StoriesProcessContext";
import { CardContainer } from "@/components/ui/card-container";
import { CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { IoMdThumbsUp } from "react-icons/io";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { IoBookOutline } from "react-icons/io5";
import { ArNSDisplay } from "@/components/ui/arns-display";
import Image from "next/image";
import { User, ExternalLink, ArrowLeft, Edit, Copy, Check, Wallet, RefreshCw } from "lucide-react";
import { ArnsName } from "@/components/ui/arns-name";
import { ArnsList } from "@/components/ui/arns-list";

export default function ProfilePage() {
  const { address, profile, profileLoading, refreshBalance } = useWallet();
  const { stories, getStories, loading: storiesLoading } = useStoriesProcess();
  const [isEditing, setIsEditing] = useState(false);
  const [userStories, setUserStories] = useState<any[]>([]);
  const [storiesError, setStoriesError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("profile");
  const [assets, setAssets] = useState<string[]>([]);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedProfileId, setCopiedProfileId] = useState(false);

  useEffect(() => {
    if (!address && !profileLoading) {
      router.push("/");
    }
  }, [address, profileLoading, router]);

  useEffect(() => {
    if (profile?.assets) {
      setAssets(profile.assets);
    }
  }, [profile]);

  useEffect(() => {
    let mounted = true;
    const fetchStories = async () => {
      if (!address) return;
      
      // Only fetch if we don't have stories yet or if there was an error
      if (stories.length === 0 || storiesError) {
        try {
          await getStories();
          if (mounted) {
            setStoriesError(false);
            setRetryCount(0); // Reset retry count on success
          }
        } catch (error: any) {
          console.error("Error fetching stories:", error);
          if (mounted) {
            setStoriesError(true);
            if (retryCount < 2) {
              // Exponential backoff with jitter
              const backoffTime = Math.min(1000 * Math.pow(2, retryCount) + Math.random() * 1000, 5000);
              setTimeout(() => {
                if (mounted) {
                  setRetryCount(prev => prev + 1);
                }
              }, backoffTime);
            } else {
              // After max retries, show a user-friendly error message
              toast.error("Unable to load stories. Please try refreshing the page later.");
            }
          }
        }
      }
    };

    fetchStories();
    return () => {
      mounted = false;
    };
  }, [address, getStories, retryCount, stories.length, storiesError]);

  useEffect(() => {
    if (address && stories.length > 0) {
      const filtered = stories.filter(
        story => story.version_data?.author?.toLowerCase() === address.toLowerCase()
      );
      setUserStories(filtered);
    } else {
      setUserStories([]);
    }
  }, [address, stories]);

  const copyToClipboard = (text: string, type: 'address' | 'profileId') => {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'address') {
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
      } else {
        setCopiedProfileId(true);
        setTimeout(() => setCopiedProfileId(false), 2000);
      }
      toast.success("Copied to clipboard!");
    }).catch(err => {
      toast.error("Failed to copy to clipboard");
      console.error("Failed to copy: ", err);
    });
  };

  // Add a function to handle balance refresh
  const handleRefreshBalance = async () => {
    try {
      await refreshBalance();
      toast.success("Balance refreshed!");
    } catch (error) {
      console.error("Error refreshing balance:", error);
      toast.error("Failed to refresh balance");
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">No Profile Found</h1>
        <p className="text-gray-400 mb-6">You need to connect your wallet to view your profile.</p>
        <Link href="/" className="flex items-center text-purple-400 hover:text-purple-300">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <Link href="/" className="flex items-center text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
        <Button 
          onClick={() => setIsEditing(true)}
          className="bg-purple-600 hover:bg-purple-700 flex items-center shadow-[0_4px_14px_0_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)] transition-all duration-300"
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit Profile
        </Button>
      </div>

      {isEditing ? (
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <ProfileManager
            onSave={() => setIsEditing(false)}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg">
          {/* Profile Header */}
          <div className="relative h-48 bg-gradient-to-r from-purple-900 to-blue-900">
            {profile.banner ? (
              <Image
                src={profile.banner.startsWith('http') 
                  ? profile.banner 
                  : `https://arweave.net/${profile.banner}`}
                alt="Profile Banner"
                fill
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-purple-900 to-blue-900"></div>
            )}
            <div className="absolute -bottom-16 left-8">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {profile?.thumbnail ? (
                    <Image
                      src={profile.thumbnail}
                      alt={profile.displayName || profile.userName || "Profile"}
                      width={100}
                      height={100}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-[100px] h-[100px] bg-black/60 rounded-full flex items-center justify-center">
                      <FaUser className="text-gray-400 text-4xl" />
                    </div>
                  )}
                  {profile?.banner && (
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full overflow-hidden border-2 border-black">
                      <Image
                        src={profile.banner}
                        alt="Banner"
                        width={32}
                        height={32}
                        className="object-cover"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold">
                    <div className="bg-white/30 backdrop-blur-sm px-3 py-1 rounded-md inline-block shadow-md">
                      <ArnsName address={address} showAddress={false} className="uppercase font-bold text-white" />
                    </div>
                  </h1>
                  {address && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-300">
                        {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Profile Info */}
          <div className="pt-20 px-8 pb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {profile.displayName || profile.userName || "Anonymous"}
                </h1>
                <div className="flex items-center">
                  <p className="text-gray-400">
                    <span className="text-gray-500 text-sm">Wallet: </span>
                    {profile.wallet_address || address}
                  </p>
                  <button 
                    onClick={() => copyToClipboard(profile.wallet_address || address || '', 'address')}
                    className="ml-2 text-gray-400 hover:text-white"
                    title="Copy address"
                  >
                    {copiedAddress ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                {profile.id && (
                  <div className="flex items-center mt-1">
                    <p className="text-gray-500 text-sm">
                      Profile ID: {profile.id}
                    </p>
                    <button 
                      onClick={() => copyToClipboard(profile.id || '', 'profileId')}
                      className="ml-2 text-gray-400 hover:text-white"
                      title="Copy profile ID"
                    >
                      {copiedProfileId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-4 md:mt-0">
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-white font-medium flex items-center justify-between">
                    <div className="flex items-center">
                      <Wallet className="w-5 h-5 text-purple-400 mr-2" />
                      ARIO Balance
                    </div>
                  </h3>
                  <div className="mt-2 flex items-center">
                    <p className="text-gray-400 italic">
                      Coming Soon
                    </p>
                  </div>
                  <p className="text-gray-400 text-sm mt-2">
                    Used for ArNS operations and governance
                  </p>
                </div>
              </div>
            </div>

            {profile.description && (
              <div className="mt-6">
                <h2 className="text-lg font-medium text-white mb-2">About</h2>
                <p className="text-gray-300">{profile.description}</p>
              </div>
            )}

            {/* Tabs */}
            <div className="mt-8 border-b border-gray-700">
              <div className="flex space-x-8">
                <button
                  className={`pb-2 ${
                    activeTab === "profile"
                      ? "text-purple-400 border-b-2 border-purple-400"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                  onClick={() => setActiveTab("profile")}
                >
                  Profile
                </button>
                <button
                  className={`pb-2 ${
                    activeTab === "arns"
                      ? "text-purple-400 border-b-2 border-purple-400"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                  onClick={() => setActiveTab("arns")}
                >
                  ARNs
                </button>
                <button
                  className={`pb-2 ${
                    activeTab === "assets"
                      ? "text-purple-400 border-b-2 border-purple-400"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                  onClick={() => setActiveTab("assets")}
                >
                  Assets
                </button>
                <button
                  className={`pb-2 ${
                    activeTab === "stories"
                      ? "text-purple-400 border-b-2 border-purple-400"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                  onClick={() => setActiveTab("stories")}
                >
                  Stories
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
              {activeTab === "profile" && (
                <div>
                  <h2 className="text-lg font-medium text-white mb-4">Profile Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-gray-400 text-sm">Username</h3>
                      <p className="text-white">{profile.userName || "Not set"}</p>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-gray-400 text-sm">Display Name</h3>
                      <p className="text-white">{profile.displayName || "Not set"}</p>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-gray-400 text-sm">Created</h3>
                      <p className="text-white">
                        {profile.created_at
                          ? new Date(profile.created_at).toLocaleDateString()
                          : "Unknown"}
                      </p>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-gray-400 text-sm">Last Updated</h3>
                      <p className="text-white">
                        {profile.updated_at
                          ? new Date(profile.updated_at).toLocaleDateString()
                          : "Unknown"}
                      </p>
                    </div>
                  </div>

                  {profile.social_links && (
                    <div className="mt-6">
                      <h3 className="text-lg font-medium text-white mb-2">Social Links</h3>
                      <div className="flex space-x-4">
                        {profile.social_links.twitter && (
                          <a
                            href={`https://twitter.com/${profile.social_links.twitter}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-blue-400 hover:text-blue-300"
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Twitter
                          </a>
                        )}
                        {profile.social_links.github && (
                          <a
                            href={`https://github.com/${profile.social_links.github}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-gray-400 hover:text-gray-300"
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            GitHub
                          </a>
                        )}
                        {profile.social_links.website && (
                          <a
                            href={profile.social_links.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-purple-400 hover:text-purple-300"
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Website
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "arns" && (
                <div>
                  <h2 className="text-lg font-medium text-white mb-4">Your ARNs</h2>
                  {profile.allArns && profile.allArns.length > 0 ? (
                    <div className="space-y-4">
                      {profile.primaryArn && (
                        <div className="bg-gray-700 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-white font-medium">Primary ARN</h3>
                              <p className="text-cyan-400">{profile.primaryArn}</p>
                            </div>
                            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">
                              Primary
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {profile.allArns
                          .filter((arn) => arn !== profile.primaryArn)
                          .map((arn, index) => (
                            <div key={index} className="bg-gray-700 rounded-lg p-4">
                              <h3 className="text-white font-medium">ARN {index + 1}</h3>
                              <p className="text-cyan-400">{arn}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-400">You don't have any ARNs yet.</p>
                  )}
                </div>
              )}

              {activeTab === "assets" && (
                <div>
                  <h2 className="text-lg font-medium text-white mb-4">Profile Assets</h2>
                  {assets.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {assets.map((asset, index) => (
                        <a 
                          key={index} 
                          href={`https://bazar.arweave.net/#/asset/${asset}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                        >
                          <Image
                            src={`https://arweave.net/${asset}`}
                            alt={`Asset ${index + 1}`}
                            fill
                            className="object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400">No assets found.</p>
                  )}
                </div>
              )}

              {activeTab === "stories" && (
                <div>
                  <h2 className="text-lg font-medium text-white mb-4">Your Stories</h2>
                  {storiesLoading ? (
                    <div className="flex justify-center items-center py-8">
                      <Spinner />
                    </div>
                  ) : storiesError ? (
                    <div className="text-red-400 text-center py-8">
                      Failed to load stories. Please try again later.
                    </div>
                  ) : userStories.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {userStories.map((story, index) => (
                        <Link
                          key={index}
                          href={`/story/${story.id}`}
                          className="block bg-gray-700 rounded-lg overflow-hidden hover:bg-gray-600 transition-colors"
                        >
                          {story.version_data?.coverImage && (
                            <div className="relative w-full h-48">
                              <Image
                                src={`https://arweave.net/${story.version_data.coverImage}`}
                                alt={story.version_data?.title || "Story cover"}
                                fill
                                className="object-cover"
                              />
                            </div>
                          )}
                          <div className="p-4">
                            <h3 className="text-white font-medium mb-2 line-clamp-2">
                              {story.version_data?.title || "Untitled Story"}
                            </h3>
                            <p className="text-gray-400 text-sm line-clamp-3 mb-4">
                              {story.version_data?.description || "No description available"}
                            </p>
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-1">
                                  <IoBookOutline className="text-gray-400 w-4 h-4" />
                                  <span className="text-gray-400">
                                    {story.version_data?.wordCount?.toLocaleString() || 0}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <IoMdThumbsUp className="text-gray-400 w-4 h-4" />
                                  <span className="text-gray-400">
                                    {story.version_data?.likes?.toLocaleString() || 0}
                                  </span>
                                </div>
                              </div>
                              <div className="text-gray-400">
                                {new Date(story.version_data?.created_at || Date.now()).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-400">You haven't created any stories yet.</p>
                      <Link
                        href="/dashboard"
                        className="inline-block mt-4 text-purple-400 hover:text-purple-300"
                      >
                        Create your first story
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-black/40 p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
          <FaGlobe className="text-purple-400" />
          ArNS Names
        </h2>
        {address && <ArnsList address={address} className="text-white" />}
      </div>
    </div>
  );
} 