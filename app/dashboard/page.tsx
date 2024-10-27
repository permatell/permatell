"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { STORY_CATEGORIES } from "../constants/categories";
import { IoMdThumbsUp } from "react-icons/io";

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
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Discover Stories</h1>
        <Link href="/author-board">
          <Button variant="outline">Author Board</Button>
        </Link>
      </div>

      {featuredStory && (
        <Card className="mb-8 overflow-hidden">
          <div className="md:flex">
            <div className="md:w-1/3 h-64 md:h-auto relative">
              <img
                src={featuredStory.version_data.cover_image || "/no_cover.webp"}
                alt={`Cover for ${featuredStory.version_data.title}`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            <div className="md:w-2/3 p-6">
              <h2 className="text-2xl font-bold mb-2">Featured Story</h2>
              <CardTitle className="text-2xl mb-2">
                {featuredStory.version_data.title}
              </CardTitle>
              <p className="text-gray-600 mb-4">
                {featuredStory.version_data.description}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {featuredStory.version_data.content.slice(0, 150)}...
              </p>
              <div className="flex items-center mb-4">
                <IoMdThumbsUp size={20} className="text-yellow-500 mr-2" />
                <span className="font-semibold">
                  {featuredStory.version_data.votes} votes
                </span>
              </div>
              <Link href={`/story/${featuredStory.id}`}>
                <Button size="lg">Read Featured Story</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      <div className="flex gap-4 mb-6">
        <Input
          placeholder="Search for stories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow"
        />
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Categories</SelectItem>
            {STORY_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-8">
        {address ? (
          <Link href="/story/create">
            <Button>Create New Story</Button>
          </Link>
        ) : (
          <Button disabled>Connect Wallet to Create a Story</Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <Spinner />
        </div>
      ) : (
        <section>
          <h2 className="text-2xl font-semibold mb-4">All Stories</h2>
          {filteredStories.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStories.map((story) => (
                <Card
                  key={story.id}
                  className="overflow-hidden flex flex-col relative"
                >
                  <div className="absolute top-2 right-2 bg-white rounded-full p-2 shadow-md flex items-center justify-center">
                    <IoMdThumbsUp size={16} className="text-yellow-500 mr-1" />
                    <span className="text-sm font-semibold">
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
                  <CardHeader>
                    <CardTitle>{story.version_data.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-grow">
                    <p className="text-sm text-gray-500 mb-2">
                      Last contribution:{" "}
                      <b>
                        {story.version_data.author.slice(0, 6)}...
                        {story.version_data.author.slice(-4)}
                      </b>
                    </p>
                    <p className="text-sm text-gray-500 mb-2">
                      Category: <b>{story.version_data.category}</b>
                    </p>
                    <p className="text-sm text-gray-500 mb-2">
                      Votes: <b>{story.version_data.votes}</b>
                    </p>
                    <div className="flex-grow" />
                    <Link href={`/story/${story.id}`} className="mt-auto">
                      <Button className="w-full">Read Story</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p>No stories found.</p>
          )}
        </section>
      )}
    </div>
  );
};

export default Dashboard;
