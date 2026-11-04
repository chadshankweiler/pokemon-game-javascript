import { readFileSync, writeFileSync, existsSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const NOTES_PATH = path.join(__dirname, "..", "data", "notes.json")

function loadNotes() {
    if (!existsSync(NOTES_PATH)) return []
    const raw = readFileSync(NOTES_PATH, "utf-8")
    return JSON.parse(raw)
}

function saveNotes(notes) {
    writeFileSync(NOTES_PATH, JSON.stringify(notes, null, 2))
}

export const tools = [
    {
        name: "save_note",
        description: "Save a new note with optional tags for organization",
        input_schema: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    description: "Note title",
                },
                content: {
                    type: "string",
                    description: "Note content",
                },
                tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional tags for categorization",
                },
            },
            required: ["title", "content"],
        },
    },
    {
        name: "search_notes",
        description: "Search notes by text (matches title, content, and tags)",
        input_schema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Search text to match against notes",
                },
            },
            required: ["query"],
        },
    },
    {
        name: "list_recent_notes",
        description: "List the most recent notes",
        input_schema: {
            type: "object",
            properties: {
                count: {
                    type: "number",
                    description: "Number of notes to list (default 5)",
                },
            },
            required: [],
        },
    },
    {
        name: "delete_note",
        description: "Delete a note by its title (first match)",
        input_schema: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    description: "Title of the note to delete",
                },
            },
            required: ["title"],
        },
    },
]

export async function executeToolCall(toolName, toolInput) {
    switch (toolName) {
        case "save_note": {
            const { title, content, tags = [] } = toolInput
            const notes = loadNotes()
            const note = {
                id: Date.now().toString(36),
                title,
                content,
                tags,
                createdAt: new Date().toISOString(),
            }
            notes.push(note)
            saveNotes(notes)
            return `Note saved: "${title}"${tags.length ? ` [${tags.join(", ")}]` : ""}`
        }

        case "search_notes": {
            const { query } = toolInput
            const notes = loadNotes()
            const q = query.toLowerCase()
            const matches = notes.filter(n =>
                n.title.toLowerCase().includes(q) ||
                n.content.toLowerCase().includes(q) ||
                n.tags.some(t => t.toLowerCase().includes(q))
            )

            if (matches.length === 0) return `No notes found matching "${query}"`
            return matches.map(n =>
                `[${n.title}] ${n.content.slice(0, 100)}${n.content.length > 100 ? "..." : ""}${n.tags.length ? ` (tags: ${n.tags.join(", ")})` : ""}`
            ).join("\n")
        }

        case "list_recent_notes": {
            const count = toolInput.count || 5
            const notes = loadNotes()
            const recent = notes.slice(-count).reverse()

            if (recent.length === 0) return "No notes saved yet!"
            return recent.map(n =>
                `[${n.title}] ${n.content.slice(0, 80)}${n.content.length > 80 ? "..." : ""}${n.tags.length ? ` (${n.tags.join(", ")})` : ""}`
            ).join("\n")
        }

        case "delete_note": {
            const { title } = toolInput
            const notes = loadNotes()
            const idx = notes.findIndex(n =>
                n.title.toLowerCase().includes(title.toLowerCase())
            )

            if (idx === -1) return `No note found matching "${title}"`

            const removed = notes.splice(idx, 1)[0]
            saveNotes(notes)
            return `Deleted note: "${removed.title}"`
        }

        default:
            return `Unknown tool: ${toolName}`
    }
}

// Notes don't generate proactive alerts
export async function checkAlerts() {
    return null
}
