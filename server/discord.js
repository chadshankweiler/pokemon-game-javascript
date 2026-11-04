import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from "discord.js"
import { chat, checkAllAlerts } from "./claude.js"

// NPC metadata for Discord — mirrors data/npcs.js
const NPC_MAP = {
    "prof-oak": {
        name: "Prof. Oak",
        color: 0xe74c3c,
        emoji: "🔴",
        description: "Calendar & scheduling",
        systemPrompt: `You are Professor Oak, a friendly Pokemon professor who also happens to be the user's personal assistant. You have access to their Google Calendar. You can also search and read the user's personal notes vault for relevant context using search_vault and read_vault_note. Stay in character as a warm, knowledgeable professor while helping with real-world scheduling tasks. Keep responses concise (2-3 sentences) since they appear in Discord messages.`,
    },
    "nurse-joy": {
        name: "Nurse Joy",
        color: 0xe91e8f,
        emoji: "🩷",
        description: "Tasks & reminders",
        systemPrompt: `You are Nurse Joy from the Pokemon Center, but you also serve as the player's personal task manager and accountability partner. You have access to their Google Tasks. You can also search and read the user's personal notes vault for relevant context using search_vault and read_vault_note. Stay in character as a caring, encouraging nurse who genuinely wants to help them stay on top of things. Be warm but firm about overdue tasks. Keep responses concise (2-3 sentences) since they appear in Discord messages.`,
    },
    "bill": {
        name: "Bill",
        color: 0x3498db,
        emoji: "🔵",
        description: "Email & messages",
        systemPrompt: `You are Bill, the nerdy Pokemon Storage System inventor, but you also manage the player's email. You have access to their Gmail. You can also search and read the user's personal notes vault for relevant context using search_vault and read_vault_note. Stay in character as a tech-savvy, slightly awkward genius who speaks concisely and gets straight to the point. Keep responses concise (2-3 sentences) since they appear in Discord messages. When drafting replies, always mention it's saved as a draft for their review.`,
    },
    "copycat": {
        name: "Copycat",
        color: 0x2ecc71,
        emoji: "🟢",
        description: "Notes & knowledge",
        systemPrompt: `You are Copycat, the quirky girl from Saffron City who loves to mimic others, but you also serve as the player's personal note-taking assistant. You have access to a notes system where you can save, search, and organize their notes. You can also search and read the user's personal notes vault for relevant context using search_vault and read_vault_note. Use search_notes for your quick notes and search_vault for the user's full Obsidian knowledge base. Stay in character as playful and slightly eccentric. Keep responses concise (2-3 sentences) since they appear in Discord messages.`,
    },
    "meowth": {
        name: "Meowth",
        color: 0xf1c40f,
        emoji: "🪙",
        description: "Finance & budgets",
        systemPrompt: `You are Meowth, the fast-talking, money-obsessed Pokemon who learned to speak human. You're the player's personal finance tracker. You love coins and keeping careful count of every penny — it's your Pay Day every day! You can also search and read the user's personal notes vault for relevant context using search_vault and read_vault_note. Be witty and street-smart while helping with real money management. Keep responses concise (2-3 sentences) since they appear in Discord messages.`,
    },
}

// Per-user conversation history (keyed by `${userId}-${npcId}`)
const conversationHistory = {}

function getHistory(userId, npcId) {
    const key = `${userId}-${npcId}`
    if (!conversationHistory[key]) conversationHistory[key] = []
    return conversationHistory[key]
}

function addToHistory(userId, npcId, userMsg, assistantMsg) {
    const history = getHistory(userId, npcId)
    history.push(
        { role: "user", content: userMsg },
        { role: "assistant", content: assistantMsg },
    )
    // Keep history reasonable — last 20 messages
    if (history.length > 20) {
        conversationHistory[`${userId}-${npcId}`] = history.slice(-20)
    }
}

