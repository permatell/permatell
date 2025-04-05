-- Main Stories Process
-- This process serves as a registry and router for user story processes
-- It maintains backward compatibility with the old API while supporting the new decentralized architecture

local STORY_POINTS_PROCESS_ADDRESS = "UwYxEKXxEmbd9-sIJtSVgAPMj85QQC7ExMt1VeLxXsA"
local USER_PROFILE_PROCESS_ADDRESS = "il72h8w_dG4J6CPB-IdlBD8QCZsv0xdR3yHGH35gmPg" -- Will be set during initialization
local STORY_PROCESS_MODULE_ID = "OljmAJ0sKU-ga5ocNumrTW4dMapWquhsWBM0-Gdnp2A" -- Will be set during initialization

-- Legacy storage for backward compatibility
local last_story_id = 1
local stories = {}

-- Registry of user story processes
local user_story_processes = {}

-- Initialize the process with necessary addresses
function initialize(user_profile_address, story_process_module)
  USER_PROFILE_PROCESS_ADDRESS = user_profile_address
  STORY_PROCESS_MODULE_ID = story_process_module
end

-- Send story points to a user
local function send_story_points(address, points)
  ao.send({
    Target = STORY_POINTS_PROCESS_ADDRESS,
    Action = "AddStoryPoints",
    address = address,
    points = tostring(points)
  })
end

-- Legacy functions for backward compatibility
local function generate_story_id()
  last_story_id = last_story_id + 1
  return tostring(last_story_id)
end

local function generate_new_version_id(story)
  local max_id = 0
  for version_id, _ in pairs(story.versions) do
    local id_num = tonumber(version_id)
    if id_num and id_num > max_id then
      max_id = id_num
    end
  end
  return tostring(max_id + 1)
end

local function increment_version_votes(story_id, version_id)
  local story = stories[story_id]
  if story and story.versions[version_id] then
    story.versions[version_id].votes = (story.versions[version_id].votes or 0) + 1
    return true
  end
  return false
end

-- Get or create a user's story process
local function get_or_create_user_story_process(address)
  -- Check if user already has a story process
  if user_story_processes[address] then
    return user_story_processes[address]
  end
  
  -- If user profile process is available, request it to spawn a process
  if USER_PROFILE_PROCESS_ADDRESS ~= "" then
    -- Send a message to the user profile process to spawn a story process
    ao.send({
      Target = USER_PROFILE_PROCESS_ADDRESS,
      Action = "SpawnStoryProcess",
      From = address
    })
    
    -- In a real implementation, we would wait for the response
    -- For now, we'll return a placeholder message
    return "PROCESS_BEING_SPAWNED_BY_PROFILE"
  end
  
  -- Fallback: Spawn a new process for the user's stories directly
  -- This is for backward compatibility
  local init_data = {
    owner = address,
    stories = {},
    last_story_id = 0,
    collaborators = {}
  }
  
  -- Spawn a new process for the user's stories and wait for it to be created
  local res = ao.spawn(STORY_PROCESS_MODULE_ID or "STORY-PROCESS-MODULE-ID", {
    Data = init_data,
    Tags = {
      ["Process-Type"] = "user-story-process",
      ["Owner"] = address,
      ["User-Profile-Process-Address"] = USER_PROFILE_PROCESS_ADDRESS,
      ["Authority"] = "fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY" -- MU ID for authorization
    }
  }).receive()
  
  -- Get the process ID from the response
  local process_id = res.Process
  
  -- Print confirmation for debugging
  print("Spawned story process for user " .. address .. " with ID " .. process_id)
  
  -- Store the process ID
  user_story_processes[address] = process_id
  
  -- Notify the user profile process if available
  if USER_PROFILE_PROCESS_ADDRESS ~= "" then
    ao.send({
      Target = USER_PROFILE_PROCESS_ADDRESS,
      Action = "StoryProcessCreated",
      address = address,
      process_id = process_id
    })
  end
  
  return process_id
end

-- Forward a message to a user's story process
local function forward_to_user_story_process(address, action, msg)
  local process_id = get_or_create_user_story_process(address)
  
  -- Forward the message to the user's story process
  ao.send({
    Target = process_id,
    Action = action,
    From = msg.From,
    -- Include all original message fields
    title = msg.title,
    content = msg.content,
    cover_image = msg.cover_image,
    category = msg.category,
    is_public = msg.is_public,
    story_id = msg.story_id,
    version_id = msg.version_id,
    collaborators = msg.collaborators,
    tags = msg.tags,
    metadata = msg.metadata
  })
  
  return process_id
end

