local user_points = {}

local function add_points(address, points)
  if not user_points[address] then
    user_points[address] = 0
  end
  user_points[address] = user_points[address] + points
end
-- Process ID: CiCoT60SUbCAJYY2ncv_-BJOQvGB0tHib_mTLJv4Q6Q
-- Points System rework** as pre HL
-- @mutation
Handlers.add("add_story_points",
  { Action = "AddStoryPoints" },
  function(msg)
    if msg.address and msg.points then
      add_points(msg.address, msg.points)
      ao.send({ Target = msg.From, Data = "Added " .. msg.points .. " points to " .. msg.address })
    else
      ao.send({ Target = msg.From, Data = "Invalid request. Please provide address and points." })
    end
  end
)

-- @view
Handlers.add("get_all_story_points",
  { Action = "GetAllStoryPoints" },
  function(msg)
    ao.send({ Target = msg.From, Data = user_points })
  end
)

-- @view
Handlers.add("get_user_story_points",
  { Action = "GetUserStoryPoints" },
  function(msg)
    if msg.address then
      local points = user_points[msg.address] or 0
      ao.send({ Target = msg.From, Data = { address = msg.address, points = points } })
    else
      ao.send({ Target = msg.From, Data = "Invalid request. Please provide an address." })
    end
  end
)
