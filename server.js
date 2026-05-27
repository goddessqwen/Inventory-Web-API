app.post("/api/buy", async (req, res) => {

  try {

    const { name, itemType, amount } = req.body;

    const cleanItemType =
      String(itemType).trim().toUpperCase();

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