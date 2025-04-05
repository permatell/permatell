-- User Story Process
-- This process is spawned for each user to store their stories
-- Each process has 4GB of RAM and is controlled by the user

local STORY_POINTS_PROCESS_ADDRESS = "UwYxEKXxEmbd9-sIJtSVgAPMj85QQC7ExMt1VeLxXsA"
local USER_PROFILE_PROCESS_ADDRESS = "il72h8w_dG4J6CPB-IdlBD8QCZsv0xdR3yHGH35gmPg" -- Will be set during initialization

-- Process state
local owner = nil
local stories = {}
local last_story_id = 0
local collaborators = {}

-- Initialize the process with the owner address
function initialize(init_data)
  if init_data then
    owner = init_data.owner
    stories = init_data.stories or {}
    last_story_id = init_data.last_story_id or 0
    collaborators = init_data.collaborators or {}
  end
  
  -- Print initialization confirmation for debugging
  print("User story process initialized for owner: " .. (owner or "unknown"))
  print("Process ID: " .. ao.id)
  
  -- Check if Authority tag is set correctly
  if ao.env and ao.env.Process and ao.env.Process.Tags and ao.env.Process.Tags["Authority"] then
    print("Authority tag set to: " .. ao.env.Process.Tags["Authority"])
  else
    print("Warning: Authority tag not set")
  end
end

-- Check if the sender is authorized to modify this process
local function is_authorized(address)
  return address == owner or collaborators[address]
end

-- Generate a new story ID
local function generate_story_id()
  last_story_id = last_story_id + 1
  return tostring(last_story_id)
end

-- Generate a new version ID for a story
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

-- Send story points to a user
local function send_story_points(address, points)
  ao.send({
    Target = STORY_POINTS_PROCESS_ADDRESS,
    Action = "AddStoryPoints",
    address = address,
    points = tostring(points)
  })
end

-- Increment the votes for a story version
local function increment_version_votes(story_id, version_id)
  local story = stories[story_id]
  if story and story.versions[version_id] then
    story.versions[version_id].votes = (story.versions[version_id].votes or 0) + 1
    return true
  end
  return false
end

-- @mutation
Handlers.add("create_story",
  { Action = "CreateStory" },
  function(msg)
    if not is_authorized(msg.From) then
      ao.send({ Target = msg.From, Data = "Unauthorized: Only the owner or collaborators can create stories" })
      return
    end
    
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
          votes = 0,
          tags = msg.tags or {},
          metadata = msg.metadata or {}
        }
      },
      collaborators = msg.collaborators or {},
      created_at = os.time(),
      updated_at = os.time()
    }
    
    -- Add collaborators to the process-level collaborators list
    if msg.collaborators then
      for _, collaborator in ipairs(msg.collaborators) do
        collaborators[collaborator] = true
      end
    end
    
    -- Notify the user profile process about the new story
    if USER_PROFILE_PROCESS_ADDRESS ~= "" then
      ao.send({
        Target = USER_PROFILE_PROCESS_ADDRESS,
        Action = "StoryCreated",
        address = msg.From,
        story_id = story_id,
        process_id = ao.id
      })
    end
    
    -- Send points to the creator
    send_story_points(msg.From, 10)
    
    ao.send({ 
      Target = msg.From, 
      Data = "Story created with ID: " .. story_id,
      story = stories[story_id]
    })
  end
)

-- @mutation
Handlers.add("create_story_version",
  { Action = "CreateStoryVersion" },
  function(msg)
    local story = stories[msg.story_id]
    
    if not story then
      ao.send({ Target = msg.From, Data = "Story not found!" })
      return
    end
    
    if not is_authorized(msg.From) and not story.collaborators[msg.From] then
      ao.send({ Target = msg.From, Data = "Unauthorized: Only the owner or collaborators can update this story" })
      return
    end
    
    local new_version_id = generate_new_version_id(story)
    local current_version = story.versions[story.current_version]
    
    story.current_version = new_version_id
    story.updated_at = os.time()
    
    story.versions[new_version_id] = {
      id = tonumber(new_version_id),
      title = msg.title or current_version.title,
      content = msg.content or current_version.content,
      cover_image = msg.cover_image or current_version.cover_image,
      author = msg.From,
      timestamp = os.time(),
      category = msg.category or current_version.category,
      votes = 0,
      tags = msg.tags or current_version.tags or {},
      metadata = msg.metadata or current_version.metadata or {},
      parent_version = story.current_version
    }
    
    -- Send points to the creator
    send_story_points(msg.From, 5)
    
    ao.send({ 
      Target = msg.From, 
      Data = "Story updated with new version: " .. new_version_id,
      story = story
    })
  end
)