-- @mutation
Handlers.add("create_story",
  { Action = "CreateStory" },
  function(msg)
    -- Forward to user's story process if using new architecture
    if STORY_PROCESS_MODULE_ID ~= "" then
      local process_id = forward_to_user_story_process(msg.From, "CreateStory", msg)
      
      -- For backward compatibility, we'll still respond directly
      -- The user's story process will also respond with more details
      ao.send({ 
        Target = msg.From, 
        Data = "Story creation request forwarded to your personal story process: " .. process_id 
      })
      return
    end
    
    -- Legacy implementation for backward compatibility
    local story_id = generate_story_id()
    
    stories[story_id] = {
      id = story_id,
      current_version = "1",
      is_public = msg.is_public,
      versions = {
        ["1"] = {
          id = 1,
          title = msg.title,
          content = msg.content,
          cover_image = msg.cover_image or "",
          author = msg.From,
          timestamp = os.time(),
          category = msg.category or "",
          votes = 0
        }
      }
    }
    
    send_story_points(msg.From, 10)
    
    ao.send({ Target = msg.From, Data = "Story created with ID: " .. story_id })
  end
)

-- @mutation
Handlers.add("create_story_version",
  { Action = "CreateStoryVersion" },
  function(msg)
    -- Check if the story belongs to a user process
    local author = nil
    local story = stories[msg.story_id]
    
    if story then
      author = story.versions["1"].author
    end
    
    -- If we have the author and using new architecture, forward to their process
    if author and STORY_PROCESS_MODULE_ID ~= "" then
      local process_id = user_story_processes[author]
      
      if process_id then
        ao.send({
          Target = process_id,
          Action = "CreateStoryVersion",
          From = msg.From,
          story_id = msg.story_id,
          title = msg.title,
          content = msg.content,
          cover_image = msg.cover_image,
          category = msg.category,
          tags = msg.tags,
          metadata = msg.metadata
        })
        
        ao.send({ 
          Target = msg.From, 
          Data = "Story version creation request forwarded to the story owner's process: " .. process_id 
        })
        return
      end
    end
    
    -- Legacy implementation for backward compatibility
    if story then
      local new_version_id = generate_new_version_id(story)
      local current_version = story.versions[story.current_version]
      story.current_version = new_version_id
      story.versions[new_version_id] = {
        id = tonumber(new_version_id),
        title = msg.title or current_version.title,
        content = msg.content or current_version.content,
        cover_image = msg.cover_image or current_version.cover_image,
        author = msg.From,
        timestamp = tostring(os.time()),
        category = msg.category or current_version.category,
        votes = 0
      }
      
      send_story_points(msg.From, 5)
      
      ao.send({ Target = msg.From, Data = "Story updated with new version: " .. new_version_id })
    else
      ao.send({ Target = msg.From, Data = "Story not found!" })
    end
  end
)

-- @mutation
Handlers.add("revert_story_to_version",
  { Action = "RevertStoryToVersion" },
  function(msg)
    -- Check if the story belongs to a user process
    local author = nil
    local story = stories[msg.story_id]
    
    if story then
      author = story.versions["1"].author
    end
    
    -- If we have the author and using new architecture, forward to their process
    if author and STORY_PROCESS_MODULE_ID ~= "" then
      local process_id = user_story_processes[author]
      
      if process_id then
        ao.send({
          Target = process_id,
          Action = "RevertStoryToVersion",
          From = msg.From,
          story_id = msg.story_id,
          version_id = msg.version_id
        })
        
        ao.send({ 
          Target = msg.From, 
          Data = "Story revert request forwarded to the story owner's process: " .. process_id 
        })
        return
      end
    end
    
    -- Legacy implementation for backward compatibility
    if story and story.versions[msg.version_id] then
      story.current_version = msg.version_id
      ao.send({ Target = msg.From, Data = "Story reverted to version: " .. msg.version_id })
    else
      ao.send({ Target = msg.From, Data = "Story or version not found!" })
    end
  end
)

-- @mutation
Handlers.add("add_collaborator",
  { Action = "AddCollaborator" },
  function(msg)
    -- This is a new feature only available in the new architecture
    if STORY_PROCESS_MODULE_ID == "" then
      ao.send({ Target = msg.From, Data = "This feature is only available in the new architecture." })
      return
    end
    
    -- Check if the story belongs to a user process
    local author = nil
    local story = stories[msg.story_id]
    
    if story then
      author = story.versions["1"].author
    end
    
    -- If we have the author, forward to their process
    if author then
      local process_id = user_story_processes[author]
      
      if process_id then
        ao.send({
          Target = process_id,
          Action = "AddCollaborator",
          From = msg.From,
          story_id = msg.story_id,
          collaborator_address = msg.collaborator_address
        })
        
        ao.send({ 
          Target = msg.From, 
          Data = "Collaborator add request forwarded to the story owner's process: " .. process_id 
        })
      else
        ao.send({ Target = msg.From, Data = "Story owner's process not found!" })
      end
    else
      ao.send({ Target = msg.From, Data = "Story not found!" })
    end
  end
)

