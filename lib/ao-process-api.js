// AO Process API
// This file provides a clean API for interacting with our AO processes

import { connect } from '@permaweb/aoconnect';

// Process IDs - Replace these with your actual process IDs
const PROCESS_IDS = {
  STORIES: "gUp8l-EyEVG1wHkyjTY2PLX3kfNOttXdUTsQFgL8gfI", // Main stories process
  STORY_POINTS: "UwYxEKXxEmbd9-sIJtSVgAPMj85QQC7ExMt1VeLxXsA", // Story points process
  USER_PROFILE: "il72h8w_dG4J6CPB-IdlBD8QCZsv0xdR3yHGH35gmPg", // User profile process
  AO_PROFILE_INTEGRATION: "cghQLblfE5PFF44Eb9zsQvxXtbn3zt9FmwWEh3gHWGA", // AO profile integration process
  HOOD_MINTING: "N-cNO2ryesWjEdXrx4h19E0uewSCEmAsBmaXaP8f9Jg", // $HOOD minting process
};

// Initialize AO connection with minimal adapter to fix ZodError
let ao;

// Safely initialize AO connection with required functions
try {
  ao = connect({
    wallet: {
      // These functions are required by ZodFunction validation
      sign: async (tx) => {
        if (typeof window !== 'undefined' && window.arweaveWallet) {
          try {
            return await window.arweaveWallet.sign(tx);
          } catch (error) {
            console.error('Error signing with ArConnect:', error);
            throw error;
          }
        }
        throw new Error('ArConnect wallet not connected');
      },
      dispatch: async (tx) => {
        // This function is required but rarely used for AO
        console.log('Dispatch called (not implemented):', tx);
        return { id: tx.id, status: 200 };
      }
    }
  });
} catch (error) {
  console.error('Error initializing AO connection:', error);
  // Provide a mock instance that won't throw immediately
  ao = {
    message: async () => {
      throw new Error('AO connection failed to initialize');
    },
    dryrun: async () => {
      throw new Error('AO connection failed to initialize');
    }
  };
}

/**
 * Initialize the API with process IDs
 * @param {Object} processIds - Object containing process IDs
 */
export function initializeApi(processIds) {
  if (processIds.STORIES) PROCESS_IDS.STORIES = processIds.STORIES;
  if (processIds.STORY_POINTS) PROCESS_IDS.STORY_POINTS = processIds.STORY_POINTS;
  if (processIds.USER_PROFILE) PROCESS_IDS.USER_PROFILE = processIds.USER_PROFILE;
  if (processIds.AO_PROFILE_INTEGRATION) PROCESS_IDS.AO_PROFILE_INTEGRATION = processIds.AO_PROFILE_INTEGRATION;
  if (processIds.HOOD_MINTING) PROCESS_IDS.HOOD_MINTING = processIds.HOOD_MINTING;
}

/**
 * Verify if a process exists and is active
 * @param {string} processId - The process ID to check
 * @returns {Promise<boolean>} - True if the process exists and is active
 */
async function verifyProcessExists(processId) {
  try {
    // Check if the process ID is valid
    if (!processId || processId.trim() === "") {
      return false;
    }
    
    // Use dryrun to check if the process exists
    const result = await ao.dryrun({
      process: processId,
      tags: [{ name: "Action", value: "Ping" }]
    });
    
    // If we got a response, the process exists
    return true;
  } catch (error) {
    console.warn(`Process verification failed for ${processId}:`, error);
    return false;
  }
}

/**
 * Send a message to a process with retry logic
 * @param {string} processId - The process ID to send the message to
 * @param {Object} message - The message to send
 * @param {Object} options - Optional parameters
 * @param {number} options.retries - Number of retries (default: 3)
 * @param {number} options.backoffMs - Initial backoff in ms (default: 1000)
 * @returns {Promise<any>} - The result of the message
 */
