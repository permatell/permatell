-- AO Profile Integration Process
-- This process handles integration with the @permaweb/aoprofile SDK
-- It allows users to link their AO profiles to our application

local USER_PROFILE_PROCESS_ADDRESS = "il72h8w_dG4J6CPB-IdlBD8QCZsv0xdR3yHGH35gmPg" -- Will be set during initialization
local PROFILE_REGISTRY_PROCESS = "SNy4m-DrqxWl01YqGM4sxI8qCni-58re8uuJLvZPypY" -- Will be set during initialization

-- Cache of AO profiles
local ao_profiles = {}

-- Initialize the process with necessary addresses
function initialize(user_profile_address, profile_registry_process)
  USER_PROFILE_PROCESS_ADDRESS = user_profile_address
  PROFILE_REGISTRY_PROCESS = profile_registry_process
end

-- Fetch a profile from the registry
local function fetch_profile_from_registry(profile_id)
  -- In a real implementation, this would query the profile registry process
  -- For now, we'll use a simple mock implementation
  
  if PROFILE_REGISTRY_PROCESS ~= "" then
    -- This would be an async operation in a real implementation
    -- For simplicity, we're just returning a placeholder value
    return {
      id = profile_id,
      fetched = true,
      timestamp = os.time()
    }
  end
  
  return nil
end

-- Link an AO profile to a user profile
local function link_profile_to_user(address, profile_id)
  -- Fetch the profile from the registry if not already cached
  if not ao_profiles[profile_id] then
    ao_profiles[profile_id] = fetch_profile_from_registry(profile_id)
  end
  
  -- Notify the user profile process
  if USER_PROFILE_PROCESS_ADDRESS ~= "" then
    ao.send({
      Target = USER_PROFILE_PROCESS_ADDRESS,
      Action = "LinkAOProfile",
      address = address,
      ao_profile_id = profile_id
    })
    
    -- Also request to spawn a story process for this profile
    ao.send({
      Target = USER_PROFILE_PROCESS_ADDRESS,
      Action = "SpawnStoryProcess",
      From = address
    })
  end
  
  return ao_profiles[profile_id]
end

-- @mutation
Handlers.add("link_ao_profile",
  { Action = "LinkAOProfile" },
  function(msg)
    local address = msg.address or msg.From
    local profile_id = msg.profile_id
    
    if not profile_id then
      ao.send({ Target = msg.From, Data = "Invalid request. Please provide a profile_id." })
      return
    end
    
    local profile = link_profile_to_user(address, profile_id)
    
    if profile then
      ao.send({ 
        Target = msg.From, 
        Data = "AO Profile linked successfully",
        profile = profile
      })
    else
      ao.send({ Target = msg.From, Data = "Failed to link AO Profile. Profile not found in registry." })
    end
  end
)

-- @view
Handlers.add("get_ao_profile",
  { Action = "GetAOProfile" },
  function(msg)
    local profile_id = msg.profile_id
    
    if not profile_id then
      ao.send({ Target = msg.From, Data = "Invalid request. Please provide a profile_id." })
      return
    end
    
    -- Fetch the profile from the registry if not already cached
    if not ao_profiles[profile_id] then
      ao_profiles[profile_id] = fetch_profile_from_registry(profile_id)
    end
    
    if ao_profiles[profile_id] then
      ao.send({ 
        Target = msg.From, 
        Data = ao_profiles[profile_id]
      })
    else
      ao.send({ Target = msg.From, Data = "Profile not found." })
    end
  end
)

-- @view
Handlers.add("get_user_ao_profile",
  { Action = "GetUserAOProfile" },
  function(msg)
    local address = msg.address or msg.From
    
    -- Query the user profile process to get the user's AO profile ID
    if USER_PROFILE_PROCESS_ADDRESS ~= "" then
      ao.send({
        Target = USER_PROFILE_PROCESS_ADDRESS,
        Action = "GetProfile",
        address = address
      })
      
      -- In a real implementation, we would wait for the response
      -- For simplicity, we'll just return a placeholder message
      ao.send({ 
        Target = msg.From, 
        Data = "Profile request forwarded to user profile process: " .. USER_PROFILE_PROCESS_ADDRESS
      })
    else
      ao.send({ Target = msg.From, Data = "User profile process not configured." })
    end
  end
)

-- @mutation
Handlers.add("create_ao_profile",
  { Action = "CreateAOProfile" },
  function(msg)
    local address = msg.From
    local username = msg.username
    local display_name = msg.display_name
    local description = msg.description
    local thumbnail = msg.thumbnail
    local banner = msg.banner
    
    if not username then
      ao.send({ Target = msg.From, Data = "Invalid request. Please provide a username." })
      return
    end
    
    -- In a real implementation, this would create a profile using the SDK
    -- For now, we'll use a simple mock implementation
    local profile_id = "ao-profile-" .. os.time()
    
    -- Cache the profile
    ao_profiles[profile_id] = {
      id = profile_id,
      username = username,
      display_name = display_name or username,
      description = description or "",
      thumbnail = thumbnail or "",
      banner = banner or "",
      created_at = os.time()
    }
    
    -- Link the profile to the user
    link_profile_to_user(address, profile_id)
    
    ao.send({ 
      Target = msg.From, 
      Data = "AO Profile created and linked successfully",
      profile_id = profile_id,
      profile = ao_profiles[profile_id]
    })
  end
)

-- @mutation
Handlers.add("update_ao_profile",
  { Action = "UpdateAOProfile" },
  function(msg)
    local profile_id = msg.profile_id
    
    if not profile_id or not ao_profiles[profile_id] then
      ao.send({ Target = msg.From, Data = "Invalid request. Profile not found." })
      return
    end
    
    local profile = ao_profiles[profile_id]
    
    -- Update profile fields
    if msg.username then profile.username = msg.username end
    if msg.display_name then profile.display_name = msg.display_name end
    if msg.description then profile.description = msg.description end
    if msg.thumbnail then profile.thumbnail = msg.thumbnail end
    if msg.banner then profile.banner = msg.banner end
    
    profile.updated_at = os.time()
    
    ao.send({ 
      Target = msg.From, 
      Data = "AO Profile updated successfully",
      profile = profile
    })
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
Handlers.add("set_profile_registry_process",
  { Action = "SetProfileRegistryProcess" },
  function(msg)
    if msg.process_address then
      PROFILE_REGISTRY_PROCESS = msg.process_address
      ao.send({ Target = msg.From, Data = "Profile registry process address set successfully." })
    else
      ao.send({ Target = msg.From, Data = "Invalid request. Please provide a process address." })
    end
  end
)

-- Initialize with addresses if provided
if ao.env and ao.env.Process and ao.env.Process.Tags then
  if ao.env.Process.Tags["User-Profile-Process-Address"] then
    USER_PROFILE_PROCESS_ADDRESS = ao.env.Process.Tags["User-Profile-Process-Address"]
  end
  
  if ao.env.Process.Tags["Profile-Registry-Process"] then
    PROFILE_REGISTRY_PROCESS = ao.env.Process.Tags["Profile-Registry-Process"]
  end
end
