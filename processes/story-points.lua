local user_points = {}
local user_rewards = {}
local USER_PROFILE_PROCESS_ADDRESS = "il72h8w_dG4J6CPB-IdlBD8QCZsv0xdR3yHGH35gmPg" -- Will be set during initialization
local HOOD_TOKEN_CONTRACT_ADDRESS = "N-cNO2ryesWjEdXrx4h19E0uewSCEmAsBmaXaP8f9Jg" -- Will be set during initialization

-- Constants for rewards
local REWARD_THRESHOLDS = {
  BASIC = 100,
  INTERMEDIATE = 500,
  ADVANCED = 1000,
  EXPERT = 5000
}

-- Reward multipliers for $HOOD token holders
local HOOD_TOKEN_MULTIPLIERS = {
  POINTS_EARNED = 2,
  REWARD_THRESHOLD_REDUCTION = 0.8 -- 20% reduction in threshold requirements
}

local function add_points(address, points)
  if not user_points[address] then
    user_points[address] = 0
  end
  user_points[address] = user_points[address] + points
  
  -- Check if user has reached any reward thresholds
  check_reward_thresholds(address)
  
  return user_points[address]
end

-- Check if a user has reached any reward thresholds
local function check_reward_thresholds(address)
  local points = user_points[address] or 0
  
  if not user_rewards[address] then
    user_rewards[address] = {
      claimed_rewards = {},
      available_rewards = {}
    }
  end
  
  -- Check each threshold
  for level, threshold in pairs(REWARD_THRESHOLDS) do
    if points >= threshold and not user_rewards[address].claimed_rewards[level] then
      -- Add to available rewards if not already claimed
      user_rewards[address].available_rewards[level] = true
      
      -- Notify user profile process if available
      if USER_PROFILE_PROCESS_ADDRESS ~= "" then
        ao.send({
          Target = USER_PROFILE_PROCESS_ADDRESS,
          Action = "RewardAvailable",
          address = address,
          reward_level = level,
          points_required = threshold
        })
      end
    end
  end
end

-- Check if a user is a $HOOD token holder
local function is_hood_token_holder(address)
  -- This would typically query a token balance from a token contract
  -- For now, we'll use a simple mock implementation
  -- In a real implementation, you would query the token contract
  
  -- If the profile process is available, query it
  if USER_PROFILE_PROCESS_ADDRESS ~= "" then
    -- This would be an async operation in a real implementation
    -- For simplicity, we're just returning a placeholder value
    return true
  end
  
  return false
end

-- Get adjusted threshold based on token holder status
local function get_adjusted_threshold(address, threshold)
  if is_hood_token_holder(address) then
    return threshold * HOOD_TOKEN_MULTIPLIERS.REWARD_THRESHOLD_REDUCTION
  else
    return threshold
  end
end

-- Process ID: CiCoT60SUbCAJYY2ncv_-BJOQvGB0tHib_mTLJv4Q6Q
-- Points System with $HOOD token integration
-- @mutation
Handlers.add("add_story_points",
  { Action = "AddStoryPoints" },
  function(msg)
    if msg.address and msg.points then
      local points = tonumber(msg.points)
      
      -- Apply multiplier for $HOOD token holders
      if is_hood_token_holder(msg.address) then
        points = points * HOOD_TOKEN_MULTIPLIERS.POINTS_EARNED
      end
      
      local new_total = add_points(msg.address, points)
      
      ao.send({ 
        Target = msg.From, 
        Data = "Added " .. points .. " points to " .. msg.address .. ". New total: " .. new_total,
        is_hood_holder = is_hood_token_holder(msg.address)
      })
    else
      ao.send({ Target = msg.From, Data = "Invalid request. Please provide address and points." })
    end
  end
)

