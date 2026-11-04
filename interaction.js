class InteractionManager {
    constructor(dialogueBox) {
        this.dialogueBox = dialogueBox
        this.loading = false
        this.conversationHistory = {} // per NPC
    }

    async interact(npc) {
        if (this.loading) return

        this.loading = true
        this.dialogueBox.open(npc.name, "...")

        const history = this.conversationHistory[npc.id] || []
        const userMessage = history.length === 0
            ? "Hello! *the player walks up to you*"
            : "Hello again!"

        try {
            const response = await fetch("/api/npc/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    npcId: npc.id,
                    npcName: npc.name,
                    systemPrompt: npc.systemPrompt,
                    message: userMessage,
                    history: history,
                }),
            })

            if (!response.ok) throw new Error(`Server error: ${response.status}`)

            const data = await response.json()
            const reply = data.reply || "..."

            // Save to conversation history
            if (!this.conversationHistory[npc.id]) {
                this.conversationHistory[npc.id] = []
            }
            this.conversationHistory[npc.id].push(
                { role: "user", content: userMessage },
                { role: "assistant", content: reply }
            )

            this.dialogueBox.open(npc.name, reply)
        } catch (err) {
            console.error("NPC interaction failed:", err)
            this.dialogueBox.open(npc.name, "Hmm, I seem to be having trouble thinking right now. Try again later!")
        } finally {
            this.loading = false
        }
    }
}
