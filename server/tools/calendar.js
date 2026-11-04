import { google } from "googleapis"

function getCalendarClient() {
    const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
    )
    auth.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    })
    return google.calendar({ version: "v3", auth })
}

export const tools = [
    {
        name: "get_todays_events",
        description: "Get all events on the user's calendar for today",
        input_schema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "get_upcoming_events",
        description: "Get upcoming events on the user's calendar for the next N days",
        input_schema: {
            type: "object",
            properties: {
                days: {
                    type: "number",
                    description: "Number of days to look ahead (default 7)",
                },
            },
            required: [],
        },
    },
    {
        name: "find_free_time",
        description: "Find free time slots on the user's calendar for a given date",
        input_schema: {
            type: "object",
            properties: {
                date: {
                    type: "string",
                    description: "Date to check in YYYY-MM-DD format. Defaults to today.",
                },
            },
            required: [],
        },
    },
    {
        name: "create_event",
        description: "Create a new event on the user's calendar",
        input_schema: {
            type: "object",
            properties: {
                summary: {
                    type: "string",
                    description: "Event title",
                },
                date: {
                    type: "string",
                    description: "Date in YYYY-MM-DD format",
                },
                startTime: {
                    type: "string",
                    description: "Start time in HH:MM format (24h)",
                },
                endTime: {
                    type: "string",
                    description: "End time in HH:MM format (24h)",
                },
                description: {
                    type: "string",
                    description: "Optional event description",
                },
            },
            required: ["summary", "date", "startTime", "endTime"],
        },
    },
]

function formatEvent(event) {
    const start = event.start.dateTime || event.start.date
    const end = event.end.dateTime || event.end.date
    return `${event.summary || "(No title)"} — ${start} to ${end}`
}

export async function executeToolCall(toolName, toolInput) {
    const calendar = getCalendarClient()
    const now = new Date()

    switch (toolName) {
        case "get_todays_events": {
            const startOfDay = new Date(now)
            startOfDay.setHours(0, 0, 0, 0)
            const endOfDay = new Date(now)
            endOfDay.setHours(23, 59, 59, 999)

            const res = await calendar.events.list({
                calendarId: "primary",
                timeMin: startOfDay.toISOString(),
                timeMax: endOfDay.toISOString(),
                singleEvents: true,
                orderBy: "startTime",
            })

            const events = res.data.items || []
            if (events.length === 0) return "No events scheduled for today."
            return events.map(formatEvent).join("\n")
        }

        case "get_upcoming_events": {
            const days = toolInput.days || 7
            const endDate = new Date(now)
            endDate.setDate(endDate.getDate() + days)

            const res = await calendar.events.list({
                calendarId: "primary",
                timeMin: now.toISOString(),
                timeMax: endDate.toISOString(),
                singleEvents: true,
                orderBy: "startTime",
                maxResults: 20,
            })

            const events = res.data.items || []
            if (events.length === 0) return `No events in the next ${days} days.`
            return events.map(formatEvent).join("\n")
        }

        case "find_free_time": {
            const dateStr = toolInput.date || now.toISOString().split("T")[0]
            const dayStart = new Date(`${dateStr}T08:00:00`)
            const dayEnd = new Date(`${dateStr}T18:00:00`)

            const res = await calendar.events.list({
                calendarId: "primary",
                timeMin: dayStart.toISOString(),
                timeMax: dayEnd.toISOString(),
                singleEvents: true,
                orderBy: "startTime",
            })

            const events = res.data.items || []
            if (events.length === 0) return `${dateStr}: Completely free from 8 AM to 6 PM.`

            const busySlots = events.map(e => ({
                start: new Date(e.start.dateTime || e.start.date),
                end: new Date(e.end.dateTime || e.end.date),
            }))

            const freeSlots = []
            let cursor = dayStart

            for (const slot of busySlots) {
                if (cursor < slot.start) {
                    freeSlots.push(`${cursor.toTimeString().slice(0, 5)} - ${slot.start.toTimeString().slice(0, 5)}`)
                }
                if (slot.end > cursor) cursor = slot.end
            }
            if (cursor < dayEnd) {
                freeSlots.push(`${cursor.toTimeString().slice(0, 5)} - ${dayEnd.toTimeString().slice(0, 5)}`)
            }

            if (freeSlots.length === 0) return `${dateStr}: No free time between 8 AM and 6 PM.`
            return `Free slots on ${dateStr}:\n${freeSlots.join("\n")}`
        }

        case "create_event": {
            const { summary, date, startTime, endTime, description } = toolInput
            const res = await calendar.events.insert({
                calendarId: "primary",
                resource: {
                    summary,
                    description: description || "",
                    start: {
                        dateTime: `${date}T${startTime}:00`,
                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    },
                    end: {
                        dateTime: `${date}T${endTime}:00`,
                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    },
                },
            })

            return `Event created: "${res.data.summary}" on ${date} from ${startTime} to ${endTime}`
        }

        default:
            return `Unknown tool: ${toolName}`
    }
}

// Check for upcoming events in the next 15 minutes (for alerts)
export async function checkAlerts() {
    try {
        const calendar = getCalendarClient()
        const now = new Date()
        const soon = new Date(now.getTime() + 15 * 60 * 1000)

        const res = await calendar.events.list({
            calendarId: "primary",
            timeMin: now.toISOString(),
            timeMax: soon.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
        })

        const events = res.data.items || []
        if (events.length === 0) return null

        const event = events[0]
        const start = new Date(event.start.dateTime || event.start.date)
        const minutesUntil = Math.round((start - now) / 60000)

        return {
            npcId: "prof-oak",
            message: `Hey trainer! You have "${event.summary}" starting in ${minutesUntil} minutes!`,
            priority: minutesUntil <= 5 ? "urgent" : "normal",
        }
    } catch (err) {
        console.error("Calendar alert check failed:", err.message)
        return null
    }
}
