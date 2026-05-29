const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const http = require("http");
const { Server } = require("socket.io");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
  });

/*
========================
SCHEMAS
========================
*/

const playerSchema = new mongoose.Schema({
  uuid: String,
  name: String,
  inventory: Array,
  balance: {
    type: Number,
    default: 0
  }
});

const linkCodeSchema = new mongoose.Schema({
  code: String,
  uuid: String,
  name: String,
  expiresAt: Date,
  usedAt: Date
});

const pendingSellSchema = new mongoose.Schema({
  id: String,
  name: String,
  slot: Number,
  amount: Number,
  status: String
});

const pendingBuySchema = new mongoose.Schema({
  id: String,
  name: String,
  itemType: String,
  amount: Number,
  cost: Number,
  status: String
});

const twitchGateLinkSchema = new mongoose.Schema({
  code: String,
  minecraftUuid: String,
  minecraftName: String,
  twitchUserId: String,
  twitchLogin: String,
  allowed: {
    type: Boolean,
    default: false
  },
  expiresAt: Date,
  linkedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const shopItemSchema = new mongoose.Schema({
  itemType: String,
  displayName: String,
  price: Number,
  imageUrl: String,
  iconUrl: String,
  enabled: {
    type: Boolean,
    default: true
  }
});

const sellPriceSchema = new mongoose.Schema({
  itemType: String,
  price: Number,
  enabled: {
    type: Boolean,
    default: true
  }
});

/*
========================
MODELS
========================
*/

const Player = mongoose.model("Player", playerSchema);
const LinkCode = mongoose.model("LinkCode", linkCodeSchema);
const PendingSell = mongoose.model("PendingSell", pendingSellSchema);
const PendingBuy = mongoose.model("PendingBuy", pendingBuySchema);
const TwitchGateLink = mongoose.model("TwitchGateLink", twitchGateLinkSchema);
const ShopItem = mongoose.model("ShopItem", shopItemSchema);
const SellPrice = mongoose.model("SellPrice", sellPriceSchema);

const SERVER_API_KEY = process.env.SERVER_API_KEY || "mySecret123456789";
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_CHANNEL = process.env.TWITCH_CHANNEL || "goddess_qwen";
const TWITCH_REDIRECT_URI =
  process.env.TWITCH_REDIRECT_URI ||
  "https://inventory-web-api.onrender.com/api/twitch/callback";
const PUBLIC_API_URL =
  process.env.PUBLIC_API_URL ||
  "https://inventory-web-api.onrender.com";
const WEBSITE_URL =
  process.env.WEBSITE_URL ||
  "https://vfusions.com/minecraft";

/*
========================
SELL PRICE LOOKUP
========================
*/

function getGunIdFromNbt(nbt) {

  const match = String(nbt || "").match(/GunId:"([^"]+)"/i);

  return match ? match[1] : "";
}

function getItemDisplayNameFromParts(type, nbt) {

  const gunId =
    getGunIdFromNbt(nbt) ||
    getGunIdFromNbt(type);
  const value = gunId || type;

  return String(value || "")
    .split(":")
    .pop()
    .replaceAll("_", " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function getFullItemCode(type, nbt) {

  const cleanType = String(type || "").trim();
  const cleanNbt = String(nbt || "").trim();

  if (!cleanType) return "";
  if (!cleanNbt || cleanType.includes("{")) return cleanType;

  return `${cleanType}${cleanNbt.startsWith("{") ? cleanNbt : `{${cleanNbt}}`}`;
}

function getTaczIdentityCode(type, nbt) {

  const cleanType = String(type || "").trim();
  const gunId =
    getGunIdFromNbt(nbt) ||
    getGunIdFromNbt(cleanType);

  if (cleanType && gunId) {
    return `${cleanType}{GunId:"${gunId}"}`;
  }

  return "";
}

async function getSellPrice(type, nbt = "") {

  const cleanType = String(type || "").trim();
  const gunId =
    getGunIdFromNbt(nbt) ||
    getGunIdFromNbt(cleanType);
  const displayName = getItemDisplayNameFromParts(cleanType, nbt);
  const taczIdentityCode = getTaczIdentityCode(cleanType, nbt);
  const fullItemCode = getFullItemCode(cleanType, nbt);
  const keys = [taczIdentityCode, fullItemCode, gunId, displayName, cleanType].filter(Boolean);

  for (const key of keys) {
    const item =
      await SellPrice.findOne({
        itemType: key,
        enabled: true
      }) ||
      await SellPrice.findOne({
        itemType: key.toUpperCase(),
        enabled: true
      }) ||
      await SellPrice.findOne({
        itemType: key.toLowerCase(),
        enabled: true
      });

    if (item) {
      return item.price;
    }
  }

  return 1;
}

async function getSellPricesMap() {

  const items = await SellPrice.find({
    enabled: true
  });

  return items.reduce((prices, item) => {
    prices[item.itemType] = item.price;
    return prices;
  }, {});
}

function createLinkCode() {

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}

function requireServerKey(req, res) {

  const key = req.headers["x-server-key"] || req.headers["x-api-key"];

  if (key !== SERVER_API_KEY) {

    res.status(401).json({
      allowed: false,
      success: false,
      message: "Invalid server API key"
    });

    return false;
  }

  return true;
}

async function createGateCode(minecraftUuid, minecraftName) {

  await TwitchGateLink.deleteMany({
    minecraftUuid,
    allowed: false
  });

  let code = createLinkCode();

  while (await TwitchGateLink.findOne({
    code,
    allowed: false,
    expiresAt: { $gt: new Date() }
  })) {
    code = createLinkCode();
  }

  const link = new TwitchGateLink({
    code,
    minecraftUuid,
    minecraftName,
    allowed: false,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000)
  });

  await link.save();

  return link;
}

async function twitchFetch(url, accessToken) {

  const res = await fetch(url, {
    headers: {
      "Client-ID": TWITCH_CLIENT_ID,
      "Authorization": `Bearer ${accessToken}`
    }
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || data.error || `Twitch request failed with ${res.status}`);
  }

  return data;
}

/*
========================
DEFAULT SHOP ITEMS
========================
*/

async function seedShopIfEmpty() {

  const count = await ShopItem.countDocuments();

  if (count > 0) {
    return;
  }

  await ShopItem.insertMany([
    {
      itemType: "DIAMOND",
      price: 100,
      enabled: true
    },
    {
      itemType: "EMERALD",
      price: 75,
      enabled: true
    }
  ]);

  console.log("Default shop items created");
}

mongoose.connection.once("open", () => {
  seedShopIfEmpty().catch(console.error);
});

/*
========================
ROOT
========================
*/

app.get("/", (req, res) => {
  res.send("Inventory API is running.");
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "InventoryWebAPI",
    twitchGate: true
  });
});