-- @mutation
Handlers.add("revert_story_to_version",
  { Action = "RevertStoryToVersion" },
  function(msg)
    local story = stories[msg.story_id]
    
    if not story then
      ao.send({ Target = msg.From, Data = "Story not found!" })
      return
    end
    
    if not is_authorized(msg.From) and not story.collaborators[msg.From] then
      ao.send({ Target = msg.From, Data = "Unauthorized: Only the owner or collaborators can revert this story" })
      return
    end
    
    if not story.versions[msg.version_id] then
      ao.send({ Target = msg.From, Data = "Version not found!" })
      return
    end
    
    story.current_version = msg.version_id
    story.updated_at = os.time()
    
    ao.send({ 
      Target = msg.From, 
      Data = "Story reverted to version: " .. msg.version_id,
      story = story
    })
  end
)

-- @mutation
Handlers.add("add_collaborator",
  { Action = "AddCollaborator" },
  function(msg)
    if not is_authorized(msg.From) then
      ao.send({ Target = msg.From, Data = "Unauthorized: Only the owner or existing collaborators can add new collaborators" })
      return
    end
    
    local story_id = msg.story_id
    local collaborator_address = msg.collaborator_address
    
    if story_id then
      -- Add collaborator to a specific story
      local story = stories[story_id]
      
      if not story then
        ao.send({ Target = msg.From, Data = "Story not found!" })
        return
      end
      
      story.collaborators[collaborator_address] = true
      story.updated_at = os.time()
      
      ao.send({ 
        Target = msg.From, 
        Data = "Collaborator added to story: " .. story_id,
        story = story
      })
    else
      -- Add collaborator to the process level
      collaborators[collaborator_address] = true
      
      ao.send({ 
        Target = msg.From, 
        Data = "Collaborator added to all stories",
        collaborators = collaborators
      })
    end
  end
)

-- @mutation
Handlers.add("remove_collaborator",
  { Action = "RemoveCollaborator" },
  function(msg)
    if msg.From ~= owner then
      ao.send({ Target = msg.From, Data = "Unauthorized: Only the owner can remove collaborators" })
      return
    end
    
    local story_id = msg.story_id
    local collaborator_address = msg.collaborator_address
    
    if story_id then
      -- Remove collaborator from a specific story
      local story = stories[story_id]
      
      if not story then
        ao.send({ Target = msg.From, Data = "Story not found!" })
        return
      end
      
      story.collaborators[collaborator_address] = nil
      story.updated_at = os.time()
      
      ao.send({ 
        Target = msg.From, 
        Data = "Collaborator removed from story: " .. story_id,
        story = story
      })
    else
      -- Remove collaborator from the process level
      collaborators[collaborator_address] = nil
      
      ao.send({ 
        Target = msg.From, 
        Data = "Collaborator removed from all stories",
        collaborators = collaborators
      })
    end
  end
)

-- @mutation
Handlers.add("upvote_story_version",
  { Action = "UpvoteStoryVersion" },
  function(msg)
    if increment_version_votes(msg.story_id, msg.version_id) then
      -- Send points to the voter
      send_story_points(msg.From, 1)
      
      -- Also send points to the author of the version
      local story = stories[msg.story_id]
      local version = story.versions[msg.version_id]
      send_story_points(version.author, 2)
      
      ao.send({ 
        Target = msg.From, 
        Data = "Upvote successful for story " .. msg.story_id .. ", version " .. msg.version_id,
        story = story
      })
    else
      ao.send({ Target = msg.From, Data = "Story or version not found!" })
    end
  end
)

