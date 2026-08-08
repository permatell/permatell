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
import {
  COMPRESSION_TARGET_BYTES,
  canCompressImageType,
  compressImageToTarget,
  isAnimatedGif,
} from "@/lib/image-compress";
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

interface OversizeFile {
  file: File;
  compressible: boolean;
  animatedGif: boolean;
}

type UploadStatus = "idle" | "compressing" | "uploading";

export function CoverImageField({
  value,
  onChange,
  onPreviewChange,
  disabled = false,
  id = "coverImage",
}: CoverImageFieldProps) {
  const { address, walletType } = useWallet();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [uploadError, setUploadError] = useState("");
  const [uploadedTxId, setUploadedTxId] = useState("");
  const [uploadNote, setUploadNote] = useState("");
  const [oversize, setOversize] = useState<OversizeFile | null>(null);

  const isBusy = status !== "idle";
  const canUpload = Boolean(address) && walletType !== "evm";
  const uploadDisabled = disabled || isBusy || !canUpload;

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const runUpload = async (file: File, note: string) => {
    setStatus("uploading");
    try {
      const result = await uploadImage(file, { contentType: file.type });
      setUploadedTxId(result.id);
      setUploadNote(note);
      setOversize(null);
      onChange(result.url);
      onPreviewChange(result.url);
      toast.success(
        note
          ? "Cover image compressed and uploaded to Arweave"
          : "Cover image uploaded to Arweave"
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not upload the image to Arweave.";
      setUploadError(message);
      toast.error(message);
    } finally {
      setStatus("idle");
    }
  };

  const handleFileSelected = async (file?: File | null) => {
    if (!file) return;

    setUploadError("");
    setUploadedTxId("");
    setUploadNote("");
    setOversize(null);
    resetFileInput();

    const validationError = validateImageFile(file);
    if (validationError) {
      setUploadError(validationError);
      toast.error(validationError);
      return;
    }

    if (file.size <= FREE_UPLOAD_MAX_BYTES) {
      await runUpload(file, "");
      return;
    }

    setOversize({
      file,
      compressible: canCompressImageType(file.type),
      animatedGif: await isAnimatedGif(file),
    });
  };

  const handleCompressAndUpload = async () => {
    if (!oversize) return;

    const { file } = oversize;
    setUploadError("");
    setStatus("compressing");

    try {
      const result = await compressImageToTarget(file);

      if (!result.reachedTarget) {
        const message = `Could not get this image under ${formatBytes(
          COMPRESSION_TARGET_BYTES
        )} — the smallest version was ${formatBytes(
          result.bytes
        )}. Try a simpler image, or upload the original with Turbo credits.`;
        setUploadError(message);
        toast.error(message);
        setStatus("idle");
        return;
      }

      const parts = [
        `Compressed ${formatBytes(result.originalBytes)} → ${formatBytes(
          result.bytes
        )}`,
        `${result.format === "image/webp" ? "WebP" : "JPEG"} ${result.width}×${
          result.height
        }`,
      ];
      if (result.alphaFlattened) parts.push("transparency flattened onto white");
      if (oversize.animatedGif) parts.push("first frame only");

      await runUpload(result.file, parts.join(", "));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not compress that image.";
      setUploadError(message);
      toast.error(message);
      setStatus("idle");
    }
  };

  const buttonLabel =
    status === "compressing"
      ? "Compressing..."
      : status === "uploading"
      ? "Uploading to Arweave..."
      : "Upload image to Arweave";

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
        disabled={disabled || isBusy}
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
          {buttonLabel}
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
        Images up to {formatBytes(FREE_UPLOAD_MAX_BYTES)} upload for free.
        Anything larger (up to {formatBytes(MAX_IMAGE_UPLOAD_BYTES)}) can be
        compressed here to fit, or uploaded as-is with Turbo credits.
      </p>

      {oversize && (
        <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-950/20 p-3 text-xs text-amber-100">
          <p>
            <span className="font-medium break-all">{oversize.file.name}</span>{" "}
            is {formatBytes(oversize.file.size)}, over the{" "}
            {formatBytes(FREE_UPLOAD_MAX_BYTES)} free upload limit.
          </p>

          {oversize.compressible ? (
            <p className="text-amber-200/80">
              Compressing resizes it to at most 1600px and re-encodes it to
              around {formatBytes(COMPRESSION_TARGET_BYTES)} so it uploads for
              free.
              {oversize.animatedGif
                ? " This GIF is animated — compressing keeps only the first frame."
                : ""}
            </p>
          ) : (
            <p className="text-amber-200/80">
              This is a vector image, so resizing cannot make it smaller.
              Simplify the SVG, or upload it with Turbo credits.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {oversize.compressible && (
              <Button
                type="button"
                size="sm"
                disabled={disabled || isBusy}
                onClick={handleCompressAndUpload}
                className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white border-none"
              >
                {status === "compressing"
                  ? "Compressing..."
                  : "Compress to fit free upload"}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || isBusy}
              onClick={() => runUpload(oversize.file, "")}
              className="bg-black/60 hover:bg-black/80 hover:text-gray-100 text-gray-300"
            >
              Upload original (needs Turbo credits)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isBusy}
              onClick={() => setOversize(null)}
              className="text-gray-400 hover:text-gray-200"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {uploadedTxId && (
        <div className="rounded-lg border border-cyan-500/40 bg-cyan-950/20 p-3 text-xs text-cyan-100">
          <p className="font-medium">Uploaded to Arweave.</p>
          {uploadNote && (
            <p className="mt-1 text-cyan-200/80">{uploadNote}.</p>
          )}
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
