import Anthropic from "@anthropic-ai/sdk"
import * as calendar from "./tools/calendar.js"
import * as tasks from "./tools/tasks.js"
import * as email from "./tools/email.js"
import * as notes from "./tools/notes.js"
import * as finance from "./tools/finance.js"
import * as vault from "./tools/vault.js"

const anthropic = new Anthropic()

// Compose domain tools with shared vault tools for each NPC
function composeToolSet(domainModule) {
    const domainToolNames = new Set(domainModule.tools.map(t => t.name))
    return {
        tools: [...domainModule.tools, ...vault.tools],
        executeToolCall(toolName, toolInput) {
            if (domainToolNames.has(toolName)) {
                return domainModule.executeToolCall(toolName, toolInput)
            }
            return vault.executeToolCall(toolName, toolInput)
        },
        checkAlerts: domainModule.checkAlerts,
    }
}

// Tool registry — maps NPC IDs to their tool sets
const toolRegistry = {
    "prof-oak": composeToolSet(calendar),
    "nurse-joy": composeToolSet(tasks),
    "bill": composeToolSet(email),
    "copycat": composeToolSet(notes),
    "meowth": composeToolSet(finance),
}

// In-memory TTL cache for read-only tool results (30s)
const toolCache = new Map()
const CACHE_TTL = 30000
const READ_ONLY_TOOLS = new Set([
    "get_todays_events", "get_upcoming_events", "find_free_time",
    "get_tasks", "get_overdue_tasks",
    "get_unread_emails", "get_email_summary", "search_emails",
    "search_notes", "list_recent_notes",
    "get_spending_summary", "check_budget",
    "search_vault", "read_vault_note",
])

function getCached(key) {
    const entry = toolCache.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.time > CACHE_TTL) {
        toolCache.delete(key)
        return undefined
    }
    return entry.value
}

function setCache(key, value) {
    toolCache.set(key, { value, time: Date.now() })
}

export async function chat({ npcId, systemPrompt, message, history = [], model = "claude-sonnet-4-20250514" }) {
    const toolSet = toolRegistry[npcId]
    if (!toolSet) {
        return "This NPC doesn't have any tools configured."
    }

    const messages = [
        ...history,
        { role: "user", content: message },
    ]

    let response = await anthropic.messages.create({
        model,
        max_tokens: 300,
        system: systemPrompt,
        tools: toolSet.tools,
        messages,
    })

    // Tool use loop — keep going until Claude gives a text response
    while (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(b => b.type === "tool_use")
        const toolResults = []

        for (const toolUse of toolUseBlocks) {
            let result
            try {
                const cacheKey = `${npcId}-${toolUse.name}-${JSON.stringify(toolUse.input)}`
                if (READ_ONLY_TOOLS.has(toolUse.name)) {
                    const cached = getCached(cacheKey)
                    if (cached !== undefined) {
                        result = cached
                    } else {
                        result = await toolSet.executeToolCall(toolUse.name, toolUse.input)
                        setCache(cacheKey, result)
                    }
                } else {
                    result = await toolSet.executeToolCall(toolUse.name, toolUse.input)
                }
            } catch (err) {
                console.error(`Tool ${toolUse.name} failed:`, err.message)
                result = `Error: ${err.message}`
            }
            toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: result,
            })
        }

        messages.push({ role: "assistant", content: response.content })
        messages.push({ role: "user", content: toolResults })

        response = await anthropic.messages.create({
            model,
            max_tokens: 300,
            system: systemPrompt,
            tools: toolSet.tools,
            messages,
        })
    }

    const textBlock = response.content.find(b => b.type === "text")
    return textBlock ? textBlock.text : "..."
}

// Haiku-powered alert helper — use for future alert logic that needs LLM interpretation
export async function checkAlertWithLLM(prompt) {
    const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
    })
    const textBlock = response.content.find(b => b.type === "text")
    return textBlock ? textBlock.text : null
}

// Check all NPCs for alerts
export async function checkAllAlerts() {
    const alerts = []

    for (const [npcId, toolSet] of Object.entries(toolRegistry)) {
        try {
            const alert = await toolSet.checkAlerts()
            if (alert) alerts.push(alert)
        } catch (err) {
            console.error(`Alert check failed for ${npcId}:`, err.message)
        }
    }

    return alerts
}
