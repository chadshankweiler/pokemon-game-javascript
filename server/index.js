import "dotenv/config"
import express from "express"
import cors from "cors"
import path from "path"
import { fileURLToPath } from "url"
import { chat, checkAllAlerts } from "./claude.js"
import { startDiscordBot } from "./discord.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 8888

app.use(cors())
app.use(express.json())

// Serve static game files from project root
app.use(express.static(path.join(__dirname, "..")))

app.post("/api/npc/chat", async (req, res) => {
    const { npcId, npcName, systemPrompt, message, history } = req.body

    if (!npcId || !systemPrompt || !message) {
        return res.status(400).json({ error: "npcId, systemPrompt, and message are required" })
    }

    try {
        const reply = await chat({ npcId, systemPrompt, message, history })
        res.json({ reply })
    } catch (err) {
        console.error(`NPC chat error (${npcName}):`, err.message)
        res.status(500).json({ error: "Failed to get NPC response" })
    }
})

app.get("/api/alerts", async (req, res) => {
    try {
        const alerts = await checkAllAlerts()
        res.json({ alerts })
    } catch (err) {
        console.error("Alert check error:", err.message)
        res.status(500).json({ error: "Failed to check alerts" })
    }
})

app.listen(PORT, () => {
    console.log(`Game server running at http://localhost:${PORT}`)

    // Start Discord bot (non-blocking — failure won't crash the server)
    startDiscordBot().catch(err => {
        console.error("Discord bot failed to start:", err.message)
    })
})