// Build slash commands
const commands = [
    new SlashCommandBuilder()
        .setName("oak")
        .setDescription("Talk to Prof. Oak about your calendar & schedule")
        .addStringOption(opt =>
            opt.setName("message").setDescription("What to say to Prof. Oak").setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName("joy")
        .setDescription("Talk to Nurse Joy about your tasks & reminders")
        .addStringOption(opt =>
            opt.setName("message").setDescription("What to say to Nurse Joy").setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName("bill")
        .setDescription("Talk to Bill about your email")
        .addStringOption(opt =>
            opt.setName("message").setDescription("What to say to Bill").setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName("copycat")
        .setDescription("Talk to Copycat about your notes")
        .addStringOption(opt =>
            opt.setName("message").setDescription("What to say to Copycat").setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName("meowth")
        .setDescription("Talk to Meowth about your finances & budget")
        .addStringOption(opt =>
            opt.setName("message").setDescription("What to say to Meowth").setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName("alerts")
        .setDescription("Check all NPCs for pending alerts right now"),
]

const COMMAND_TO_NPC = {
    oak: "prof-oak",
    joy: "nurse-joy",
    bill: "bill",
    copycat: "copycat",
    meowth: "meowth",
}

let client = null
let alertChannelId = null

export async function startDiscordBot() {
    const token = process.env.DISCORD_BOT_TOKEN
    const appId = process.env.DISCORD_APP_ID
    alertChannelId = process.env.DISCORD_ALERT_CHANNEL_ID

    if (!token || !appId) {
        console.log("Discord bot disabled — set DISCORD_BOT_TOKEN and DISCORD_APP_ID to enable")
        return
    }

    // Register slash commands
    const rest = new REST().setToken(token)
    try {
        console.log("Registering Discord slash commands...")
        await rest.put(Routes.applicationCommands(appId), {
            body: commands.map(c => c.toJSON()),
        })
        console.log("Discord slash commands registered")
    } catch (err) {
        console.error("Failed to register Discord commands:", err.message)
    }

    // Create and start client
    client = new Client({
        intents: [GatewayIntentBits.Guilds],
    })

    client.on("ready", () => {
        console.log(`Discord bot online as ${client.user.tag}`)

        // Start alert polling if channel is configured
        if (alertChannelId) {
            console.log(`Discord alerts will be sent to channel ${alertChannelId}`)
            setInterval(pollAndSendAlerts, 60000)
            // Initial check after 10s
            setTimeout(pollAndSendAlerts, 10000)
        }
    })

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isChatInputCommand()) return

        // Handle /alerts command
        if (interaction.commandName === "alerts") {
            await interaction.deferReply()
            try {
                const alerts = await checkAllAlerts()
                if (alerts.length === 0) {
                    await interaction.editReply("All clear! No pending alerts from any NPC.")
                    return
                }
                const embeds = alerts.map(alert => {
                    const npc = NPC_MAP[alert.npcId]
                    return new EmbedBuilder()
                        .setTitle(`${npc.emoji} ${npc.name}`)
                        .setDescription(alert.message)
                        .setColor(npc.color)
                        .setFooter({ text: alert.priority === "urgent" ? "⚠️ URGENT" : "Normal priority" })
                })
                await interaction.editReply({ embeds })
            } catch (err) {
                console.error("Discord alerts command failed:", err.message)
                await interaction.editReply("Failed to check alerts. Try again later.")
            }
            return
        }

        // Handle NPC chat commands
        const npcId = COMMAND_TO_NPC[interaction.commandName]
        if (!npcId) return

        const npc = NPC_MAP[npcId]
        const message = interaction.options.getString("message")
        const userId = interaction.user.id

        await interaction.deferReply()

        try {
            const history = getHistory(userId, npcId)
            const reply = await chat({
                npcId,
                systemPrompt: npc.systemPrompt,
                message,
                history,
            })

            addToHistory(userId, npcId, message, reply)

            const embed = new EmbedBuilder()
                .setTitle(`${npc.emoji} ${npc.name}`)
                .setDescription(reply)
                .setColor(npc.color)
                .setFooter({ text: npc.description })

            await interaction.editReply({ embeds: [embed] })
        } catch (err) {
            console.error(`Discord NPC chat failed (${npcId}):`, err.message)
            await interaction.editReply(`${npc.name} is having trouble right now. Try again later!`)
        }
    })

    await client.login(token)
}

// Poll for alerts and send to Discord channel
async function pollAndSendAlerts() {
    if (!client || !alertChannelId) return

    try {
        const alerts = await checkAllAlerts()
        if (alerts.length === 0) return

        const channel = await client.channels.fetch(alertChannelId)
        if (!channel) return

        for (const alert of alerts) {
            const npc = NPC_MAP[alert.npcId]
            const embed = new EmbedBuilder()
                .setTitle(`${npc.emoji} ${npc.name} — Alert!`)
                .setDescription(alert.message)
                .setColor(alert.priority === "urgent" ? 0xe74c3c : npc.color)
                .setTimestamp()
                .setFooter({ text: alert.priority === "urgent" ? "⚠️ URGENT" : "Heads up" })

            await channel.send({ embeds: [embed] })
        }
    } catch (err) {
        console.error("Discord alert polling failed:", err.message)
    }
}

// Send a one-off message to the alert channel (callable from other modules)
export async function sendToDiscord(npcId, message) {
    if (!client || !alertChannelId) return

    try {
        const channel = await client.channels.fetch(alertChannelId)
        if (!channel) return

        const npc = NPC_MAP[npcId]
        const embed = new EmbedBuilder()
            .setTitle(`${npc.emoji} ${npc.name}`)
            .setDescription(message)
            .setColor(npc.color)
            .setTimestamp()

        await channel.send({ embeds: [embed] })
    } catch (err) {
        console.error("Failed to send Discord message:", err.message)
    }
}
