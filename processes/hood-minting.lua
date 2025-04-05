-- $HOOD Minting Process
-- This process handles the minting of $HOOD tokens by allocating a percentage of AO yield

-- Token Info
-- Total Supply: 21,000,000 $HOOD
-- Fair Launch Allocation: 70% (14,700,000 $HOOD)
-- Community & Ecosystem Fund: 20% (4,200,000 $HOOD)
-- Platform Development Fund: 10% (2,100,000 $HOOD)

local Variant = "0.0.2"
local Allocations = Allocations or {} -- Stores user allocations: { address => { percentage, timestamp } }
local MintedTokens = MintedTokens or {} -- Stores minted tokens: { address => amount }
local TotalAllocated = TotalAllocated or 0 -- Total percentage allocated across all users
local MinAllocationPercentage = 5 -- Minimum allocation percentage
local MaxAllocationPercentage = 100 -- Maximum allocation percentage
local HOOD_TOKEN_CONTRACT = "Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE" -- $HOOD token contract ID
local USER_PROFILE_PROCESS_ADDRESS = "il72h8w_dG4J6CPB-IdlBD8QCZsv0xdR3yHGH35gmPg" -- Will be set during initialization

-- Token Distribution Constants
local TOTAL_SUPPLY = "21000000" -- Total supply of $HOOD tokens
local FAIR_LAUNCH_PERCENTAGE = 70 -- % of total supply allocated to fair launch
local FAIR_LAUNCH_SUPPLY = "14700000" -- 70% of total supply
local COMMUNITY_FUND_SUPPLY = "4200000" -- 20% of total supply
local GODDESSES_ALLOCATION_SUPPLY = "840000" -- 4% of total supply (20% of community fund)
local PUBLIC_CONTRIBUTORS_SUPPLY = "3360000" -- 16% of total supply (80% of community fund)
local PLATFORM_FUND_SUPPLY = "2100000" -- 10% of total supply

-- Goddesses NFT constants
local GODDESSES_COLLECTION_ID = "1NOj1dFvK_ZdXrx8zYlQniXkC3eOUaO7pV8m2-2g1E0" -- Goddesses collection ID on BazAR
local GoddessesHolders = GoddessesHolders or {} -- Stores verified Goddesses holders: { address => { verified: boolean, timestamp: number } }
local GoddessesRewards = GoddessesRewards or {} -- Stores rewards for Goddesses holders: { address => amount }

-- Emission Schedule Constants
local LAUNCH_DATE = 1710720000 -- Unix timestamp for March 16, 2025
local YEAR_IN_SECONDS = 31536000 -- Seconds in a year
local INITIAL_YEAR_PERCENTAGE = 17 -- % of fair launch supply minted in first year
local HALVING_PERIOD_YEARS = 4 -- Period in years after which the emission rate halves

-- Utility functions for big integer operations
local bint = require('.bint')(256)

local utils = {
  add = function (a, b) 
    return tostring(bint(a) + bint(b))
  end,
  subtract = function (a, b)
    return tostring(bint(a) - bint(b))
  end,
  multiply = function (a, b)
    return tostring(bint(a) * bint(b))
  end,
  divide = function (a, b)
    return tostring(bint(a) / bint(b))
  end
}

-- Initialize the process with necessary addresses
function initialize(user_profile_address)
  USER_PROFILE_PROCESS_ADDRESS = user_profile_address
end

-- Verify if an address is a Goddesses NFT holder
local function verify_goddesses_holder(address)
  -- This is a placeholder for the actual verification logic
  -- In a real implementation, this would query the Arweave network or use a cached list
  -- to check if the address owns any Goddesses NFTs from the BazAR collection
  
  -- For demonstration purposes, we're using a simplified approach:
  -- 1. Query Arweave GraphQL to find transactions by the address that interact with the Goddesses collection
  -- 2. Check if the address has any valid Goddesses NFTs from collection ID 1NOj1dFvK_ZdXrx8zYlQniXkC3eOUaO7pV8m2-2g1E0
  
  -- Mark the address as verified for now (placeholder)
  if not GoddessesHolders[address] then
    GoddessesHolders[address] = {
      verified = true,
      timestamp = os.time()
    }
    
    print("Verified Goddesses holder: " .. address)
  end
  
  return GoddessesHolders[address] and GoddessesHolders[address].verified