async function sendMessage(processId, message, options = {}) {
  // Default options
  const { retries = 3, backoffMs = 1000 } = options;
  
  try {
    // Check if the process ID is valid
    if (!processId || processId.trim() === "") {
      console.error(`Invalid process ID: ${processId}`);
      return {
        error: "Invalid process ID",
        success: false
      };
    }
    
    // Create tags array from message
    const tags = [{ name: "Action", value: message.Action }];
    
    // Add other message properties as tags if needed
    for (const key in message) {
      if (key !== "Action" && typeof message[key] === "string") {
        tags.push({ name: key, value: message[key] });
      }
    }
    
    // Implement retry logic with exponential backoff
    let lastError = null;
    let attempt = 0;
    
    while (attempt <= retries) {
      try {
        // Try to send the message
        const result = await ao.message({
          process: processId,
          tags,
          data: message
        });
        
        return result;
      } catch (error) {
        lastError = error;
        
        // If it's a rate limiting error (429), wait and retry
        if (error.message && error.message.includes("429")) {
          console.warn(`Rate limited when sending to ${processId}. Attempt ${attempt + 1}/${retries + 1}`);
          
          // If we've used all retries, break out
          if (attempt >= retries) {
            break;
          }
          
          // Calculate backoff with jitter
          const delay = backoffMs * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
          console.log(`Retrying in ${Math.round(delay / 1000)} seconds...`);
          
          // Wait for backoff period
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Increment attempt counter
          attempt++;
          continue;
        } else {
          // For other errors, just break the loop
          break;
        }
      }
    }
    
    // If we got here, all retries failed
    console.error(`Error sending message to process ${processId} after ${retries + 1} attempts:`, lastError);
    
    // Return a fallback result instead of throwing
    return {
      error: lastError?.message || "Unknown error after multiple retries",
      success: false,
      rate_limited: lastError?.message?.includes("429") || false
    };
  } catch (error) {
    console.error(`Unexpected error sending message to process ${processId}:`, error);
    
    // Return a fallback result instead of throwing
    return {
      error: error.message || "Unknown error",
      success: false
    };
  }
}

// Stories API

/**
 * Create a new story
 * @param {Object} storyData - The story data
 * @returns {Promise<any>} - The result of the creation
 */
export async function createStory(storyData) {
  return sendMessage(PROCESS_IDS.STORIES, {
    Action: "CreateStory",
    title: storyData.title,
    content: storyData.content,
    cover_image: storyData.coverImage,
    category: storyData.category,
    is_public: storyData.isPublic,
    tags: storyData.tags,
    metadata: storyData.metadata
  });
}

/**
 * Create a new version of a story
 * @param {string} storyId - The story ID
 * @param {Object} versionData - The version data
 * @returns {Promise<any>} - The result of the creation
 */
export async function createStoryVersion(storyId, versionData) {
  return sendMessage(PROCESS_IDS.STORIES, {
    Action: "CreateStoryVersion",
    story_id: storyId,
    title: versionData.title,
    content: versionData.content,
    cover_image: versionData.coverImage,
    category: versionData.category,
    tags: versionData.tags,
    metadata: versionData.metadata
  });
}

/**
 * Revert a story to a previous version
 * @param {string} storyId - The story ID
 * @param {string} versionId - The version ID to revert to
 * @returns {Promise<any>} - The result of the reversion
 */
export async function revertStoryToVersion(storyId, versionId) {
  return sendMessage(PROCESS_IDS.STORIES, {
    Action: "RevertStoryToVersion",
    story_id: storyId,
    version_id: versionId
  });
}

/**
 * Get all stories
 * @returns {Promise<any>} - The stories
 */
export async function getStories() {
  return sendMessage(PROCESS_IDS.STORIES, {
    Action: "GetStories"
  });
}

/**
 * Get a specific story
 * @param {string} storyId - The story ID
 * @returns {Promise<any>} - The story
 */
export async function getStory(storyId) {
  return sendMessage(PROCESS_IDS.STORIES, {
    Action: "GetStory",
    story_id: storyId
  });
}

/**
 * Upvote a story version
 * @param {string} storyId - The story ID
 * @param {string} versionId - The version ID
 * @returns {Promise<any>} - The result of the upvote
 */
