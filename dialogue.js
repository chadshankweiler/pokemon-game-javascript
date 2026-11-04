class DialogueBox {
    constructor() {
        this.active = false
        this.npcName = ""
        this.fullText = ""
        this.displayedText = ""
        this.charIndex = 0
        this.typewriterElapsed = 0
        this.typewriterSpeed = 30 // ms per character
        this.padding = 20
        this.boxHeight = 140
        this.lineHeight = 22
    }

    open(npcName, text) {
        this.active = true
        this.npcName = npcName
        this.fullText = text
        this.displayedText = ""
        this.charIndex = 0
        this.typewriterElapsed = 0
    }

    close() {
        this.active = false
        this.npcName = ""
        this.fullText = ""
        this.displayedText = ""
        this.charIndex = 0
    }

    update(deltaTime) {
        if (!this.active || this.charIndex >= this.fullText.length) return

        this.typewriterElapsed += deltaTime
        while (this.typewriterElapsed >= this.typewriterSpeed && this.charIndex < this.fullText.length) {
            this.typewriterElapsed -= this.typewriterSpeed
            this.charIndex++
            this.displayedText = this.fullText.slice(0, this.charIndex)
        }
    }

    isFullyDisplayed() {
        return this.charIndex >= this.fullText.length
    }

    skipToEnd() {
        this.charIndex = this.fullText.length
        this.displayedText = this.fullText
    }

    wrapText(ctx, text, maxWidth) {
        const words = text.split(" ")
        const lines = []
        let currentLine = ""

        for (const word of words) {
            const testLine = currentLine ? currentLine + " " + word : word
            if (ctx.measureText(testLine).width > maxWidth && currentLine) {
                lines.push(currentLine)
                currentLine = word
            } else {
                currentLine = testLine
            }
        }
        if (currentLine) lines.push(currentLine)
        return lines
    }

    draw(ctx, canvasWidth, canvasHeight) {
        if (!this.active) return

        const boxY = canvasHeight - this.boxHeight - 10
        const boxX = 10
        const boxWidth = canvasWidth - 20

        // Semi-transparent background
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)"
        ctx.beginPath()
        ctx.roundRect(boxX, boxY, boxWidth, this.boxHeight, 8)
        ctx.fill()

        // Border
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(boxX, boxY, boxWidth, this.boxHeight, 8)
        ctx.stroke()

        // NPC name tag
        ctx.font = "bold 14px monospace"
        ctx.fillStyle = "#f1c40f"
        ctx.fillText(this.npcName, boxX + this.padding, boxY + this.padding + 2)

        // Dialogue text
        ctx.font = "14px monospace"
        ctx.fillStyle = "white"
        const textX = boxX + this.padding
        const textY = boxY + this.padding + this.lineHeight + 4
        const maxWidth = boxWidth - this.padding * 2
        const lines = this.wrapText(ctx, this.displayedText, maxWidth)

        for (let i = 0; i < lines.length && i < 4; i++) {
            ctx.fillText(lines[i], textX, textY + i * this.lineHeight)
        }

        // "[Enter] to continue" hint
        if (this.isFullyDisplayed()) {
            ctx.font = "12px monospace"
            ctx.fillStyle = "rgba(255, 255, 255, 0.5)"
            ctx.textAlign = "right"
            ctx.fillText("[Enter] to close", boxX + boxWidth - this.padding, boxY + this.boxHeight - 12)
            ctx.textAlign = "start"
        }
    }
}
