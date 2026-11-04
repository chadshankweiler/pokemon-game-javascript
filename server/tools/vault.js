import { readFileSync, readdirSync, statSync } from "fs"
import path from "path"

const VAULT_ROOT = process.env.OBSIDIAN_VAULT_PATH || "/Users/chad/Documents/notes/Notes"
const MAX_FILE_SIZE = 100 * 1024 // 100KB
const MAX_RESULTS = 15
const MAX_READ_CHARS = 4000

export const tools = [
    {
        name: "search_vault",
        description: "Search the user's Obsidian notes vault for text (case-insensitive). Returns matching file paths and line snippets.",
        input_schema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Text to search for in vault notes",
                },
                folder: {
                    type: "string",
                    description: "Optional subfolder to scope the search (e.g. 'school', 'daily-notes')",
                },
            },
            required: ["query"],
        },
    },
    {
        name: "read_vault_note",
        description: "Read a specific note from the user's Obsidian vault by relative path (e.g. 'school/c867/module-1.md'). Read-only.",
        input_schema: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Relative path to the .md file within the vault",
                },
            },
            required: ["path"],
        },
    },
]

function walkMdFiles(dir) {
    const results = []
    let entries
    try {
        entries = readdirSync(dir, { withFileTypes: true })
    } catch {
        return results
    }
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            results.push(...walkMdFiles(fullPath))
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
            try {
                const stat = statSync(fullPath)
                if (stat.size <= MAX_FILE_SIZE) {
                    results.push(fullPath)
                }
            } catch {
                // skip unreadable files
            }
        }
    }
    return results
}

export async function executeToolCall(toolName, toolInput) {
    switch (toolName) {
        case "search_vault": {
            const { query, folder } = toolInput
            const searchRoot = folder
                ? path.resolve(VAULT_ROOT, folder)
                : VAULT_ROOT

            // Path traversal guard for folder param
            if (!searchRoot.startsWith(VAULT_ROOT)) {
                return "Error: Invalid folder path."
            }

            const q = query.toLowerCase()
            const files = walkMdFiles(searchRoot)
            const matches = []

            for (const filePath of files) {
                if (matches.length >= MAX_RESULTS) break
                try {
                    const content = readFileSync(filePath, "utf-8")
                    const lines = content.split("\n")
                    for (const line of lines) {
                        if (line.toLowerCase().includes(q)) {
                            const relativePath = path.relative(VAULT_ROOT, filePath)
                            const snippet = line.trim().slice(0, 120)
                            matches.push(`${relativePath}: ${snippet}`)
                            break // one match per file
                        }
                    }
                } catch {
                    // skip unreadable files
                }
            }

            if (matches.length === 0) return `No vault notes found matching "${query}"`
            return matches.join("\n")
        }

        case "read_vault_note": {
            const notePath = toolInput.path
            const resolved = path.resolve(VAULT_ROOT, notePath)

            // Path traversal guard
            if (!resolved.startsWith(VAULT_ROOT)) {
                return "Error: Access denied — path is outside the vault."
            }

            try {
                const content = readFileSync(resolved, "utf-8")
                if (content.length > MAX_READ_CHARS) {
                    return content.slice(0, MAX_READ_CHARS) + "\n\n[Truncated — note is " + content.length + " chars total]"
                }
                return content
            } catch {
                return `Error: Could not read "${notePath}" — file may not exist.`
            }
        }

        default:
            return `Unknown tool: ${toolName}`
    }
}

// Vault is passive — no proactive alerts
export async function checkAlerts() {
    return null
}
