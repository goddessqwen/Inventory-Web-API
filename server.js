const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const inventories = {};

app.post("/api/inventory", (req, res) => {
  const data = req.body;

  inventories[data.name] = data;

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

  res.json(data);
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

  const slots = Array.from({ length: 36 }, (_, i) => {
    const item = data.inventory.find(x => x.slot === i);

    return `
      <div class="slot">
        ${
          item
            ? `
          <div class="item">
            ${item.type.replaceAll("_", " ")}
          </div>

          <div class="amount">
            ${item.amount}
          </div>
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
          box-shadow:
            inset 3px 3px #fff,
            inset -3px -3px #777;
        }

        .title {
          color: #222;
          font-weight: bold;
          margin-bottom: 10px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(9, 54px);
          gap: 4px;
        }

        .slot {
          width: 54px;
          height: 54px;
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
          padding-top: 8px;
          text-shadow: 1px 1px #000;
        }

        .amount {
          position: absolute;
          right: 4px;
          bottom: 2px;
          font-weight: bold;
          font-size: 12px;
          text-shadow: 1px 1px #000;
        }
      </style>
    </head>

    <body>
      <h1>${data.name}'s Inventory</h1>

      <div class="container">

        <img
          class="skin"
          src="https://mc-heads.net/body/${data.name}/180"
          alt="${data.name}"
        />

        <div class="inventory">
          <div class="title">Inventory</div>

          <div class="grid">
            ${slots}
          </div>
        </div>

      </div>
    </body>
    </html>
  `);
});

app.listen(3000, () => {
  console.log("Inventory API running on http://localhost:3000");
});