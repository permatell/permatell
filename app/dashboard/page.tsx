"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useStoriesProcess } from "@/contexts/StoriesProcessContext";
import { useWallet } from "@/contexts/WalletContext";
import { Spinner } from "@/components/ui/spinner";

const categories = ["Adventure", "Romance", "Sci-Fi"];

const Dashboard = () => {
  const { stories, getStories, loading } = useStoriesProcess();
  const { address } = useWallet();
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (stories.length === 0 && !loading) {
      getStories();
    }
  }, [getStories, stories.length, loading]);

  const filteredStories = stories.filter((story) =>
    story.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto py-6 px-4">
      <h1 className="text-3xl font-bold mb-4">Discover Stories</h1>

      <Input
        placeholder="Search for stories..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-6"
      />

      <div className="mb-8">
        {address ? (
          <Link href="/story/create">
            <Button>Create New Story</Button>
          </Link>
        ) : (
          <Button disabled>Connect Wallet to Create a Story</Button>
        )}
      </div>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Categories</h2>
        <div className="flex space-x-4">
          {categories.map((category) => (
            <Button key={category} variant="outline">
              {category}
            </Button>
          ))}
        </div>
      </section>

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
                <Card key={story.id} className="overflow-hidden flex flex-col">
                  <div className="relative h-48">
                    <img
                      src={story.cover_image || "/no_cover.webp"}
                      alt={`Cover for ${story.title}`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                  <CardHeader>
                    <CardTitle>{story.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-grow">
                    <p className="text-sm text-gray-500 mb-2">
                      Last contribution:{" "}
                      <b>
                        {story.author.slice(0, 6)}...{story.author.slice(-4)}
                      </b>
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