/*
========================
TWITCH FOLLOWER GATE
========================
*/

app.post("/api/minecraft/join", async (req, res) => {

  try {

    if (!requireServerKey(req, res)) return;

    const { minecraftUuid, minecraftName } = req.body;

    if (!minecraftUuid || !minecraftName) {

      return res.status(400).json({
        allowed: false,
        message: "Missing minecraftUuid or minecraftName"
      });
    }

    const linked = await TwitchGateLink.findOne({
      minecraftUuid,
      allowed: true
    });

    if (linked) {

      return res.json({
        allowed: true,
        code: null,
        message: "Verified Twitch follower"
      });
    }

    const link = await createGateCode(minecraftUuid, minecraftName);

    res.json({
      allowed: false,
      code: link.code,
      message: `Follow twitch.tv/${TWITCH_CHANNEL}, then link your Twitch account.`
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      allowed: false,
      message: err.message
    });
  }
});

app.get("/api/link-code/:code", async (req, res) => {

  try {

    const code = String(req.params.code || "").trim().toUpperCase();

    const link = await TwitchGateLink.findOne({
      code,
      allowed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!link) {

      return res.status(404).json({
        success: false,
        error: "Invalid or expired code"
      });
    }

    res.json({
      success: true,
      code: link.code,
      minecraftName: link.minecraftName,
      minecraftUuid: link.minecraftUuid,
      twitchLoginUrl: `${API_PUBLIC_BASE_URL(req)}/api/twitch/login?code=${encodeURIComponent(link.code)}`
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

function API_PUBLIC_BASE_URL(req) {
  const forwardedProto = req.get("x-forwarded-proto");

  if (PUBLIC_API_URL) {
    return PUBLIC_API_URL.replace(/\/$/, "");
  }

  return `${forwardedProto || req.protocol}://${req.get("host")}`;
}

app.get("/api/twitch/login", async (req, res) => {

  const code = String(req.query.code || "").trim().toUpperCase();

  if (!code) {
    return res.status(400).send("Missing link code.");
  }

  const link = await TwitchGateLink.findOne({
    code,
    allowed: false,
    expiresAt: { $gt: new Date() }
  });

  if (!link) {
    return res.status(404).send("Invalid or expired link code.");
  }

  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    return res.status(500).send("Twitch OAuth is not configured.");
  }

  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    redirect_uri: TWITCH_REDIRECT_URI,
    response_type: "code",
    scope: "user:read:follows",
    state: code
  });

  res.redirect(`https://id.twitch.tv/oauth2/authorize?${params.toString()}`);
});

app.get("/api/twitch/callback", async (req, res) => {

  try {

    const oauthCode = req.query.code;
    const state = String(req.query.state || "").trim().toUpperCase();

    if (!oauthCode || !state) {
      return res.status(400).send("Missing Twitch OAuth code or state.");
    }

    const link = await TwitchGateLink.findOne({
      code: state,
      allowed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!link) {
      return res.status(404).send("Invalid or expired Minecraft link code.");
    }

    const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        code: oauthCode,
        grant_type: "authorization_code",
        redirect_uri: TWITCH_REDIRECT_URI
      })
    });
    const tokens = await tokenRes.json();

    if (!tokenRes.ok || !tokens.access_token) {
      throw new Error(tokens.message || tokens.error_description || "Could not get Twitch token");
    }

    const userData = await twitchFetch("https://api.twitch.tv/helix/users", tokens.access_token);
    const twitchUser = userData.data?.[0];

    if (!twitchUser) {
      throw new Error("Could not load Twitch user");
    }

    const channelData = await twitchFetch(
      `https://api.twitch.tv/helix/users?login=${encodeURIComponent(TWITCH_CHANNEL)}`,
      tokens.access_token
    );
    const channel = channelData.data?.[0];

    if (!channel) {
      throw new Error(`Could not find Twitch channel ${TWITCH_CHANNEL}`);
    }

    const followData = await twitchFetch(
      `https://api.twitch.tv/helix/channels/followed?user_id=${encodeURIComponent(twitchUser.id)}&broadcaster_id=${encodeURIComponent(channel.id)}`,
      tokens.access_token
    );
    const follows = Array.isArray(followData.data) && followData.data.length > 0;

    if (!follows) {
      return res.status(403).send(`You must follow twitch.tv/${TWITCH_CHANNEL} before joining.`);
    }

    link.twitchUserId = twitchUser.id;
    link.twitchLogin = twitchUser.login;
    link.allowed = true;
    link.linkedAt = new Date();

    await link.save();

    res.send(`
      <html>
        <body style="font-family: sans-serif; padding: 32px;">
          <h1>Twitch linked!</h1>
          <p>${link.minecraftName} is verified as a follower of twitch.tv/${TWITCH_CHANNEL}.</p>
          <p>You can return to Minecraft and run /twitchcode or reconnect.</p>
        </body>
      </html>
    `);

  } catch (err) {

    console.error(err);

    res.status(500).send(`Twitch verification failed: ${err.message}`);
  }
});