-- @mutation
Handlers.add("claim_reward",
  { Action = "ClaimReward" },
  function(msg)
    local address = msg.address or msg.From
    local reward_level = msg.reward_level
    
    if not user_rewards[address] then
      ao.send({ Target = msg.From, Data = "No rewards available for this address." })
      return
    end
    
    if not user_rewards[address].available_rewards[reward_level] then
      ao.send({ Target = msg.From, Data = "This reward is not available or has already been claimed." })
      return
    end
    
    -- Mark as claimed
    user_rewards[address].claimed_rewards[reward_level] = true
    user_rewards[address].available_rewards[reward_level] = nil
    
    -- Notify user profile process if available
    if USER_PROFILE_PROCESS_ADDRESS ~= "" then
      ao.send({
        Target = USER_PROFILE_PROCESS_ADDRESS,
        Action = "RewardClaimed",
        address = address,
        reward_level = reward_level
      })
    end
    
    ao.send({ 
      Target = msg.From, 
      Data = "Reward " .. reward_level .. " claimed successfully!",
      rewards = user_rewards[address]
    })
  end
)

-- @view
Handlers.add("get_all_story_points",
  { Action = "GetAllStoryPoints" },
  function(msg)
    ao.send({ 
      Target = msg.From, 
      Data = {
        points = user_points,
        reward_thresholds = REWARD_THRESHOLDS
      }
    })
  end
)

-- @view
Handlers.add("get_user_story_points",
  { Action = "GetUserStoryPoints" },
  function(msg)
    if msg.address then
      local address = msg.address
      local points = user_points[address] or 0
      local is_hood_holder = is_hood_token_holder(address)
      
      -- Get available and claimed rewards
      local rewards = user_rewards[address] or {
        claimed_rewards = {},
        available_rewards = {}
      }
      
      -- Calculate next reward threshold
      local next_threshold = nil
      local next_level = nil
      
      for level, threshold in pairs(REWARD_THRESHOLDS) do
        local adjusted_threshold = get_adjusted_threshold(address, threshold)
        if points < adjusted_threshold and (not next_threshold or adjusted_threshold < next_threshold) then
          next_threshold = adjusted_threshold
          next_level = level
        end
      end
      
      ao.send({ 
        Target = msg.From, 
        Data = { 
          address = address, 
          points = points,
          is_hood_holder = is_hood_holder,
          rewards = rewards,
          next_threshold = next_threshold,
          next_level = next_level,
          points_multiplier = is_hood_holder and HOOD_TOKEN_MULTIPLIERS.POINTS_EARNED or 1
        }
      })
    else
      ao.send({ Target = msg.From, Data = "Invalid request. Please provide an address." })
    end
  end
)

-- @view
Handlers.add("get_user_rewards",
  { Action = "GetUserRewards" },
  function(msg)
    if msg.address then
      local address = msg.address
      local rewards = user_rewards[address] or {
        claimed_rewards = {},
        available_rewards = {}
      }
      
      ao.send({ 
        Target = msg.From, 
        Data = { 
          address = address,
          rewards = rewards,
          is_hood_holder = is_hood_token_holder(address)
        }
      })
    else
      ao.send({ Target = msg.From, Data = "Invalid request. Please provide an address." })
    end
  end
)

-- @mutation
Handlers.add("set_user_profile_process",
  { Action = "SetUserProfileProcess" },
  function(msg)
    if msg.process_address then
      USER_PROFILE_PROCESS_ADDRESS = msg.process_address
      ao.send({ Target = msg.From, Data = "User profile process address set successfully." })
    else
      ao.send({ Target = msg.From, Data = "Invalid request. Please provide a process address." })
    end
  end
)

-- @mutation
Handlers.add("set_hood_token_contract",
  { Action = "SetHoodTokenContract" },
  function(msg)
    if msg.contract_address then
      HOOD_TOKEN_CONTRACT_ADDRESS = msg.contract_address
      ao.send({ Target = msg.From, Data = "HOOD token contract address set successfully." })
    else
      ao.send({ Target = msg.From, Data = "Invalid request. Please provide a contract address." })
    end
  end
)

-- Initialize with addresses if provided
if ao.env and ao.env.Process and ao.env.Process.Tags then
  if ao.env.Process.Tags["User-Profile-Process-Address"] then
    USER_PROFILE_PROCESS_ADDRESS = ao.env.Process.Tags["User-Profile-Process-Address"]
  end
  
  if ao.env.Process.Tags["Hood-Token-Contract-Address"] then
    HOOD_TOKEN_CONTRACT_ADDRESS = ao.env.Process.Tags["Hood-Token-Contract-Address"]
  end
end
