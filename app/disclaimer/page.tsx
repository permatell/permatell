"use client";

import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function DisclaimerPage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <PageHeader title="Disclaimer">
        <Link href="/dashboard">
          <Button variant="outline" className="bg-purple-600/20 hover:bg-purple-600/30 text-white border-purple-500/50">Back to Dashboard</Button>
        </Link>
      </PageHeader>

      <div className="space-y-6">
        {/* Main Content Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/40 backdrop-blur-md border border-gray-800 rounded-lg p-6"
        >
          <h2 className="text-xl font-semibold mb-4 text-white">Platform Overview</h2>
          <p className="text-gray-300 mb-4">
            PermaTell is a decentralized storytelling platform built on the Arweave blockchain, 
            designed to empower creators and readers through permanent, immutable content storage.
          </p>
        </motion.div>

        {/* Coming Soon Feature Teaser */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative overflow-hidden"
        >
          <div className="bg-gradient-to-r from-purple-500/5 to-cyan-500/5 border border-gray-800 rounded-lg p-6">
            <div className="relative z-10">
              <h3 className="text-lg font-semibold mb-2 text-white/90">Coming Soon: $HOOD Token Integration</h3>
              <div className="space-y-3">
                <div className="blur-[2px]">
                  <p className="text-gray-400 select-none">
                    Experience the future of decentralized storytelling with $HOOD tokens. 
                    Unlock exclusive features and become part of our thriving community.
                  </p>
                </div>
                <div className="blur-[1px]">
                  <ul className="list-disc text-gray-400 pl-5 select-none">
                    <li>Token-gated premium features</li>
                    <li>Community governance participation</li>
                    <li>Exclusive content access</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
              <span className="bg-gradient-to-r from-purple-500 to-cyan-500 bg-clip-text text-transparent font-semibold text-lg">
                Coming Soon
              </span>
            </div>
          </div>
        </motion.div>

        {/* Content Disclaimer */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-black/40 backdrop-blur-md border border-gray-800 rounded-lg p-6"
        >
          <h2 className="text-xl font-semibold mb-4 text-white">Content Disclaimer</h2>
          <p className="text-gray-300 mb-4">
            PermaTell is a fully decentralized platform where content is stored on the Arweave blockchain. As such:
          </p>
          <ul className="list-disc pl-5 mb-4 text-gray-300 space-y-2">
            <li>We do not control, moderate, or have the ability to remove content once it is published</li>
            <li>Content published on PermaTell is permanent and immutable</li>
            <li>Users are solely responsible for the content they publish</li>
            <li>We do not endorse any content published on the platform</li>
          </ul>
        </motion.div>

        {/* Alpha Status */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-black/40 backdrop-blur-md border border-gray-800 rounded-lg p-6"
        >
          <h2 className="text-xl font-semibold mb-4 text-white">Alpha Status</h2>
          <p className="text-gray-300 mb-4">
            PermaTell is currently in alpha stage, which means:
          </p>
          <ul className="list-disc pl-5 mb-4 text-gray-300 space-y-2">
            <li>The platform is still under active development</li>
            <li>Features may change or be added without notice</li>
            <li>There may be bugs or performance issues</li>
            <li>We recommend backing up any important content you publish</li>
          </ul>
        </motion.div>

        {/* Agreement Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 p-4 bg-purple-900/30 border border-purple-800 rounded-lg"
        >
          <p className="text-purple-200 text-sm">
            By using PermaTell, you acknowledge that you have read and understood this disclaimer. 
            Stay tuned for exciting new features and updates coming to the platform.
          </p>
        </motion.div>
      </div>
    </div>
  );
} 