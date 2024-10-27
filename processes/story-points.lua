local user_points = {
  ["0x1a2b3c4d5e6f7g8h9i0j"] = 100,
  ["0xk1l2m3n4o5p6q7r8s9t"] = 50,
  ["0xu1v2w3x4y5z6a7b8c9d"] = 75,
  ["0xe1f2g3h4i5j6k7l8m9n"] = 120,
  ["0xo1p2q3r4s5t6u7v8w9x"] = 30,
  ["0xy1z2a3b4c5d6e7f8g9h"] = 200,
  ["0xi1j2k3l4m5n6o7p8q9r"] = 85,
  ["0xs1t2u3v4w5x6y7z8a9b"] = 150,
  ["0xc1d2e3f4g5h6i7j8k9l"] = 60,
  ["0xm1n2o3p4q5r6s7t8u9v"] = 95
}

local function add_points(address, points)
  if not user_points[address] then
    user_points[address] = 0
  end
  user_points[address] = user_points[address] + points
end

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

Handlers.add("get_all_story_points",
  { Action = "GetAllStoryPoints" },
  function(msg)
    ao.send({ Target = msg.From, Data = user_points })
  end
)

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
