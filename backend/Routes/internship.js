const express = require("express");
const router = express.Router();
const Internship = require("../Model/Internship");

router.post("/", async (req, res) => {
  const perks = Array.isArray(req.body.perks)
    ? req.body.perks
    : typeof req.body.perks === "string"
      ? req.body.perks.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

  const Internshipdata = new Internship({
    title: req.body.title,
    company: req.body.company,
    location: req.body.location,
    category: req.body.category,
    aboutCompany: req.body.aboutCompany,
    aboutInternship: req.body.aboutInternship,
    whoCanApply: req.body.whoCanApply,
    perks,
    numberOfOpening: req.body.numberOfOpening,
    stipend: req.body.stipend,
    startDate: req.body.startDate,
    additionalInfo: req.body.additionalInfo,
  });

  try {
    const data = await Internshipdata.save();
    res.status(201).json(data);
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: "Failed to create internship", error: error.message });
  }
});
router.get("/", async (req, res) => {
  try {
    const data = await Internship.find();
    res.json(data).status(200);
  } catch (error) {
    console.log(error);
    res.status(404).json({ error: "internal server error" });
  }
});
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Internship.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "internship not found" });
    }
    return res.json({ success: true, message: "Internship deleted" });
  } catch (error) {
    console.log(error);
    return res.status(400).json({ error: "Unable to delete internship" });
  }
});
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await Internship.findById(id);
    if (!data) {
      res.status(404).json({ error: "internship not found" });
    }
    res.json(data).status(200);
  } catch (error) {
    console.log(error);
    res.status(404).json({ error: "internal server error" });
  }
});
module.exports = router;