end

-- Calculate rewards for Goddesses holders based on their activity
local function calculate_goddesses_rewards(address, activity_points)
  if not GoddessesHolders[address] or not GoddessesHolders[address].verified then
    return "0" -- Not a verified Goddesses holder
  end
  
  -- This is a simplified reward calculation
  -- In a real implementation, this would consider:
  -- 1. The total number of Goddesses holders
  -- 2. Activity level of each holder (story creation, contributions)
  -- 3. Available allocation remaining in the Goddesses fund
  
  -- For demonstration, we'll use a base amount multiplied by activity points
  local base_amount = "100" -- Base amount per activity point
  local reward = utils.multiply(base_amount, tostring(activity_points))
  
  -- Initialize if not exists
  if not GoddessesRewards[address] then
    GoddessesRewards[address] = "0"
  end
  
  -- Add to total rewards for this address
  GoddessesRewards[address] = utils.add(GoddessesRewards[address], reward)
  
  -- Update token balance in user profile
  if USER_PROFILE_PROCESS_ADDRESS ~= "" then
    ao.send({
      Target = USER_PROFILE_PROCESS_ADDRESS,
      Action = "UpdateHoodBalance",
      address = address,
      balance = GoddessesRewards[address],
      source = "goddesses_rewards"
    })
  end
  
  -- Send tokens to the user's wallet via the $HOOD token contract
  ao.send({
    Target = HOOD_TOKEN_CONTRACT,
    Action = "Transfer",
    Recipient = address,
    Quantity = reward
  })
  
  print("Rewarded " .. reward .. " $HOOD tokens to Goddesses holder " .. address)
  
  return reward
end

-- Calculate emission rate based on time since launch
local function calculate_emission_rate(current_time)
  local seconds_since_launch = current_time - LAUNCH_DATE
  if seconds_since_launch < 0 then
    seconds_since_launch = 0 -- Not launched yet, use initial rate
  end
  
  local years_since_launch = seconds_since_launch / YEAR_IN_SECONDS
  local halving_count = math.floor(years_since_launch / HALVING_PERIOD_YEARS)
  
  -- Base emission rate (tokens per day for first year)
  local initial_year_tokens = utils.multiply(FAIR_LAUNCH_SUPPLY, tostring(INITIAL_YEAR_PERCENTAGE))
  initial_year_tokens = utils.divide(initial_year_tokens, "100") -- Convert percentage to decimal
  local initial_daily_rate = utils.divide(initial_year_tokens, "365") -- Daily rate for first year
  
  -- Apply halving
  local current_daily_rate = initial_daily_rate
  for i = 1, halving_count do
    current_daily_rate = utils.divide(current_daily_rate, "2") -- Halve the rate
  end
  
  -- For years 2-4 (before first halving), apply gradual reduction
  if years_since_launch > 1 and halving_count == 0 then
    local year = math.floor(years_since_launch) + 1 -- Year 2, 3, or 4
    local reduction_factor = 1 - ((year - 1) * 0.2) -- 20% reduction per year
    current_daily_rate = utils.multiply(current_daily_rate, tostring(reduction_factor))
  end
  
  return current_daily_rate
end

-- Calculate predicted $HOOD tokens for the next 30 days based on current allocation
local function calculate_predicted_tokens(address)
  local allocation = Allocations[address]
  if not allocation then
    return "0"
  end
  
  local current_time = os.time()
  local daily_emission = calculate_emission_rate(current_time)
  local percentage = tonumber(allocation.percentage)
  
  -- Calculate user's share based on percentage and total allocation
  local daily_user_share = utils.multiply(daily_emission, tostring(percentage))
  daily_user_share = utils.divide(daily_user_share, "100") -- Convert percentage to decimal
  
  -- Adjust based on total allocation (more total allocation = less per person)
  if TotalAllocated > 0 then
    local adjustment = utils.divide("10000", tostring(TotalAllocated))
    daily_user_share = utils.multiply(daily_user_share, adjustment)
    daily_user_share = utils.divide(daily_user_share, "100")
  end
  
  -- Multiply by 30 days
  local prediction = utils.multiply(daily_user_share, "30")
  
  return prediction
