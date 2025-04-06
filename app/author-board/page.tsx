"use client";
import React, { useState, useEffect } from "react";
import { useStoryPointsProcess } from "@/contexts/StoryPointsProcessContext";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { FaUser, FaStar } from "react-icons/fa";
import { Spinner } from "@/components/ui/spinner";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/page-header";
import { useStoriesProcess } from "@/contexts/StoriesProcessContext";
import { IoBookOutline } from "react-icons/io5";
import { IoMdArrowDropdown, IoMdArrowDropup } from "react-icons/io";
import Link from "next/link";
import { useWallet } from "@/contexts/WalletContext";
import { AuthorAvatar } from "@/components/ui/author-avatar";
import { ArnsName } from "@/components/ui/arns-name";

const AuthorBoard: React.FC = () => {
  const { getAllStoryPoints, allUsersStoryPoints, loading } =
    useStoryPointsProcess();
  const { stories, getStories, loading: storiesLoading } = useStoriesProcess();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortedAuthors, setSortedAuthors] = useState<[string, number][]>([]);
  const [authorStories, setAuthorStories] = useState<Record<string, any[]>>({});
  const [expandedAuthor, setExpandedAuthor] = useState<string | null>(null);
  const { address } = useWallet();

  useEffect(() => {
    getAllStoryPoints();
    getStories();
  }, []);

  useEffect(() => {
    const storyMap: Record<string, any[]> = {};
    stories.forEach((story) => {
      const author = story.version_data.author;
      if (!storyMap[author]) {
        storyMap[author] = [];
      }
      storyMap[author].push(story);
    });
    setAuthorStories(storyMap);
  }, [stories]);

  useEffect(() => {
    const sorted = Object.entries(allUsersStoryPoints)
      .sort(([, a], [, b]) => b - a)
      .filter(([address]) =>
        address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    setSortedAuthors(sorted);
  }, [allUsersStoryPoints, searchTerm]);

  const getPointColor = (index: number) => {
    switch (index) {
      case 0:
        return "text-yellow-500";
      case 1:
        return "text-gray-400";
      case 2:
        return "text-amber-600";
      default:
        return "text-white/70";
    }
  };

  const toggleAuthor = (address: string) => {
    setExpandedAuthor(expandedAuthor === address ? null : address);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title="Author Leaderboard" />

      <Input
        type="text"
        placeholder="Search by address"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-6 bg-black/40 backdrop-blur-md border-gray-800 focus:ring-purple-500 text-gray-400 placeholder:text-gray-400 focus:text-white"
      />

      {loading || storiesLoading ? (
        <div className="flex justify-center items-center min-h-[200px]">
          <Spinner className="text-purple-500 w-8 h-8" />
        </div>
      ) : sortedAuthors.length > 0 ? (
        <div className="space-y-4">
          {sortedAuthors.map(([authorAddress, points], index) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              key={authorAddress}
              className={`flex flex-col p-4 bg-gradient-to-br from-black to-[#0F0514]/95 backdrop-blur-md border ${
                address?.toLowerCase() === authorAddress.toLowerCase()
                  ? "border-purple-500/50 shadow-lg shadow-purple-500/20"
                  : "border-gray-800/50"
              } rounded-lg shadow-lg hover:shadow-purple-500/20 transition-all duration-300`}
            >
              <div
                className="flex items-center space-x-4 cursor-pointer"
                onClick={() => toggleAuthor(authorAddress)}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-white/90">{index + 1}.</span>
                    <AuthorAvatar address={authorAddress} size="md" />
                    <div className="flex-grow">
                      <p className="font-medium text-white/90">
                        <ArnsName address={authorAddress || null} showAddress={true} />
                      </p>
                      <p className="text-sm text-gray-500">{points} points</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <FaStar
                      size={16}
                      className={`flex-shrink-0 ${getPointColor(index)}`}
                    />
                    <span
                      className={`font-bold mt-[2px] ${getPointColor(index)}`}
                    >
                      {points}
                    </span>
                    {authorStories[authorAddress]?.length > 0 && (
                      <>
                        <span className="mx-2 text-gray-500">|</span>
                        {expandedAuthor === authorAddress ? (
                          <IoMdArrowDropup className="text-gray-400 text-xl" />
                        ) : (
                          <IoMdArrowDropdown className="text-gray-400 text-xl" />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {expandedAuthor === authorAddress &&
                authorStories[authorAddress]?.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 space-y-2 border-t border-gray-800/50 pt-4"
                  >
                    <div className="pl-8">
                      <div className="space-y-2">
                        {authorStories[authorAddress].map((story) => (
                          <Link
                            key={story.id}
                            href={`/story/${story.id}`}
                            className="flex items-center space-x-2 p-2 rounded-md hover:bg-white/5 transition-colors group"
                          >
                            <IoBookOutline className="text-purple-400 group-hover:text-purple-300" />
                            <span className="text-sm text-gray-300 group-hover:text-purple-300">
                              {story.version_data.title}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500">No authors found</div>
      )}
    </div>
  );
};

export default AuthorBoard;
