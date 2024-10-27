"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStoriesProcess } from "@/contexts/StoriesProcessContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Story } from "@/types/Story";
import { useWallet } from "@/contexts/WalletContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { StoryVersion } from "@/types/StoryVersion";

const StoryPage = () => {
  const { getStory, createStoryVersion, revertStoryToVersion } =
    useStoriesProcess();
  const params = useParams();
  const [story, setStory] = useState<Story | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [editedCoverImage, setEditedCoverImage] = useState("");
  const { address: author } = useWallet();
  const [isSaving, setIsSaving] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const storyId = Array.isArray(params.id) ? params.id[0] : params.id;
    if (storyId) {
      fetchStory(storyId);
    }
  }, [params.id]);

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

  if (isInitialLoading) {
    return <div>Loading...</div>;
  }

  if (!story) {
    return <div>Story not found</div>;
  }

  return (
    <div className="container mx-auto py-6 px-4 flex">
      <div className="w-3/4 pr-6">
        <Card className="p-6 h-full">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                {isEditing ? (
                  <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="text-2xl font-bold"
                    disabled={isSaving || isRefreshing}
                  />
                ) : (
                  <CardTitle>{currentVersion?.title}</CardTitle>
                )}
                <div className="text-sm text-gray-500 mt-2">
                  <p>Version: {story?.current_version}</p>
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
              </div>
              <img
                src={
                  isEditing
                    ? editedCoverImage || "/no_cover.webp"
                    : currentVersion?.cover_image || "/no_cover.webp"
                }
                alt="Story cover"
                className="rounded w-[200px] h-[150px] object-cover"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <>
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="mb-4"
                  rows={10}
                  disabled={isSaving || isRefreshing}
                />
                <Input
                  value={editedCoverImage}
                  onChange={(e) => setEditedCoverImage(e.target.value)}
                  placeholder="Cover image URL"
                  className="mb-4"
                  disabled={isSaving || isRefreshing}
                />
              </>
            ) : (
              <p>{currentVersion?.content}</p>
            )}
            <div className="border-t border-gray-200 mt-4 pt-4">
              {isRefreshing ? (
                <div className="flex justify-center">
                  <Spinner className="w-6 h-6" />
                </div>
              ) : isEditing ? (
                <Button onClick={handleSave} disabled={isSaving || !author}>
                  {isSaving
                    ? "Saving..."
                    : !author
                    ? "Connect Wallet to Save"
                    : "Save Changes"}
                </Button>
              ) : (
                <Button
                  onClick={handleEdit}
                  className="mt-4"
                  disabled={!author}
                >
                  {!author ? "Connect Wallet to Edit" : "Edit Story"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="w-1/4">
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Story History</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <ul className="relative border-l border-gray-200">
                {sortedVersions.map((version: StoryVersion) => (
                  <li key={version.id} className="mb-10 ml-4">
                    <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-1.5 border border-white"></div>
                    <div className="p-2">
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-semibold text-lg">
                          Version {version.id}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatDate(version.timestamp)}
                      </p>
                      <p className="text-sm mb-2">{version.title}</p>
                      <div className="text-xs text-gray-500 mb-2">
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
                      {version && story && (
                        <Button
                          onClick={() => handleRevert(version.id)}
                          className="w-full text-xs py-1"
                          variant="outline"
                          disabled={
                            isReverting ||
                            String(version.id) === story.current_version ||
                            !author
                          }
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StoryPage;