end

-- Update a user's allocation percentage
local function update_allocation(address, percentage)
  -- Validate percentage
  percentage = tonumber(percentage)
  if percentage < 0 then percentage = 0 end
  if percentage > MaxAllocationPercentage then percentage = MaxAllocationPercentage end
  
  -- If user already has an allocation, update the total allocated amount
  if Allocations[address] then
    TotalAllocated = TotalAllocated - tonumber(Allocations[address].percentage)
  end
  
  -- Update or remove allocation
  if percentage == 0 then
    Allocations[address] = nil
    print("Allocation removed for " .. address)
  else
    Allocations[address] = {
      percentage = percentage,
      timestamp = os.time()
    }
    TotalAllocated = TotalAllocated + percentage
    print("Allocation updated for " .. address .. " to " .. percentage .. "%")
  end
  
  -- Return the updated allocation
  return Allocations[address]
end

-- Mint $HOOD tokens based on allocations (called periodically)
local function mint_tokens()
  local current_time = os.time()
  local daily_emission = calculate_emission_rate(current_time)
  
  -- If no allocations, exit early
  if next(Allocations) == nil then
    return
  end
  
  for address, allocation in pairs(Allocations) do
    local percentage = tonumber(allocation.percentage)
    
    -- Calculate user's share based on percentage and total allocation
    local tokens_to_mint = utils.multiply(daily_emission, tostring(percentage))
    tokens_to_mint = utils.divide(tokens_to_mint, "100") -- Convert percentage to decimal
    
    -- Adjust based on total allocation (more total allocation = less per person)
    if TotalAllocated > 0 then
      local adjustment = utils.divide("10000", tostring(TotalAllocated))
      tokens_to_mint = utils.multiply(tokens_to_mint, adjustment)
      tokens_to_mint = utils.divide(tokens_to_mint, "100")
    end
    
    -- Initialize if not exists
    if not MintedTokens[address] then
      MintedTokens[address] = "0"
    end
    
    -- Add minted tokens to user's balance
    MintedTokens[address] = utils.add(MintedTokens[address], tokens_to_mint)
    
    -- Update token balance in user profile
    if USER_PROFILE_PROCESS_ADDRESS ~= "" then
      ao.send({
        Target = USER_PROFILE_PROCESS_ADDRESS,
        Action = "UpdateHoodBalance",
        address = address,
        balance = MintedTokens[address]
      })
    end
    
    -- Send tokens to the user's wallet via the $HOOD token contract
    ao.send({
      Target = HOOD_TOKEN_CONTRACT,
      Action = "Transfer",
      Recipient = address,
      Quantity = tokens_to_mint
    })
    
    print("Minted " .. tokens_to_mint .. " $HOOD tokens for " .. address)
  end
end

-- Handler for updating a user's allocation percentage
-- @mutation
Handlers.add("update_allocation",
  Handlers.utils.hasMatchingTag("Action", "UpdateAllocation"),
  function(msg)
    local address = msg.From
    local percentage = msg.percentage
    
    if not percentage then
      if msg.reply then
        msg.reply({ Data = "Invalid request. Please provide a percentage." })
      else
        ao.send({ Target = msg.From, Data = "Invalid request. Please provide a percentage." })
      end
      return
    end
    
    percentage = tonumber(percentage)
    
    -- Validate minimum percentage
    if percentage > 0 and percentage < MinAllocationPercentage then
      if msg.reply then
        msg.reply({ Data = "Invalid percentage. Minimum allocation is " .. MinAllocationPercentage .. "%." })
      else
        ao.send({ 
          Target = msg.From, 
          Data = "Invalid percentage. Minimum allocation is " .. MinAllocationPercentage .. "%."
        })
      end
      return
    end
    
    local allocation = update_allocation(address, percentage)
    local predicted_tokens = "0"
    
    if allocation then
      predicted_tokens = calculate_predicted_tokens(address)
    end
    
    local response = {
      Data = percentage > 0 and "Allocation updated successfully" or "Allocation removed successfully",
      allocation = allocation,
      predicted_tokens = predicted_tokens,
      minted_tokens = MintedTokens[address] or "0"
    }
    
    if msg.reply then
      msg.reply(response)
    else
      -- Create a new message with all fields from response
      local message = { Target = msg.From }
      for k, v in pairs(response) do
        message[k] = v
      end
      ao.send(message)
    end
  end
)

