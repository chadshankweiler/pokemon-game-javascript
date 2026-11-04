import { google } from "googleapis"

function getTasksClient() {
    const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
    )
    auth.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    })
    return google.tasks({ version: "v1", auth })
}

export const tools = [
    {
        name: "get_tasks",
        description: "Get the user's current tasks from their task list",
        input_schema: {
            type: "object",
            properties: {
                maxResults: {
                    type: "number",
                    description: "Maximum number of tasks to return (default 10)",
                },
            },
            required: [],
        },
    },
    {
        name: "add_task",
        description: "Add a new task to the user's task list",
        input_schema: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    description: "The task title",
                },
                notes: {
                    type: "string",
                    description: "Optional notes/details for the task",
                },
                due: {
                    type: "string",
                    description: "Optional due date in YYYY-MM-DD format",
                },
            },
            required: ["title"],
        },
    },
    {
        name: "complete_task",
        description: "Mark a task as completed by its title (finds the first matching task)",
        input_schema: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    description: "The title of the task to complete (partial match)",
                },
            },
            required: ["title"],
        },
    },
    {
        name: "get_overdue_tasks",
        description: "Get all tasks that are past their due date",
        input_schema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
]

function formatTask(task) {
    const status = task.status === "completed" ? "[done]" : "[  ]"
    const due = task.due ? ` (due: ${task.due.split("T")[0]})` : ""
    return `${status} ${task.title}${due}`
}

export async function executeToolCall(toolName, toolInput) {
    const tasksClient = getTasksClient()

    switch (toolName) {
        case "get_tasks": {
            const maxResults = toolInput.maxResults || 10
            const res = await tasksClient.tasks.list({
                tasklist: "@default",
                maxResults,
                showCompleted: false,
            })

            const tasks = res.data.items || []
            if (tasks.length === 0) return "No tasks found. Your task list is empty!"
            return tasks.map(formatTask).join("\n")
        }

        case "add_task": {
            const { title, notes, due } = toolInput
            const resource = { title }
            if (notes) resource.notes = notes
            if (due) resource.due = `${due}T00:00:00.000Z`

            const res = await tasksClient.tasks.insert({
                tasklist: "@default",
                resource,
            })

            return `Task added: "${res.data.title}"${due ? ` (due: ${due})` : ""}`
        }

        case "complete_task": {
            const { title } = toolInput
            const res = await tasksClient.tasks.list({
                tasklist: "@default",
                showCompleted: false,
            })

            const tasks = res.data.items || []
            const match = tasks.find(t =>
                t.title.toLowerCase().includes(title.toLowerCase())
            )

            if (!match) return `No task found matching "${title}"`

            await tasksClient.tasks.update({
                tasklist: "@default",
                task: match.id,
                resource: { ...match, status: "completed" },
            })

            return `Completed: "${match.title}"`
        }

        case "get_overdue_tasks": {
            const res = await tasksClient.tasks.list({
                tasklist: "@default",
                showCompleted: false,
                dueMax: new Date().toISOString(),
            })

            const tasks = res.data.items || []
            if (tasks.length === 0) return "No overdue tasks. You're all caught up!"
            return `Overdue tasks:\n${tasks.map(formatTask).join("\n")}`
        }

        default:
            return `Unknown tool: ${toolName}`
    }
}

// Check for overdue tasks (for alerts)
export async function checkAlerts() {
    try {
        const tasksClient = getTasksClient()
        const res = await tasksClient.tasks.list({
            tasklist: "@default",
            showCompleted: false,
            dueMax: new Date().toISOString(),
        })

        const tasks = res.data.items || []
        if (tasks.length === 0) return null

        return {
            npcId: "nurse-joy",
            message: `Trainer! You have ${tasks.length} overdue task${tasks.length > 1 ? "s" : ""}! Come talk to me so we can get you back on track!`,
            priority: tasks.length >= 3 ? "urgent" : "normal",
        }
    } catch (err) {
        console.error("Tasks alert check failed:", err.message)
        return null
    }
}
