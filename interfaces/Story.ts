import { StoryVersion } from "./StoryVersion";

export interface Story {
  id: string;
  is_public: boolean;
  cover_image: string;
  author: string;
  title: string;
  versions: { [key: string]: StoryVersion };
  current_version: string;
}

export interface CurrentStory {
  id: string;
  is_public: boolean;
  current_version: string;
  version_data: StoryVersion;
}
