"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Award } from "lucide-react";
import { useStoryPointsProcess } from "@/contexts/StoryPointsProcessContext";
import { AuthorAvatar } from "@/components/ui/author-avatar";
import { ArnsName } from "@/components/ui/arns-name";
import {
  fetchDiscoverPomps,
  fetchPompCampaignInfo,
  type PompCampaignInfo,
  type PompClaimedAsset,
} from "@/lib/pomp";

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
  const [pomps, setPomps] = useState<PompClaimedAsset[]>([]);
  const [pompCampaignStats, setPompCampaignStats] = useState<
    Record<string, PompCampaignInfo>
  >({});
  const [loadingPomps, setLoadingPomps] = useState(false);
  const requestedStoriesRef = useRef(false);
  const requestedStoryPointsRef = useRef(false);
  const requestedPompsRef = useRef(false);

  useEffect(() => {
    if (!requestedStoriesRef.current && stories.length === 0 && !loading) {
      requestedStoriesRef.current = true;
      getStories();
    }
  }, [getStories, stories.length, loading]);

  useEffect(() => {
    if (
      !requestedStoryPointsRef.current &&
      Object.keys(allUsersStoryPoints).length === 0
    ) {
      requestedStoryPointsRef.current = true;
      getAllStoryPoints();
    }
  }, [getAllStoryPoints, allUsersStoryPoints]);

  useEffect(() => {
    if (requestedPompsRef.current) return;
    requestedPompsRef.current = true;
    setLoadingPomps(true);
    fetchDiscoverPomps(36)
      .then(async (discovered) => {
        setPomps(discovered);
        const nativePomps = discovered
          .filter((pomp) => pomp.assetType === "native-event")
          .slice(0, 12);
        const stats = await Promise.allSettled(
          nativePomps.map(async (pomp) => ({
            assetId: pomp.assetId,
            campaign: await fetchPompCampaignInfo(pomp.assetId),
          }))
        );
        const nextStats: Record<string, PompCampaignInfo> = {};
        for (const result of stats) {
          if (result.status === "fulfilled") {
            nextStats[result.value.assetId] = result.value.campaign;
          }
        }
        setPompCampaignStats(nextStats);
      })
      .catch((error) => {
        console.warn("Unable to load POMPs for discovery:", error);
        setPomps([]);
        setPompCampaignStats({});
      })
      .finally(() => setLoadingPomps(false));
  }, []);

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

  const filteredStories = stories.filter(
    (story) =>
      story.version_data.title
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) &&
      (selectedCategory === "All" ||
        story.version_data.category === selectedCategory)
  );

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % topStories.length);
  };

  const prevSlide = () => {
    setCurrentSlide(
      (prev) => (prev - 1 + topStories.length) % topStories.length
    );
  };

  const topPomps = useMemo(
    () =>
      pomps
        .filter((pomp) => pomp.assetType === "native-event")
        .map((pomp) => ({
          pomp,
          stats: pompCampaignStats[pomp.assetId],
        }))
        .sort((a, b) => (b.stats?.claimed || 0) - (a.stats?.claimed || 0))
        .slice(0, 3),
    [pompCampaignStats, pomps]
  );

  return (
    <div className="container mx-auto py-6 px-4">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2">
          {topStories.length > 0 && (
            <div
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              <CardContainer className="overflow-hidden relative h-[320px] bg-gradient-to-br from-black to-[#0F0514]/95 backdrop-blur-md border border-gray-800/50 shadow-lg hover:shadow-purple-500/20 transition-all duration-300">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlide}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="h-full"
                  >
                    <div className="md:flex h-full">
                      <div className="md:w-1/3 h-48 md:h-full relative">
                        <img
                          src={
                            topStories[currentSlide].version_data.cover_image ||
                            "/no_cover.webp"
                          }
                          alt={`Cover for ${topStories[currentSlide].version_data.title}`}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      </div>
                      <div className="md:w-2/3 p-6 flex flex-col">
                        <h2 className="text-2xl font-bold mb-2 text-white/95">
                          Featured Stories
                        </h2>
                        <CardTitle className="text-2xl mb-2 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                          {topStories[currentSlide].version_data.title}
                        </CardTitle>
                        <p className="text-gray-200 mb-4 line-clamp-3">
                          {topStories[currentSlide].version_data.description}
                        </p>
                        <div className="mb-4">
                          <p className="text-sm text-gray-300 italic line-clamp-2">
                            "
                            {topStories[
                              currentSlide
                            ].version_data.content.slice(0, 150)}
                            ..."
                          </p>
                        </div>
                        <div className="flex items-center mb-4">
                          <IoMdThumbsUp
                            size={20}
                            className="text-yellow-500 mr-2"
                          />
                          <span className="text-gray-300">
                            {topStories[currentSlide].version_data.votes} votes
                          </span>
                        </div>
                        <div className="mt-auto">
                          <Link href={`/story/${topStories[currentSlide].id}`}>
                            <Button className="bg-gradient-to-br from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-gray-200 border border-gray-700">
                              Read Story
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <Button
                    onClick={prevSlide}
                    variant="ghost"
                    className="h-8 w-8 p-0 bg-black/40 hover:bg-black/60 text-white"
                  >
                    <IoMdArrowBack />
                  </Button>
                  <Button
                    onClick={nextSlide}
                    variant="ghost"
                    className="h-8 w-8 p-0 bg-black/40 hover:bg-black/60 text-white"
                  >
                    <IoMdArrowForward />
                  </Button>
                </div>
              </CardContainer>
            </div>
          )}
        </div>

        <div className="md:col-span-1">
          <h2 className="text-xl font-bold mb-4 text-white/95">Top Authors</h2>
          <div className="space-y-3">
            {topAuthors.map(([address, points], index) => (
              <div
                key={address}
                className="flex items-center space-x-3 p-3 bg-black/40 rounded-lg hover:bg-black/60 transition-colors"
              >
                <div className="flex-shrink-0">
                  <AuthorAvatar address={address} size="md" />
                </div>
                <div className="flex-grow">
                  <p className="font-medium text-white/90">
                    <ArnsName address={address || null} showAddress={true} />
                  </p>
                  <p className="text-sm text-gray-500">{points} points</p>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <FaStar
                    size={14}
                    className={
                      index === 0
                        ? "text-yellow-500"
                        : index === 1
                        ? "text-gray-400"
                        : "text-amber-600"
                    }
                  />
                  <span className="font-bold text-sm text-gray-300">
                    {points}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <h2 className="mb-4 mt-8 text-xl font-bold text-white/95">
            Top POMPs
          </h2>
          <div className="space-y-3">
            {topPomps.length > 0 ? (
              topPomps.map(({ pomp, stats }, index) => (
                <Link
                  key={pomp.assetId}
                  href={`/pomp/claim/${pomp.assetId}`}
                  className="block rounded-lg bg-black/40 p-3 transition-colors hover:bg-black/60"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-950">
                      {pomp.artworkUrl ? (
                        <img
                          src={pomp.artworkUrl}
                          alt={pomp.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Award className="h-5 w-5 text-purple-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-grow">
                      <p className="truncate font-medium text-white/90">
                        {pomp.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        {stats ? `${stats.claimed} claims` : "Indexing claims"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-bold text-purple-200">
                      <FaStar
                        size={14}
                        className={index === 0 ? "text-yellow-500" : "text-gray-400"}
                      />
                      <span>{stats?.claimed || 0}</span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-lg bg-black/30 p-3 text-sm text-gray-500">
                No native POMP campaigns ranked yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-white/90">
              POMP Memories
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              POAP migrations and native POMP events discovered from Arweave/AO.
            </p>
          </div>
          <Link href="/pomp">
            <Button className="bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:from-purple-600 hover:to-cyan-600">
              Create POMP
            </Button>
          </Link>
        </div>

        {loadingPomps ? (
          <div className="flex justify-center items-center py-8">
            <Spinner className="text-purple-500" />
          </div>
        ) : pomps.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pomps.map((pomp, index) => (
              <motion.div
                key={pomp.assetId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <CardContainer className="overflow-hidden flex flex-col relative h-[300px] bg-gradient-to-br from-black to-[#0F0514]/95 backdrop-blur-md border border-purple-500/25 shadow-lg hover:shadow-purple-500/20 transition-all duration-300">
                  <div className="absolute top-2 right-2 z-10 rounded-full bg-black/80 px-2 py-1 text-[11px] font-semibold text-purple-100">
                    {pomp.assetType === "native-event"
                      ? "Native POMP"
                      : "POAP POMP"}
                  </div>
                  <div className="relative h-36 bg-gray-950">
                    {pomp.artworkUrl ? (
                      <img
                        src={pomp.artworkUrl}
                        alt={`Artwork for ${pomp.title}`}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-gray-500">
                        POMP
                      </div>
                    )}
                  </div>
                  <CardHeader className="pb-1 pt-3">
                    <CardTitle className="bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent truncate text-base">
                      {pomp.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-grow pt-1">
                    <div className="space-y-1">
                      {pomp.tokenId && (
                        <p className="text-xs text-gray-300/90">
                          POAP token:{" "}
                          <b className="text-purple-200/90">{pomp.tokenId}</b>
                        </p>
                      )}
                      <p className="text-xs text-gray-300/90">
                        Creator:{" "}
                        <b className="text-purple-200/90">
                          {pomp.arweaveOwner
                            ? `${pomp.arweaveOwner.slice(0, 6)}...${pomp.arweaveOwner.slice(-4)}`
                            : "Unknown"}
                        </b>
                      </p>
                      {pomp.claimedAt && (
                        <p className="text-xs text-gray-500">
                          {new Date(pomp.claimedAt).toLocaleDateString()}
                        </p>
                      )}
                      {pomp.assetType === "native-event" && (
                        <p className="text-xs text-cyan-100/80">
                          Claims:{" "}
                          <b>
                            {pompCampaignStats[pomp.assetId]?.claimed ?? "indexing"}
                          </b>
                          {pompCampaignStats[pomp.assetId] &&
                            ` · Remaining: ${pompCampaignStats[pomp.assetId].remaining}`}
                        </p>
                      )}
                    </div>
                    <div
                      className={`mt-auto grid gap-2 ${
                        pomp.assetType === "native-event"
                          ? "grid-cols-3"
                          : "grid-cols-2"
                      }`}
                    >
                      {pomp.assetType === "native-event" && (
                        <Link href={`/pomp/claim/${pomp.assetId}`}>
                          <Button className="w-full border border-cyan-500/40 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15 text-sm h-8">
                            Claim
                          </Button>
                        </Link>
                      )}
                      <a
                        href={pomp.bazarUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button className="w-full bg-gradient-to-br from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-gray-200 border border-gray-700 text-sm h-8">
                          Bazar
                        </Button>
                      </a>
                      <a
                        href={pomp.arweaveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button className="w-full border border-gray-700 bg-black/40 text-gray-200 hover:bg-gray-900 text-sm h-8">
                          Arweave
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </CardContainer>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-gray-800 bg-black/30 p-6 text-center text-gray-400">
            No POMPs discovered yet.
          </div>
        )}
      </div>

      <h2 className="text-2xl font-semibold mb-4 text-white/90">
        Find Stories
      </h2>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex gap-4 mb-6"
      >
        <Input
          placeholder="Search for stories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow bg-black/40 backdrop-blur-md border-gray-800 focus:ring-purple-500 text-gray-400 placeholder:text-gray-400 focus:text-white"
        />
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[180px] bg-black/40 backdrop-blur-md border-gray-800 text-gray-400">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent className="border-gray-800">
            <SelectItem value="All">All Categories</SelectItem>
            {STORY_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <Spinner className="text-purple-500" />
        </div>
      ) : (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {filteredStories.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredStories.map((story, index) => (
                <motion.div
                  key={story.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <CardContainer className="overflow-hidden flex flex-col relative h-[280px] bg-gradient-to-br from-black to-[#0F0514]/95 backdrop-blur-md border border-gray-800/50 shadow-lg hover:shadow-purple-500/20 transition-all duration-300">
                    <div className="absolute top-2 right-2 bg-black/80 rounded-full p-1.5 shadow-md flex items-center justify-center z-10">
                      <IoMdThumbsUp
                        size={14}
                        className="text-yellow-500 mr-1"
                      />
                      <span className="text-xs font-semibold text-gray-300">
                        {story.version_data.votes}
                      </span>
                    </div>
                    <div className="relative h-28">
                      <img
                        src={story.version_data.cover_image || "/no_cover.webp"}
                        alt={`Cover for ${story.version_data.title}`}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </div>
                    <CardHeader className="pb-1 pt-2">
                      <CardTitle className="bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent truncate text-base mt-2">
                        {story.version_data.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-grow pt-1">
                      <div>
                        <p className="text-xs text-gray-300/90 mb-1">
                          Last contribution:{" "}
                          <b className="text-purple-200/90">
                            {story.version_data.author.slice(0, 6)}...
                            {story.version_data.author.slice(-4)}
                          </b>
                        </p>
                        <p className="text-xs text-gray-300/90">
                          Category:{" "}
                          <b className="text-purple-200/90">
                            {story.version_data.category}
                          </b>
                        </p>
                      </div>
                      <Link href={`/story/${story.id}`} className="mt-auto">
                        <Button className="w-full bg-gradient-to-br from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-gray-200 border border-gray-700 text-sm h-8">
                          Read Story
                        </Button>
                      </Link>
                    </CardContent>
                  </CardContainer>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-white/70">No stories found.</p>
          )}
        </motion.section>
      )}

      {/* Footer Section */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-12 pt-6 border-t border-gray-800"
      >
        <div className="flex justify-between items-center text-sm text-gray-400">
          <div className="flex items-center gap-4">
            <Link href="/disclaimer" className="hover:text-white transition-colors">
              Disclaimer
            </Link>
            <div className="relative group cursor-not-allowed">
              <span className="group-hover:text-white transition-colors">$HOOD Token</span>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Coming Soon
              </div>
            </div>
          </div>
          <div className="text-gray-500 text-xs">
            Alpha Version
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
