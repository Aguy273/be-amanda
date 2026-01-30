const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")
const path = require("path")
const api = require("./api")
const exportRouter = require("./api/reports/exportRouter")

const app = express()

app.use(cors())
app.use(bodyParser.json())

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "../uploads")))

app.get("/", async (req, res) => {
  res.json({
    message: "Hello World from API",
  })
})

app.use("/api/v1", api)
app.use("/api/v1", exportRouter)

module.exports = app
