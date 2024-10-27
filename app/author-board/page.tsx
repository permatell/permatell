"use client";
import React, { useState, useEffect } from "react";
import { useStoryPointsProcess } from "@/contexts/StoryPointsProcessContext";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { FaUser, FaStar } from "react-icons/fa";
import { Spinner } from "@/components/ui/spinner";

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
        return "text-black";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Author Leaderboard</h1>
      <Input
        type="text"
        placeholder="Search by address"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-6"
      />
      {loading ? (
        <div className="flex justify-center items-center">
          <Spinner />
        </div>
      ) : sortedAuthors.length > 0 ? (
        <div className="space-y-4">
          {sortedAuthors.map(([address, points], index) => (
            <div
              key={address}
              className="flex items-center space-x-4 p-4 bg-gray-100 rounded-lg"
            >
              <span className="font-bold">{index + 1}.</span>
              <Avatar className="h-10 w-10 bg-gray-300 flex items-center justify-center">
                <FaUser className="text-gray-600" />
              </Avatar>
              <span className="flex-grow font-mono text-sm">{address}</span>
              <div className="flex items-center space-x-1">
                <FaStar
                  size={16}
                  className={`flex-shrink-0 ${getPointColor(index)}`}
                />
                <span className={`font-bold mt-[2px] ${getPointColor(index)}`}>
                  {points}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500">No authors found</div>
      )}
    </div>
  );
};

export default AuthorBoard;
