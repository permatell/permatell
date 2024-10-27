"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardContainer } from "@/components/ui/card-container";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useStoriesProcess } from "@/contexts/StoriesProcessContext";
import { useWallet } from "@/contexts/WalletContext";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { STORY_CATEGORIES } from "../constants/categories";
import { IoMdThumbsUp } from "react-icons/io";
import { motion } from "framer-motion";

const Dashboard = () => {
  const { stories, getStories, loading } = useStoriesProcess();
  const { address } = useWallet();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [featuredStory, setFeaturedStory] = useState<any>(null);

  useEffect(() => {
    if (stories.length === 0 && !loading) {
      getStories();
    }
  }, [getStories, stories.length, loading]);

  useEffect(() => {
    if (stories.length > 0) {
      const highestVotedStory = stories.reduce((prev, current) =>
        prev.version_data.votes > current.version_data.votes ? prev : current
      );
      setFeaturedStory(highestVotedStory);
    }
  }, [stories]);

  const filteredStories = stories.filter(
    (story) =>
      story.version_data.title
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) &&
      (selectedCategory === "All" ||
        story.version_data.category === selectedCategory)
  );

  return (
    <div className="container mx-auto py-6 px-4">
      <PageHeader title="Discover Stories">
        <Link href="/author-board">
          <Button className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white border-none">
            Author Board
          </Button>
        </Link>
      </PageHeader>

      {featuredStory && (
        <CardContainer className="mb-8 overflow-hidden">
          <div className="md:flex">
            <div className="md:w-1/3 h-64 md:h-auto relative">
              <img
                src={featuredStory.version_data.cover_image || "/no_cover.webp"}
                alt={`Cover for ${featuredStory.version_data.title}`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            <div className="md:w-2/3 p-6">
              <h2 className="text-2xl font-bold mb-2 text-white/95">
                Featured Story
              </h2>
              <CardTitle className="text-2xl mb-2 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                {featuredStory.version_data.title}
              </CardTitle>
              <p className="text-gray-200 mb-4">
                {featuredStory.version_data.description}
              </p>
              <p className="text-gray-300 mb-4">
                {featuredStory.version_data.content.slice(0, 150)}...
              </p>
              <div className="flex items-center mb-4">
                <IoMdThumbsUp size={20} className="text-yellow-500 mr-2" />
                <span className="text-gray-300">
                  {featuredStory.version_data.votes} votes
                </span>
              </div>
              <Link href={`/story/${featuredStory.id}`}>
                <Button className="bg-gradient-to-br from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-gray-200 border border-gray-700">
                  Read Featured Story
                </Button>
              </Link>
            </div>
          </div>
        </CardContainer>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex gap-4 mb-6"
      >
        <Input
          placeholder="Search for stories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow bg-black/40 backdrop-blur-md border-gray-800 focus:ring-purple-500 text-gray-400 placeholder:text-gray-400 focus:text-white"
        />
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[180px] bg-black/40 backdrop-blur-md border-gray-800 text-gray-400">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent className="border-gray-800">
            <SelectItem value="All">All Categories</SelectItem>
            {STORY_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      <div className="mb-8">
        {address ? (
          <Link href="/story/create">
            <Button className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-none">
              Create New Story
            </Button>
          </Link>
        ) : (
          <Button
            disabled
            className="bg-gradient-to-r from-green-500/50 to-emerald-500/50 text-white/70 border-none cursor-not-allowed"
          >
            Connect Wallet to Create a Story
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <Spinner className="text-purple-500" />
        </div>
      ) : (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-2xl font-semibold mb-4 text-white/90">
            All Stories
          </h2>
          {filteredStories.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStories.map((story, index) => (
                <motion.div
                  key={story.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <CardContainer className="overflow-hidden flex flex-col relative h-[420px] bg-gradient-to-br from-black to-[#0F0514]/95 backdrop-blur-md border border-gray-800/50 shadow-lg hover:shadow-purple-500/20 transition-all duration-300">
                    <div className="absolute top-2 right-2 bg-black/80 rounded-full p-2 shadow-md flex items-center justify-center z-10">
                      <IoMdThumbsUp
                        size={16}
                        className="text-yellow-500 mr-1"
                      />
                      <span className="text-sm font-semibold text-gray-300">
                        {story.version_data.votes}
                      </span>
                    </div>
                    <div className="relative h-48">
                      <img
                        src={story.version_data.cover_image || "/no_cover.webp"}
                        alt={`Cover for ${story.version_data.title}`}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </div>
                    <CardHeader className="pb-2">
                      <CardTitle className="bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent truncate">
                        {story.version_data.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-grow pt-4">
                      <div>
                        <p className="text-sm text-gray-300/90 mb-2">
                          Last contribution:{" "}
                          <b className="text-purple-200/90">
                            {story.version_data.author.slice(0, 6)}...
                            {story.version_data.author.slice(-4)}
                          </b>
                        </p>
                        <p className="text-sm text-gray-300/90">
                          Category:{" "}
                          <b className="text-purple-200/90">
                            {story.version_data.category}
                          </b>
                        </p>
                      </div>
                      <Link href={`/story/${story.id}`} className="mt-auto">
                        <Button className="w-full bg-gradient-to-br from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-gray-200 border border-gray-700">
                          Read Story
                        </Button>
                      </Link>
                    </CardContent>
                  </CardContainer>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-white/70">No stories found.</p>
          )}
        </motion.section>
      )}
    </div>
  );
};

export default Dashboard;
