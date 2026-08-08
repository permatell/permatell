"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { isCompleteHttpUrl } from "@/lib/utils";
import {
  FREE_UPLOAD_MAX_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
  formatBytes,
  uploadImage,
  validateImageFile,
} from "@/lib/turbo";
import { FiUploadCloud } from "react-icons/fi";
import { toast } from "sonner";

interface CoverImageFieldProps {
  value: string;
  onChange: (value: string) => void;
  /**
   * Commits the value used as the preview `<img src>`. Kept separate from
   * `onChange` so half-typed hosts never reach the network.
   */
  onPreviewChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}

export function CoverImageField({
  value,
  onChange,
  onPreviewChange,
  disabled = false,
  id = "coverImage",
}: CoverImageFieldProps) {
  const { address, walletType } = useWallet();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadedTxId, setUploadedTxId] = useState("");

  const canUpload = Boolean(address) && walletType !== "evm";
  const uploadDisabled = disabled || isUploading || !canUpload;

  const handleFileSelected = async (file?: File | null) => {
    if (!file) return;

    setUploadError("");
    setUploadedTxId("");

    const validationError = validateImageFile(file);
    if (validationError) {
      setUploadError(validationError);
      toast.error(validationError);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadImage(file, { contentType: file.type });
      setUploadedTxId(result.id);
      onChange(result.url);
      onPreviewChange(result.url);
      toast.success("Cover image uploaded to Arweave");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not upload the image to Arweave.";
      setUploadError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <Label htmlFor={id} className="text-gray-200 text-lg block">
        Cover Image URL:
      </Label>
      <Input
        type="url"
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onPreviewChange(isCompleteHttpUrl(value) ? value.trim() : "")}
        placeholder="https://example.com/image.jpg"
        className="bg-black/40 backdrop-blur-md border-gray-800 focus:ring-purple-500 text-gray-400 placeholder:text-gray-400 focus:text-white"
        disabled={disabled || isUploading}
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
          className="hidden"
          onChange={(e) => handleFileSelected(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploadDisabled}
          onClick={() => fileInputRef.current?.click()}
          className="bg-black/60 hover:bg-black/80 hover:text-gray-100 text-gray-300"
        >
          <FiUploadCloud size={16} className="text-cyan-400 mr-2" />
          {isUploading ? "Uploading to Arweave..." : "Upload image to Arweave"}
        </Button>
        <p className="text-xs text-gray-400">
          Paste a URL above, or upload an image and we&apos;ll store the Arweave
          URL for you.
        </p>
      </div>

      {!canUpload && (
        <p className="text-xs text-amber-200/90">
          {address
            ? "Uploading needs a Wander or Beacon wallet — the connected EVM wallet cannot sign Arweave uploads."
            : "Connect your Wander wallet to upload an image."}
        </p>
      )}

      <p className="text-xs text-gray-500">
        Images up to {formatBytes(FREE_UPLOAD_MAX_BYTES)} upload for free;
        larger files (up to {formatBytes(MAX_IMAGE_UPLOAD_BYTES)}) need Turbo
        credits.
      </p>

      {uploadedTxId && (
        <div className="rounded-lg border border-cyan-500/40 bg-cyan-950/20 p-3 text-xs text-cyan-100">
          <p className="font-medium">Uploaded to Arweave.</p>
          <a
            href={`https://arweave.net/${uploadedTxId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block break-all text-cyan-300 underline underline-offset-4"
          >
            {uploadedTxId}
          </a>
        </div>
      )}

      {uploadError && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-200">
          {uploadError}
        </div>
      )}
    </div>
  );
}
