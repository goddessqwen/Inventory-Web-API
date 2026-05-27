const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

const playerSchema = new mongoose.Schema({
  uuid: String,
  name: String,
  inventory: Array,
  balance: { type: Number, default: 0 }
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
  enabled: { type: Boolean, default: true }
});

const Player = mongoose.model("Player", playerSchema);
const PendingSell = mongoose.model("PendingSell", pendingSellSchema);
const PendingBuy = mongoose.model("PendingBuy", pendingBuySchema);
const ShopItem = mongoose.model("ShopItem", shopItemSchema);

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

async function seedShopIfEmpty() {
  const count = await ShopItem.countDocuments();

  if (count > 0) return;

  await ShopItem.insertMany([
    { itemType: "DIAMOND", price: 100, iconUrl: "", enabled: true },
    { itemType: "EMERALD", price: 75, iconUrl: "", enabled: true },
    { itemType: "GOLD_INGOT", price: 25, iconUrl: "", enabled: true },
    { itemType: "IRON_INGOT", price: 10, iconUrl: "", enabled: true },
    { itemType: "COAL", price: 3, iconUrl: "", enabled: true }
  ]);

  console.log("Default shop items created");
}

mongoose.connection.once("open", () => {
  seedShopIfEmpty().catch(console.error);
});

app.get("/", (req, res) => {
  res.send("Inventory API is running.");
});

app.post("/api/inventory", async (req, res) => {
  try {
    const data = req.body;

    let player = await Player.findOne({ name: data.name });

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

    res.json({ success: true, message: "Inventory saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to save inventory" });
  }
});

app.get("/api/inventory/:name", async (req, res) => {
  try {
    const player = await Player.findOne({ name: req.params.name });

    if (!player) {
      return res.status(404).json({
        success: false,
        error: "Player not found"
      });
    }

    const shopItems = await ShopItem.find({ enabled: true });
    const iconMap = {};

    shopItems.forEach(item => {
      iconMap[item.itemType] = item.iconUrl || "";
    });

    res.json({
      uuid: player.uuid,
      name: player.name,
      inventory: player.inventory,
      balance: player.balance,
      prices: sellPrices,
      icons: iconMap
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

app.get("/api/shop", async (req, res) => {
  try {
    const items = await ShopItem.find({ enabled: true });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to load shop" });
  }
});

app.get("/api/admin/shop", async (req, res) => {
  try {
    const items = await ShopItem.find();
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.post("/api/admin/shop", async (req, res) => {
  try {
    const { itemType, price, iconUrl, enabled } = req.body;

    const item = new ShopItem({
      itemType: String(itemType).toUpperCase(),
      price: Number(price),
      iconUrl: iconUrl || "",
      enabled: enabled !== false
    });

    await item.save();

    res.json({ success: true, item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.put("/api/admin/shop/:id", async (req, res) => {
  try {
    const { itemType, price, iconUrl, enabled } = req.body;

    const item = await ShopItem.findByIdAndUpdate(
      req.params.id,
      {
        itemType: String(itemType).toUpperCase(),
        price: Number(price),
        iconUrl: iconUrl || "",
        enabled
      },
      { new: true }
    );

    res.json({ success: true, item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.delete("/api/admin/shop/:id", async (req, res) => {
  try {
    await ShopItem.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.post("/api/sell", async (req, res) => {
  try {
    const { name, slot, amount } = req.body;
    const sellAmount = Number(amount);

    if (!name || slot === undefined || !sellAmount) {
      return res.status(400).json({ success: false });
    }

    const id = Date.now().toString() + Math.floor(Math.random() * 9999);

    const sellRequest = new PendingSell({
      id,
      name,
      slot: Number(slot),
      amount: sellAmount,
      status: "PENDING"
    });

    await sellRequest.save();

    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.get("/api/pending-sells/:name", async (req, res) => {
  try {
    const requests = await PendingSell.find({
      name: req.params.name,
      status: "PENDING"
    });

    const text = requests
      .map(request => `${request.id}|${request.slot}|${request.amount}`)
      .join("\n");

    res.type("text/plain").send(text);
  } catch (err) {
    console.error(err);
    res.status(500).send("");
  }
});

app.post("/api/complete-sell", async (req, res) => {
  try {
    const { id, name, success, itemType, amount } = req.body;

    const request = await PendingSell.findOne({ id });

    if (!request) {
      return res.status(404).json({ success: false });
    }

    if (!success) {
      request.status = "FAILED";
      await request.save();
      return res.json({ success: true });
    }

    const total = getSellPrice(itemType) * Number(amount || 0);
    const player = await Player.findOne({ name });

    player.balance += total;
    await player.save();

    request.status = "COMPLETE";
    await request.save();

    res.json({
      success: true,
      total,
      balance: player.balance
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.post("/api/buy", async (req, res) => {
  try {
    const { name, itemType, amount } = req.body;
    const cleanItemType = String(itemType).toUpperCase();
    const buyAmount = Number(amount);

    const shopItem = await ShopItem.findOne({
      itemType: cleanItemType,
      enabled: true
    });

    if (!shopItem) {
      return res.status(400).json({
        success: false,
        error: "Invalid item"
      });
    }

    if (isNaN(buyAmount) || buyAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid amount"
      });
    }

    const player = await Player.findOne({ name });

    if (!player) {
      return res.status(404).json({
        success: false,
        error: "Player not found"
      });
    }

    const totalCost = shopItem.price * buyAmount;

    if (player.balance < totalCost) {
      return res.status(400).json({
        success: false,
        error: "Not enough money"
      });
    }

    player.balance -= totalCost;
    await player.save();

    const id = Date.now().toString() + Math.floor(Math.random() * 9999);

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
      message: "Buy request created"
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
  try {
    const requests = await PendingBuy.find({
      name: req.params.name,
      status: "PENDING"
    });

    const text = requests
      .map(request => `${request.id}|${request.itemType}|${request.amount}`)
      .join("\n");

    res.type("text/plain").send(text);
  } catch (err) {
    console.error(err);
    res.status(500).send("");
  }
});

app.post("/api/complete-buy", async (req, res) => {
  try {
    const { id, success } = req.body;

    const request = await PendingBuy.findOne({ id });

    if (!request) {
      return res.status(404).json({ success: false });
    }

    if (!success) {
      request.status = "FAILED";
      await request.save();
      return res.json({ success: true });
    }

    request.status = "COMPLETE";
    await request.save();

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Inventory API running on port ${port}`);
});