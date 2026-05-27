const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const inventories = {};
const balances = {};
const pendingSells = [];

const prices = {
  DIAMOND: 100,
  EMERALD: 75,
  GOLD_INGOT: 25,
  IRON_INGOT: 10,
  COAL: 3,
  REDSTONE: 4,
  LAPIS_LAZULI: 5
};

function getPrice(type) {
  return prices[type] || 1;
}

app.post("/api/inventory", (req, res) => {
  const data = req.body;

  inventories[data.name] = data;

  if (balances[data.name] === undefined) {
    balances[data.name] = 0;
  }

  console.log("Inventory received:");
  console.log(JSON.stringify(data, null, 2));

  res.json({
    success: true,
    message: "Inventory saved"
  });
});

app.get("/api/inventory/:name", (req, res) => {
  const name = req.params.name;
  const data = inventories[name];

  if (!data) {
    return res.status(404).json({
      success: false,
      error: "Player not found"
    });
  }

  res.json({
    ...data,
    balance: balances[name] || 0,
    prices
  });
});

app.post("/api/sell", (req, res) => {
  const { name, slot, amount } = req.body;

  if (!name || slot === undefined || !amount) {
    return res.status(400).json({
      success: false,
      error: "Missing name, slot, or amount"
    });
  }

  const sellAmount = Number(amount);

  if (isNaN(sellAmount) || sellAmount <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid sell amount"
    });
  }

  const id = Date.now().toString() + Math.floor(Math.random() * 9999);

  pendingSells.push({
    id,
    name,
    slot: Number(slot),
    amount: sellAmount,
    status: "PENDING"
  });

  console.log(`Sell request created: ${name} slot ${slot} amount ${sellAmount}`);

  res.json({
    success: true,
    message: "Sell request created",
    id
  });
});

app.get("/api/pending-sells/:name", (req, res) => {
  const name = req.params.name;

  const requests = pendingSells.filter(
    request => request.name === name && request.status === "PENDING"
  );

  const text = requests
    .map(request => `${request.id}|${request.slot}|${request.amount}`)
    .join("\n");

  res.type("text/plain").send(text);
});

app.post("/api/complete-sell", (req, res) => {
  const { id, name, success, itemType, amount } = req.body;

  const request = pendingSells.find(request => request.id === id);

  if (!request) {
    return res.status(404).json({
      success: false,
      error: "Sell request not found"
    });
  }

  if (request.status !== "PENDING") {
    return res.status(400).json({
      success: false,
      error: "Sell request already processed"
    });
  }

  if (!success) {
    request.status = "FAILED";

    return res.json({
      success: true,
      message: "Sell failed"
    });
  }

  const total = getPrice(itemType) * Number(amount || 0);

  balances[name] = (balances[name] || 0) + total;

  request.status = "COMPLETE";
  request.itemType = itemType;
  request.amount = amount;
  request.total = total;

  console.log(`${name} sold ${amount}x ${itemType} for $${total}`);

  res.json({
    success: true,
    message: "Sell completed",
    total,
    balance: balances[name]
  });
});

app.get("/inventory/:name", (req, res) => {
  const name = req.params.name;
  const data = inventories[name];

  if (!data) {
    return res.send(`
      <html>
        <body style="background:#111;color:white;font-family:Arial;">
          <h1>No inventory found for ${name}</h1>
        </body>
      </html>
    `);
  }

  const balance = balances[name] || 0;

  const slots = Array.from({ length: 36 }, (_, i) => {
    const item = data.inventory.find(x => x.slot === i);
    const priceEach = item ? getPrice(item.type) : 0;

    return `
      <div class="slot">
        ${
          item
            ? `
          <div class="item">${item.type.replaceAll("_", " ")}</div>
          <div class="amount">${item.amount}</div>
          <button class="sell" onclick="sellItem('${data.name}', ${item.slot}, ${item.amount}, ${priceEach})">
            Sell
          </button>
        `
            : ""
        }
      </div>
    `;
  }).join("");

  res.send(`
    <html>
    <head>
      <style>
        body {
          background: #0b0f1a;
          color: white;
          font-family: Arial, sans-serif;
          padding: 30px;
        }

        .container {
          display: flex;
          gap: 30px;
          align-items: flex-start;
        }

        .skin {
          image-rendering: pixelated;
        }

        .inventory {
          background: #c6c6c6;
          border: 4px solid #555;
          padding: 16px;
          box-shadow: inset 3px 3px #fff, inset -3px -3px #777;
        }

        .title,
        .money {
          color: #222;
          font-weight: bold;
          margin-bottom: 10px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(9, 68px);
          gap: 4px;
        }

        .slot {
          width: 68px;
          height: 68px;
          background: #8b8b8b;
          border: 3px solid;
          border-color: #373737 #fff #fff #373737;
          position: relative;
          overflow: hidden;
          color: white;
          font-size: 8px;
          text-align: center;
        }

        .item {
          padding-top: 7px;
          text-shadow: 1px 1px #000;
        }

        .amount {
          position: absolute;
          right: 4px;
          bottom: 18px;
          font-weight: bold;
          font-size: 12px;
          text-shadow: 1px 1px #000;
        }

        .sell {
          position: absolute;
          left: 4px;
          right: 4px;
          bottom: 2px;
          font-size: 9px;
          cursor: pointer;
        }
      </style>
    </head>

    <body>
      <h1>${data.name}'s Inventory</h1>

      <div class="container">
        <img class="skin" src="https://mc-heads.net/body/${data.name}/180" alt="${data.name}" />

        <div class="inventory">
          <div class="title">Inventory</div>
          <div class="money">Money: $${balance}</div>

          <div class="grid">
            ${slots}
          </div>
        </div>
      </div>

      <script>
        async function sellItem(name, slot, maxAmount, priceEach) {
          const amountText = prompt(
            "How many do you want to sell? Max: " + maxAmount + "\\nPrice each: $" + priceEach
          );

          if (!amountText) {
            return;
          }

          const amount = Number(amountText);

          if (isNaN(amount) || amount <= 0) {
            alert("Enter a real number.");
            return;
          }

          if (amount > maxAmount) {
            alert("You cannot sell more than you have.");
            return;
          }

          const response = await fetch("/api/sell", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              name,
              slot,
              amount
            })
          });

          const result = await response.json();

          if (result.success) {
            alert("Sell request sent. Wait up to 5 seconds, then refresh.");
          } else {
            alert(result.error || "Sell failed");
          }
        }
      </script>
    </body>
    </html>
  `);
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Inventory API running on port ${port}`);
});