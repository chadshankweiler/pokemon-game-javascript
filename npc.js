class NPC {
    static SIZE = 48
    static INTERACTION_RANGE = 60
    static APPROACH_SPEED = 1.5

    constructor({ position, name, color, id, systemPrompt }) {
        this.position = position
        this.width = NPC.SIZE
        this.height = NPC.SIZE
        this.name = name
        this.color = color
        this.id = id
        this.systemPrompt = systemPrompt
        this.showIndicator = false
        this.indicatorBob = 0

        // Movement/approach system
        this.homePosition = { x: position.x, y: position.y }
        this.isApproaching = false
        this.isReturning = false
        this.alertMessage = null
        this.alertPriority = null
    }

    draw(deltaTime = 16.67) {
        // Draw NPC body
        context.fillStyle = this.color
        context.fillRect(this.position.x, this.position.y, this.width, this.height)

        // Draw face details
        context.fillStyle = "white"
        context.fillRect(this.position.x + 12, this.position.y + 12, 8, 8)
        context.fillRect(this.position.x + 28, this.position.y + 12, 8, 8)
        context.fillStyle = "#333"
        context.fillRect(this.position.x + 14, this.position.y + 14, 4, 4)
        context.fillRect(this.position.x + 30, this.position.y + 14, 4, 4)

        // Draw indicator when player is nearby or when alerting
        if (this.showIndicator || this.isApproaching) {
            this.indicatorBob += deltaTime * 0.005
            const bobY = Math.sin(this.indicatorBob) * 3

            context.font = "bold 20px Arial"
            context.textAlign = "center"
            const indicatorX = this.position.x + this.width / 2
            const indicatorY = this.position.y - 8 + bobY

            if (this.isApproaching) {
                // Alert indicator — double "!!" for urgent
                const symbol = this.alertPriority === "urgent" ? "!!" : "!"
                context.fillStyle = this.alertPriority === "urgent" ? "#e74c3c" : "#f39c12"
                context.strokeStyle = "#333"
                context.lineWidth = 3
                context.strokeText(symbol, indicatorX, indicatorY)
                context.fillText(symbol, indicatorX, indicatorY)
            } else {
                context.fillStyle = "#f1c40f"
                context.strokeStyle = "#333"
                context.lineWidth = 3
                context.strokeText("!", indicatorX, indicatorY)
                context.fillText("!", indicatorX, indicatorY)
            }

            context.textAlign = "start"
        }
    }

    // Move NPC toward a target position, returns true when arrived
    moveToward(targetX, targetY) {
        const dx = targetX - this.position.x
        const dy = targetY - this.position.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < NPC.APPROACH_SPEED) {
            this.position.x = targetX
            this.position.y = targetY
            return true
        }

        this.position.x += (dx / dist) * NPC.APPROACH_SPEED
        this.position.y += (dy / dist) * NPC.APPROACH_SPEED
        return false
    }

    // Start approaching the player with an alert
    startApproach(message, priority) {
        this.isApproaching = true
        this.isReturning = false
        this.alertMessage = message
        this.alertPriority = priority
    }

    // Update movement each frame — call from animate loop
    updateMovement(playerPosition) {
        if (this.isApproaching) {
            // Move toward player's position (offset to stand nearby, not on top)
            const targetX = playerPosition.x - 60
            const targetY = playerPosition.y
            const arrived = this.moveToward(targetX, targetY)

            if (arrived || this.isPlayerInRange(playerPosition)) {
                this.isApproaching = false
                return "arrived" // Signal to auto-open dialogue
            }
        }

        if (this.isReturning) {
            const arrived = this.moveToward(this.homePosition.x, this.homePosition.y)
            if (arrived) {
                this.isReturning = false
            }
        }

        return null
    }

    // Start returning to home position after dialogue
    returnHome() {
        this.isReturning = true
        this.alertMessage = null
        this.alertPriority = null
    }

    isPlayerInRange(playerPosition) {
        const centerX = this.position.x + this.width / 2
        const centerY = this.position.y + this.height / 2
        const playerCenterX = playerPosition.x + 24
        const playerCenterY = playerPosition.y + 34
        const dx = centerX - playerCenterX
        const dy = centerY - playerCenterY
        return Math.sqrt(dx * dx + dy * dy) < NPC.INTERACTION_RANGE
    }
}
