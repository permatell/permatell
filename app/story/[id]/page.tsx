"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useStoriesProcess } from "@/contexts/StoriesProcessContext";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/contexts/WalletContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Story } from "@/interfaces/Story";
import { StoryVersion } from "@/interfaces/StoryVersion";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STORY_CATEGORIES } from "@/app/constants/categories";
import { IoMdThumbsUp } from "react-icons/io";
import { motion } from "framer-motion";
import { Separator } from "@/components/ui/separator";
import { CustomMarkdownEditor } from "@/components/ui/markdown-editor";
import ReactMarkdown from "react-markdown";
import { BiNetworkChart } from "react-icons/bi";
import Link from "next/link";

const StoryPage = () => {
  const {
    getStory,
    createStoryVersion,
    revertStoryToVersion,
    upvoteStoryVersion,
  } = useStoriesProcess();
  const params = useParams();
  const [story, setStory] = useState<Story | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState<string>("");
  const [editedCoverImage, setEditedCoverImage] = useState("");
  const [editedCategory, setEditedCategory] = useState("");
  const { address: author } = useWallet();
  const [isSaving, setIsSaving] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpvoting, setIsUpvoting] = useState(false);

  console.log(story);

  useEffect(() => {
    const storyId = params?.id;
    if (storyId && !story) {
      fetchStory(Array.isArray(storyId) ? storyId[0] : storyId);
    }
  }, [params?.id]);

  const fetchStory = async (storyId: string) => {
    if (isInitialLoading) {
      setIsInitialLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const fetchedStory = await getStory({ story_id: storyId });
      if (fetchedStory) {
        setStory(fetchedStory);
        const currentVersion =
          fetchedStory.versions[fetchedStory.current_version];
        setEditedTitle(currentVersion.title);
        setEditedContent(currentVersion.content);
        setEditedCoverImage(currentVersion.cover_image);
        setEditedCategory(currentVersion.category || "Uncategorized");
      }
    } catch (error) {
      console.error("Error fetching story:", error);
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!author || !story) {
      return;
    }
    setIsSaving(true);
    try {
      await createStoryVersion({
        story_id: story.id,
        title: editedTitle,
        content: editedContent,
        cover_image: editedCoverImage,
        category: editedCategory ?? "Uncategorized",
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      setIsRefreshing(true);
      await fetchStory(story.id);

      setIsEditing(false);
    } catch (error) {
      console.error("Error updating story:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = async (versionId: string | number) => {
    if (!story) return;
    setIsReverting(true);
    try {
      await revertStoryToVersion({
        story_id: story.id,
        version_id: versionId.toString(),
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await fetchStory(story.id);
    } catch (error) {
      console.error("Error reverting story:", error);
    } finally {
      setIsReverting(false);
    }
  };

  const formatDate = (timestamp: number | string) => {
    const date = new Date(Number(timestamp));
    return date.toLocaleString();
  };

  const sortedVersions = story
    ? (Object.values(story.versions) as StoryVersion[]).sort(
        (a, b) => Number(b.timestamp) - Number(a.timestamp)
      )
    : [];
  const currentVersion = story ? story.versions[story.current_version] : null;

  const handleUpvote = async () => {
    if (!author || !story) {
      return;
    }
    setIsUpvoting(true);
    try {
      await upvoteStoryVersion({
        story_id: story.id,
        version_id: story.current_version,
      });
      await fetchStory(story.id);
    } catch (error) {
      console.error("Error upvoting story:", error);
    } finally {
      setIsUpvoting(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <Spinner className="w-8 h-8" />
        <p className="text-gray-200 text-lg">Loading story...</p>
      </div>
    );
  }

  if (!story) {
    return <div>Story not found</div>;
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          {isEditing ? "Edit Story" : currentVersion?.title}
        </h1>
      </motion.div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-6">
              <div>
                <Label
                  htmlFor="title"
                  className="text-gray-200 text-lg mb-2 block"
                >
                  Title:
                </Label>
                <Input
                  id="title"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="bg-black/40 backdrop-blur-md border-gray-800 focus:ring-purple-500 text-gray-400 placeholder:text-gray-400 focus:text-white"
                  disabled={isSaving || isRefreshing}
                />
              </div>

              <div>
                <Label
                  htmlFor="category"
                  className="text-gray-200 text-lg mb-2 block"
                >
                  Category:
                </Label>
                <Select
                  value={editedCategory}
                  onValueChange={setEditedCategory}
                >
                  <SelectTrigger className="w-full bg-black/40 backdrop-blur-md border-gray-800 text-gray-400">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent className="border-gray-800">
                    {STORY_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label
                  htmlFor="content"
                  className="text-gray-200 text-lg mb-2 block"
                >
                  Content:
                </Label>
                <CustomMarkdownEditor
                  id="content"
                  value={editedContent}
                  onChange={setEditedContent}
                />
              </div>

              <div>
                <Label
                  htmlFor="coverImage"
                  className="text-gray-200 text-lg mb-2 block"
                >
                  Cover Image URL:
                </Label>
                <Input
                  value={editedCoverImage}
                  onChange={(e) => setEditedCoverImage(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="bg-black/40 backdrop-blur-md border-gray-800 focus:ring-purple-500 text-gray-400 placeholder:text-gray-400 focus:text-white"
                  disabled={isSaving || isRefreshing}
                />
              </div>

              <div className="flex gap-4 mt-8">
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !author}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white border-none"
                >
                  {isSaving
                    ? "Saving..."
                    : !author
                    ? "Connect Wallet to Save"
                    : "Save Changes"}
                </Button>

                <Button
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  className="flex-1 bg-black/60 hover:bg-black/80 hover:text-gray-100 text-gray-300"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div className="text-sm text-gray-300/90 space-y-1">
                  <p>Version: {story?.current_version}</p>
                  <p>Category: {currentVersion?.category || "Uncategorized"}</p>
                  <p>Public: {story?.is_public ? "Yes" : "No"}</p>
                  <p>
                    Votes:{" "}
                    <span className="text-yellow-500 font-bold">
                      {currentVersion?.votes || 0}
                    </span>
                  </p>
                  <p>
                    Author:{" "}
                    {currentVersion?.author
                      ? `${currentVersion.author.slice(
                          0,
                          6
                        )}...${currentVersion.author.slice(-4)}`
                      : "Unknown"}
                  </p>
                  <p>Date: {formatDate(currentVersion?.timestamp || 0)}</p>
                </div>

                {!isEditing && (
                  <div className="flex items-center space-x-4">
                    <Button
                      onClick={handleEdit}
                      disabled={!author || isReverting}
                      className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white border-none"
                    >
                      {!author
                        ? "Connect Wallet to Edit"
                        : isReverting
                        ? "Reverting..."
                        : "Edit Story"}
                    </Button>
                    <Button
                      onClick={handleUpvote}
                      disabled={!author || isUpvoting}
                      variant="outline"
                      className="flex items-center bg-black/60 hover:bg-black/80 hover:text-gray-100 text-gray-300"
                    >
                      <IoMdThumbsUp
                        size={16}
                        className="text-yellow-500 mr-1"
                      />
                      <span>{isUpvoting ? "Upvoting..." : "Upvote"}</span>
                    </Button>
                  </div>
                )}
              </div>
              <div className="prose prose-invert max-w-none text-white">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-3xl font-bold mb-4 text-white">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-2xl font-bold mb-3 text-white">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-xl font-bold mb-2 text-white">
                        {children}
                      </h3>
                    ),
                    h4: ({ children }) => (
                      <h4 className="text-lg font-bold mb-2 text-white">
                        {children}
                      </h4>
                    ),
                    p: ({ children }) => (
                      <p className="mb-4 text-gray-200">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc ml-6 mb-4 text-gray-200">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal ml-6 mb-4 text-gray-200">
                        {children}
                      </ol>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-gray-500 pl-4 italic my-4 text-gray-200">
                        {children}
                      </blockquote>
                    ),
                    a: ({ children, href }) => (
                      <a
                        href={href}
                        className="text-blue-400 hover:text-blue-300 underline"
                      >
                        {children}
                      </a>
                    ),
                    code: ({ children }) => (
                      <code className="bg-gray-800 text-gray-200 px-1 rounded">
                        {children}
                      </code>
                    ),
                  }}
                >
                  {currentVersion?.content || ""}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        <Separator orientation="vertical" className="hidden md:block h-auto" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="md:w-1/3"
        >
          <div className="bg-gradient-to-br from-black/50 to-[#0F0514]/50 backdrop-blur-md border border-gray-800/50 shadow-lg p-4 rounded-lg relative isolate">
            <img
              src={
                isEditing
                  ? editedCoverImage || "/no_cover.webp"
                  : currentVersion?.cover_image || "/no_cover.webp"
              }
              alt="Story cover"
              className="w-full h-auto object-cover rounded-lg shadow-md"
            />
            <div className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  Story History
                </h3>
                <Link href={`/story/${story.id}/graph`}>
                  <Button
                    variant="outline"
                    className="flex items-center bg-black/60 hover:bg-black/80 hover:text-gray-100 text-gray-300"
                    size="sm"
                  >
                    <BiNetworkChart
                      size={16}
                      className="text-purple-500 mr-1"
                    />
                    <span>Graph</span>
                  </Button>
                </Link>
              </div>
              <ScrollArea className="h-[400px] pr-4">
                <ul className="relative border-l border-white/20 ml-2">
                  {sortedVersions.map((version: StoryVersion) => (
                    <li key={version.id} className="mb-10 ml-6">
                      <div className="absolute w-3 h-3 bg-white rounded-full -left-[7px] border border-white/20"></div>
                      <div className="p-2">
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-semibold text-lg text-gray-300">
                            Version {version.id}
                          </p>
                        </div>
                        <div>
                          <p className="font-thin text-xs text-gray-300/90">
                            Votes: {version.votes}
                          </p>
                        </div>
                        <p className="text-xs text-gray-300/90">
                          {formatDate(version.timestamp)}
                        </p>
                        <p className="text-sm mb-2 text-gray-300">
                          {version.title}
                        </p>
                        <div className="text-xs text-gray-300/90 mb-2">
                          <p>
                            Author:{" "}
                            {typeof version.author === "string"
                              ? `${version.author.slice(
                                  0,
                                  6
                                )}...${version.author.slice(-4)}`
                              : "Unknown"}
                          </p>
                        </div>
                        {version &&
                          story &&
                          String(version.id) !== story.current_version && (
                            <Button
                              onClick={() => handleRevert(version.id)}
                              className="w-full text-xs py-1 bg-gray-800/50 hover:bg-gray-700 hover:text-gray-100 text-gray-300"
                              variant="outline"
                              disabled={isReverting || !author}
                            >
                              {isReverting
                                ? "Processing..."
                                : !author
                                ? "Connect to Revert"
                                : "Revert to This Version"}
                            </Button>
                          )}
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default StoryPage;
