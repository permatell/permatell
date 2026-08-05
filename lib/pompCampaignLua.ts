export const POMP_CAMPAIGN_LUA = String.raw`
local json = require("json")

local bint
if type(_G.bint) == "function" then
  bint = _G.bint
else
  local ok, result = pcall(function() return require(".bint")(256) end)
  if ok and result then bint = result end
end

local function get_tag(msg, name)
  if not msg.Tags then return nil end
  return msg.Tags[name]
end

local function text(value)
  if value == nil then return "" end
  return tostring(value)
end

local function number_value(value)
  local parsed = tonumber(value)
  if parsed == nil then return 0 end
  return parsed
end

local function valid_address(address)
  return type(address) == "string" and #address == 43 and string.match(address, "^[%w%-_]+$") ~= nil
end

local function safe_json(data)
  local ok, encoded = pcall(json.encode, data)
  if ok then return encoded end
  return "{}"
end

local function reply_json(msg, action, body, tags)
  local reply = {
    Action = action,
    Data = safe_json(body),
    Tags = tags or {}
  }
  msg.reply(reply)
end

if not POMPCampaignConfig then
  POMPCampaignConfig = {
    Version = "0.1",
    Enabled = false,
    Name = "",
    Description = "",
    Creator = "",
    ParentAssetId = ao.id,
    ArtworkId = "",
    EventUrl = "",
    City = "",
    Country = "",
    StartDate = "",
    EndDate = "",
    ClaimMethod = "secret-word",
    ClaimCodeHash = "",
    ClaimStart = "0",
    ClaimEnd = "0",
    TotalSupply = 0
  }
end

if not POMPClaims then POMPClaims = {} end

local function get_owner()
  if Owner then return Owner end
  if Token and Token.Creator then return Token.Creator end
  return POMPCampaignConfig.Creator
end

local function count_claims()
  local count = 0
  for _ in pairs(POMPClaims) do count = count + 1 end
  return count
end

local function recipient_has_claimed(recipient)
  if not recipient or recipient == "" then return false, nil end
  for wallet, claim in pairs(POMPClaims) do
    if claim and claim.Recipient == recipient then
      return true, wallet
    end
  end
  return false, nil
end

local function remaining_supply()
  local total = number_value(POMPCampaignConfig.TotalSupply)
  if total <= 0 and Token and Token.TotalSupply then
    total = number_value(Token.TotalSupply)
  end
  return total - count_claims()
end

local function owner_balance()
  if not Token or not Token.Balances then return "0" end
  local owner = get_owner()
  if not owner then return "0" end
  return Token.Balances[owner] or "0"
end

local function ensure_owner_balance()
  if not Token then return false end
  if not Token.Balances then Token.Balances = {} end
  local owner = get_owner()
  if not owner or owner == "" then return false end
  local configuredSupply = number_value(POMPCampaignConfig.TotalSupply)
  if configuredSupply <= 0 then configuredSupply = number_value(Token.TotalSupply) end
  if configuredSupply <= 0 then configuredSupply = 1 end
  if not Token.Creator or Token.Creator == "" then Token.Creator = owner end
  if owner_balance() == "0" then
    Token.Balances[owner] = tostring(configuredSupply)
    Token.TotalSupply = tostring(configuredSupply)
    return true
  end
  return false
end

local originalSyncState = _G.syncState
_G.syncState = function()
  if type(Send) == "function" and Token and json then
    Send({
      device = "patch@1.0",
      asset = json.encode({
        Name = Token.Name,
        Ticker = Token.Ticker,
        Denomination = tostring(Token.Denomination),
        Balances = Token.Balances,
        TotalSupply = Token.TotalSupply,
        Transferable = Token.Transferable,
        Creator = Token.Creator,
        Metadata = Metadata or {},
        POMPCampaignConfig = POMPCampaignConfig,
        POMPClaims = POMPClaims
      })
    })
  elseif originalSyncState and type(originalSyncState) == "function" then
    originalSyncState()
  end
end
syncState = _G.syncState

local function campaign_state()
  return {
    assetId = ao.id,
    config = POMPCampaignConfig,
    claims = POMPClaims,
    claimed = count_claims(),
    remaining = remaining_supply(),
    ownerBalance = owner_balance()
  }
end

Handlers.add(
  "POMP-Campaign-Info",
  Handlers.utils.hasMatchingTag("Action", "POMP-Campaign-Info"),
  function(msg)
    reply_json(msg, "POMP-Campaign-Info-Response", campaign_state())
  end
)

Handlers.add(
  "Setup-POMP-Campaign",
  Handlers.utils.hasMatchingTag("Action", "Setup-POMP-Campaign"),
  function(msg)
    local owner = get_owner()
    if owner ~= "" and msg.From ~= owner and msg.From ~= POMPCampaignConfig.Creator then
      reply_json(msg, "POMP-Campaign-Setup-Error", {
        error = "Only the creator can configure this campaign"
      }, { Status = "Error" })
      return
    end

    POMPCampaignConfig.Enabled = true
    POMPCampaignConfig.Name = text(get_tag(msg, "Title") or POMPCampaignConfig.Name)
    POMPCampaignConfig.Description = text(get_tag(msg, "Description") or POMPCampaignConfig.Description)
    POMPCampaignConfig.Creator = text(get_tag(msg, "Creator") or msg.From)
    POMPCampaignConfig.ParentAssetId = ao.id
    POMPCampaignConfig.ArtworkId = text(get_tag(msg, "POMP-Artwork") or POMPCampaignConfig.ArtworkId)
    POMPCampaignConfig.EventUrl = text(get_tag(msg, "Event-URL") or POMPCampaignConfig.EventUrl)
    POMPCampaignConfig.City = text(get_tag(msg, "Event-City") or POMPCampaignConfig.City)
    POMPCampaignConfig.Country = text(get_tag(msg, "Event-Country") or POMPCampaignConfig.Country)
    POMPCampaignConfig.StartDate = text(get_tag(msg, "Event-Start-Date") or POMPCampaignConfig.StartDate)
    POMPCampaignConfig.EndDate = text(get_tag(msg, "Event-End-Date") or POMPCampaignConfig.EndDate)
    POMPCampaignConfig.ClaimMethod = text(get_tag(msg, "POMP-Claim-Method") or "secret-word")
    POMPCampaignConfig.ClaimCodeHash = text(get_tag(msg, "POMP-Claim-Code-Hash") or POMPCampaignConfig.ClaimCodeHash)
    POMPCampaignConfig.ClaimStart = text(get_tag(msg, "POMP-Claim-Start") or POMPCampaignConfig.ClaimStart)
    POMPCampaignConfig.ClaimEnd = text(get_tag(msg, "POMP-Claim-End") or POMPCampaignConfig.ClaimEnd)
    POMPCampaignConfig.TotalSupply = number_value(get_tag(msg, "POMP-Max-Claims") or POMPCampaignConfig.TotalSupply)

    ensure_owner_balance()
    pcall(syncState)
    reply_json(msg, "POMP-Campaign-Setup-Response", campaign_state(), { Status = "Configured" })
  end
)

Handlers.add(
  "POMP-Claim-Status",
  Handlers.utils.hasMatchingTag("Action", "POMP-Claim-Status"),
  function(msg)
    local wallet = text(get_tag(msg, "Wallet-Address") or msg.From)
    local claim = POMPClaims[wallet]
    local status = "Available"
    if claim then
      status = "Already-Claimed"
    elseif remaining_supply() <= 0 then
      status = "Sold-Out"
    end
    reply_json(msg, "POMP-Claim-Status-Response", {
      status = status,
      wallet = wallet,
      claim = claim,
      campaign = campaign_state()
    }, { Status = status })
  end
)

Handlers.add(
  "Claim",
  Handlers.utils.hasMatchingTag("Action", "Claim"),
  function(msg)
    local function run_claim()
      if not POMPCampaignConfig.Enabled then
        reply_json(msg, "POMP-Claim-Error", { error = "POMP campaign is not enabled" }, { Status = "Error" })
        return
      end

      local wallet = text(get_tag(msg, "Wallet-Address") or msg.From)
      local recipient = text(get_tag(msg, "Recipient") or msg.From)
      if not valid_address(wallet) then
        reply_json(msg, "POMP-Claim-Error", { error = "Invalid claim wallet" }, { Status = "Error" })
        return
      end
      if not valid_address(recipient) then
        reply_json(msg, "POMP-Claim-Error", { error = "Invalid claim recipient" }, { Status = "Error" })
        return
      end
      if POMPClaims[wallet] ~= nil then
        reply_json(msg, "POMP-Claim-Error", {
          error = "This wallet already claimed this POMP",
          claim = POMPClaims[wallet]
        }, { Status = "Already-Claimed" })
        return
      end
      local recipientClaimed, recipientWallet = recipient_has_claimed(recipient)
      if recipientClaimed then
        reply_json(msg, "POMP-Claim-Error", {
          error = "This recipient already claimed this POMP",
          existingWallet = recipientWallet
        }, { Status = "Already-Claimed" })
        return
      end

      local currentTime = number_value(msg.Timestamp or os.time())
      local claimStart = number_value(POMPCampaignConfig.ClaimStart)
      local claimEnd = number_value(POMPCampaignConfig.ClaimEnd)
      if claimStart > 0 and currentTime < claimStart then
        reply_json(msg, "POMP-Claim-Error", { error = "Claim window has not opened" }, { Status = "Not-Open" })
        return
      end
      if claimEnd > 0 and currentTime > claimEnd then
        reply_json(msg, "POMP-Claim-Error", { error = "Claim window has closed" }, { Status = "Closed" })
        return
      end
      if remaining_supply() <= 0 then
        reply_json(msg, "POMP-Claim-Error", { error = "POMP campaign is sold out" }, { Status = "Sold-Out" })
        return
      end

      if POMPCampaignConfig.ClaimMethod == "secret-word" then
        local submittedHash = text(get_tag(msg, "POMP-Claim-Code-Hash"))
        if POMPCampaignConfig.ClaimCodeHash == "" or submittedHash ~= POMPCampaignConfig.ClaimCodeHash then
          reply_json(msg, "POMP-Claim-Error", { error = "Invalid claim word" }, { Status = "Invalid-Code" })
          return
        end
      end

      ensure_owner_balance()
      if not bint then
        reply_json(msg, "POMP-Claim-Error", { error = "bint is unavailable" }, { Status = "Error" })
        return
      end

      local owner = get_owner()
      if not Token.Balances[owner] then Token.Balances[owner] = "0" end
      if not Token.Balances[recipient] then Token.Balances[recipient] = "0" end
      if bint(Token.Balances[owner]) <= bint(0) then
        reply_json(msg, "POMP-Claim-Error", { error = "No POMPs available to claim" }, { Status = "Sold-Out" })
        return
      end

      Token.Balances[owner] = tostring(bint(Token.Balances[owner]) - bint(1))
      Token.Balances[recipient] = tostring(bint(Token.Balances[recipient]) + bint(1))
      if bint(Token.Balances[owner]) <= bint(0) then Token.Balances[owner] = nil end

      local claim = {
        Timestamp = tostring(currentTime),
        WalletAddress = wallet,
        Recipient = recipient,
        AssetId = ao.id,
        ClaimIndex = count_claims() + 1
      }
      POMPClaims[wallet] = claim

      ao.send({
        Target = recipient,
        Action = "Credit-Notice",
        Tags = {
          Status = "Success",
          Sender = ao.id,
          Quantity = "1",
          ["POMP-Claim-Campaign"] = ao.id,
          ["POMP-Claim-Wallet"] = wallet
        },
        Data = json.encode({ Sender = ao.id, Quantity = "1" })
      })

      pcall(syncState)
      reply_json(msg, "POMP-Claim-Success", {
        message = "POMP claimed",
        recipient = recipient,
        assetId = ao.id,
        remaining = remaining_supply(),
        claimedAt = tostring(currentTime)
      }, {
        Status = "Claimed",
        Recipient = recipient,
        ["Asset-ID"] = ao.id
      })
    end

    local ok, err = xpcall(run_claim, debug.traceback)
    if not ok then
      reply_json(msg, "POMP-Claim-Error", { error = tostring(err) }, { Status = "Error" })
    end
  end
)

pcall(ensure_owner_balance)
pcall(syncState)
`;
