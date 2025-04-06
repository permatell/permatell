// Initialize ARIO client for gateway interactions
import { ARIO } from '@ar.io/sdk/web';
import type { JWKInterface as JWK } from 'arweave/node/lib/wallet';
import { connect } from '@permaweb/aoconnect';

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

// Initialize AO connection with proper configuration
const aoConnection = connect();

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

// ArNS Manager implementation
export const arnManager = {
  // Get gateway node info for an address
  async getGatewayNode(address: string): Promise<GatewayNode | null> {
    try {
      console.log('Getting gateway node for address:', address);
      
      // Check cache first
      const now = Date.now();
      const cachedData = primaryArnCache[address];
      if (cachedData && (now - cachedData.timestamp) < PRIMARY_ARN_CACHE_DURATION) {
        console.log('Using cached gateway node for address:', address);
        return cachedData.arn ? {
          fqdn: cachedData.arn,
          owner: address,
          processId: address
        } : null;
      }
      
      // Get gateway info
      const gateway = await arioGateway.getGateway({ address });
      if (gateway?.settings?.fqdn) {
        console.log('Found gateway node:', gateway.settings.fqdn);
        
        const gatewayNode = {
          fqdn: gateway.settings.fqdn,
          owner: address,
          processId: address
        };
        
        // Cache the result
        primaryArnCache[address] = {
          arn: gateway.settings.fqdn,
          timestamp: now
        };
        
        return gatewayNode;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting gateway node:', error);
      return null;
    }
  },

  // Get primary ARN for an address
  async getPrimaryARN(address: string): Promise<string | null> {
    try {
      console.log('Getting primary ARN for address:', address);
      
      // Check cache first
      const now = Date.now();
      const cachedData = primaryArnCache[address];
      if (cachedData && (now - cachedData.timestamp) < PRIMARY_ARN_CACHE_DURATION) {
        console.log('Using cached primary ARN for address:', address);
        return cachedData.arn;
      }
      
      // Try to get primary name directly from SDK with retries
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          console.log(`Attempt ${retryCount + 1} to get primary name from SDK`);
          const result = await arioGateway.getPrimaryName({ address });
          console.log('Primary name result from SDK:', result);
          
          if (result && result.name) {
            // Cache the result
            primaryArnCache[address] = {
              arn: result.name,
              timestamp: now
            };
            
            return result.name;
          }
          break; // Break if we got a result (even if null)
        } catch (sdkError) {
          console.error(`Error getting primary name from SDK (attempt ${retryCount + 1}):`, sdkError);
          retryCount++;
          if (retryCount < maxRetries) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
          }
        }
      }
      
      // If SDK fails after retries, try fallback method
      console.log('Trying fallback method to get primary ARN');
      const arns = await this.getAllPrimaryNames(address);
      console.log('Found ARNs from records:', arns);
      
      const primaryArn = arns.length > 0 ? arns[0].domain : null;
      
      // Cache the result
      primaryArnCache[address] = {
        arn: primaryArn,
        timestamp: now
      };
      
      return primaryArn;
    } catch (error) {
      console.error('Error getting primary ARN:', error);
      return null;
    }
  },

  // Get all ARNs for an address
  async getAllPrimaryNames(address: string): Promise<ArNSRecord[]> {
    try {
      console.log('Getting all primary names for address:', address);
      
      // Check cache first
      const now = Date.now();
      const cachedData = arnsCache[address];
      if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
        console.log('Using cached ARNS names for address:', address);
        return cachedData.names;
      }
      
      // Get ARN records with a reasonable limit
      console.log('Fetching ARN records...');
      const records = await arioGateway.getArNSRecords({
        limit: 100,
        sortBy: 'startTimestamp',
        sortOrder: 'desc'
      });
      
      console.log('Total ARN records found:', records.totalItems);
      
      // Filter and map records owned by the address
      const userArns = records.items
        .filter(record => record.processId === address)
        .map(record => ({
          domain: record.name,
          owner: address,
          processId: record.processId
        }));
      
      console.log('User ARNs found:', userArns);
      
      // Cache the results
      arnsCache[address] = {
        names: userArns,
        timestamp: now
      };
      
      return userArns;
    } catch (error) {
      console.error('Error getting all primary names:', error);
      return [];
    }
  },

  // Request a primary name
  async requestPrimaryName(name: string, address: string): Promise<boolean> {
    try {
      console.log('Requesting primary name:', name, 'for address:', address);
      
      // Check if the name is available
      const record = await arioGateway.getArNSRecord({ name });
      console.log('Existing record for name:', name, record);
      
      if (record) {
        console.log('Name already taken:', name);
        return false;
      }

      // TODO: Implement actual name request logic when available in SDK
      console.log('Name request functionality not yet implemented in SDK');
      return false;
    } catch (error) {
      console.error('Error requesting primary name:', error);
      return false;
    }
  },

  // Check for pending primary name requests
  async checkPrimaryNameRequest(address: string): Promise<PrimaryNameRequest | null> {
    try {
      console.log('Checking primary name request for address:', address);
      
      // First try to get gateway info
      const gateway = await arioGateway.getGateway({ address });
      if (gateway?.settings?.fqdn) {
        console.log('Found gateway with FQDN:', gateway.settings.fqdn);
        return {
          domain: gateway.settings.fqdn,
          owner: address,
          timestamp: Date.now()
        };
      }
      
      // If no gateway, try to get ARN records
      console.log('Fetching ARN records...');
      const records = await arioGateway.getArNSRecords({
        limit: 1000,
        sortBy: 'startTimestamp',
        sortOrder: 'desc'
      });
      
      console.log('Total ARN records found:', records.totalItems);
      
      // Find the most recent record owned by the address
      const userRecord = records.items.find(record => {
        const isOwner = record.processId === address;
        console.log('Checking record:', record.name, 'Owner:', record.processId, 'Is owner:', isOwner);
        return isOwner;
      });
      
      if (userRecord) {
        console.log('Found user record:', userRecord);
        return {
          domain: userRecord.name,
          owner: address,
          timestamp: userRecord.startTimestamp
        };
      }
      
      console.log('No primary name request found');
      return null;
    } catch (error) {
      console.error('Error checking primary name request:', error);
      return null;
    }
  },

  // Check ARIO token balance
  async checkBalance(address: string): Promise<{ balance: number }> {
    try {
      console.log('Checking balance for address:', address);
      
      // Check cache first
      const now = Date.now();
      const cachedData = balanceCache[address];
      if (cachedData && (now - cachedData.timestamp) < BALANCE_CACHE_DURATION) {
        console.log('Using cached balance for address:', address);
        return { balance: cachedData.balance };
      }
      
      // Initialize ARIO client
      const ario = ARIO.init();
      
      try {
        console.log('Fetching ARIO balance using SDK...');
        // Use the getBalance method from the ARIO SDK
        const balanceInMARIO = await ario.getBalance({ address });
        console.log('Raw balance in mARIO:', balanceInMARIO);
        
        if (typeof balanceInMARIO !== 'number') {
          console.error('Invalid balance returned from SDK:', balanceInMARIO);
          throw new Error('Invalid balance format from SDK');
        }
        
        // Convert from mARIO to ARIO (1 ARIO = 1,000,000 mARIO)
        const balance = balanceInMARIO / 1_000_000;
        console.log('Balance from ARIO SDK:', balance);
        
        // Cache the result
        balanceCache[address] = {
          balance,
          timestamp: now
        };
        
        return { balance };
      } catch (sdkError) {
        console.error('Error fetching balance from ARIO SDK:', sdkError);
        // Continue to fallback methods
      }
      
      // Fallback: Try to get gateway info to check stake
      try {
        console.log('Trying fallback: fetching gateway info...');
        const gateway = await arioGateway.getGateway({ address });
        console.log('Gateway info:', gateway);
        
        if (gateway?.operatorStake) {
          const balance = gateway.operatorStake / 1_000_000; // Convert mARIO to ARIO
          console.log('Balance from gateway:', balance);
          
          // Cache the result
          balanceCache[address] = {
            balance,
            timestamp: now
          };
          
          return { balance };
        }
      } catch (gatewayError) {
        console.error('Error fetching gateway info:', gatewayError);
        // Continue to fallback
      }
      
      // If all methods fail, return 0
      console.log('No balance found, returning 0');
      
      // Cache the zero balance result
      balanceCache[address] = {
        balance: 0,
        timestamp: now
      };
      
      return { balance: 0 };
    } catch (error) {
      console.error('Error checking ARIO balance:', error);
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