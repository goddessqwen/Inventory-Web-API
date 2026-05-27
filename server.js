const express = require("express");

const app = express();
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

app.get("/inventory/:name", (req, res) => {
  const name = req.params.name;
  const data = inventories[name];

  if (!data) {
    return res.send(`<h1>No inventory found for ${name}</h1>`);
  }

  const items = data.inventory.map(item => `
    <div style="border:1px solid #555;padding:10px;margin:5px;width:120px;">
      <strong>Slot ${item.slot}</strong><br>
      ${item.type}<br>
      x${item.amount}
    </div>
  `).join("");

  res.send(`
    <html>
      <body style="background:#111;color:white;font-family:Arial;">
        <h1>${data.name}'s Inventory</h1>
        <p>UUID: ${data.uuid}</p>
        <div style="display:flex;flex-wrap:wrap;">
          ${items}
        </div>
      </body>
    </html>
  `);
});

app.listen(3000, () => {
  console.log("Inventory API running on http://localhost:3000");
});