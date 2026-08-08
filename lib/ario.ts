// Initialize ARIO client for gateway interactions
import { ARIO } from '@ar.io/sdk/web';
import type { JWKInterface as JWK } from 'arweave/node/lib/wallet';
import { aoConnect } from '@/lib/ao-config';

// Define Gateway response types based on SDK documentation
interface GatewaySettings {
  fqdn: string;
  label?: string;
  note?: string;
  port: number;
  properties?: string;
  protocol: string;
}

interface GatewayStats {
  failedConsecutiveEpochs: number;
  passedEpochCount: number;
  submittedEpochCount: number;
  totalEpochCount: number;
  totalEpochsPrescribedCount: number;
}

interface GatewayWeights {
  compositeWeight: number;
  gatewayRewardRatioWeight: number;
  tenureWeight: number;
  observerRewardRatioWeight: number;
  normalizedCompositeWeight: number;
  stakeWeight: number;
}

interface Gateway {
  gatewayAddress: string;
  observerAddress: string;
  operatorStake: number;
  settings: GatewaySettings;
  startTimestamp: number;
  stats: GatewayStats;
  status: string;
  vaults: Record<string, any>;
  weights: GatewayWeights;
}

interface GatewayResponse {
  items: Gateway[];
  hasMore: boolean;
  nextCursor?: string;
  totalItems: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// Initialize ARIO client for gateway interactions
const arioGateway = ARIO.init();

// Define types for ArNS data
interface ArNSRecord {
  domain: string;
  owner: string;
  processId: string;
}

interface GatewayNode {
  fqdn: string;
  owner: string;
  processId: string;
}

interface PrimaryNameRequest {
  domain: string;
  owner: string;
  timestamp: number;
}

interface ArNSBalance {
  ticker: string;
  balance: number;
}

// Define AO primary name type
interface AoPrimaryName {
  name: string;
  owner: string;
}

// Define fallback response types
interface FallbackResponses {
  record: any;
  records: any[];
  pendingRequests: any[];
  balance: number;
  listAll: any[];
}

// Define AO response types
interface AOMessage {
  Messages: Array<{
    Tags: Array<{
      name: string;
      value: string;
    }>;
  }>;
}

// Flag to track AO availability
let isAOAvailable = true;

// Lazy-initialize AO connection to avoid SSR issues
let _aoConnection: ReturnType<typeof aoConnect> | null = null;
function getAOConnection() {
  if (!_aoConnection) {
    _aoConnection = aoConnect();
  }
  return _aoConnection;
}

// Helper function to handle AO responses
async function handleAOResponse<T>(response: any): Promise<T> {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid response from AO process');
  }
  
  if (response.Messages && Array.isArray(response.Messages) && response.Messages.length > 0) {
    const message = response.Messages[0];
    if (message.Tags) {
      const result = message.Tags.reduce((acc: any, tag: any) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});
      return result as T;
    }
  }
  
  return response as T;
}

// Helper function to check AO availability and return fallback responses
function checkAOAvailability(): { available: boolean; fallback: FallbackResponses } {
  if (!isAOAvailable) {
    return {
      available: false,
      fallback: {
        record: null,
        records: [],
        pendingRequests: [],
        balance: 0,
        listAll: []
      }
    };
  }
  return { 
    available: true,
    fallback: {
      record: null,
      records: [],
      pendingRequests: [],
      balance: 0,
      listAll: []
    }
  };
}

