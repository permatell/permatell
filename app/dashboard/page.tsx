"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardContainer } from "@/components/ui/card-container";
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
import { CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { STORY_CATEGORIES } from "../constants/categories";
import { IoMdThumbsUp, IoMdArrowBack, IoMdArrowForward } from "react-icons/io";
import { AnimatePresence, motion } from "framer-motion";
import { FaUser, FaStar } from "react-icons/fa";
import { useStoryPointsProcess } from "@/contexts/StoryPointsProcessContext";
import { Avatar } from "@/components/ui/avatar";

// ✅ Import AoSyncWrapper
import { AoSyncWrapper } from "@/components/AoSyncWrapper";

const Dashboard = () => {
  const { stories, getStories, loading } = useStoriesProcess();
  const { address } = useWallet();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [topStories, setTopStories] = useState<any[]>([]);
  const { getAllStoryPoints, allUsersStoryPoints } = useStoryPointsProcess();
  const [topAuthors, setTopAuthors] = useState<[string, number][]>([]);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    if (stories.length === 0 && !loading) {
      getStories();
    }
  }, [getStories, stories.length, loading]);

  useEffect(() => {
    if (Object.keys(allUsersStoryPoints).length === 0) {
      getAllStoryPoints();
    }
  }, [getAllStoryPoints, allUsersStoryPoints]);

  useEffect(() => {
    if (Object.keys(allUsersStoryPoints).length > 0) {
      const sorted = Object.entries(allUsersStoryPoints)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);
      setTopAuthors(sorted);
    }
  }, [allUsersStoryPoints]);

  useEffect(() => {
    if (stories.length > 0) {
      const sorted = [...stories].sort(
        (a, b) => b.version_data.votes - a.version_data.votes
      );
      setTopStories(sorted.slice(0, 3));
    }
  }, [stories]);

  useEffect(() => {
    if (topStories.length === 0 || isHovering) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % topStories.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [topStories.length, isHovering]);

  return (
    <div className="container mx-auto py-6 px-4">
      {/* ✅ Add AoSyncWrapper Here */}
      <AoSyncWrapper />

      <PageHeader title="Discover Stories">
        <div className="flex gap-3">
          {address ? (
            <Link href="/story/create">
              <Button className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-none">
                Create New Story
              </Button>
            </Link>
          ) : (
            <Button
              disabled
              className="bg-gradient-to-r from-green-500/50 to-emerald-500/50 text-white/70 border-none cursor-not-allowed"
            >
              Connect Wallet to Create
            </Button>
          )}
          <Link href="/author-board">
            <Button className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white border-none">
              Author Board
            </Button>
          </Link>
        </div>
      </PageHeader>

      {/* Rest of your existing code */}
      
    </div>
  );
};

export default Dashboard;