-- Handler for getting a user's allocation information
-- @view
Handlers.add("get_allocation",
  Handlers.utils.hasMatchingTag("Action", "GetAllocation"),
  function(msg)
    local address = msg.address or msg.From
    local allocation = Allocations[address]
    local predicted_tokens = "0"
    
    if allocation then
      predicted_tokens = calculate_predicted_tokens(address)
    end
    
    -- Check if the address is a Goddesses holder
    local is_goddesses_holder = GoddessesHolders[address] and GoddessesHolders[address].verified
    
    local response = {
      Data = {
        allocation = allocation,
        predicted_tokens = predicted_tokens,
        minted_tokens = MintedTokens[address] or "0",
        goddesses_rewards = GoddessesRewards[address] or "0",
        is_goddesses_holder = is_goddesses_holder,
        total_allocated = TotalAllocated
      }
    }
    
    if msg.reply then
      msg.reply(response)
    else
      -- Create a new message with all fields from response
      local message = { Target = msg.From }
      for k, v in pairs(response) do
        message[k] = v
      end
      ao.send(message)
    end
  end
)

-- Handler for getting all allocations
-- @view
Handlers.add("get_all_allocations",
  Handlers.utils.hasMatchingTag("Action", "GetAllAllocations"),
  function(msg)
    local response = {
      Data = {
        allocations = Allocations,
        total_allocated = TotalAllocated
      }
    }
    
    if msg.reply then
      msg.reply(response)
    else
      -- Create a new message with all fields from response
      local message = { Target = msg.From }
      for k, v in pairs(response) do
        message[k] = v
      end
      ao.send(message)
    end
  end
)

-- Handler for setting the user profile process address
-- @mutation
Handlers.add("set_user_profile_process",
  Handlers.utils.hasMatchingTag("Action", "SetUserProfileProcess"),
  function(msg)
    if msg.process_address then
      USER_PROFILE_PROCESS_ADDRESS = msg.process_address
      
      local response = { Data = "User profile process address set successfully." }
      
      if msg.reply then
        msg.reply(response)
      else
        -- Create a new message with all fields from response
        local message = { Target = msg.From }
        for k, v in pairs(response) do
          message[k] = v
        end
        ao.send(message)
      end
    else
      local response = { Data = "Invalid request. Please provide a process address." }
      
      if msg.reply then
        msg.reply(response)
      else
        -- Create a new message with all fields from response
        local message = { Target = msg.From }
        for k, v in pairs(response) do
          message[k] = v
        end
        ao.send(message)
      end
    end
  end
)

-- Handler for setting the HOOD token contract address
-- @mutation
Handlers.add("set_hood_token_contract",
  Handlers.utils.hasMatchingTag("Action", "SetHoodTokenContract"),
  function(msg)
    if msg.contract_address then
      HOOD_TOKEN_CONTRACT = msg.contract_address
      
      local response = { Data = "HOOD token contract address set successfully." }
      
      if msg.reply then
        msg.reply(response)
      else
        -- Create a new message with all fields from response
        local message = { Target = msg.From }
        for k, v in pairs(response) do
          message[k] = v
        end
        ao.send(message)
      end
    else
      local response = { Data = "Invalid request. Please provide a contract address." }
      
      if msg.reply then
        msg.reply(response)
      else
        -- Create a new message with all fields from response
        local message = { Target = msg.From }
        for k, v in pairs(response) do
          message[k] = v
        end
        ao.send(message)
      end
    end
  end
)

