local last_story_id = 1
local STORY_POINTS_PROCESS_ADDRESS = "CcsBc_giuk4t5-3oIzmepMalbgzRHdy63x5XyJcCIv8"

local stories = {}

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

local function send_story_points(address, points)
  local result = ao.send({
    Target = STORY_POINTS_PROCESS_ADDRESS,
    Action = "AddStoryPoints",
    address = address,
    points = tostring(points)
  })
end

local function increment_version_votes(story_id, version_id)
  local story = stories[story_id]
  if story and story.versions[version_id] then
    story.versions[version_id].votes = (story.versions[version_id].votes or 0) + 1
    return true
  end
  return false
end

Handlers.add("create_story",
  { Action = "CreateStory" },
  function(msg)
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

Handlers.add("create_story_version",
  { Action = "CreateStoryVersion" },
  function(msg)
    local story = stories[msg.story_id]
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

Handlers.add("revert_story_to_version",
  { Action = "RevertStoryToVersion" },
  function(msg)
    local story = stories[msg.story_id]
    if story and story.versions[msg.version_id] then
      story.current_version = msg.version_id
      ao.send({ Target = msg.From, Data = "Story reverted to version: " .. msg.version_id })
    else
      ao.send({ Target = msg.From, Data = "Story or version not found!" })
    end
  end
)

Handlers.add("get_stories",
  { Action = "GetStories" },
  function(msg)
    local all_stories = {}
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
        }
      })
    end
    ao.send({ Target = msg.From, Data = all_stories })
  end
)

Handlers.add("get_story",
  { Action = "GetStory" },
  function(msg)
    local story = stories[msg.story_id]
    if story then
      ao.send({ Target = msg.From, Data = story })
    else
      ao.send({ Target = msg.From, Data = "Story not found!" })
    end
  end
)

Handlers.add("upvote_story_version",
  { Action = "UpvoteStoryVersion" },
  function(msg)
    if increment_version_votes(msg.story_id, msg.version_id) then
      send_story_points(msg.From, 1)
      ao.send({ Target = msg.From, Data = "Upvote successful for story " .. msg.story_id .. ", version " .. msg.version_id })
    else
      ao.send({ Target = msg.From, Data = "Story or version not found!" })
    end
  end
)
