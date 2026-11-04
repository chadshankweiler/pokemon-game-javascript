import { google } from "googleapis"

function getGmailClient() {
    const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
    )
    auth.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    })
    return google.gmail({ version: "v1", auth })
}

export const tools = [
    {
        name: "get_unread_emails",
        description: "Get the user's most recent unread emails (up to 10)",
        input_schema: {
            type: "object",
            properties: {
                maxResults: {
                    type: "number",
                    description: "Maximum number of emails to return (default 10)",
                },
            },
            required: [],
        },
    },
    {
        name: "get_email_summary",
        description: "Get a summary of a specific email by its subject line (finds the first match)",
        input_schema: {
            type: "object",
            properties: {
                subject: {
                    type: "string",
                    description: "Subject line to search for (partial match)",
                },
            },
            required: ["subject"],
        },
    },
    {
        name: "search_emails",
        description: "Search emails using Gmail search syntax",
        input_schema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Gmail search query (e.g. 'from:boss@company.com', 'subject:meeting', 'is:important')",
                },
                maxResults: {
                    type: "number",
                    description: "Maximum number of results (default 5)",
                },
            },
            required: ["query"],
        },
    },
    {
        name: "draft_reply",
        description: "Create a draft reply to an email found by subject. Does NOT send — just saves as draft for review.",
        input_schema: {
            type: "object",
            properties: {
                subject: {
                    type: "string",
                    description: "Subject line of the email to reply to",
                },
                body: {
                    type: "string",
                    description: "The reply body text",
                },
            },
            required: ["subject", "body"],
        },
    },
]

function decodeHeader(headers, name) {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase())
    return header ? header.value : ""
}

function formatEmail(headers) {
    const from = decodeHeader(headers, "From")
    const subject = decodeHeader(headers, "Subject")
    const date = decodeHeader(headers, "Date")
    return `From: ${from}\nSubject: ${subject}\nDate: ${date}`
}

export async function executeToolCall(toolName, toolInput) {
    const gmail = getGmailClient()

    switch (toolName) {
        case "get_unread_emails": {
            const maxResults = toolInput.maxResults || 10
            const res = await gmail.users.messages.list({
                userId: "me",
                q: "is:unread",
                maxResults,
            })

            const messages = res.data.messages || []
            if (messages.length === 0) return "No unread emails!"

            const details = await Promise.all(
                messages.map(async (msg) => {
                    const detail = await gmail.users.messages.get({
                        userId: "me",
                        id: msg.id,
                        format: "metadata",
                        metadataHeaders: ["From", "Subject", "Date"],
                    })
                    return formatEmail(detail.data.payload.headers)
                })
            )

            return details.join("\n---\n")
        }

        case "get_email_summary": {
            const { subject } = toolInput
            const res = await gmail.users.messages.list({
                userId: "me",
                q: `subject:${subject}`,
                maxResults: 1,
            })

            const messages = res.data.messages || []
            if (messages.length === 0) return `No email found with subject matching "${subject}"`

            const detail = await gmail.users.messages.get({
                userId: "me",
                id: messages[0].id,
                format: "full",
            })

            const headers = detail.data.payload.headers
            const snippet = detail.data.snippet || ""
            return `${formatEmail(headers)}\n\nPreview: ${snippet}`
        }

        case "search_emails": {
            const { query, maxResults = 5 } = toolInput
            const res = await gmail.users.messages.list({
                userId: "me",
                q: query,
                maxResults,
            })

            const messages = res.data.messages || []
            if (messages.length === 0) return `No emails found for: "${query}"`

            const details = await Promise.all(
                messages.map(async (msg) => {
                    const detail = await gmail.users.messages.get({
                        userId: "me",
                        id: msg.id,
                        format: "metadata",
                        metadataHeaders: ["From", "Subject", "Date"],
                    })
                    return formatEmail(detail.data.payload.headers)
                })
            )

            return details.join("\n---\n")
        }

        case "draft_reply": {
            const { subject, body } = toolInput
            const res = await gmail.users.messages.list({
                userId: "me",
                q: `subject:${subject}`,
                maxResults: 1,
            })

            const messages = res.data.messages || []
            if (messages.length === 0) return `No email found with subject matching "${subject}"`

            const original = await gmail.users.messages.get({
                userId: "me",
                id: messages[0].id,
                format: "metadata",
                metadataHeaders: ["From", "Subject", "Message-ID"],
            })

            const headers = original.data.payload.headers
            const to = decodeHeader(headers, "From")
            const origSubject = decodeHeader(headers, "Subject")
            const messageId = decodeHeader(headers, "Message-ID")

            const replySubject = origSubject.startsWith("Re:") ? origSubject : `Re: ${origSubject}`
            const raw = [
                `To: ${to}`,
                `Subject: ${replySubject}`,
                `In-Reply-To: ${messageId}`,
                `References: ${messageId}`,
                `Content-Type: text/plain; charset="UTF-8"`,
                "",
                body,
            ].join("\r\n")

            const encoded = Buffer.from(raw).toString("base64url")

            await gmail.users.drafts.create({
                userId: "me",
                resource: {
                    message: {
                        raw: encoded,
                        threadId: messages[0].threadId,
                    },
                },
            })

            return `Draft reply created for "${origSubject}" to ${to}. Check your Gmail drafts to review and send.`
        }

        default:
            return `Unknown tool: ${toolName}`
    }
}

// Check for unread email count (for alerts)
export async function checkAlerts() {
    try {
        const gmail = getGmailClient()
        const res = await gmail.users.messages.list({
            userId: "me",
            q: "is:unread",
            maxResults: 1,
        })

        const total = res.data.resultSizeEstimate || 0
        if (total < 5) return null

        return {
            npcId: "bill",
            message: `Yo trainer! You've got ${total} unread emails piling up. Want me to give you a rundown?`,
            priority: total >= 20 ? "urgent" : "normal",
        }
    } catch (err) {
        console.error("Email alert check failed:", err.message)
        return null
    }
}
