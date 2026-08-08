"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useStoryPointsProcess } from "@/contexts/StoryPointsProcessContext";
import { Input } from "@/components/ui/input";
import { FaStar } from "react-icons/fa";
import { Spinner } from "@/components/ui/spinner";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/page-header";
import { useStoriesProcess } from "@/contexts/StoriesProcessContext";
import { IoBookOutline } from "react-icons/io5";
import { IoMdArrowDropdown, IoMdArrowDropup } from "react-icons/io";
import Link from "next/link";
import { useWallet } from "@/contexts/WalletContext";
import { AuthorAvatar } from "@/components/ui/author-avatar";
import { ArnsName } from "@/components/ui/arns-name";
import { useNetworkMode } from "@/contexts/NetworkModeContext";
import {
  fetchDiscoverPomps,
  fetchPompCampaignInfo,
  type PompCampaignInfo,
  type PompClaimedAsset,
} from "@/lib/pomp";

/** Score authors from the Discovery story set: +10 per story, +1 per vote. */
function aggregateAuthorScoresFromStories(
  stories: Array<{
    version_data?: { author?: string; votes?: number };
    author?: string;
  }>
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const story of stories) {
    const author =
      story.version_data?.author ||
      (typeof story.author === "string" ? story.author : "");
    if (!author) continue;
    const votes = Number(story.version_data?.votes) || 0;
    scores[author] = (scores[author] || 0) + 10 + votes;
  }
  return scores;
}

