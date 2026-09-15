const mongoose=require("mongoose")
const path = require("path")
require('dotenv').config({ path: path.join(__dirname, ".env") })
const database=process.env.DATABASE_URL
const url=database
module.exports.connect=()=>{
    if (!url) throw new Error("DATABASE_URL is missing from backend/.env")
    mongoose.connect(url).then(() => console.log("Database is connected")).catch((error) => console.error("Database connection failed:", error.message))
}