const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
  });

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

const Player = mongoose.model("Player", playerSchema);
const PendingSell = mongoose.model("PendingSell", pendingSellSchema);
const PendingBuy = mongoose.model("PendingBuy", pendingBuySchema);

const prices = {
  DIAMOND: 100,
  EMERALD: 75,
  GOLD_INGOT: 25,
  IRON_INGOT: 10,
  COAL: 3,
  REDSTONE: 4,
  LAPIS_LAZULI: 5
};

const shopItems = {
  DIAMOND: 100,
  EMERALD: 75,
  GOLD_INGOT: 25,
  IRON_INGOT: 10,
  COAL: 3
};

function getPrice(type) {
  return prices[type] || 1;
}

app.get("/api/shop", (req, res) => {
  res.json(shopItems);
});

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
      prices
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false
    });
  }
});

app.post("/api/sell", async (req, res) => {

  try {

    const { name, slot, amount } = req.body;

    const sellAmount = Number(amount);

    if (!name || slot === undefined || !sellAmount) {
      return res.status(400).json({
        success: false
      });
    }

    const id =
      Date.now().toString() + Math.floor(Math.random() * 9999);

    const sellRequest = new PendingSell({
      id,
      name,
      slot: Number(slot),
      amount: sellAmount,
      status: "PENDING"
    });

    await sellRequest.save();

    res.json({
      success: true,
      id
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false
    });
  }
});

app.get("/api/pending-sells/:name", async (req, res) => {

  try {

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

    const total = getPrice(itemType) * Number(amount || 0);

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

    res.status(500).json({
      success: false
    });
  }
});

app.post("/api/buy", async (req, res) => {

  try {

    const { name, itemType, amount } = req.body;

    if (!shopItems[itemType]) {
      return res.status(400).json({
        success: false,
        error: "Invalid item"
      });
    }

    const buyAmount = Number(amount);

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

    const totalCost = shopItems[itemType] * buyAmount;

    if (player.balance < totalCost) {
      return res.status(400).json({
        success: false,
        error: "Not enough money"
      });
    }

    player.balance -= totalCost;

    await player.save();

    const id =
      Date.now().toString() + Math.floor(Math.random() * 9999);

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
      .map(request =>
        `${request.id}|${request.itemType}|${request.amount}`
      )
      .join("\n");

    res.type("text/plain").send(text);

  } catch (err) {

    console.error(err);

    res.status(500).send("");
  }
});

app.post("/api/complete-buy", async (req, res) => {

  try {

    const { id } = req.body;

    const request = await PendingBuy.findOne({ id });

    if (!request) {
      return res.status(404).json({
        success: false
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

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Inventory API running on port ${port}`);
});