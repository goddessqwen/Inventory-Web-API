const express = require("express");

const app = express();
const PORT = 3000;
const API_KEY = "change-this-secret-key";

app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => {
  res.send(`
    <h1>Inventory Web API is running</h1>
    <p>POST player inventory to <code>/api/inventory</code></p>
  `);
});

app.post("/api/inventory", (req, res) => {
  const apiKey = req.header("X-API-Key");

  if (apiKey !== API_KEY) {
    return res.status(401).json({
      success: false,
      message: "Invalid API key"
    });
  }

  console.log("Inventory received:");
  console.log(JSON.stringify(req.body, null, 2));

  res.json({
    success: true,
    message: "Inventory received"
  });
});

app.listen(PORT, () => {
  console.log(`Inventory API running on http://localhost:${PORT}`);
});
