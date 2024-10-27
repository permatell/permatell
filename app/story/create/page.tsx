"use client";

import React, { useState } from "react";
import { useStoriesProcess } from "@/contexts/StoriesProcessContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useWallet } from "@/contexts/WalletContext";

export default function CreateStoryPage() {
  const { createStory, loading } = useStoriesProcess();
  const { address } = useWallet();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [coverImage, setCoverImage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createStory({
        title,
        content,
        is_public: isPublic,
        cover_image: coverImage,
      });
      router.push("/dashboard");
    } catch (error) {
      console.error("Error creating story:", error);
    }
  };

  const coverImageSrc = coverImage || "/no_cover.webp";

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Create a New Story</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="title">Title:</Label>
          <Input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="content">Content:</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            className="h-32"
          />
        </div>
        <div>
          <Label htmlFor="coverImage">Cover Image URL:</Label>
          <Input
            type="url"
            id="coverImage"
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            placeholder="https://example.com/image.jpg"
          />
        </div>
        <div className="mt-2">
          <img
            src={coverImageSrc}
            alt="Cover preview"
            className="max-w-xs h-auto object-cover rounded-lg shadow-md"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="isPublic"
            checked={isPublic}
            onCheckedChange={(checked) => setIsPublic(checked as boolean)}
          />
          <Label htmlFor="isPublic">Make this story public</Label>
        </div>
        <Button type="submit" disabled={loading || !address} className="w-full">
          {!address
            ? "Connect Wallet to Create"
            : loading
            ? "Creating..."
            : "Create Story"}
        </Button>
      </form>
    </div>
  );
}
