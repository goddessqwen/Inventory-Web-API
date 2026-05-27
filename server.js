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

const shopItemSchema = new mongoose.Schema({
  itemType: String,
  price: Number,
  iconUrl: String,
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
const PendingSell = mongoose.model("PendingSell", pendingSellSchema);
const PendingBuy = mongoose.model("PendingBuy", pendingBuySchema);
const ShopItem = mongoose.model("ShopItem", shopItemSchema);

/*
========================
SELL PRICES
========================
*/

const sellPrices = {
  DIAMOND: 100,
  EMERALD: 75,
  GOLD_INGOT: 25,
  IRON_INGOT: 10,
  COAL: 3,
  REDSTONE: 4,
  LAPIS_LAZULI: 5
};

function getSellPrice(type) {
  return sellPrices[type] || 1;
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
    },
    {
      itemType: "GOLD_INGOT",
      price: 25,
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
      success: true,
      message: "Inventory saved"
    });

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
        success: false,
        error: "Player not found"
      });
    }

    res.json({
      uuid: player.uuid,
      name: player.name,
      inventory: player.inventory,
      balance: player.balance,
      prices: sellPrices
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
SHOP
========================
*/

app.get("/api/shop", async (req, res) => {

  const items = await ShopItem.find({
    enabled: true
  });

  res.json(items);
});

/*
========================
ADMIN SHOP
========================
*/

app.get("/api/admin/shop", async (req, res) => {

  const items = await ShopItem.find();

  res.json(items);
});

app.post("/api/admin/shop", async (req, res) => {

  const {
    itemType,
    price,
    iconUrl,
    enabled
  } = req.body;

  const item = new ShopItem({
    itemType: itemType.toUpperCase(),
    price: Number(price),
    iconUrl,
    enabled: enabled !== false
  });

  await item.save();

  io.emit("shopUpdate");

  res.json({
    success: true,
    item
  });
});

app.put("/api/admin/shop/:id", async (req, res) => {

  const {
    itemType,
    price,
    iconUrl,
    enabled
  } = req.body;

  const item = await ShopItem.findByIdAndUpdate(
    req.params.id,
    {
      itemType: itemType.toUpperCase(),
      price: Number(price),
      iconUrl,
      enabled
    },
    {
      new: true
    }
  );

  io.emit("shopUpdate");

  res.json({
    success: true,
    item
  });
});

app.delete("/api/admin/shop/:id", async (req, res) => {

  await ShopItem.findByIdAndDelete(req.params.id);

  io.emit("shopUpdate");

  res.json({
    success: true
  });
});

/*
========================
SELL SYSTEM
========================
*/

app.post("/api/sell", async (req, res) => {

  const {
    name,
    slot,
    amount
  } = req.body;

  const id =
    Date.now().toString()
    + Math.floor(Math.random() * 9999);

  const sellRequest = new PendingSell({
    id,
    name,
    slot,
    amount,
    status: "PENDING"
  });

  await sellRequest.save();

  res.json({
    success: true
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

  const {
    id,
    name,
    success,
    itemType,
    amount
  } = req.body;

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
    getSellPrice(itemType)
    * Number(amount || 0);

  const player = await Player.findOne({
    name
  });

  player.balance += total;

  await player.save();

  request.status = "COMPLETE";

  await request.save();

  io.emit("balanceUpdate", {
    name: player.name,
    balance: player.balance
  });

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

  const {
    name,
    itemType,
    amount
  } = req.body;

  const buyAmount = Number(amount);

  const shopItem = await ShopItem.findOne({
    itemType,
    enabled: true
  });

  if (!shopItem) {

    return res.status(400).json({
      success: false,
      error: "Invalid item"
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
    itemType,
    amount: buyAmount,
    cost: totalCost,
    status: "PENDING"
  });

  await buyRequest.save();

  res.json({
    success: true
  });
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

  const {
    id,
    success
  } = req.body;

  const request = await PendingBuy.findOne({
    id
  });

  if (!request) {

    return res.status(404).json({
      success: false
    });
  }

  request.status =
    success ? "COMPLETE" : "FAILED";

  await request.save();

  res.json({
    success: true
  });
});

/*
========================
SOCKET CONNECTION
========================
*/

io.on("connection", (socket) => {

  console.log("Client connected");

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
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