/*
========================
MINECRAFT LINK CODES
========================
*/

app.post("/api/link-code", async (req, res) => {

  try {

    const { uuid, name } = req.body;

    if (!uuid || !name) {

      return res.status(400).json({
        success: false,
        error: "Missing uuid or name"
      });
    }

    await LinkCode.deleteMany({
      uuid,
      usedAt: null
    });

    let code = createLinkCode();

    while (await LinkCode.findOne({
      code,
      usedAt: null,
      expiresAt: { $gt: new Date() }
    })) {
      code = createLinkCode();
    }

    const linkCode = new LinkCode({
      code,
      uuid,
      name,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      usedAt: null
    });

    await linkCode.save();

    res.json({
      success: true,
      code,
      name,
      uuid,
      expiresAt: linkCode.expiresAt
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.post("/api/verify-link-code", async (req, res) => {

  try {

    const code = String(req.body.code || "").trim().toUpperCase();

    if (!code) {

      return res.status(400).json({
        success: false,
        error: "Missing code"
      });
    }

    const linkCode = await LinkCode.findOne({
      code,
      usedAt: null,
      expiresAt: { $gt: new Date() }
    });

    if (!linkCode) {

      return res.status(404).json({
        success: false,
        error: "Invalid or expired code"
      });
    }

    linkCode.usedAt = new Date();

    await linkCode.save();

    res.json({
      success: true,
      name: linkCode.name,
      uuid: linkCode.uuid
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/*
========================
PLAYER INVENTORY
========================
*/

app.post("/api/inventory", async (req, res) => {

  try {

    const data = req.body;

    let player = await Player.findOne({
      name: data.name
    });

    if (!player) {

      player = new Player({
        uuid: data.uuid,
        name: data.name,
        inventory: data.inventory,
        balance: 0
      });

    } else {

      player.uuid = data.uuid;
      player.inventory = data.inventory;
    }

    await player.save();

    io.emit("inventoryUpdate", {
      name: player.name,
      inventory: player.inventory,
      balance: player.balance
    });

    res.json({
      success: true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false
    });
  }
});

app.get("/api/players", async (req, res) => {

  try {

    const players = await Player.find({}).sort({ name: 1 });

    res.json(players.map(player => ({
      uuid: player.uuid,
      name: player.name,
      balance: player.balance || 0,
      itemCount: Array.isArray(player.inventory) ? player.inventory.length : 0,
      lastSeen: player.updatedAt || (player._id && player._id.getTimestamp ? player._id.getTimestamp() : null)
    })));

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false
    });
  }
});

app.get("/api/inventory/:name", async (req, res) => {

  try {

    const player = await Player.findOne({
      name: req.params.name
    });

    if (!player) {

      return res.status(404).json({
        success: false
      });
    }

    const prices = await getSellPricesMap();

    res.json({
      uuid: player.uuid,
      name: player.name,
      inventory: player.inventory,
      balance: player.balance,
      prices
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false
    });
  }
});

/*
========================
SHOP ROUTES
========================
*/

app.get("/api/shop", async (req, res) => {

  const items = await ShopItem.find({
    enabled: true
  });

  res.json(items);
});

app.get("/api/admin/shop", async (req, res) => {

  const items = await ShopItem.find();

  res.json(items);
});

app.post("/api/admin/shop", async (req, res) => {

  try {

    const { itemType, price, displayName, imageUrl, iconUrl, enabled } = req.body;

    if (!itemType || price === undefined) {

      return res.status(400).json({
        success: false,
        error: "Missing itemType or price"
      });
    }

    const item = new ShopItem({
      itemType: itemType,
      displayName: displayName || "",
      price: Number(price),
      imageUrl: imageUrl || "",
      iconUrl,
      enabled: enabled !== false
    });

    await item.save();

    io.emit("shopUpdated");

    res.json({
      success: true,
      item
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false
    });
  }
});

app.put("/api/admin/shop/:id", async (req, res) => {

  try {

    const { itemType, price, displayName, imageUrl, iconUrl, enabled } = req.body;

    const item = await ShopItem.findByIdAndUpdate(
      req.params.id,
      {
        itemType: itemType,
        displayName: displayName || "",
        price: Number(price),
        imageUrl: imageUrl || "",
        iconUrl,
        enabled
      },
      { new: true }
    );

    io.emit("shopUpdated");

    res.json({
      success: true,
      item
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false
    });
  }
});

app.delete("/api/admin/shop/:id", async (req, res) => {

  await ShopItem.findByIdAndDelete(req.params.id);

  io.emit("shopUpdated");

  res.json({
    success: true
  });
});

/*
========================
SELL PRICE ADMIN
========================
*/

app.get("/api/admin/sell-prices", async (req, res) => {

  const items = await SellPrice.find();

  res.json(items);
});

app.post("/api/admin/sell-prices", async (req, res) => {

  try {

    const { itemType, price, enabled } = req.body;

    if (!itemType || price === undefined) {

      return res.status(400).json({
        success: false,
        error: "Missing itemType or price"
      });
    }

    const cleanType =
      String(itemType).trim();

    let item = await SellPrice.findOne({
      itemType: cleanType
    });

    if (item) {

      item.price = Number(price);
      item.enabled = enabled !== false;

    } else {

      item = new SellPrice({
        itemType: cleanType,
        price: Number(price),
        enabled: enabled !== false
      });
    }

    await item.save();

    io.emit("sellPricesUpdated");

    res.json({
      success: true,
      item
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.delete("/api/admin/sell-prices", async (req, res) => {

  try {

    const itemType =
      req.body?.itemType ||
      req.query?.itemType;
    const cleanType =
      String(itemType || "").trim();

    if (!cleanType) {

      return res.status(400).json({
        success: false,
        error: "Missing itemType"
      });
    }

    const result = await SellPrice.deleteMany({
      itemType: cleanType
    });

    io.emit("sellPricesUpdated");

    res.json({
      success: true,
      deletedCount: result.deletedCount
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/*
========================
SELL SYSTEM
========================
*/

app.post("/api/sell", async (req, res) => {

  const { name, slot, amount } = req.body;

  const id =
    Date.now().toString()
    + Math.floor(Math.random() * 9999);

  const sellRequest = new PendingSell({
    id,
    name,
    slot: Number(slot),
    amount: Number(amount),
    status: "PENDING"
  });

  await sellRequest.save();

  res.json({
    success: true,
    id
  });
});

app.get("/api/pending-sells/:name", async (req, res) => {

  const requests = await PendingSell.find({
    name: req.params.name,
    status: "PENDING"
  });

  const text = requests
    .map(request =>
      `${request.id}|${request.slot}|${request.amount}`
    )
    .join("\n");

  res.type("text/plain").send(text);
});

app.post("/api/complete-sell", async (req, res) => {

  const { id, name, success, itemType, nbt, amount } = req.body;

  const request = await PendingSell.findOne({
    id
  });

  if (!request) {

    return res.status(404).json({
      success: false
    });
  }

  if (!success) {

    request.status = "FAILED";

    await request.save();

    return res.json({
      success: true
    });
  }

  const total =
    (await getSellPrice(itemType, nbt))
    * Number(amount || 0);

  const player = await Player.findOne({
    name
  });

  player.balance += total;

  await player.save();

  io.emit("balanceUpdate", {
    name: player.name,
    balance: player.balance
  });

  request.status = "COMPLETE";

  await request.save();

  res.json({
    success: true,
    total,
    balance: player.balance
  });
});

/*
========================
BUY SYSTEM
========================
*/

app.post("/api/buy", async (req, res) => {

  try {

    const { name, itemType, amount } = req.body;

    // KEEP NBT EXACTLY AS TYPED
    const cleanItemType =
      String(itemType).trim();

    const buyAmount = Number(amount);

    const shopItem = await ShopItem.findOne({
      itemType: cleanItemType,
      enabled: true
    });

    if (!shopItem) {

      return res.status(400).json({
        success: false,
        error: "Item not found in shop"
      });
    }

    if (isNaN(buyAmount) || buyAmount <= 0) {

      return res.status(400).json({
        success: false,
        error: "Invalid amount"
      });
    }

    const player = await Player.findOne({
      name
    });

    if (!player) {

      return res.status(404).json({
        success: false,
        error: "Player not found"
      });
    }

    const totalCost =
      shopItem.price * buyAmount;

    if (player.balance < totalCost) {

      return res.status(400).json({
        success: false,
        error: "Not enough money"
      });
    }

    player.balance -= totalCost;

    await player.save();

    io.emit("balanceUpdate", {
      name: player.name,
      balance: player.balance
    });

    const id =
      Date.now().toString()
      + Math.floor(Math.random() * 9999);

    const buyRequest = new PendingBuy({
      id,
      name,
      itemType: cleanItemType,
      amount: buyAmount,
      cost: totalCost,
      status: "PENDING"
    });

    await buyRequest.save();

    res.json({
      success: true,
      balance: player.balance
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: "Buy failed"
    });
  }
});

app.get("/api/pending-buys/:name", async (req, res) => {

  const requests = await PendingBuy.find({
    name: req.params.name,
    status: "PENDING"
  });

  const text = requests
    .map(request =>
      `${request.id}|${request.itemType}|${request.amount}`
    )
    .join("\n");

  res.type("text/plain").send(text);
});

app.post("/api/complete-buy", async (req, res) => {

  try {

    const { id, success } = req.body;

    const request = await PendingBuy.findOne({
      id
    });

    if (!request) {

      return res.status(404).json({
        success: false
      });
    }

    if (!success) {

      const player = await Player.findOne({
        name: request.name
      });

      if (player) {

        player.balance += request.cost;

        await player.save();

        io.emit("balanceUpdate", {
          name: player.name,
          balance: player.balance
        });
      }

      request.status = "FAILED";

      await request.save();

      return res.json({
        success: true,
        refunded: true
      });
    }

    request.status = "COMPLETE";

    await request.save();

    res.json({
      success: true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false
    });
  }
});

/*
========================
START SERVER
========================
*/

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`Inventory API running on port ${port}`);
});