export async function upvoteStoryVersion(storyId, versionId) {
  return sendMessage(PROCESS_IDS.STORIES, {
    Action: "UpvoteStoryVersion",
    story_id: storyId,
    version_id: versionId
  });
}

/**
 * Add a collaborator to a story
 * @param {string} storyId - The story ID
 * @param {string} collaboratorAddress - The collaborator's address
 * @returns {Promise<any>} - The result of the addition
 */
export async function addCollaborator(storyId, collaboratorAddress) {
  return sendMessage(PROCESS_IDS.STORIES, {
    Action: "AddCollaborator",
    story_id: storyId,
    collaborator_address: collaboratorAddress
  });
}

/**
 * Get a user's story process
 * @param {string} address - The user's address (optional, defaults to sender)
 * @returns {Promise<any>} - The user's story process
 */
export async function getUserStoryProcess(address) {
  return sendMessage(PROCESS_IDS.STORIES, {
    Action: "GetUserStoryProcess",
    address: address
  });
}

// User Story Process API

/**
 * Get stories from a user's story process
 * @param {string} processId - The user's story process ID
 * @returns {Promise<any>} - The stories
 */
export async function getStoriesFromUserProcess(processId) {
  return sendMessage(processId, {
    Action: "GetStories"
  });
}

/**
 * Get a specific story from a user's story process
 * @param {string} processId - The user's story process ID
 * @param {string} storyId - The story ID
 * @returns {Promise<any>} - The story
 */
export async function getStoryFromUserProcess(processId, storyId) {
  return sendMessage(processId, {
    Action: "GetStory",
    story_id: storyId
  });
}

/**
 * Get a specific story version from a user's story process
 * @param {string} processId - The user's story process ID
 * @param {string} storyId - The story ID
 * @param {string} versionId - The version ID
 * @returns {Promise<any>} - The story version
 */
export async function getStoryVersionFromUserProcess(processId, storyId, versionId) {
  return sendMessage(processId, {
    Action: "GetStoryVersion",
    story_id: storyId,
    version_id: versionId
  });
}

/**
 * Get the version history of a story from a user's story process
 * @param {string} processId - The user's story process ID
 * @param {string} storyId - The story ID
 * @returns {Promise<any>} - The version history
 */
export async function getStoryVersionHistoryFromUserProcess(processId, storyId) {
  return sendMessage(processId, {
    Action: "GetStoryVersionHistory",
    story_id: storyId
  });
}

// Story Points API

/**
 * Get a user's story points
 * @param {string} address - The user's address
 * @returns {Promise<any>} - The user's story points
 */
export async function getUserStoryPoints(address) {
  return sendMessage(PROCESS_IDS.STORY_POINTS, {
    Action: "GetUserStoryPoints",
    address: address
  });
}

/**
 * Get all story points
 * @returns {Promise<any>} - All story points
 */
export async function getAllStoryPoints() {
  return sendMessage(PROCESS_IDS.STORY_POINTS, {
    Action: "GetAllStoryPoints"
  });
}

/**
 * Get a user's rewards
 * @param {string} address - The user's address
 * @returns {Promise<any>} - The user's rewards
 */
export async function getUserRewards(address) {
  return sendMessage(PROCESS_IDS.STORY_POINTS, {
    Action: "GetUserRewards",
    address: address
  });
}

/**
 * Claim a reward
 * @param {string} rewardLevel - The reward level to claim
 * @returns {Promise<any>} - The result of the claim
 */
export async function claimReward(rewardLevel) {
  return sendMessage(PROCESS_IDS.STORY_POINTS, {
    Action: "ClaimReward",
    reward_level: rewardLevel
  });
}

// User Profile API

/**
 * Create a user profile
 * @param {Object} profileData - The profile data
 * @returns {Promise<any>} - The result of the creation
 */
export async function createUserProfile(profileData) {
  return sendMessage(PROCESS_IDS.USER_PROFILE, {
    Action: "CreateProfile",
    ao_profile_id: profileData.aoProfileId,
    display_name: profileData.displayName,
    hood_token_balance: profileData.hoodTokenBalance
  });
}

