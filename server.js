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
  serverId: {
    type: String,
    default: "main"
  },
  uuid: String,
  name: String,
  inventory: Array,
  balance: {
    type: Number,
    default: 0
  }
});

const plotSchema = new mongoose.Schema({
  world: String,
  chunkX: Number,
  chunkZ: Number,
  ownerName: String,
  ownerUuid: String,
  price: {
    type: Number,
    default: 500
  },
  claimable: {
    type: Boolean,
    default: true
  },
  trusted: {
    type: [String],
    default: []
  }
});

const regionPlotSchema = new mongoose.Schema({
  plotId: {
    type: String,
    unique: true
  },
  displayName: String,
  world: String,

  minX: Number,
  minY: Number,
  minZ: Number,

  maxX: Number,
  maxY: Number,
  maxZ: Number,

  price: {
    type: Number,
    default: 500
  },
  claimable: {
    type: Boolean,
    default: true
  },
  ownerName: String,
  ownerUuid: String,
  trusted: {
    type: [String],
    default: []
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
  serverId: {
    type: String,
    default: "main"
  },
  name: String,
  slot: Number,
  amount: Number,
  itemType: String,
  nbt: String,
  status: String
});

const pendingBuySchema = new mongoose.Schema({
  id: String,
  serverId: {
    type: String,
    default: "main"
  },
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
  aliases: {
    type: [String],
    default: []
  },
  category: {
    type: String,
    default: "misc"
  },
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

const siteSettingSchema = new mongoose.Schema({
  key: {
    type: String,
    unique: true
  },
  value: mongoose.Schema.Types.Mixed,
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const minecraftServerSchema = new mongoose.Schema({
  serverId: {
    type: String,
    unique: true
  },
  name: String,
  address: String,
  enabled: {
    type: Boolean,
    default: true
  },
  lastSeenAt: Date
}, {
  timestamps: true
});

const talentApplicationSchema = new mongoose.Schema({
  applicant_name: String,
  email: String,
  stage_name: String,
  age: Number,
  country: String,
  content_type: String,
  experience: String,
  portfolio_url: String,
  has_avatar: {
    type: Boolean,
    default: false
  },
  tech_setup: String,
  motivation: String,
  availability_hours: Number,
  status: {
    type: String,
    default: "pending"
  },
  admin_notes: {
    type: String,
    default: ""
  }
}, {
  timestamps: true
});

const clipAnalysisJobSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true
  },
  channel: String,
  vodId: String,
  vodTitle: String,
  vodUrl: String,
  thumbnailUrl: String,
  durationSeconds: Number,
  maxClips: Number,
  status: {
    type: String,
    default: "complete"
  },
  analysisMode: {
    type: String,
    default: "metadata"
  },
  candidates: {
    type: Array,
    default: []
  },
  error: String
}, {
  timestamps: true
});

/*
========================
MODELS
========================
*/

const Player = mongoose.model("Player", playerSchema);
const Plot = mongoose.model("Plot", plotSchema);
const RegionPlot = mongoose.model("RegionPlot", regionPlotSchema);
const LinkCode = mongoose.model("LinkCode", linkCodeSchema);
const PendingSell = mongoose.model("PendingSell", pendingSellSchema);
const PendingBuy = mongoose.model("PendingBuy", pendingBuySchema);
const TwitchGateLink = mongoose.model("TwitchGateLink", twitchGateLinkSchema);
const ShopItem = mongoose.model("ShopItem", shopItemSchema);
const SellPrice = mongoose.model("SellPrice", sellPriceSchema);
const SiteSetting = mongoose.model("SiteSetting", siteSettingSchema);
const MinecraftServer = mongoose.model("MinecraftServer", minecraftServerSchema);
const TalentApplication = mongoose.model("TalentApplication", talentApplicationSchema);
const ClipAnalysisJob = mongoose.model("ClipAnalysisJob", clipAnalysisJobSchema);

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

async function getMaintenanceMode() {

  const setting = await SiteSetting.findOne({
    key: "maintenanceMode"
  });

  return setting?.value === true;
}

function normalizeServerId(serverId) {
  const clean = String(serverId || "main").trim().toLowerCase();
  return clean
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "main";
}

function getRequestServerId(req) {
  return normalizeServerId(req.body?.serverId || req.query?.serverId || req.headers["x-server-id"]);
}

function getPlayerServerFilter(name, serverId) {
  const cleanServerId = normalizeServerId(serverId);
  const filter = { name };

  if (cleanServerId === "main") {
    filter.$or = [
      { serverId: "main" },
      { serverId: { $exists: false } },
      { serverId: "" },
      { serverId: null }
    ];
  } else {
    filter.serverId = cleanServerId;
  }

  return filter;
}

async function upsertMinecraftServer({ serverId, name, address } = {}) {
  const cleanServerId = normalizeServerId(serverId);
  const update = {
    serverId: cleanServerId,
    lastSeenAt: new Date()
  };

  if (name !== undefined && String(name || "").trim()) {
    update.name = String(name).trim();
  }

  if (address !== undefined && String(address || "").trim()) {
    update.address = String(address).trim();
  }

  await MinecraftServer.findOneAndUpdate(
    { serverId: cleanServerId },
    { $set: update, $setOnInsert: { enabled: true } },
    { upsert: true, new: true }
  );

  return cleanServerId;
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

let twitchAppToken = null;
let twitchAppTokenExpiresAt = 0;

function parseTwitchDuration(duration) {
  const matches = String(duration || "").match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);

  if (!matches) return 0;

  return ((Number(matches[1]) || 0) * 3600)
    + ((Number(matches[2]) || 0) * 60)
    + (Number(matches[3]) || 0);
}

function formatClipTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  return [
    hours,
    String(minutes).padStart(2, "0"),
    String(secs).padStart(2, "0")
  ].join(":");
}

async function getTwitchAppToken() {
  if (twitchAppToken && Date.now() < twitchAppTokenExpiresAt) {
    return twitchAppToken;
  }

  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    throw new Error("Twitch app credentials are not configured");
  }

  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials"
    })
  });
  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(data.message || data.error_description || "Could not get Twitch app token");
  }

  twitchAppToken = data.access_token;
  twitchAppTokenExpiresAt = Date.now() + (Math.max(60, Number(data.expires_in) || 3600) - 30) * 1000;

  return twitchAppToken;
}