-- Handler for setting the minimum allocation percentage
-- @mutation
Handlers.add("set_min_allocation_percentage",
  Handlers.utils.hasMatchingTag("Action", "SetMinAllocationPercentage"),
  function(msg)
    if msg.percentage then
      MinAllocationPercentage = tonumber(msg.percentage)
      
      local response = { Data = "Minimum allocation percentage set successfully." }
      
      if msg.reply then
        msg.reply(response)
      else
        -- Create a new message with all fields from response
        local message = { Target = msg.From }
        for k, v in pairs(response) do
          message[k] = v
        end
        ao.send(message)
      end
    else
      local response = { Data = "Invalid request. Please provide a percentage." }
      
      if msg.reply then
        msg.reply(response)
      else
        -- Create a new message with all fields from response
        local message = { Target = msg.From }
        for k, v in pairs(response) do
          message[k] = v
        end
        ao.send(message)
      end
    end
  end
)

-- Handler for triggering the minting process
-- @mutation
Handlers.add("trigger_minting",
  Handlers.utils.hasMatchingTag("Action", "TriggerMinting"),
  function(msg)
    mint_tokens()
    
    local response = { Data = "Minting process triggered successfully." }
    
    if msg.reply then
      msg.reply(response)
    else
      -- Create a new message with all fields from response
      local message = { Target = msg.From }
      for k, v in pairs(response) do
        message[k] = v
      end
      ao.send(message)
    end
  end
)

-- Handler for verifying Goddesses NFT ownership
-- @mutation
Handlers.add("verify_goddesses",
  Handlers.utils.hasMatchingTag("Action", "VerifyGoddesses"),
  function(msg)
    local address = msg.address or msg.From
    local is_verified = verify_goddesses_holder(address)
    
    local response = {
      Data = is_verified and "Successfully verified Goddesses NFT ownership" or "Failed to verify Goddesses NFT ownership",
      verified = is_verified,
      address = address,
      rewards = GoddessesRewards[address] or "0"
    }
    
    if msg.reply then
      msg.reply(response)
    else
      -- Create a new message with all fields from response
      local message = { Target = msg.From }
      for k, v in pairs(response) do
        message[k] = v
      end
      ao.send(message)
    end
  end
)

-- Handler for rewarding Goddesses holders based on activity
-- @mutation
Handlers.add("reward_goddesses_activity",
  Handlers.utils.hasMatchingTag("Action", "RewardGoddessesActivity"),
  function(msg)
    local address = msg.address or msg.From
    local activity_points = tonumber(msg.activity_points) or 1
    
    if not GoddessesHolders[address] or not GoddessesHolders[address].verified then
      local response = {
        Data = "User is not a verified Goddesses NFT holder",
        success = false
      }
      
      if msg.reply then
        msg.reply(response)
      else
        ao.send({ Target = msg.From, Data = "User is not a verified Goddesses NFT holder", success = false })
      end
      return
    end
    
    local reward = calculate_goddesses_rewards(address, activity_points)
    
    local response = {
      Data = "Successfully rewarded Goddesses NFT holder for activity",
      reward = reward,
      total_rewards = GoddessesRewards[address] or "0",
      success = true
    }
    
    if msg.reply then
      msg.reply(response)
    else
      -- Create a new message with all fields from response
      local message = { Target = msg.From }
      for k, v in pairs(response) do
        message[k] = v
      end
      ao.send(message)
    end
  end
)

-- Initialize with addresses if provided
if ao.env and ao.env.Process and ao.env.Process.Tags then
  if ao.env.Process.Tags["User-Profile-Process-Address"] then
    USER_PROFILE_PROCESS_ADDRESS = ao.env.Process.Tags["User-Profile-Process-Address"]
  end
  
  if ao.env.Process.Tags["Hood-Token-Contract-Address"] then
    HOOD_TOKEN_CONTRACT = ao.env.Process.Tags["Hood-Token-Contract-Address"]
  end
  
  if ao.env.Process.Tags["Goddesses-Collection-ID"] then
    GODDESSES_COLLECTION_ID = ao.env.Process.Tags["Goddesses-Collection-ID"]
  end
end