/**
 * Get a user's profile
 * @param {string} address - The user's address (optional, defaults to sender)
 * @returns {Promise<any>} - The user's profile
 */
export async function getUserProfile(address) {
  return sendMessage(PROCESS_IDS.USER_PROFILE, {
    Action: "GetProfile",
    address: address
  });
}

/**
 * Get a user's story processes
 * @param {string} address - The user's address (optional, defaults to sender)
 * @returns {Promise<any>} - The user's story processes
 */
export async function getUserStoryProcesses(address) {
  return sendMessage(PROCESS_IDS.USER_PROFILE, {
    Action: "GetUserStoryProcesses",
    address: address
  });
}

/**
 * Get a user's benefits
 * @param {string} address - The user's address (optional, defaults to sender)
 * @returns {Promise<any>} - The user's benefits
 */
export async function getUserBenefits(address) {
  return sendMessage(PROCESS_IDS.USER_PROFILE, {
    Action: "GetUserBenefits",
    address: address
  });
}

/**
 * Update a user's $HOOD token balance
 * @param {string} address - The user's address
 * @param {number} balance - The new balance
 * @returns {Promise<any>} - The result of the update
 */
export async function updateHoodTokenBalance(address, balance) {
  return sendMessage(PROCESS_IDS.USER_PROFILE, {
    Action: "UpdateHoodBalance",
    address: address,
    balance: balance
  });
}

/**
 * Spawn a story process for a user
 * This function handles process creation with proper authority setup
 * @returns {Promise<any>} - The result of the spawn
 */
export async function spawnStoryProcess() {
  try {
    // Create proper message structure for spawning a process
    // Use the same Action and parameters as in the Lua implementation
    const result = await sendMessage(PROCESS_IDS.USER_PROFILE, {
      Action: "SpawnStoryProcess"
    });
    
    // If we received a successful response with a process_id
    if (result && result.process_id) {
      console.log("Story process spawned successfully with ID:", result.process_id);
      return {
        success: true,
        process_id: result.process_id,
        message: "Story process created successfully"
      };
    } 
    // If we got an error
    else if (result && result.error) {
      console.error("Error spawning story process:", result.error);
      return {
        success: false,
        error: result.error,
        message: "Failed to spawn story process"
      };
    }
    // Unexpected response format
    else {
      console.error("Unexpected response format when spawning story process:", result);
      return {
        success: false,
        error: "Unexpected response format",
        message: "Failed to spawn story process due to an unexpected response format"
      };
    }
  } catch (error) {
    console.error("Exception when spawning story process:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
      message: "Failed to spawn story process due to an exception"
    };
  }
}

// AO Profile Integration API

/**
 * Create an AO profile
 * @param {Object} profileData - The profile data
 * @returns {Promise<any>} - The result of the creation
 */
export async function createAOProfile(profileData) {
  return sendMessage(PROCESS_IDS.AO_PROFILE_INTEGRATION, {
    Action: "CreateAOProfile",
    username: profileData.username,
    display_name: profileData.displayName,
    description: profileData.description,
    thumbnail: profileData.thumbnail,
    banner: profileData.banner
  });
}

/**
 * Link an AO profile to a user
 * @param {string} profileId - The AO profile ID
 * @returns {Promise<any>} - The result of the link
 */
export async function linkAOProfile(profileId) {
  return sendMessage(PROCESS_IDS.AO_PROFILE_INTEGRATION, {
    Action: "LinkAOProfile",
    profile_id: profileId
  });
}

/**
 * Get an AO profile
 * @param {string} profileId - The AO profile ID
 * @returns {Promise<any>} - The AO profile
 */
export async function getAOProfile(profileId) {
  return sendMessage(PROCESS_IDS.AO_PROFILE_INTEGRATION, {
    Action: "GetAOProfile",
    profile_id: profileId
  });
}

/**
 * Get a user's AO profile
 * @param {string} address - The user's address (optional, defaults to sender)
 * @returns {Promise<any>} - The user's AO profile
 */