-- @mutation
Handlers.add("add_story_tag",
  { Action = "AddStoryTag" },
  function(msg)
    local story = stories[msg.story_id]
    
    if not story then
      ao.send({ Target = msg.From, Data = "Story not found!" })
      return
    end
    
    if not is_authorized(msg.From) and not story.collaborators[msg.From] then
      ao.send({ Target = msg.From, Data = "Unauthorized: Only the owner or collaborators can add tags" })
      return
    end
    
    local version_id = msg.version_id or story.current_version
    local version = story.versions[version_id]
    
    if not version then
      ao.send({ Target = msg.From, Data = "Version not found!" })
      return
    end
    
    if not version.tags then
      version.tags = {}
    end
    
    table.insert(version.tags, msg.tag)
    story.updated_at = os.time()
    
    ao.send({ 
      Target = msg.From, 
      Data = "Tag added to story " .. msg.story_id .. ", version " .. version_id,
      story = story
    })
  end
)

-- @view
Handlers.add("get_stories",
  { Action = "GetStories" },
  function(msg)
    local all_stories = {}
    
    for id, story in pairs(stories) do
      -- Only return public stories or stories owned by the requester
      if story.is_public or msg.From == owner or collaborators[msg.From] or story.collaborators[msg.From] then
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
            votes = current_version.votes,
            tags = current_version.tags
          },
          created_at = story.created_at,
          updated_at = story.updated_at
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
    local story = stories[msg.story_id]
    
    if not story then
      ao.send({ Target = msg.From, Data = "Story not found!" })
      return
    end
    
    -- Only return the story if it's public or the requester is authorized
    if story.is_public or msg.From == owner or collaborators[msg.From] or story.collaborators[msg.From] then
      ao.send({ Target = msg.From, Data = story })
    else
      ao.send({ Target = msg.From, Data = "Unauthorized: This story is private" })
    end
  end
)

-- @view
Handlers.add("get_story_version",
  { Action = "GetStoryVersion" },
  function(msg)
    local story = stories[msg.story_id]
    
    if not story then
      ao.send({ Target = msg.From, Data = "Story not found!" })
      return
    end
    
    local version = story.versions[msg.version_id]
    
    if not version then
      ao.send({ Target = msg.From, Data = "Version not found!" })
      return
    end
    
    -- Only return the version if the story is public or the requester is authorized
    if story.is_public or msg.From == owner or collaborators[msg.From] or story.collaborators[msg.From] then
      ao.send({ Target = msg.From, Data = version })
    else
      ao.send({ Target = msg.From, Data = "Unauthorized: This story is private" })
    end
  end
)

-- @view
Handlers.add("get_story_version_history",
  { Action = "GetStoryVersionHistory" },
  function(msg)
    local story = stories[msg.story_id]
    
    if not story then
      ao.send({ Target = msg.From, Data = "Story not found!" })
      return
    end
    
    -- Only return the history if the story is public or the requester is authorized
    if story.is_public or msg.From == owner or collaborators[msg.From] or story.collaborators[msg.From] then
      local history = {}
      
      for version_id, version in pairs(story.versions) do
        table.insert(history, {
          id = version_id,
          title = version.title,
          author = version.author,
          timestamp = version.timestamp,
          parent_version = version.parent_version
        })
      end
      
      -- Sort by timestamp (newest first)
      table.sort(history, function(a, b) return a.timestamp > b.timestamp end)
      
      ao.send({ Target = msg.From, Data = history })
    else
      ao.send({ Target = msg.From, Data = "Unauthorized: This story is private" })
    end
  end
)

-- @view
Handlers.add("get_collaborators",
  { Action = "GetCollaborators" },
  function(msg)
    if not is_authorized(msg.From) then
      ao.send({ Target = msg.From, Data = "Unauthorized: Only the owner or collaborators can view collaborators" })
      return
    end
    
    local story_id = msg.story_id
    
    if story_id then
      -- Get collaborators for a specific story
      local story = stories[story_id]
      
      if not story then
        ao.send({ Target = msg.From, Data = "Story not found!" })
        return
      end
      
      ao.send({ Target = msg.From, Data = story.collaborators })
    else
      -- Get process-level collaborators
      ao.send({ Target = msg.From, Data = collaborators })
    end
  end
)

-- Initialize the process with the data provided during spawning
if ao.env and ao.env.Data then
  initialize(ao.env.Data)
end

-- Set the user profile process address if provided
if ao.env and ao.env.Process and ao.env.Process.Tags and ao.env.Process.Tags["User-Profile-Process-Address"] then
  USER_PROFILE_PROCESS_ADDRESS = ao.env.Process.Tags["User-Profile-Process-Address"]
end
