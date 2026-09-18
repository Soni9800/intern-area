const express = require("express");
const router = express.Router();

const Job = require("../Model/Job");

router.post("/", async (req, res) => {
  const perks = Array.isArray(req.body.perks)
    ? req.body.perks
    : typeof req.body.perks === "string"
      ? req.body.perks.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

  const createdBy = String(
    req.body.createdBy || req.body.accountId || req.body.userId || req.body.adminUsername || req.body.created_by || ""
  ).trim();

  const jobdata = new Job({
    title: req.body.title,
    company: req.body.company,
    location: req.body.location,
    Experience: req.body.Experience,
    category: req.body.category,
    aboutCompany: req.body.aboutCompany,
    aboutJob: req.body.aboutJob,
    whoCanApply: req.body.whoCanApply,
    perks,
    AdditionalInfo: req.body.AdditionalInfo,
    CTC: req.body.CTC,
    StartDate: req.body.StartDate,
    createdBy: createdBy || undefined,
  });

  try {
    const data = await jobdata.save();
    res.status(201).json(data);
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: "Failed to create job", error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const query = {};
    const createdBy = String(req.query.createdBy || "").trim();
    if (createdBy) query.createdBy = createdBy;

    const data = await Job.find(query).sort({ createAt: -1 });
    res.json(data).status(200);
  } catch (error) {
    console.log(error);
    res.status(404).json({ error: "internal server error" });
  }
});
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Job.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "job not found" });
    }
    return res.json({ success: true, message: "Job deleted" });
  } catch (error) {
    console.log(error);
    return res.status(400).json({ error: "Unable to delete job" });
  }
});
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await Job.findById(id);
    if (!data) {
      res.status(404).json({ error: "Jobs not found" });
    }
    res.json(data).status(200);
  } catch (error) {
    console.log(error);
    res.status(404).json({ error: "internal server error" });
  }
});
module.exports=router