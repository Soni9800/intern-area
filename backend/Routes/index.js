const express = require("express");
const router = express.Router();
const admin = require("./admin");
const intern = require("./internship");
const job = require("./job");
const application=require("./application")
const language = require("./language");
const resume = require("./resume");
const passwordReset = require("./passwordReset");
const auth = require("./auth");
const social = require("./social");

router.use("/admin", admin);
router.use("/internship", intern);
router.use("/job", job);
router.use("/application", application);
router.use("/language", language);
router.use("/resume", resume);
router.use("/password-reset", passwordReset);
router.use("/auth", auth);
router.use("/social", social);


module.exports = router;