async function twitchAppFetch(url) {
  const accessToken = await getTwitchAppToken();
  return twitchFetch(url, accessToken);
}

async function getLatestTwitchVod(channel) {
  const cleanChannel = String(channel || TWITCH_CHANNEL || "").trim().replace(/^@/, "");

  if (!cleanChannel) {
    throw new Error("Missing Twitch channel");
  }

  const userData = await twitchAppFetch(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(cleanChannel)}`
  );
  const twitchUser = userData.data?.[0];

  if (!twitchUser) {
    throw new Error(`Could not find Twitch channel ${cleanChannel}`);
  }

  const videosData = await twitchAppFetch(
    `https://api.twitch.tv/helix/videos?user_id=${encodeURIComponent(twitchUser.id)}&type=archive&first=1`
  );
  const vod = videosData.data?.[0];

  if (!vod) {
    throw new Error(`No recent Twitch VOD found for ${cleanChannel}`);
  }

  return {
    ...vod,
    channel: cleanChannel,
    durationSeconds: parseTwitchDuration(vod.duration)
  };
}

function buildClipCandidates(vod, maxClips = 50) {
  const totalSeconds = Math.max(60, Number(vod.durationSeconds) || 0);
  const clipCount = Math.max(1, Math.min(50, Number(maxClips) || 50));
  const usableStart = Math.min(300, Math.floor(totalSeconds * 0.08));
  const usableEnd = Math.max(usableStart + 60, totalSeconds - Math.min(300, Math.floor(totalSeconds * 0.08)));
  const span = Math.max(60, usableEnd - usableStart);
  const step = Math.max(45, Math.floor(span / clipCount));
  const title = String(vod.title || "Stream moment").trim();
  const game = String(vod.game_name || "stream").trim();

  return Array.from({ length: clipCount }).map((_, index) => {
    const start = Math.min(usableEnd - 30, usableStart + (index * step));
    const duration = index % 5 === 0 ? 45 : index % 3 === 0 ? 35 : 25;
    const score = Math.max(60, 96 - Math.floor(index * 0.7));

    return {
      rank: index + 1,
      title: `${game} highlight ${index + 1}`,
      startSeconds: start,
      endSeconds: Math.min(totalSeconds, start + duration),
      startTime: formatClipTime(start),
      endTime: formatClipTime(Math.min(totalSeconds, start + duration)),
      suggestedDurationSeconds: duration,
      score,
      reason: index === 0
        ? `Opening high-interest moment candidate from "${title}".`
        : `Candidate spaced through the VOD for AI/human review; scan chat/audio/video here for laughs, wins, surprises, or big reactions.`,
      status: "suggested"
    };
  });
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
MINECRAFT SERVERS
========================
*/

app.get("/api/minecraft-servers", async (req, res) => {

  try {

    const servers = await MinecraftServer.find({
      enabled: true
    }).sort({ name: 1, serverId: 1 });

    if (servers.length === 0) {
      return res.json([{
        serverId: "main",
        name: "Main Server",
        address: "",
        enabled: true
      }]);
    }

    res.json(servers);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: "Could not load Minecraft servers"
    });
  }
});

