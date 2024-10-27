local last_story_id = 3
local STORY_POINTS_PROCESS_ADDRESS = "7At7V2gQjAcxzeXib6pNFIyKhdr-royg9Pbjrjo3b-Q"

local stories = {
  ["1"] = {
    id = "1",
    current_version = "3",
    is_public = true,
    versions = {
      ["1"] = {
        id = 1,
        title = "The Rise of AI Art",
        content = "In recent years, the art world has been revolutionized by the emergence of AI-generated artwork...",
        cover_image = "https://s2idtqeysv4q6mzfp464rbvut45la3kcpavugxztkwsodxyvtgkq.arweave.net/lpA5wJiVeQ8zJX89yIa0nzqwbUJ4K0NfM1Wk4d8VmZU",
        author = "jK8nX2pQrS7tY9mZ3vB1cL4fG6hD5wA0uE",
        category = "Uncategorized",
        timestamp = "1679823456"
      },
      ["2"] = {
        id = 2,
        title = "The Rise of AI Art: Human vs Machine",
        content = "As AI-generated art gains prominence, a fascinating comparison emerges between human artists and their AI counterparts...",
        cover_image = "https://s2idtqeysv4q6mzfp464rbvut45la3kcpavugxztkwsodxyvtgkq.arweave.net/lpA5wJiVeQ8zJX89yIa0nzqwbUJ4K0NfM1Wk4d8VmZU",
        author = "jK8nX2pQrS7tY9mZ3vB1cL4fG6hD5wA0uE",
        category = "Uncategorized",
        timestamp = "1680428657"
      },
      ["3"] = {
        id = 3,
        title = "The Rise of AI Art: A New Era of Creativity",
        content = "The boundaries between AI-generated and human-created art are blurring, ushering in a new era of creative expression...",
        cover_image = "https://s2idtqeysv4q6mzfp464rbvut45la3kcpavugxztkwsodxyvtgkq.arweave.net/lpA5wJiVeQ8zJX89yIa0nzqwbUJ4K0NfM1Wk4d8VmZU",
        author = "jK8nX2pQrS7tY9mZ3vB1cL4fG6hD5wA0uE",
        category = "Uncategorized",
        timestamp = "1681033858"
      }
    }
  },
  ["2"] = {
    id = "2",
    current_version = "3",
    is_public = true,
    versions = {
      ["1"] = {
        id = 1,
        title = "Climate Change: The Point of No Return",
        content = "As global temperatures continue to rise, scientists warn that we may be approaching a critical tipping point...",
        cover_image = "https://wa62x53yr2bz6qqrua2xjr2oyqhcreprrrwdbsybxwqnjzieauaa.arweave.net/sD2r93iOg59CEaA1dMdOxA4okfGMbDDLAb2g1OUEBQA",
        author = "bN5mR9wX3zA7yC1pT6sJ8kF2qH4dL0uV",
        category = "Uncategorized",
        timestamp = "1681639059"
      },
      ["2"] = {
        title = "Climate Change: A Tale of Two Earths",
        content = "The stark contrast between preserved ecosystems and areas ravaged by climate change paints a vivid picture of our planet's future...",
        cover_image = "https://wa62x53yr2bz6qqrua2xjr2oyqhcreprrrwdbsybxwqnjzieauaa.arweave.net/sD2r93iOg59CEaA1dMdOxA4okfGMbDDLAb2g1OUEBQA",
        author = "bN5mR9wX3zA7yC1pT6sJ8kF2qH4dL0uV",
        category = "Uncategorized",
        timestamp = "1682244260"
      },
      ["3"] = {
        id = 3,
        title = "Climate Change: Rising Tides, Sinking Cities",
        content = "As sea levels rise at an alarming rate, coastal metropolises around the world face an existential threat...",
        cover_image = "https://wa62x53yr2bz6qqrua2xjr2oyqhcreprrrwdbsybxwqnjzieauaa.arweave.net/sD2r93iOg59CEaA1dMdOxA4okfGMbDDLAb2g1OUEBQA",
        author = "bN5mR9wX3zA7yC1pT6sJ8kF2qH4dL0uV",
        category = "Uncategorized",
        timestamp = "1682849461"
      }
    }
  },
  ["3"] = {
    id = "3",
    current_version = "3",
    is_public = true,
    versions = {
      ["1"] = {
        id = 1,
        title = "The Future of Work: Remote Revolution",
        content = "The traditional office is becoming a relic of the past as professionals embrace the freedom of remote work...",
        cover_image = "https://666b2mhebxbk3cs2h5ziand3b3f6jyyzlqashh6ua55wj6keazpq.arweave.net/97wdMOQNwq2KWj9ygDR7Dsvk4xlcASOf1Ad7ZPlEBl8",
        author = "gT2fE8iM1oP9aS4wQ6yU3xZ7vN0cB5rD",
        category = "Uncategorized",
        timestamp = "1683454662"
      },
      ["2"] = {
        id = 2,
        title = "The Future of Work: Tech-Enabled Productivity",
        content = "Cutting-edge technology is transforming home offices into hubs of unprecedented productivity and collaboration...",
        cover_image = "https://666b2mhebxbk3cs2h5ziand3b3f6jyyzlqashh6ua55wj6keazpq.arweave.net/97wdMOQNwq2KWj9ygDR7Dsvk4xlcASOf1Ad7ZPlEBl8",
        author = "gT2fE8iM1oP9aS4wQ6yU3xZ7vN0cB5rD",
        category = "Uncategorized",
        timestamp = "1684059863"
      },
      ["3"] = {
        id = 3,
        title = "The Future of Work: Balancing Act",
        content = "As the line between work and home life blurs, professionals seek new ways to maintain work-life balance in the remote era...",
        cover_image = "https://666b2mhebxbk3cs2h5ziand3b3f6jyyzlqashh6ua55wj6keazpq.arweave.net/97wdMOQNwq2KWj9ygDR7Dsvk4xlcASOf1Ad7ZPlEBl8",
        author = "gT2fE8iM1oP9aS4wQ6yU3xZ7vN0cB5rD",
        category = "Uncategorized",
        timestamp = "1684665064"
      }
    }
  }
}

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
          category = msg.category or ""
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
        category = msg.category or current_version.category
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
          category = current_version.category
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