const AuthorBoard: React.FC = () => {
  const { getAllStoryPoints, allUsersStoryPoints, loading } =
    useStoryPointsProcess();
  const { stories, getStories, loading: storiesLoading } = useStoriesProcess();
  const { networkMode } = useNetworkMode();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortedAuthors, setSortedAuthors] = useState<[string, number][]>([]);
  const [authorStories, setAuthorStories] = useState<Record<string, any[]>>({});
  const [expandedAuthor, setExpandedAuthor] = useState<string | null>(null);
  const [pomps, setPomps] = useState<PompClaimedAsset[]>([]);
  const [pompCampaignStats, setPompCampaignStats] = useState<
    Record<string, PompCampaignInfo>
  >({});
  const [loadingPomps, setLoadingPomps] = useState(false);
  const { address } = useWallet();

  useEffect(() => {
    if (networkMode !== "mainnet") {
      getAllStoryPoints();
    }
    getStories();
  }, [networkMode]);

  useEffect(() => {
    setLoadingPomps(true);
    fetchDiscoverPomps(50)
      .then(async (discovered) => {
        setPomps(discovered);
        const nativePomps = discovered
          .filter((pomp) => pomp.assetType === "native-event")
          .slice(0, 6);
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
        console.warn("Unable to load POMP leaderboard:", error);
        setPomps([]);
        setPompCampaignStats({});
      })
      .finally(() => setLoadingPomps(false));
  }, []);

  useEffect(() => {
    const storyMap: Record<string, any[]> = {};
    stories.forEach((story) => {
      const author = story.version_data?.author;
      if (!author) return;
      if (!storyMap[author]) {
        storyMap[author] = [];
      }
      storyMap[author].push(story);
    });
    setAuthorStories(storyMap);
  }, [stories]);

  useEffect(() => {
    // Mainnet ranks Discovery authors (same story set as dashboard).
    // Legacy keeps Story Points process rankings.
    const points =
      networkMode === "mainnet"
        ? aggregateAuthorScoresFromStories(stories)
        : allUsersStoryPoints;
    const sorted = Object.entries(points)
      .sort(([, a], [, b]) => b - a)
      .filter(([addr]) =>
        addr.toLowerCase().includes(searchTerm.toLowerCase())
      );
    setSortedAuthors(sorted);
  }, [allUsersStoryPoints, searchTerm, stories, networkMode]);

  const getPointColor = (index: number) => {
    switch (index) {
      case 0:
        return "text-yellow-500";
      case 1:
        return "text-gray-400";
      case 2:
        return "text-amber-600";
      default:
        return "text-white/70";
    }
  };

  const toggleAuthor = (address: string) => {
    setExpandedAuthor(expandedAuthor === address ? null : address);
  };

  const rankedPomps = useMemo(
    () =>
      pomps
        .filter((pomp) => pomp.assetType === "native-event")
        .map((pomp) => ({
          pomp,
          stats: pompCampaignStats[pomp.assetId],
        }))
        .sort((a, b) => (b.stats?.claimed || 0) - (a.stats?.claimed || 0)),
    [pompCampaignStats, pomps]
  );

  const authorBoardLoading =
    storiesLoading || (networkMode !== "mainnet" && loading);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title="Author Leaderboard" />

      <Input
        type="text"
        placeholder="Search by address"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-6 bg-black/40 backdrop-blur-md border-gray-800 focus:ring-purple-500 text-gray-400 placeholder:text-gray-400 focus:text-white"
      />

      {authorBoardLoading ? (
        <div className="flex justify-center items-center min-h-[200px]">
          <Spinner className="text-purple-500 w-8 h-8" />
        </div>
      ) : sortedAuthors.length > 0 ? (
        <div className="space-y-4">
          {sortedAuthors.map(([authorAddress, points], index) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              key={authorAddress}
              className={`flex flex-col p-4 bg-gradient-to-br from-black to-[#0F0514]/95 backdrop-blur-md border ${
                address?.toLowerCase() === authorAddress.toLowerCase()
                  ? "border-purple-500/50 shadow-lg shadow-purple-500/20"
                  : "border-gray-800/50"
              } rounded-lg shadow-lg hover:shadow-purple-500/20 transition-all duration-300`}
            >
              <div
                className="flex items-center space-x-4 cursor-pointer"
                onClick={() => toggleAuthor(authorAddress)}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-white/90">{index + 1}.</span>
                    <AuthorAvatar address={authorAddress} size="md" />
                    <div className="flex-grow">
                      <p className="font-medium text-white/90">
                        <ArnsName address={authorAddress || null} showAddress={true} />
                      </p>
                      <p className="text-sm text-gray-500">
                        {points} points
                        {networkMode === "mainnet" &&
                        authorStories[authorAddress]?.length
                          ? ` · ${authorStories[authorAddress].length} stor${
                              authorStories[authorAddress].length === 1
                                ? "y"
                                : "ies"
                            }`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <FaStar
                      size={16}
                      className={`flex-shrink-0 ${getPointColor(index)}`}
                    />
                    <span
                      className={`font-bold mt-[2px] ${getPointColor(index)}`}
                    >
                      {points}
                    </span>
                    {authorStories[authorAddress]?.length > 0 && (
                      <>
                        <span className="mx-2 text-gray-500">|</span>
                        {expandedAuthor === authorAddress ? (
                          <IoMdArrowDropup className="text-gray-400 text-xl" />
                        ) : (
                          <IoMdArrowDropdown className="text-gray-400 text-xl" />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {expandedAuthor === authorAddress &&
                authorStories[authorAddress]?.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 space-y-2 border-t border-gray-800/50 pt-4"
                  >
                    <div className="pl-8">
                      <div className="space-y-2">
                        {authorStories[authorAddress].map((story) => (
                          <Link
                            key={story.id}
                            href={`/story/${story.id}`}
                            className="flex items-center space-x-2 p-2 rounded-md hover:bg-white/5 transition-colors group"
                          >
                            <IoBookOutline className="text-purple-400 group-hover:text-purple-300" />
                            <span className="text-sm text-gray-300 group-hover:text-purple-300">
                              {story.version_data?.title || "Untitled"}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500">No authors found</div>
      )}

      <div className="mt-10 border-t border-gray-800/60 pt-8">
        <div className="mb-5">
          <h2 className="text-2xl font-semibold text-white/90">
            POMP Leaderboard
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Native POMP campaigns ranked by claim count from their AO asset
            state.
          </p>
        </div>

        {loadingPomps ? (
          <div className="flex min-h-[120px] items-center justify-center">
            <Spinner className="h-8 w-8 text-purple-500" />
          </div>
        ) : rankedPomps.length > 0 ? (
          <div className="space-y-4">
            {rankedPomps.map(({ pomp, stats }, index) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                key={pomp.assetId}
                className="rounded-lg border border-purple-500/25 bg-gradient-to-br from-black to-[#0F0514]/95 p-4 shadow-lg transition-all duration-300 hover:shadow-purple-500/20"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4 sm:w-2/5">
                    <span className={`font-bold ${getPointColor(index)}`}>
                      {index + 1}.
                    </span>
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-gray-950">
                      {pomp.artworkUrl ? (
                        <img
                          src={pomp.artworkUrl}
                          alt={pomp.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-gray-500">
                          POMP
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white/90">
                        {pomp.title}
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-gray-500">
                        {pomp.assetId}
                      </p>
                    </div>
                  </div>
                  <div className="grid flex-1 grid-cols-3 gap-3 text-sm">
                    <div className="rounded-md bg-black/30 p-3">
                      <p className="text-xs text-gray-500">Claims</p>
                      <p className="mt-1 font-semibold text-white">
                        {stats?.claimed ?? 0}
                      </p>
                    </div>
                    <div className="rounded-md bg-black/30 p-3">
                      <p className="text-xs text-gray-500">Remaining</p>
                      <p className="mt-1 font-semibold text-white">
                        {stats?.remaining ?? "Indexing"}
                      </p>
                    </div>
                    <div className="rounded-md bg-black/30 p-3">
                      <p className="text-xs text-gray-500">Creator</p>
                      <p className="mt-1 truncate font-mono text-xs text-white">
                        {pomp.arweaveOwner || "Unknown"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <Link
                      href={`/pomp/claim/${pomp.assetId}`}
                      className="text-cyan-300 hover:text-cyan-200"
                    >
                      Claim
                    </Link>
                    <a
                      href={pomp.bazarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-300 hover:text-cyan-200"
                    >
                      Bazar
                    </a>
                    <a
                      href={pomp.arweaveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-300 hover:text-cyan-200"
                    >
                      Arweave
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-gray-800/50 bg-black/30 p-6 text-center text-gray-500">
            No native POMP campaigns found yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthorBoard;
