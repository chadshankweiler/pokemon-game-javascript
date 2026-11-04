import { readFileSync, writeFileSync, existsSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LEDGER_PATH = path.join(__dirname, "..", "data", "ledger.json")

function loadLedger() {
    if (!existsSync(LEDGER_PATH)) return { transactions: [], budgets: [] }
    const raw = readFileSync(LEDGER_PATH, "utf-8")
    return JSON.parse(raw)
}

function saveLedger(ledger) {
    writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2))
}

export const tools = [
    {
        name: "log_expense",
        description: "Log an expense transaction",
        input_schema: {
            type: "object",
            properties: {
                amount: {
                    type: "number",
                    description: "Expense amount in dollars",
                },
                category: {
                    type: "string",
                    description: "Expense category (e.g. food, transport, entertainment)",
                },
                description: {
                    type: "string",
                    description: "What the expense was for",
                },
                date: {
                    type: "string",
                    description: "Date of expense (YYYY-MM-DD), defaults to today",
                },
            },
            required: ["amount", "category", "description"],
        },
    },
    {
        name: "log_income",
        description: "Log an income transaction",
        input_schema: {
            type: "object",
            properties: {
                amount: {
                    type: "number",
                    description: "Income amount in dollars",
                },
                source: {
                    type: "string",
                    description: "Income source (e.g. salary, freelance, gift)",
                },
                description: {
                    type: "string",
                    description: "Description of the income",
                },
                date: {
                    type: "string",
                    description: "Date of income (YYYY-MM-DD), defaults to today",
                },
            },
            required: ["amount", "source", "description"],
        },
    },
    {
        name: "get_spending_summary",
        description: "Get a summary of spending for a given time period, optionally filtered by category",
        input_schema: {
            type: "object",
            properties: {
                period: {
                    type: "string",
                    enum: ["today", "this_week", "this_month"],
                    description: "Time period to summarize",
                },
                category: {
                    type: "string",
                    description: "Optional category filter",
                },
            },
            required: ["period"],
        },
    },
    {
        name: "set_budget",
        description: "Set a monthly budget limit for a category (use 'overall' for total budget)",
        input_schema: {
            type: "object",
            properties: {
                category: {
                    type: "string",
                    description: "Budget category (or 'overall' for total)",
                },
                monthly_limit: {
                    type: "number",
                    description: "Monthly budget limit in dollars",
                },
            },
            required: ["category", "monthly_limit"],
        },
    },
    {
        name: "check_budget",
        description: "Check current month spending against budgets, showing percentage used and remaining amount",
        input_schema: {
            type: "object",
            properties: {
                category: {
                    type: "string",
                    description: "Optional category to check (omit for all budgets)",
                },
            },
            required: [],
        },
    },
]

function getPeriodStart(period) {
    const now = new Date()
    switch (period) {
        case "today":
            return new Date(now.getFullYear(), now.getMonth(), now.getDate())
        case "this_week": {
            const day = now.getDay()
            const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday start
            return new Date(now.getFullYear(), now.getMonth(), diff)
        }
        case "this_month":
            return new Date(now.getFullYear(), now.getMonth(), 1)
        default:
            return new Date(now.getFullYear(), now.getMonth(), 1)
    }
}

function getMonthExpenses(ledger) {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    return ledger.transactions.filter(t =>
        t.type === "expense" && new Date(t.date) >= start
    )
}

