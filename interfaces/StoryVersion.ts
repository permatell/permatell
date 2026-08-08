import { StoryCategory } from "@/types/StoryCategory";

export interface StoryVersion {
  id: number;
  title: string;
  content: string;
  cover_image: string;
  author: string;
  timestamp: string;
  category: StoryCategory;
  votes: number;
  /** Wallet addresses that have upvoted this version (one vote per wallet). */
  voters?: Record<string, boolean>;
}
