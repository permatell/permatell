local user_profiles = {}
local user_story_processes = {}
local STORY_POINTS_PROCESS_ADDRESS = "UwYxEKXxEmbd9-sIJtSVgAPMj85QQC7ExMt1VeLxXsA"
local STORIES_PROCESS_ADDRESS = "gUp8l-EyEVG1wHkyjTY2PLX3kfNOttXdUTsQFgL8gfI" -- Will be set during initialization
local AO_PROFILE_INTEGRATION_PROCESS_ID = "cghQLblfE5PFF44Eb9zsQvxXtbn3zt9FmwWEh3gHWGA" -- Replace with actual registry process ID

-- Constants for $HOOD token holders
local HOOD_TOKEN_BENEFITS = {
  STORY_POINTS_MULTIPLIER = 2,
  MAX_STORIES_PER_USER = 100,
  PREMIUM_FEATURES_ENABLED = true
}

-- Standard users
local STANDARD_USER_LIMITS = {
  STORY_POINTS_MULTIPLIER = 1,
  MAX_STORIES_PER_USER = 10,
  PREMIUM_FEATURES_ENABLED = false
}

-- Initialize the process with the stories process address
function initialize(stories_process_address)
  STORIES_PROCESS_ADDRESS = stories_process_address
end

-- Check if a user is a $HOOD token holder
local function is_hood_token_holder(address)
  -- This would typically query a token balance from a token contract
  -- For now, we'll use a simple mock implementation
  -- In a real implementation, you would query the token contract
  return user_profiles[address] and user_profiles[address].hood_token_balance > 0
end

-- Get user benefits based on their token status
local function get_user_benefits(address)
  if is_hood_token_holder(address) then
    return HOOD_TOKEN_BENEFITS
  else
    return STANDARD_USER_LIMITS
  end
end

-- Create a new user profile
local function create_user_profile(address, ao_profile_id, display_name, hood_token_balance)
  user_profiles[address] = {
    address = address,
    ao_profile_id = ao_profile_id,
    display_name = display_name,
    hood_token_balance = hood_token_balance or 0,
    created_at = os.time(),
    updated_at = os.time(),
    story_ids = {},
    preferences = {
      theme = "light",
      notifications_enabled = true
    }
  }
  return user_profiles[address]
end

-- Spawn a new story process for a user
local function spawn_user_story_process(address)
  local benefits = get_user_benefits(address)
  
  -- Check if user has reached their story limit
  if user_profiles[address] and #user_profiles[address].story_ids >= benefits.MAX_STORIES_PER_USER then
    return nil, "User has reached maximum number of stories"
  end
  
  -- Prepare initialization data for the new process
  local init_data = {
    owner = address,
    stories = {},
    last_story_id = 0,
    collaborators = {}
  }
  
  -- Spawn a new process for the user's stories and wait for it to be created
  local res = ao.spawn("OljmAJ0sKU-ga5ocNumrTW4dMapWquhsWBM0-Gdnp2A", {
    Data = init_data,
    Tags = {
      ["Process-Type"] = "user-story-process",
      ["Owner"] = address,
      ["User-Profile-Process-Address"] = ao.id,
      ["Authority"] = "fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY" -- MU ID for authorization
    }
  }).receive()
  
  -- Get the process ID from the response
  local process_id = res.Process
  
  -- Print confirmation for debugging
  print("Spawned story process for user " .. address .. " with ID " .. process_id)
  
  -- Store the process ID
  if not user_story_processes[address] then
    user_story_processes[address] = {}
  end
  
  table.insert(user_story_processes[address], process_id)
  
  -- Notify the stories process about the new user story process
  ao.send({
    Target = STORIES_PROCESS_ADDRESS,
    Action = "RegisterUserStoryProcess",
    address = address,
    process_id = process_id
  })
  
  return process_id
end

-- Link an AO profile to a user
local function link_ao_profile(address, ao_profile_id)
  if not user_profiles[address] then
    return nil, "User profile not found"
  end
  
  user_profiles[address].ao_profile_id = ao_profile_id
  user_profiles[address].updated_at = os.time()
  
  return user_profiles[address]
end

