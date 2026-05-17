const express = require("express");
const router = express.Router();

let entries = [];
let nextId = 1;

// GET /entries — list all entries
router.get("/", (req, res) => {
  res.json(entries);
});

// GET /entries/total — sum of all calories
router.get("/total", (req, res) => {
  const total = entries.reduce((sum, e) => sum + e.calories, 0);
  res.json({ total });
});

// POST /entries — add a new food entry
router.post("/", (req, res) => {
  const { name, calories } = req.body;
  if (!name || calories === undefined) {
    return res.status(400).json({ error: "name and calories are required" });
  }
  if (typeof calories !== "number" || calories < 0) {
    return res.status(400).json({ error: "calories must be a non-negative number" });
  }
  const entry = { id: nextId++, name, calories };
  entries.push(entry);
  res.status(201).json(entry);
});

// DELETE /entries/:id — remove an entry
router.delete("/:id", (req, res) => {
  const index = entries.findIndex((e) => e.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: "Entry not found" });
  entries.splice(index, 1);
  res.status(204).send();
});

module.exports = router;
