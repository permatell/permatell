"use client";

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { getUserStoryProcesses, spawnStoryProcess } from '@/lib/ao-process-api';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from './button';

export interface ProcessStatusIndicatorProps {
  compact?: boolean;
}

export const ProcessStatusIndicator = ({ compact = false }: ProcessStatusIndicatorProps) => {
  const { address } = useWallet();
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [hasStoryProcess, setHasStoryProcess] = useState<boolean | null>(null);
  const [processIds, setProcessIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const checkUserProcesses = async () => {
    if (!address) return;
    
    setChecking(true);
    setError(null);
    
    try {
      // Check if ArConnect wallet is connected before proceeding
      if (typeof window !== 'undefined' && (!window.arweaveWallet || !window.arweaveWallet.getActiveAddress)) {
        setError("ArConnect wallet not connected or initialized properly. Please reconnect your wallet.");
        setHasStoryProcess(null);
        setChecking(false);
        return;
      }
      
      // Only proceed if we have a properly connected wallet
      const result = await getUserStoryProcesses(address);
      
      if (result && Array.isArray(result.Data) && result.Data.length > 0) {
        setHasStoryProcess(true);
        setProcessIds(result.Data);
      } else {
        setHasStoryProcess(false);
        setProcessIds([]);
      }
    } catch (err) {
      console.error("Error checking user processes:", err);
      
      // Provide better error messages for common failures
      if (err instanceof Error && err.message.includes("ZodError")) {
        setError("Wallet connection issue. Please refresh the page and reconnect your wallet.");
      } else if (err instanceof Error && err.message.includes("429")) {
        setError("Rate limited by AO network. Please try again in a few moments.");
      } else {
        setError("Failed to check processes. Please try again.");
      }
      
      setHasStoryProcess(null);
    } finally {
      setChecking(false);
    }
  };

  const createStoryProcess = async () => {
    if (!address) return;
    
    setCreating(true);
    setError(null);
    
    try {
      const result = await spawnStoryProcess();
      
      if (result && result.process_id) {
        // Successfully created process
        setHasStoryProcess(true);
        setProcessIds(prev => [...prev, result.process_id]);
      } else if (result && result.error) {
        // Extract the actual error message
        if (typeof result.error === 'string') {
          setError(result.error);
        } else if (typeof result.error === 'object') {
          // Handle ZodError format
          if (Array.isArray(result.error)) {
            setError(JSON.stringify(result.error, null, 2));
          } else {
            setError(result.error.message || JSON.stringify(result.error));
          }
        } else {
          setError("Failed to create process. Please try again.");
        }
      } else {
        setError("Failed to create process. Unknown error.");
      }
    } catch (err) {
      console.error("Error creating story process:", err);
      // Provide more detailed error information
      if (err instanceof Error) {
        setError(`Error: ${err.message}`);
      } else {
        setError("Error creating story process. Please try again.");
      }
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (address) {
      checkUserProcesses();
    } else {
      setHasStoryProcess(null);
      setProcessIds([]);
    }
  }, [address]);

  if (!address) {
    return null; // Don't show anything if wallet is not connected
  }

  // Choose the appropriate styling based on compact mode
  if (compact) {
    return (
      <div className="bg-gray-700 border border-gray-600 rounded-lg p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {checking ? (
              <div className="flex items-center">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                <span className="text-xs text-gray-300">Checking...</span>
              </div>
            ) : hasStoryProcess === true ? (
              <div className="flex items-center text-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                <span className="text-xs">Story Process Active</span>
              </div>
            ) : hasStoryProcess === false ? (
              <div className="flex items-center text-red-400">
                <XCircle className="h-3 w-3 mr-1" />
                <span className="text-xs">No Story Process</span>
              </div>
            ) : (
              <div className="flex items-center text-gray-400">
                <span className="text-xs">Process Status Unknown</span>
              </div>
            )}
          </div>
          
          <div className="flex gap-1">
            {hasStoryProcess === false && (
              <Button 
                size="sm" 
                variant="default"
                onClick={createStoryProcess}
                disabled={creating || checking}
                className="h-6 text-xs px-2"
              >
                {creating && <Loader2 className="h-2 w-2 animate-spin mr-1" />}
                Create
              </Button>
            )}
            
            <Button 
              size="sm" 
              variant="outline"
              onClick={checkUserProcesses}
              disabled={creating || checking}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        {error && (
          <div className="mt-1 text-xs text-red-400 max-h-20 overflow-y-auto">
            {error}
          </div>
        )}
        
        {processIds.length > 0 && (
          <div className="mt-1">
            <div className="text-xs text-gray-400">
              ID: <span className="font-mono">{processIds[0].substring(0, 8)}...{processIds[0].substring(processIds[0].length - 8)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Standard full-size version
  return (
    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 my-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">Story Process:</span>
          
          {checking ? (
            <div className="flex items-center">
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              <span className="text-sm text-slate-500">Checking...</span>
            </div>
          ) : hasStoryProcess === true ? (
            <div className="flex items-center text-green-600">
              <CheckCircle className="h-4 w-4 mr-1" />
              <span className="text-sm">Active</span>
            </div>
          ) : hasStoryProcess === false ? (
            <div className="flex items-center text-red-500">
              <XCircle className="h-4 w-4 mr-1" />
              <span className="text-sm">Not Created</span>
            </div>
          ) : (
            <div className="flex items-center text-slate-500">
              <span className="text-sm">Unknown</span>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          {hasStoryProcess === false && (
            <Button 
              size="sm" 
              variant="default"
              onClick={createStoryProcess}
              disabled={creating || checking}
            >
              {creating && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Create Process
            </Button>
          )}
          
          <Button 
            size="sm" 
            variant="outline"
            onClick={checkUserProcesses}
            disabled={creating || checking}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>
      </div>
      
      {error && (
        <div className="mt-2 text-sm text-red-500">
          {error}
        </div>
      )}
      
      {processIds.length > 0 && (
        <div className="mt-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Process ID{processIds.length > 1 ? 's' : ''}:
          </div>
          <div className="text-xs font-mono text-slate-600 dark:text-slate-300 mt-1 max-w-full overflow-x-auto">
            {processIds.map((id, index) => (
              <div key={id} className="truncate">
                {id}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