// Add cache for ARNS names
const arnsCache: Record<string, { names: ArNSRecord[], timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Add cache for balance
const balanceCache: Record<string, { balance: number, timestamp: number }> = {};
const BALANCE_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes in milliseconds

// Add cache for primary ARN
const primaryArnCache: Record<string, { arn: string | null, timestamp: number }> = {};
const PRIMARY_ARN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

const ARNS_DEBUG =
  process.env.NEXT_PUBLIC_DEBUG_ARNS === "true" ||
  process.env.NEXT_PUBLIC_DEBUG === "true";

function arnsDebug(...args: unknown[]) {
  if (ARNS_DEBUG) console.debug("[arns]", ...args);
}

function isQuietArnsFailure(error: unknown): boolean {
  const message = String(
    (error as { message?: string })?.message || error || ""
  ).toLowerCase();
  return (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("does not support provided action") ||
    message.includes("too many requests")
  );
}

// ArNS Manager implementation
export const arnManager = {
  // Get gateway node info for an address
  async getGatewayNode(address: string): Promise<GatewayNode | null> {
    try {
      const now = Date.now();
      const cachedData = primaryArnCache[address];
      if (cachedData && (now - cachedData.timestamp) < PRIMARY_ARN_CACHE_DURATION) {
        return cachedData.arn ? {
          fqdn: cachedData.arn,
          owner: address,
          processId: address
        } : null;
      }

      const gateway = await arioGateway.getGateway({ address });
      if (gateway?.settings?.fqdn) {
        primaryArnCache[address] = {
          arn: gateway.settings.fqdn,
          timestamp: now
        };
        return {
          fqdn: gateway.settings.fqdn,
          owner: address,
          processId: address
        };
      }

      return null;
    } catch (error) {
      if (!isQuietArnsFailure(error)) {
        console.warn("[arns] gateway lookup failed", error);
      }
      return null;
    }
  },

  // Get primary ARN for an address
  async getPrimaryARN(address: string): Promise<string | null> {
    try {
      const now = Date.now();
      const cachedData = primaryArnCache[address];
      if (cachedData && (now - cachedData.timestamp) < PRIMARY_ARN_CACHE_DURATION) {
        return cachedData.arn;
      }

      // One primary attempt + one retry. Do not hammer CU on 429 / unsupported action.
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await arioGateway.getPrimaryName({ address });
          const name = result?.name || null;
          primaryArnCache[address] = { arn: name, timestamp: now };
          arnsDebug("primary name", address, name);
          return name;
        } catch (sdkError) {
          lastError = sdkError;
          if (isQuietArnsFailure(sdkError)) break;
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 750));
          }
        }
      }

      if (lastError && !isQuietArnsFailure(lastError)) {
        arnsDebug("primary name SDK failed; trying owned-record fallback", lastError);
        try {
          const arns = await this.getAllPrimaryNames(address);
          const primaryArn = arns.length > 0 ? arns[0].domain : null;
          primaryArnCache[address] = { arn: primaryArn, timestamp: now };
          return primaryArn;
        } catch {
          // fall through
        }
      }

      primaryArnCache[address] = { arn: null, timestamp: now };
      return null;
    } catch (error) {
      if (!isQuietArnsFailure(error)) {
        console.warn("[arns] getPrimaryARN failed", error);
      }
      return null;
    }
  },

  // Get all ARNs for an address
  async getAllPrimaryNames(address: string): Promise<ArNSRecord[]> {
    try {
      const now = Date.now();
      const cachedData = arnsCache[address];
      if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
        return cachedData.names;
      }

      const records = await arioGateway.getArNSRecords({
        limit: 100,
        sortBy: 'startTimestamp',
        sortOrder: 'desc'
      });

      const userArns = records.items
        .filter(record => record.processId === address)
        .map(record => ({
          domain: record.name,
          owner: address,
          processId: record.processId
        }));

      arnsDebug(
        `owned names for ${address.slice(0, 6)}…: ${userArns.length}/${records.totalItems} scanned`
      );

      arnsCache[address] = {
        names: userArns,
        timestamp: now
      };

      return userArns;
    } catch (error) {
      if (!isQuietArnsFailure(error)) {
        console.warn("[arns] getAllPrimaryNames failed", error);
      }
      return [];
    }
  },

  // Request a primary name
  async requestPrimaryName(name: string, address: string): Promise<boolean> {
    try {
      const record = await arioGateway.getArNSRecord({ name });
      if (record) {
        return false;
      }

      // TODO: Implement actual name request logic when available in SDK
      arnsDebug("name request not implemented in SDK", name, address);
      return false;
    } catch (error) {
      if (!isQuietArnsFailure(error)) {
        console.warn("[arns] requestPrimaryName failed", error);
      }
      return false;
    }
  },

  // Check for pending primary name requests
  async checkPrimaryNameRequest(address: string): Promise<PrimaryNameRequest | null> {
    try {
      const gateway = await arioGateway.getGateway({ address });
      if (gateway?.settings?.fqdn) {
        return {
          domain: gateway.settings.fqdn,
          owner: address,
          timestamp: Date.now()
        };
      }

      // Prefer SDK primary name over scanning the whole namespace.
      try {
        const primary = await arioGateway.getPrimaryName({ address });
        if (primary?.name) {
          return {
            domain: primary.name,
            owner: address,
            timestamp: Date.now()
          };
        }
      } catch (sdkError) {
        if (!isQuietArnsFailure(sdkError)) {
          arnsDebug("primary name during pending-check failed", sdkError);
        }
      }

      const owned = await this.getAllPrimaryNames(address);
      if (owned[0]) {
        return {
          domain: owned[0].domain,
          owner: address,
          timestamp: Date.now()
        };
      }

      return null;
    } catch (error) {
      if (!isQuietArnsFailure(error)) {
        console.warn("[arns] checkPrimaryNameRequest failed", error);
      }
      return null;
    }
  },

  // Check ARIO token balance
  async checkBalance(address: string): Promise<{ balance: number }> {
    try {
      const now = Date.now();
      const cachedData = balanceCache[address];
      if (cachedData && (now - cachedData.timestamp) < BALANCE_CACHE_DURATION) {
        return { balance: cachedData.balance };
      }

      const ario = ARIO.init();

      try {
        const balanceInMARIO = await ario.getBalance({ address });
        if (typeof balanceInMARIO !== 'number') {
          throw new Error('Invalid balance format from SDK');
        }

        const balance = balanceInMARIO / 1_000_000;
        balanceCache[address] = { balance, timestamp: now };
        return { balance };
      } catch (sdkError) {
        if (!isQuietArnsFailure(sdkError)) {
          arnsDebug("balance SDK failed", sdkError);
        }
      }

      try {
        const gateway = await arioGateway.getGateway({ address });
        if (gateway?.operatorStake) {
          const balance = gateway.operatorStake / 1_000_000;
          balanceCache[address] = { balance, timestamp: now };
          return { balance };
        }
      } catch (gatewayError) {
        if (!isQuietArnsFailure(gatewayError)) {
          arnsDebug("balance gateway fallback failed", gatewayError);
        }
      }

      balanceCache[address] = { balance: 0, timestamp: now };
      return { balance: 0 };
    } catch (error) {
      if (!isQuietArnsFailure(error)) {
        console.warn("[arns] checkBalance failed", error);
      }
      return { balance: 0 };
    }
  }
};

// Export types for use in other files
export type { ArNSRecord, PrimaryNameRequest, ArNSBalance };

// Export functions for backward compatibility
export const getPrimaryARN = arnManager.getPrimaryARN;
export const getAllPrimaryNames = arnManager.getAllPrimaryNames;
export const checkPrimaryNameRequest = arnManager.checkPrimaryNameRequest;