-- Update user's $HOOD token balance
local function update_hood_token_balance(address, balance)
  if not user_profiles[address] then
    return nil, "User profile not found"
  end
  
  user_profiles[address].hood_token_balance = balance
  user_profiles[address].updated_at = os.time()
  
  return user_profiles[address]
end

-- Add story points with multiplier based on token status
local function add_story_points(address, base_points)
  local benefits = get_user_benefits(address)
  local multiplier = benefits.STORY_POINTS_MULTIPLIER
  local total_points = base_points * multiplier
  
  ao.send({
    Target = STORY_POINTS_PROCESS_ADDRESS,
    Action = "AddStoryPoints",
    address = address,
    points = tostring(total_points)
  })
  
  return total_points
end

-- @mutation
Handlers.add("create_profile",
  { Action = "CreateProfile" },
  function(msg)
    local address = msg.From
    local ao_profile_id = msg.ao_profile_id
    local display_name = msg.display_name
    local hood_token_balance = tonumber(msg.hood_token_balance) or 0
    
    local profile = create_user_profile(address, ao_profile_id, display_name, hood_token_balance)
    
    ao.send({ 
      Target = msg.From, 
      Data = "Profile created successfully",
      profile = profile
    })
  end
)

-- @mutation
Handlers.add("link_ao_profile",
  { Action = "LinkAOProfile" },
  function(msg)
    local address = msg.address or msg.From
    local ao_profile_id = msg.ao_profile_id
    
    local profile, error = link_ao_profile(address, ao_profile_id)
    
    if profile then
      ao.send({ 
        Target = msg.From, 
        Data = "AO Profile linked successfully",
        profile = profile
      })
    else
      ao.send({ 
        Target = msg.From, 
        Data = "Error linking AO Profile: " .. (error or "Unknown error")
      })
    end
  end
)

-- @mutation
Handlers.add("update_hood_balance",
  { Action = "UpdateHoodBalance" },
  function(msg)
    local address = msg.address or msg.From
    local balance = tonumber(msg.balance) or 0
    
    local profile, error = update_hood_token_balance(address, balance)
    
    if profile then
      ao.send({ 
        Target = msg.From, 
        Data = "HOOD token balance updated successfully",
        profile = profile
      })
    else
      ao.send({ 
        Target = msg.From, 
        Data = "Error updating HOOD token balance: " .. (error or "Unknown error")
      })
    end
  end
)

-- @mutation
Handlers.add("spawn_story_process",
  { Action = "SpawnStoryProcess" },
  function(msg)
    local address = msg.From
    
    local process_id, error = spawn_user_story_process(address)
    
    if process_id then
      ao.send({ 
        Target = msg.From, 
        Data = "Story process spawned successfully",
        process_id = process_id
      })
    else
      ao.send({ 
        Target = msg.From, 
        Data = "Error spawning story process: " .. (error or "Unknown error")
      })
    end
  end
)

-- @view
Handlers.add("get_profile",
  { Action = "GetProfile" },
  function(msg)
    local address = msg.address or msg.From
    local profile = user_profiles[address]
    
    if profile then
      local benefits = get_user_benefits(address)
      
      ao.send({ 
        Target = msg.From, 
        Data = {
          profile = profile,
          benefits = benefits,
          is_hood_holder = is_hood_token_holder(address)
        }
      })
    else
      ao.send({ 
        Target = msg.From, 
        Data = "Profile not found"
      })
    end
  end
)

-- @view
Handlers.add("get_user_story_processes",
  { Action = "GetUserStoryProcesses" },
  function(msg)
    local address = msg.address or msg.From
    local processes = user_story_processes[address] or {}
    
    ao.send({ 
      Target = msg.From, 
      Data = processes
    })
  end
)

-- @view
Handlers.add("get_user_benefits",
  { Action = "GetUserBenefits" },
  function(msg)
    local address = msg.address or msg.From
    local benefits = get_user_benefits(address)
    
    ao.send({ 
      Target = msg.From, 
      Data = {
        benefits = benefits,
        is_hood_holder = is_hood_token_holder(address)
      }
    })
  end
)

-- Initialize with the stories process address if provided
if ao.env and ao.env.Process and ao.env.Process.Tags and ao.env.Process.Tags["Stories-Process-Address"] then
  initialize(ao.env.Process.Tags["Stories-Process-Address"])
end