export async function executeToolCall(toolName, toolInput) {
    switch (toolName) {
        case "log_expense": {
            const { amount, category, description, date } = toolInput
            const ledger = loadLedger()
            const transaction = {
                id: Date.now().toString(36),
                type: "expense",
                amount,
                category,
                description,
                date: date || new Date().toISOString().split("T")[0],
                createdAt: new Date().toISOString(),
            }
            ledger.transactions.push(transaction)
            saveLedger(ledger)
            return `Logged expense: $${amount.toFixed(2)} for ${description} [${category}]`
        }

        case "log_income": {
            const { amount, source, description, date } = toolInput
            const ledger = loadLedger()
            const transaction = {
                id: Date.now().toString(36),
                type: "income",
                amount,
                source,
                description,
                date: date || new Date().toISOString().split("T")[0],
                createdAt: new Date().toISOString(),
            }
            ledger.transactions.push(transaction)
            saveLedger(ledger)
            return `Logged income: $${amount.toFixed(2)} from ${source} — ${description}`
        }

        case "get_spending_summary": {
            const { period, category } = toolInput
            const ledger = loadLedger()
            const start = getPeriodStart(period)

            let expenses = ledger.transactions.filter(t =>
                t.type === "expense" && new Date(t.date) >= start
            )

            if (category) {
                expenses = expenses.filter(t =>
                    t.category.toLowerCase() === category.toLowerCase()
                )
            }

            if (expenses.length === 0) {
                return `No expenses found for ${period}${category ? ` in ${category}` : ""}.`
            }

            const total = expenses.reduce((sum, t) => sum + t.amount, 0)

            // Group by category
            const byCategory = {}
            for (const t of expenses) {
                byCategory[t.category] = (byCategory[t.category] || 0) + t.amount
            }

            const breakdown = Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amt]) => `  ${cat}: $${amt.toFixed(2)}`)
                .join("\n")

            return `Spending for ${period}${category ? ` (${category})` : ""}:\nTotal: $${total.toFixed(2)} across ${expenses.length} transaction(s)\n${breakdown}`
        }

        case "set_budget": {
            const { category, monthly_limit } = toolInput
            const ledger = loadLedger()
            const existing = ledger.budgets.findIndex(b =>
                b.category.toLowerCase() === category.toLowerCase()
            )

            const budget = {
                category,
                monthly_limit,
                updatedAt: new Date().toISOString(),
            }

            if (existing >= 0) {
                ledger.budgets[existing] = budget
            } else {
                ledger.budgets.push(budget)
            }

            saveLedger(ledger)
            return `Budget set: $${monthly_limit.toFixed(2)}/month for ${category}`
        }

        case "check_budget": {
            const { category } = toolInput
            const ledger = loadLedger()
            const monthExpenses = getMonthExpenses(ledger)

            let budgets = ledger.budgets
            if (category) {
                budgets = budgets.filter(b =>
                    b.category.toLowerCase() === category.toLowerCase()
                )
            }

            if (budgets.length === 0) {
                return category
                    ? `No budget set for "${category}". Use set_budget to create one.`
                    : "No budgets set yet. Use set_budget to create one."
            }

            const results = budgets.map(b => {
                let spent
                if (b.category.toLowerCase() === "overall") {
                    spent = monthExpenses.reduce((sum, t) => sum + t.amount, 0)
                } else {
                    spent = monthExpenses
                        .filter(t => t.category.toLowerCase() === b.category.toLowerCase())
                        .reduce((sum, t) => sum + t.amount, 0)
                }

                const pct = b.monthly_limit > 0 ? (spent / b.monthly_limit * 100) : 0
                const remaining = b.monthly_limit - spent
                const status = pct >= 100 ? "🚨 OVER BUDGET" : pct >= 80 ? "⚠️ Warning" : "✅ On track"

                return `${b.category}: $${spent.toFixed(2)} / $${b.monthly_limit.toFixed(2)} (${pct.toFixed(0)}%) — ${status}, $${remaining.toFixed(2)} remaining`
            })

            return results.join("\n")
        }

        default:
            return `Unknown tool: ${toolName}`
    }
}

export async function checkAlerts() {
    const ledger = loadLedger()
    if (ledger.budgets.length === 0) return null

    const monthExpenses = getMonthExpenses(ledger)
    const alerts = []

    for (const budget of ledger.budgets) {
        let spent
        if (budget.category.toLowerCase() === "overall") {
            spent = monthExpenses.reduce((sum, t) => sum + t.amount, 0)
        } else {
            spent = monthExpenses
                .filter(t => t.category.toLowerCase() === budget.category.toLowerCase())
                .reduce((sum, t) => sum + t.amount, 0)
        }

        const pct = budget.monthly_limit > 0 ? (spent / budget.monthly_limit * 100) : 0

        if (pct >= 100) {
            alerts.push({
                npcId: "meowth",
                priority: "urgent",
                message: `🚨 You've exceeded your ${budget.category} budget! Spent $${spent.toFixed(2)} of $${budget.monthly_limit.toFixed(2)} (${pct.toFixed(0)}%).`,
            })
        } else if (pct >= 80) {
            alerts.push({
                npcId: "meowth",
                priority: "normal",
                message: `⚠️ You're at ${pct.toFixed(0)}% of your ${budget.category} budget. Spent $${spent.toFixed(2)} of $${budget.monthly_limit.toFixed(2)}.`,
            })
        }
    }

    return alerts.length > 0 ? alerts[0] : null
}
