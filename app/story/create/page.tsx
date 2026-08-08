"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { FormField } from "@/components/ui/form-field";
import { useStoriesProcess } from "@/contexts/StoriesProcessContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useWallet } from "@/contexts/WalletContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STORY_CATEGORIES } from "@/app/constants/categories";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { CustomMarkdownEditor } from "@/components/ui/markdown-editor";
import type { StoryAtomicAssetResult } from "@/lib/permatellAssets";
import { isCompleteHttpUrl, safeCoverImageSrc } from "@/lib/utils";

export default function CreateStoryPage() {
  const { createStory, loading } = useStoriesProcess();
  const { address, walletType } = useWallet();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [coverImage, setCoverImage] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [category, setCategory] = useState<string>("Uncategorized");
  const [mintAtomicAsset, setMintAtomicAsset] = useState(false);
  const [assetDescription, setAssetDescription] = useState("");
  const [atomicAsset, setAtomicAsset] = useState<StoryAtomicAssetResult | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setAtomicAsset(null);
    try {
      const result = await createStory({
        title,
        content,
        is_public: isPublic,
        cover_image: coverImage,
        category,
        mint_atomic_asset: mintAtomicAsset,
        asset_description: assetDescription,
      });
      if (result.atomicAsset) {
        setAtomicAsset(result.atomicAsset);
        return;
      }
      router.push("/dashboard");
    } catch (error) {
      console.error("Error creating story:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not create story."
      );
    }
  };

  const coverImageSrc = safeCoverImageSrc(coverPreview);

  return (
    <div className="container mx-auto py-6 px-4">
      <PageHeader title="Create a New Story" />

      <div className="flex flex-col md:flex-row gap-8 md:gap-12">
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onSubmit={handleSubmit}
          className="space-y-6 flex-1"
        >
          <FormField label="Title:" htmlFor="title">
            <Input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="bg-black/40 backdrop-blur-md border-gray-800 focus:ring-purple-500 text-gray-400 placeholder:text-gray-400 focus:text-white"
            />
          </FormField>

          <div className="flex items-start space-x-8">
            <div className="flex-1">
              <Label
                htmlFor="category"
                className="text-gray-200 text-lg mb-2 block"
              >
                Category:
              </Label>
              <Select value={category} onValueChange={setCategory}>
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
            <div className="flex items-center space-x-2 pt-8">
              <Checkbox
                id="isPublic"
                checked={isPublic}
                onCheckedChange={(checked) => setIsPublic(checked as boolean)}
              />
              <Label htmlFor="isPublic" className="text-gray-200">
                Make this story public
              </Label>
            </div>
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
              value={content}
              onChange={setContent}
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
              type="url"
              id="coverImage"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              onBlur={() =>
                setCoverPreview(
                  isCompleteHttpUrl(coverImage) ? coverImage.trim() : ""
                )
              }
              placeholder="https://example.com/image.jpg"
              className="bg-black/40 backdrop-blur-md border-gray-800 focus:ring-purple-500 text-gray-400 placeholder:text-gray-400 focus:text-white"
            />
          </div>

          <div className="space-y-4 rounded-lg border border-gray-800 bg-black/30 p-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="mintAtomicAsset"
                checked={mintAtomicAsset}
                onCheckedChange={(checked) =>
                  setMintAtomicAsset(checked as boolean)
                }
              />
              <div className="space-y-1">
                <Label htmlFor="mintAtomicAsset" className="text-gray-200">
                  Mint a story atomic asset
                </Label>
                <p className="text-sm text-gray-400">
                  Creates a transferable AO atomic asset for this story after
                  the story process write succeeds.
                </p>
              </div>
            </div>

            {mintAtomicAsset && (
              <div>
                <Label
                  htmlFor="assetDescription"
                  className="text-gray-200 text-sm mb-2 block"
                >
                  Asset description
                </Label>
                <Input
                  type="text"
                  id="assetDescription"
                  value={assetDescription}
                  onChange={(e) => setAssetDescription(e.target.value)}
                  placeholder="Optional description for Bazar and permaweb discovery"
                  className="bg-black/40 backdrop-blur-md border-gray-800 focus:ring-purple-500 text-gray-400 placeholder:text-gray-400 focus:text-white"
                />
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          {walletType === "evm" && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-4 text-sm text-amber-100">
              Story creation currently requires a Wander or Beacon wallet signer.
            </div>
          )}

          {atomicAsset && (
            <div className="rounded-lg border border-cyan-500/40 bg-cyan-950/20 p-4 text-sm text-cyan-100">
              <p className="font-medium">Atomic asset minted.</p>
              <p className="mt-1 break-all text-cyan-200">
                {atomicAsset.assetId}
              </p>
              {atomicAsset.storyId && (
                <p className="mt-2 break-all text-xs text-cyan-200/80">
                  Story process: {atomicAsset.storyId}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-3">
                <a
                  href={atomicAsset.bazarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-300 underline underline-offset-4"
                >
                  Open in Bazar
                </a>
                <a
                  href={atomicAsset.arweaveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-300 underline underline-offset-4"
                >
                  Open on Arweave
                </a>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="text-cyan-300 underline underline-offset-4"
                >
                  Go to dashboard
                </button>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !address || walletType === "evm"}
            className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white border-none mt-8"
          >
            {!address
              ? "Connect Wallet to Create"
              : walletType === "evm"
              ? "Use Wander or Beacon to Create"
              : loading
              ? "Creating..."
              : "Create Story"}
          </Button>
        </motion.form>

        <Separator orientation="vertical" className="hidden md:block h-auto" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="md:w-1/3"
        >
          <div className="bg-gradient-to-br from-black/50 to-[#0F0514]/50 backdrop-blur-md border border-gray-800/50 shadow-lg p-4 rounded-lg relative isolate">
            <img
              src={coverImageSrc}
              alt="Cover preview"
              className="w-full h-auto object-cover rounded-lg shadow-md"
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