export async function getUserAOProfile(address) {
  return sendMessage(PROCESS_IDS.AO_PROFILE_INTEGRATION, {
    Action: "GetUserAOProfile",
    address: address
  });
}

/**
 * Update an AO profile
 * @param {string} profileId - The AO profile ID
 * @param {Object} profileData - The profile data to update
 * @returns {Promise<any>} - The result of the update
 */
export async function updateAOProfile(profileId, profileData) {
  return sendMessage(PROCESS_IDS.AO_PROFILE_INTEGRATION, {
    Action: "UpdateAOProfile",
    profile_id: profileId,
    username: profileData.username,
    display_name: profileData.displayName,
    description: profileData.description,
    thumbnail: profileData.thumbnail,
    banner: profileData.banner
  });
}

// $HOOD Minting API

/**
 * Update allocation percentage for minting $HOOD tokens
 * @param {number} percentage - The percentage of AO yield to allocate (0-100)
 * @returns {Promise<any>} - The result of the update
 */
export async function updateHoodAllocation(percentage) {
  return sendMessage(PROCESS_IDS.HOOD_MINTING, {
    Action: "UpdateAllocation",
    percentage: percentage
  });
}

/**
 * Get current allocation for minting $HOOD tokens
 * @param {string} address - The user's address (optional, defaults to sender)
 * @returns {Promise<any>} - The allocation information
 */
export async function getHoodAllocation(address) {
  return sendMessage(PROCESS_IDS.HOOD_MINTING, {
    Action: "GetAllocation",
    address: address
  });
}

/**
 * Get all allocations for minting $HOOD tokens
 * @returns {Promise<any>} - All allocations
 */
export async function getAllHoodAllocations() {
  return sendMessage(PROCESS_IDS.HOOD_MINTING, {
    Action: "GetAllAllocations"
  });
}

/**
 * Trigger the minting process (admin only)
 * @returns {Promise<any>} - The result of the trigger
 */
export async function triggerHoodMinting() {
  return sendMessage(PROCESS_IDS.HOOD_MINTING, {
    Action: "TriggerMinting"
  });
}

/**
 * Set the user profile process address for the $HOOD minting process
 * @param {string} processAddress - The user profile process address
 * @returns {Promise<any>} - The result of the update
 */
export async function setHoodMintingUserProfileProcess(processAddress) {
  return sendMessage(PROCESS_IDS.HOOD_MINTING, {
    Action: "SetUserProfileProcess",
    process_address: processAddress
  });
}

/**
 * Set the $HOOD token contract address for the $HOOD minting process
 * @param {string} contractAddress - The $HOOD token contract address
 * @returns {Promise<any>} - The result of the update
 */
export async function setHoodMintingTokenContract(contractAddress) {
  return sendMessage(PROCESS_IDS.HOOD_MINTING, {
    Action: "SetHoodTokenContract",
    contract_address: contractAddress
  });
}

/**
 * Set the minimum allocation percentage for the $HOOD minting process
 * @param {number} percentage - The minimum allocation percentage
 * @returns {Promise<any>} - The result of the update
 */
export async function setHoodMintingMinAllocationPercentage(percentage) {
  return sendMessage(PROCESS_IDS.HOOD_MINTING, {
    Action: "SetMinAllocationPercentage",
    percentage: percentage
  });
}

/**
 * Verify Goddesses NFT ownership for a user
 * @param {string} address - The user's address (optional, defaults to sender)
 * @returns {Promise<any>} - The result of the verification
 */
export async function verifyGoddessesNFT(address) {
  return sendMessage(PROCESS_IDS.HOOD_MINTING, {
    Action: "VerifyGoddesses",
    address: address
  });
}

/**
 * Reward a Goddesses NFT holder for activity
 * @param {string} address - The user's address (optional, defaults to sender)
 * @param {number} activityPoints - The number of activity points to reward
 * @returns {Promise<any>} - The result of the reward
 */
export async function rewardGoddessesActivity(address, activityPoints) {
  return sendMessage(PROCESS_IDS.HOOD_MINTING, {
    Action: "RewardGoddessesActivity",
    address: address,
    activity_points: activityPoints
  });
}
