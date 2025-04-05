"use client";

import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DisclaimerPage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <PageHeader title="Disclaimer">
        <Link href="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </PageHeader>

      <div className="bg-black/40 backdrop-blur-md border border-gray-800 rounded-lg p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Token Gating Policy</h2>
        <p className="text-gray-300 mb-4">
          PermaTell is a token-gated platform that requires users to hold at least one $HOOD token (Contract ID: Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE) to access content and contribute to the platform.
        </p>
        
        <h3 className="text-lg font-semibold mb-2 text-white">Get $HOOD Tokens</h3>
        <p className="text-gray-300 mb-4">
          You can acquire $HOOD tokens through the following methods:
        </p>
        <ul className="list-disc pl-5 mb-4 text-gray-300 space-y-2">
          <li>
            <Link 
              href="/mint-guide"
              className="text-purple-400 hover:text-purple-300 underline"
            >
              Mint $HOOD tokens by allocating AO yield
            </Link>
          </li>
          <li>
            <a 
              href="https://www.ao.link/#/token/Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 underline"
            >
              View $HOOD on AO Chain Explorer
            </a>
          </li>
          <li>
            <a 
              href="https://botega.arweave.net/#/swap?from=xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10&to=Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 underline"
            >
              Buy $HOOD on Botega
            </a>
          </li>
          <li>
            <a 
              href="https://dexi.arweave.net/#/pool/BBiwIhEU9vxmSvtY0KkX5WTMudUcAS3-WKxAqIwoTKA" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 underline"
            >
              Trade $HOOD on DEX
            </a>
          </li>
        </ul>
        
        <h3 className="text-lg font-semibold mb-2 text-white">Why Token Gating?</h3>
        <ul className="list-disc pl-5 mb-4 text-gray-300 space-y-2">
          <li>To create a community of committed users who have a stake in the platform</li>
          <li>To reduce spam and low-quality content</li>
          <li>To support the long-term sustainability of the platform</li>
        </ul>
        
        <h2 className="text-xl font-semibold mb-4 mt-8 text-white">Content Disclaimer</h2>
        <p className="text-gray-300 mb-4">
          PermaTell is a fully decentralized platform where content is stored on the Arweave blockchain. As such:
        </p>
        
        <ul className="list-disc pl-5 mb-4 text-gray-300 space-y-2">
          <li>We do not control, moderate, or have the ability to remove content once it is published</li>
          <li>Content published on PermaTell is permanent and immutable</li>
          <li>Users are solely responsible for the content they publish</li>
          <li>We do not endorse any content published on the platform</li>
        </ul>
        
        <h2 className="text-xl font-semibold mb-4 mt-8 text-white">Alpha Status</h2>
        <p className="text-gray-300 mb-4">
          PermaTell is currently in alpha stage, which means:
        </p>
        
        <ul className="list-disc pl-5 mb-4 text-gray-300 space-y-2">
          <li>The platform is still under active development</li>
          <li>Features may change or be removed without notice</li>
          <li>There may be bugs or performance issues</li>
          <li>We recommend backing up any important content you publish</li>
        </ul>
        
        <div className="mt-8 p-4 bg-purple-900/30 border border-purple-800 rounded-lg">
          <p className="text-purple-200 text-sm">
            By using PermaTell, you acknowledge that you have read and understood this disclaimer and agree to abide by the platform's token gating policy.
          </p>
        </div>
      </div>
    </div>
  );
}