-- @view
Handlers.add("get_stories",
  { Action = "GetStories" },
  function(msg)
    local all_stories = {}
    
    -- Get stories from legacy storage
    for id, story in pairs(stories) do
      local current_version = story.versions[story.current_version]
      table.insert(all_stories, {
        id = story.id,
        current_version = story.current_version,
        is_public = story.is_public,
        version_data = {
          id = current_version.id,
          title = current_version.title,
          content = current_version.content,
          cover_image = current_version.cover_image,
          author = current_version.author,
          timestamp = current_version.timestamp,
          category = current_version.category,
          votes = current_version.votes
        },
        process_id = nil -- Indicates this is a legacy story
      })
    end
    
    -- If using new architecture, also query user story processes
    if STORY_PROCESS_MODULE_ID ~= "" and USER_PROFILE_PROCESS_ADDRESS ~= "" then
      -- In a real implementation, this would query all user story processes
      -- For simplicity, we'll just include the process IDs in the response
      
      for address, process_id in pairs(user_story_processes) do
        table.insert(all_stories, {
          process_id = process_id,
          owner = address,
          note = "To get stories from this process, query it directly with GetStories action"
        })
      end
    end
    
    ao.send({ Target = msg.From, Data = all_stories })
  end
)

-- @view
Handlers.add("get_story",
  { Action = "GetStory" },
  function(msg)
    -- Check if the story belongs to a user process
    local author = nil
    local story = stories[msg.story_id]
    
    if story then
      author = story.versions["1"].author
    end
    
    -- If we have the author and using new architecture, forward to their process
    if author and STORY_PROCESS_MODULE_ID ~= "" then
      local process_id = user_story_processes[author]
      
      if process_id then
        ao.send({
          Target = process_id,
          Action = "GetStory",
          From = msg.From,
          story_id = msg.story_id
        })
        
        ao.send({ 
          Target = msg.From, 
          Data = "Story request forwarded to the story owner's process: " .. process_id 
        })
        return
      end
    end
    
    -- Legacy implementation for backward compatibility
    if story then
      ao.send({ Target = msg.From, Data = story })
    else
      ao.send({ Target = msg.From, Data = "Story not found!" })
    end
  end
)

-- @mutation
Handlers.add("upvote_story_version",
  { Action = "UpvoteStoryVersion" },
  function(msg)
    -- Check if the story belongs to a user process
    local author = nil
    local story = stories[msg.story_id]
    
    if story then
      author = story.versions["1"].author
    end
    
    -- If we have the author and using new architecture, forward to their process
    if author and STORY_PROCESS_MODULE_ID ~= "" then
      local process_id = user_story_processes[author]
      
      if process_id then
        ao.send({
          Target = process_id,
          Action = "UpvoteStoryVersion",
          From = msg.From,
          story_id = msg.story_id,
          version_id = msg.version_id
        })
        
        ao.send({ 
          Target = msg.From, 
          Data = "Upvote request forwarded to the story owner's process: " .. process_id 
        })
        return
      end
    end
    
    -- Legacy implementation for backward compatibility
    if increment_version_votes(msg.story_id, msg.version_id) then
      send_story_points(msg.From, 1)
      ao.send({ Target = msg.From, Data = "Upvote successful for story " .. msg.story_id .. ", version " .. msg.version_id })
    else
      ao.send({ Target = msg.From, Data = "Story or version not found!" })
    end
  end
)

-- @mutation
Handlers.add("register_user_story_process",
  { Action = "RegisterUserStoryProcess" },
  function(msg)
    if msg.address and msg.process_id then
      user_story_processes[msg.address] = msg.process_id
      
      ao.send({ 
        Target = msg.From, 
        Data = "User story process registered successfully for address: " .. msg.address 
      })
    else
      ao.send({ Target = msg.From, Data = "Invalid request. Please provide address and process_id." })
    end
  end
)

-- @view
Handlers.add("get_user_story_process",
  { Action = "GetUserStoryProcess" },
  function(msg)
    local address = msg.address or msg.From
    local process_id = user_story_processes[address]
    
    if process_id then
      ao.send({ 
        Target = msg.From, 
        Data = {
          address = address,
          process_id = process_id
        }
      })
    else
      ao.send({ Target = msg.From, Data = "No story process found for this address." })
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
Handlers.add("set_story_process_module",
  { Action = "SetStoryProcessModule" },
  function(msg)
    if msg.module_id then
      STORY_PROCESS_MODULE_ID = msg.module_id
      ao.send({ Target = msg.From, Data = "Story process module ID set successfully." })
    else
      ao.send({ Target = msg.From, Data = "Invalid request. Please provide a module ID." })
    end
  end
)

-- Initialize with addresses if provided
if ao.env and ao.env.Process and ao.env.Process.Tags then
  if ao.env.Process.Tags["User-Profile-Process-Address"] then
    USER_PROFILE_PROCESS_ADDRESS = ao.env.Process.Tags["User-Profile-Process-Address"]
  end
  
  if ao.env.Process.Tags["Story-Process-Module-ID"] then
    STORY_PROCESS_MODULE_ID = ao.env.Process.Tags["Story-Process-Module-ID"]
  end
end