app.post("/api/admin/minecraft-servers", async (req, res) => {

  try {

    const serverId = normalizeServerId(req.body?.serverId);
    const name = String(req.body?.name || serverId).trim();
    const address = String(req.body?.address || "").trim();

    if (!serverId) {
      return res.status(400).json({
        success: false,
        error: "Missing serverId"
      });
    }

    const server = await MinecraftServer.findOneAndUpdate(
      { serverId },
      {
        serverId,
        name,
        address,
        enabled: req.body?.enabled !== false,
        lastSeenAt: new Date()
      },
      { new: true, upsert: true }
    );

    io.emit("minecraftServersUpdated");

    res.json({
      success: true,
      server
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
AI CLIP ANALYSIS
========================
*/

app.post("/api/admin/clip-analysis/latest", async (req, res) => {

  try {

    const channel = String(req.body?.channel || TWITCH_CHANNEL || "").trim();
    const maxClips = Math.max(1, Math.min(50, Number(req.body?.maxClips) || 50));
    const vod = await getLatestTwitchVod(channel);
    const candidates = buildClipCandidates(vod, maxClips);
    const id = `clip_${Date.now()}_${Math.floor(Math.random() * 9999)}`;

    const job = new ClipAnalysisJob({
      id,
      channel: vod.channel,
      vodId: vod.id,
      vodTitle: vod.title || "",
      vodUrl: vod.url || `https://www.twitch.tv/videos/${vod.id}`,
      thumbnailUrl: String(vod.thumbnail_url || "").replace("%{width}", "640").replace("%{height}", "360"),
      durationSeconds: vod.durationSeconds,
      maxClips,
      status: "complete",
      analysisMode: "metadata",
      candidates
    });

    await job.save();

    res.json({
      success: true,
      job
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message || "Could not analyze latest stream"
    });
  }
});

app.get("/api/admin/clip-analysis", async (req, res) => {

  try {

    const jobs = await ClipAnalysisJob.find()
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 20, 100));

    res.json(jobs);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.get("/api/admin/clip-analysis/:id", async (req, res) => {

  try {

    const job = await ClipAnalysisJob.findOne({
      id: req.params.id
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Clip analysis job not found"
      });
    }

    res.json({
      success: true,
      job
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
TALENT APPLICATIONS
========================
*/

function formatTalentApplication(application) {

  const data = application.toObject ? application.toObject() : application;

  return {
    ...data,
    id: String(data._id),
    created_date: data.createdAt,
    updated_date: data.updatedAt
  };
}

function getTalentApplicationSort(sort = "-created_date") {

  const cleanSort = String(sort || "-created_date").trim();
  const direction = cleanSort.startsWith("-") ? -1 : 1;
  const field = cleanSort.replace(/^-/, "");

  if (field === "created_date") return { createdAt: direction };
  if (field === "updated_date") return { updatedAt: direction };
  if (field === "applicant_name") return { applicant_name: direction };
  if (field === "email") return { email: direction };
  if (field === "status") return { status: direction };

  return { createdAt: -1 };
}

app.post("/api/applications", async (req, res) => {

  try {

    const applicantName = String(req.body.applicant_name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!applicantName || !email) {

      return res.status(400).json({
        success: false,
        error: "Missing applicant name or email"
      });
    }

    const application = new TalentApplication({
      applicant_name: applicantName,
      email,
      stage_name: String(req.body.stage_name || "").trim(),
      age: req.body.age === undefined || req.body.age === "" ? undefined : Number(req.body.age),
      country: String(req.body.country || "").trim(),
      content_type: String(req.body.content_type || "").trim(),
      experience: String(req.body.experience || "").trim(),
      portfolio_url: String(req.body.portfolio_url || "").trim(),
      has_avatar: req.body.has_avatar === true,
      tech_setup: String(req.body.tech_setup || "").trim(),
      motivation: String(req.body.motivation || "").trim(),
      availability_hours:
        req.body.availability_hours === undefined || req.body.availability_hours === ""
          ? undefined
          : Number(req.body.availability_hours),
      status: String(req.body.status || "pending").trim().toLowerCase() || "pending"
    });

    await application.save();

    io.emit("applicationsUpdated");

    res.json({
      success: true,
      application: formatTalentApplication(application)
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: "Could not submit application"
    });
  }
});

app.get("/api/applications", async (req, res) => {

  try {

    const limit = Math.min(Number(req.query.limit) || 100, 250);
    const email = String(req.query.email || "").trim().toLowerCase();
    const filter = email ? { email } : {};

    const applications = await TalentApplication.find(filter)
      .sort(getTalentApplicationSort(req.query.sort))
      .limit(limit);

    res.json(applications.map(formatTalentApplication));

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: "Could not load applications"
    });
  }
});

app.patch("/api/applications/:id", async (req, res) => {

  try {

    const allowedFields = [
      "applicant_name",
      "email",
      "stage_name",
      "age",
      "country",
      "content_type",
      "experience",
      "portfolio_url",
      "has_avatar",
      "tech_setup",
      "motivation",
      "availability_hours",
      "status",
      "admin_notes"
    ];
    const update = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        update[field] = req.body[field];
      }
    }

    if (update.email) {
      update.email = String(update.email).trim().toLowerCase();
    }

    if (update.status) {
      update.status = String(update.status).trim().toLowerCase();
    }

    const application = await TalentApplication.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    if (!application) {

      return res.status(404).json({
        success: false,
        error: "Application not found"
      });
    }

    io.emit("applicationsUpdated");

    res.json({
      success: true,
      application: formatTalentApplication(application)
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: "Could not update application"
    });
  }
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
    const serverId = await upsertMinecraftServer({
      serverId: data.serverId,
      name: data.serverName,
      address: data.serverAddress
    });

    let player = await Player.findOne(getPlayerServerFilter(data.name, serverId));

    if (!player) {

      player = new Player({
        serverId,
        uuid: data.uuid,
        name: data.name,
        inventory: data.inventory,
        balance: 0
      });

    } else {

      player.serverId = serverId;
      player.uuid = data.uuid;
      player.inventory = data.inventory;
    }

    await player.save();

    io.emit("inventoryUpdate", {
      serverId,
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

    const serverId = getRequestServerId(req);
    const players = await Player.find({ serverId }).sort({ name: 1 });

    res.json(players.map(player => ({
      serverId: player.serverId || "main",
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

    const serverId = getRequestServerId(req);
    const player = await Player.findOne(getPlayerServerFilter(req.params.name, serverId));

    if (!player) {

      return res.status(404).json({
        success: false
      });
    }

    const prices = await getSellPricesMap();

    res.json({
      uuid: player.uuid,
      serverId: player.serverId || serverId,
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

app.post("/api/player/charge", async (req, res) => {

  try {

    if (!requireServerKey(req, res)) return;

    const name = String(req.body?.name || "").trim();
    const serverId = getRequestServerId(req);
    const amount = Number(req.body?.amount);
    const reason = String(req.body?.reason || "charge").trim();

    if (!name || !Number.isFinite(amount) || amount <= 0) {

      return res.status(400).json({
        success: false,
        error: "Missing name or invalid amount"
      });
    }

    const player = await Player.findOne(getPlayerServerFilter(name, serverId));

    if (!player) {

      return res.status(404).json({
        success: false,
        error: "Player not found"
      });
    }

    if ((Number(player.balance) || 0) < amount) {

      return res.status(400).json({
        success: false,
        error: "Not enough money",
        balance: Number(player.balance) || 0
      });
    }

    player.balance = (Number(player.balance) || 0) - amount;

    await player.save();

    io.emit("balanceUpdate", {
      serverId,
      name: player.name,
      balance: player.balance,
      reason
    });

    res.json({
      success: true,
      balance: player.balance
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
SHOP ROUTES
========================
*/

/*
========================
PLOTS
========================
*/

app.get("/api/plots", async (req, res) => {
  try {
    const plots = await Plot.find().sort({ world: 1, chunkX: 1, chunkZ: 1 });
    res.json(plots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Could not load plots" });
  }
});

app.get("/api/plots/:world/:chunkX/:chunkZ", async (req, res) => {
  try {
    const plot = await Plot.findOne({
      world: req.params.world,
      chunkX: Number(req.params.chunkX),
      chunkZ: Number(req.params.chunkZ)
    });

    if (!plot) {
      return res.json({
        owned: false,
        claimable: true,
        price: 500
      });
    }

    res.json({
      owned: !!plot.ownerName,
      claimable: plot.claimable !== false,
      price: Number(plot.price) || 500,
      ownerName: plot.ownerName || "",
      ownerUuid: plot.ownerUuid || "",
      trusted: plot.trusted || []
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Could not load plot" });
  }
});

app.post("/api/admin/plots", async (req, res) => {
  try {
    const { world, chunkX, chunkZ, price, claimable } = req.body;

    const plot = await Plot.findOneAndUpdate(
      {
        world,
        chunkX: Number(chunkX),
        chunkZ: Number(chunkZ)
      },
      {
        world,
        chunkX: Number(chunkX),
        chunkZ: Number(chunkZ),
        price: Number(price) || 500,
        claimable: claimable !== false
      },
      { new: true, upsert: true }
    );

    io.emit("plotsUpdated");

    res.json({ success: true, plot });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/plots/buy", async (req, res) => {
  try {
    const { name, uuid, world, chunkX, chunkZ } = req.body;

    const existing = await Plot.findOne({
      world,
      chunkX: Number(chunkX),
      chunkZ: Number(chunkZ)
    });

    if (existing?.ownerName) {
      return res.status(400).json({
        success: false,
        error: "Plot already owned"
      });
    }

    if (existing && existing.claimable === false) {
      return res.status(400).json({
        success: false,
        error: "This plot is not claimable"
      });
    }

    const player = await Player.findOne({ name });

    if (!player) {
      return res.status(404).json({
        success: false,
        error: "Player not found"
      });
    }

    const price = Number(existing?.price) || 500;

    if (player.balance < price) {
      return res.status(400).json({
        success: false,
        error: "Not enough money"
      });
    }

    player.balance -= price;
    await player.save();

    let plot = existing;

    if (!plot) {
      plot = new Plot({
        world,
        chunkX: Number(chunkX),
        chunkZ: Number(chunkZ),
        trusted: []
      });
    }

    plot.ownerName = name;
    plot.ownerUuid = uuid || player.uuid || "";
    plot.price = price;
    plot.claimable = true;

    await plot.save();

    io.emit("plotsUpdated");
    io.emit("balanceUpdate", {
      name: player.name,
      balance: player.balance
    });

    res.json({
      success: true,
      plot,
      balance: player.balance
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Could not buy plot" });
  }
});

app.post("/api/plots/trust", async (req, res) => {
  try {
    const { ownerName, ownerUuid, world, chunkX, chunkZ } = req.body;
    const trustedName = String(req.body.trustedName || req.body.targetName || "").trim();

    if (!ownerName || !trustedName || !world || chunkX === undefined || chunkZ === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing ownerName, trustedName, world, chunkX, or chunkZ"
      });
    }

    const plot = await Plot.findOne({
      world,
      chunkX: Number(chunkX),
      chunkZ: Number(chunkZ)
    });

    if (!plot || !plot.ownerName) {
      return res.status(404).json({
        success: false,
        error: "Plot not found"
      });
    }

    const isOwner =
      String(plot.ownerName || "").toLowerCase() === String(ownerName || "").toLowerCase() ||
      (ownerUuid && String(plot.ownerUuid || "").toLowerCase() === String(ownerUuid || "").toLowerCase());

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: "Only the plot owner can trust players"
      });
    }

    if (!plot.trusted.some(name => String(name).toLowerCase() === trustedName.toLowerCase())) {
      plot.trusted.push(trustedName);
      await plot.save();
    }

    io.emit("plotsUpdated");

    res.json({ success: true, plot });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Could not trust player" });
  }
});

app.post("/api/plots/untrust", async (req, res) => {
  try {
    const { ownerName, ownerUuid, world, chunkX, chunkZ } = req.body;
    const trustedName = String(req.body.trustedName || req.body.targetName || "").trim();

    if (!ownerName || !trustedName || !world || chunkX === undefined || chunkZ === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing ownerName, trustedName, world, chunkX, or chunkZ"
      });
    }

    const plot = await Plot.findOne({
      world,
      chunkX: Number(chunkX),
      chunkZ: Number(chunkZ)
    });

    if (!plot || !plot.ownerName) {
      return res.status(404).json({
        success: false,
        error: "Plot not found"
      });
    }

    const isOwner =
      String(plot.ownerName || "").toLowerCase() === String(ownerName || "").toLowerCase() ||
      (ownerUuid && String(plot.ownerUuid || "").toLowerCase() === String(ownerUuid || "").toLowerCase());

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: "Only the plot owner can remove trusted players"
      });
    }

    plot.trusted = (plot.trusted || []).filter(
      name => String(name).toLowerCase() !== trustedName.toLowerCase()
    );

    await plot.save();

    io.emit("plotsUpdated");

    res.json({ success: true, plot });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Could not remove trusted player" });
  }
});
/*
========================
REGION PLOTS
========================
*/

app.get("/api/test-region", (req, res) => {
  res.json({
    success: true,
    message: "Region routes loaded"
  });
});

app.get("/api/region-plots", async (req, res) => {
  try {
    const plots = await RegionPlot.find().sort({ plotId: 1 });
    res.json(plots);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Could not load region plots"
    });
  }
});

app.post("/api/admin/region-plots", async (req, res) => {
  try {
    const {
      plotId,
      displayName,
      world,
      minX,
      minY,
      minZ,
      maxX,
      maxY,
      maxZ,
      price,
      claimable
    } = req.body;

    if (!plotId || !world) {
      return res.status(400).json({
        success: false,
        error: "Missing plotId or world"
      });
    }

    const plot = await RegionPlot.findOneAndUpdate(
      { plotId },
      {
        plotId,
        displayName: String(displayName || "").trim(),
        world,
        minX: Number(minX),
        minY: Number(minY),
        minZ: Number(minZ),
        maxX: Number(maxX),
        maxY: Number(maxY),
        maxZ: Number(maxZ),
        price: Number(price) || 500,
        claimable: claimable !== false
      },
      {
        new: true,
        upsert: true
      }
    );

    io.emit("regionPlotsUpdated");

    res.json({
      success: true,
      plot
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.delete("/api/admin/region-plots/:plotId", async (req, res) => {
  try {
    const plotId = String(req.params.plotId || "").trim();

    if (!plotId) {
      return res.status(400).json({
        success: false,
        error: "Missing plotId"
      });
    }

    const plot = await RegionPlot.findOneAndDelete({ plotId });

    if (!plot) {
      return res.status(404).json({
        success: false,
        error: "Plot not found"
      });
    }

    io.emit("regionPlotsUpdated");

    res.json({
      success: true,
      plot
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Could not remove region plot"
    });
  }
});

app.patch("/api/admin/region-plots/:plotId", async (req, res) => {
  try {
    const plotId = String(req.params.plotId || "").trim();

    if (!plotId) {
      return res.status(400).json({
        success: false,
        error: "Missing plotId"
      });
    }

    const update = {};

    if (req.body.displayName !== undefined || req.body.name !== undefined) {
      update.displayName = String(req.body.displayName ?? req.body.name ?? "").trim();
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({
        success: false,
        error: "Missing fields to update"
      });
    }

    const plot = await RegionPlot.findOneAndUpdate(
      { plotId },
      update,
      { new: true }
    );

    if (!plot) {
      return res.status(404).json({
        success: false,
        error: "Plot not found"
      });
    }

    io.emit("regionPlotsUpdated");

    res.json({
      success: true,
      plot
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Could not update region plot"
    });
  }
});

app.post("/api/region-plots/trust", async (req, res) => {
  try {
    const { plotId, ownerName, ownerUuid } = req.body;
    const trustedName = String(req.body.trustedName || req.body.targetName || "").trim();
    const cleanPlotId = String(plotId || "").trim();

    if (!cleanPlotId || !ownerName || !trustedName) {
      return res.status(400).json({
        success: false,
        error: "Missing plotId, ownerName, or trustedName"
      });
    }

    const plot = await RegionPlot.findOne({ plotId: cleanPlotId });

    if (!plot || !plot.ownerName) {
      return res.status(404).json({
        success: false,
        error: "Plot not found"
      });
    }

    const isOwner =
      String(plot.ownerName || "").toLowerCase() === String(ownerName || "").toLowerCase() ||
      (ownerUuid && String(plot.ownerUuid || "").toLowerCase() === String(ownerUuid || "").toLowerCase());

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: "Only the plot owner can trust players"
      });
    }

    if (!plot.trusted.some(name => String(name).toLowerCase() === trustedName.toLowerCase())) {
      plot.trusted.push(trustedName);
      await plot.save();
    }

    io.emit("regionPlotsUpdated");

    res.json({ success: true, plot });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Could not trust player"
    });
  }
});

app.post("/api/region-plots/untrust", async (req, res) => {
  try {
    const { plotId, ownerName, ownerUuid } = req.body;
    const trustedName = String(req.body.trustedName || req.body.targetName || "").trim();
    const cleanPlotId = String(plotId || "").trim();

    if (!cleanPlotId || !ownerName || !trustedName) {
      return res.status(400).json({
        success: false,
        error: "Missing plotId, ownerName, or trustedName"
      });
    }

    const plot = await RegionPlot.findOne({ plotId: cleanPlotId });

    if (!plot || !plot.ownerName) {
      return res.status(404).json({
        success: false,
        error: "Plot not found"
      });
    }

    const isOwner =
      String(plot.ownerName || "").toLowerCase() === String(ownerName || "").toLowerCase() ||
      (ownerUuid && String(plot.ownerUuid || "").toLowerCase() === String(ownerUuid || "").toLowerCase());

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: "Only the plot owner can remove trusted players"
      });
    }

    plot.trusted = (plot.trusted || []).filter(
      name => String(name).toLowerCase() !== trustedName.toLowerCase()
    );

    await plot.save();

    io.emit("regionPlotsUpdated");

    res.json({ success: true, plot });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Could not remove trusted player"
    });
  }
});

app.post("/api/region-plots/buy", async (req, res) => {
  try {
    const { plotId, name, uuid } = req.body;

    const plot = await RegionPlot.findOne({ plotId });

    if (!plot) {
      return res.status(404).json({
        success: false,
        error: "Plot not found"
      });
    }

    if (plot.ownerName) {
      return res.status(400).json({
        success: false,
        error: "Plot already owned"
      });
    }

    if (plot.claimable === false) {
      return res.status(400).json({
        success: false,
        error: "This plot is not claimable"
      });
    }

    const player = await Player.findOne({ name });

    if (!player) {
      return res.status(404).json({
        success: false,
        error: "Player not found"
      });
    }

    const price = Number(plot.price) || 500;

    if (player.balance < price) {
      return res.status(400).json({
        success: false,
        error: "Not enough money"
      });
    }

    player.balance -= price;
    await player.save();

    plot.ownerName = name;
    plot.ownerUuid = uuid || player.uuid || "";

    await plot.save();
	console.log("Region plot bought:", {
  plotId: plot.plotId,
  ownerName: plot.ownerName,
  ownerUuid: plot.ownerUuid
});

    io.emit("regionPlotsUpdated");
    io.emit("balanceUpdate", {
      name: player.name,
      balance: player.balance
    });

    res.json({
      success: true,
      plot,
      balance: player.balance
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Could not buy region plot"
    });
  }
});

app.post("/api/region-plots/sell", async (req, res) => {
  try {
    const { plotId, name, uuid } = req.body;

    const cleanPlotId = String(plotId || "").trim();
    const cleanName = String(name || "").trim();
    const cleanUuid = String(uuid || "").trim();

    if (!cleanPlotId || !cleanName) {
      return res.status(400).json({
        success: false,
        error: "Missing plotId or name"
      });
    }

    const plot = await RegionPlot.findOne({ plotId: cleanPlotId });

    if (!plot) {
      return res.status(404).json({
        success: false,
        error: "Plot not found"
      });
    }

    if (!plot.ownerName) {
      return res.status(400).json({
        success: false,
        error: "Plot is not owned"
      });
    }

    const isOwner =
      String(plot.ownerName || "").toLowerCase() === cleanName.toLowerCase() ||
      (cleanUuid && String(plot.ownerUuid || "").toLowerCase() === cleanUuid.toLowerCase());

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: "Only the plot owner can sell this plot"
      });
    }

    const player = await Player.findOne({ name: cleanName });

    if (!player) {
      return res.status(404).json({
        success: false,
        error: "Player not found"
      });
    }

    const refund = Number(plot.price) || 500;

    player.balance += refund;
    await player.save();

    plot.ownerName = "";
    plot.ownerUuid = "";
    plot.trusted = [];
    plot.claimable = true;

    await plot.save();

    io.emit("regionPlotsUpdated");
    io.emit("balanceUpdate", {
      name: player.name,
      balance: player.balance
    });

    res.json({
      success: true,
      plot,
      refund,
      balance: player.balance
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Could not sell region plot"
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
  }).sort({ category: 1, displayName: 1, itemType: 1 });

  res.json(items);
});

app.get("/api/admin/shop", async (req, res) => {

  const items = await ShopItem.find().sort({ category: 1, displayName: 1, itemType: 1 });

  res.json(items);
});

app.post("/api/admin/shop", async (req, res) => {

  try {

    const { itemType, price, displayName, imageUrl, iconUrl, enabled } = req.body;
    const category = String(req.body.category || "misc").trim().toLowerCase();

    if (!itemType || price === undefined) {

      return res.status(400).json({
        success: false,
        error: "Missing itemType or price"
      });
    }

    const item = new ShopItem({
      itemType: itemType,
      category: category || "misc",
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

app.post("/api/admin/shop/upsert", async (req, res) => {

  try {

    const { itemType, price, displayName, imageUrl, iconUrl, enabled } = req.body;
    const category = String(req.body.category || "misc").trim().toLowerCase();
    const cleanType = String(itemType || "").trim();
    const aliases = Array.isArray(req.body.aliases)
      ? req.body.aliases.map(alias => String(alias || "").trim()).filter(Boolean)
      : [];

    if (!cleanType || price === undefined) {

      return res.status(400).json({
        success: false,
        error: "Missing itemType or price"
      });
    }

    const item = await ShopItem.findOneAndUpdate(
      { itemType: cleanType },
      {
        itemType: cleanType,
        aliases: [...new Set([cleanType, ...aliases])],
        category: category || "misc",
        displayName: displayName || "",
        price: Number(price),
        imageUrl: imageUrl || "",
        iconUrl: iconUrl || "",
        enabled: enabled !== false
      },
      {
        new: true,
        upsert: true
      }
    );

    io.emit("shopUpdated");

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

app.put("/api/admin/shop/:id", async (req, res) => {

  try {

    const { itemType, price, displayName, imageUrl, iconUrl, enabled } = req.body;
    const category = String(req.body.category || "misc").trim().toLowerCase();

    const item = await ShopItem.findByIdAndUpdate(
      req.params.id,
      {
        itemType: itemType,
        category: category || "misc",
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

app.delete("/api/admin/shop/by-type/:itemType", async (req, res) => {

  try {

    const cleanType = String(req.params.itemType || "").trim();

    if (!cleanType) {
      return res.status(400).json({
        success: false,
        error: "Missing itemType"
      });
    }

    const result = await ShopItem.deleteMany({
      $or: [
        { itemType: cleanType },
        { aliases: cleanType }
      ]
    });

    io.emit("shopUpdated");

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
SELL PRICE ADMIN
========================
*/

app.get("/api/admin/sell-prices", async (req, res) => {

  const items = await SellPrice.find();

  res.json(items);
});

app.get("/api/site-settings", async (req, res) => {

  try {

    res.json({
      maintenanceMode: await getMaintenanceMode()
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.post("/api/admin/site-settings", async (req, res) => {

  try {

    const maintenanceMode = req.body?.maintenanceMode === true;

    const setting = await SiteSetting.findOneAndUpdate(
      {
        key: "maintenanceMode"
      },
      {
        key: "maintenanceMode",
        value: maintenanceMode,
        updatedAt: new Date()
      },
      {
        new: true,
        upsert: true
      }
    );

    io.emit("siteSettingsUpdated", {
      maintenanceMode
    });

    res.json({
      success: true,
      maintenanceMode: setting.value === true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
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
  const serverId = getRequestServerId(req);
  const slotNumber = Number(slot);
  const sellAmount = Number(amount);

  const player = await Player.findOne(getPlayerServerFilter(name, serverId));

  const inventoryItem = player?.inventory?.find(item =>
    Number(item.slot) === slotNumber
  );

  if (!player || !inventoryItem) {

    return res.status(404).json({
      success: false,
      error: "Item was not found in that inventory slot"
    });
  }

  if (!Number.isFinite(sellAmount) || sellAmount < 1 || sellAmount > Number(inventoryItem.amount || 0)) {

    return res.status(400).json({
      success: false,
      error: "Invalid sell amount"
    });
  }

  const id =
    Date.now().toString()
    + Math.floor(Math.random() * 9999);

  const sellRequest = new PendingSell({
    id,
    serverId,
    name,
    slot: slotNumber,
    amount: sellAmount,
    itemType: inventoryItem.type || inventoryItem.itemType || "",
    nbt: inventoryItem.nbt || "",
    status: "PENDING"
  });

  await sellRequest.save();

  res.json({
    success: true,
    id
  });
});

app.get("/api/pending-sells/:name", async (req, res) => {

  const serverId = getRequestServerId(req);
  const requests = await PendingSell.find({
    name: req.params.name,
    serverId,
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

  const sellItemType =
    request.itemType ||
    itemType;
  const sellNbt =
    request.nbt ||
    nbt;
  const soldAmount =
    Number(amount || request.amount || 0);

  const total =
    (await getSellPrice(sellItemType, sellNbt))
    * soldAmount;

  const player = await Player.findOne(getPlayerServerFilter(
    name,
    request.serverId || getRequestServerId(req)
  ));

  player.balance += total;

  await player.save();

  io.emit("balanceUpdate", {
    serverId: player.serverId || request.serverId || "main",
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
    const serverId = getRequestServerId(req);

    // KEEP NBT EXACTLY AS TYPED
    const cleanItemType =
      String(itemType).trim();

    const buyAmount = Number(amount);

    const shopItem = await ShopItem.findOne({
      enabled: true,
      $or: [
        { itemType: cleanItemType },
        { aliases: cleanItemType },
        { itemType: cleanItemType.toUpperCase() },
        { aliases: cleanItemType.toUpperCase() },
        { itemType: cleanItemType.toLowerCase() },
        { aliases: cleanItemType.toLowerCase() }
      ]
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

    const player = await Player.findOne(getPlayerServerFilter(name, serverId));

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
      serverId,
      name: player.name,
      balance: player.balance
    });

    const id =
      Date.now().toString()
      + Math.floor(Math.random() * 9999);

    const buyRequest = new PendingBuy({
      id,
      serverId,
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

  const serverId = getRequestServerId(req);
  const requests = await PendingBuy.find({
    name: req.params.name,
    serverId,
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

      const player = await Player.findOne(getPlayerServerFilter(
        request.name,
        request.serverId || getRequestServerId(req)
      ));

      if (player) {

        player.balance += request.cost;

        await player.save();

        io.emit("balanceUpdate", {
          serverId: player.serverId || request.serverId || "main",
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
