"use client";
import React, { useState, useEffect } from "react";
import { useStoryPointsProcess } from "@/contexts/StoryPointsProcessContext";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { FaUser, FaStar } from "react-icons/fa";
import { Spinner } from "@/components/ui/spinner";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/page-header";

const AuthorBoard: React.FC = () => {
  const { getAllStoryPoints, allUsersStoryPoints, loading } =
    useStoryPointsProcess();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortedAuthors, setSortedAuthors] = useState<[string, number][]>([]);

  useEffect(() => {
    getAllStoryPoints();
  }, []);

  useEffect(() => {
    const sorted = Object.entries(allUsersStoryPoints)
      .sort(([, a], [, b]) => b - a)
      .filter(([address]) =>
        address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    setSortedAuthors(sorted);
  }, [allUsersStoryPoints, searchTerm]);

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

      {loading ? (
        <div className="flex justify-center items-center">
          <Spinner className="text-purple-500" />
        </div>
      ) : sortedAuthors.length > 0 ? (
        <div className="space-y-4">
          {sortedAuthors.map(([address, points], index) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              key={address}
              className="flex items-center space-x-4 p-4 bg-gradient-to-br from-black to-[#0F0514]/95 backdrop-blur-md border border-gray-800/50 rounded-lg shadow-lg hover:shadow-purple-500/20 transition-all duration-300"
            >
              <span className="font-bold text-white/90">{index + 1}.</span>
              <Avatar className="h-10 w-10 bg-black/60 flex items-center justify-center">
                <FaUser className="text-gray-400" />
              </Avatar>
              <span className="flex-grow font-mono text-sm text-gray-300">
                {address}
              </span>
              <div className="flex items-center space-x-1">
                <FaStar
                  size={16}
                  className={`flex-shrink-0 ${getPointColor(index)}`}
                />
                <span className={`font-bold mt-[2px] ${getPointColor(index)}`}>
                  {points}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500">No authors found</div>
      )}
    </div>
  );
};

export default AuthorBoard;
