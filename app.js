// Game configuration constants
const CONFIG = {
    CANVAS_WIDTH: 1024,
    CANVAS_HEIGHT: 576,
    MOVE_SPEED: 3,
    MAP_OFFSET: { x: -730, y: -620 },
    TILES_PER_ROW: 70,
    COLLISION_TILE_ID: 1025,
    ENCOUNTER_RATE: 0.01,
    PLAYER_FRAMES: 4,
    PLAYER_SPRITE_WIDTH: 192,
    PLAYER_SPRITE_HEIGHT: 68,
    ZOOM: 0.75,
}

const canvas = document.querySelector("canvas")
const context = canvas.getContext("2d")
canvas.width = CONFIG.CANVAS_WIDTH
canvas.height = CONFIG.CANVAS_HEIGHT

context.fillStyle = "white"
context.fillRect(0, 0, canvas.width, canvas.height)

const collisions = data.layers[8].data
let collisionsMap = []

const battleZoneData = data.layers[9].data
let battleZoneMap= []

for(let i = 0; i < collisions.length; i += CONFIG.TILES_PER_ROW) {
    collisionsMap.push(collisions.slice(i, CONFIG.TILES_PER_ROW + i))
}

for(let i = 0; i < battleZoneData.length; i += CONFIG.TILES_PER_ROW) {
    battleZoneMap.push(battleZoneData.slice(i, CONFIG.TILES_PER_ROW + i))
}


const boundaries = []
const offset = {
    x: CONFIG.MAP_OFFSET.x,
    y: CONFIG.MAP_OFFSET.y,
}

collisionsMap.forEach((row, i)=> {
    row.forEach((symbol, j) => {
        if(symbol === CONFIG.COLLISION_TILE_ID) {
            boundaries.push(new Boundary({
                position: {
                    x: j * Boundary.width + offset.x,
                    y: i * Boundary.height + offset.y,
                }
            }))
        }
    })
})

const battleZones = []

battleZoneMap.forEach((row, i)=> {
    row.forEach((symbol, j) => {
        if(symbol === CONFIG.COLLISION_TILE_ID) {
            battleZones.push(new Boundary({
                position: {
                    x: j * Boundary.width + offset.x,
                    y: i * Boundary.height + offset.y,
                }
            }))
        }
    })
})

function loadImage(src) {
    const img = new Image()
    img.src = src
    img.onerror = () => console.error(`Failed to load image: ${src}`)
    return img
}

const image = loadImage("./img/pelletTown.png")
const playerDownImage = loadImage("./img/playerDown.png")
const playerLeftImage = loadImage("./img/playerLeft.png")
const playerUpImage = loadImage("./img/playerUp.png")
const playerRightImage = loadImage("./img/playerRight.png")
const foregroundImage = loadImage("./img/foregroundObject.png")

const keys = {
    w: { pressed: false },
    a: { pressed: false },
    s: { pressed: false },
    d: { pressed: false },
}

const background = new Sprite({
    position: {
        x: offset.x,
        y: offset.y,
    },
    image: image,
})

const foreground = new Sprite({
    position: {
        x: offset.x,
        y: offset.y,
    },
    image: foregroundImage,
})


const player = new Sprite({
    position: {
        x: canvas.width / 2 - (CONFIG.PLAYER_SPRITE_WIDTH / CONFIG.PLAYER_FRAMES) / 2,
        y: canvas.height / 2 - CONFIG.PLAYER_SPRITE_HEIGHT / 2,
    },
    image: playerDownImage,
    frames: {
        max: CONFIG.PLAYER_FRAMES
    },
    sprites: {
        up: playerUpImage,
        left: playerLeftImage,
        down: playerDownImage,
        right: playerRightImage,
    }
})

function rectangularCollision({rectangle1, rectangle2}){
    return (
        rectangle1.position.x + rectangle1.width >= rectangle2.position.x &&
        rectangle1.position.x <= rectangle2.position.x + rectangle2.width &&
        rectangle1.position.y <= rectangle2.position.y + rectangle2.height &&
        rectangle1.position.y  + rectangle1.height >= rectangle2.position.y
    )
}

// Create NPCs from data
const npcs = NPC_DATA.map(npcData => new NPC({
    position: {
        x: npcData.tileX * Boundary.width + offset.x,
        y: npcData.tileY * Boundary.height + offset.y,
    },
    name: npcData.name,
    color: npcData.color,
    id: npcData.id,
    systemPrompt: npcData.systemPrompt,
}))

// Add NPC collision boundaries
const npcBoundaries = npcs.map(npc => new Boundary({
    position: { x: npc.position.x, y: npc.position.y }
}))
boundaries.push(...npcBoundaries)

const movables = [background, foreground, ...boundaries, ...battleZones, ...npcs]

const battle = {
    initiated: false
}

const dialogueBox = new DialogueBox()
const interactionManager = new InteractionManager(dialogueBox)

// Alert polling system
const ALERT_POLL_INTERVAL = 60000 // 60 seconds
let alertPollingTimer = null

async function checkAlerts() {
    try {
        const response = await fetch("/api/alerts")
        if (!response.ok) return

        const data = await response.json()
        const alerts = data.alerts || []

        for (const alert of alerts) {
            const npc = npcs.find(n => n.id === alert.npcId)
            if (npc && !npc.isApproaching && !npc.isReturning && !dialogueBox.active) {
                npc.startApproach(alert.message, alert.priority)
            }
        }
    } catch (err) {
        console.error("Alert polling failed:", err)
    }
}

// Start polling after a short delay
setTimeout(() => {
    checkAlerts()
    alertPollingTimer = setInterval(checkAlerts, ALERT_POLL_INTERVAL)
}, 3000)

let lastTimestamp = 0

function animate(timestamp = 0) {
    window.requestAnimationFrame(animate)

    const deltaTime = timestamp - lastTimestamp
    lastTimestamp = timestamp

    context.save()
    context.translate(canvas.width / 2, canvas.height / 2)
    context.scale(CONFIG.ZOOM, CONFIG.ZOOM)
    context.translate(-canvas.width / 2, -canvas.height / 2)

    background.draw(deltaTime)
    boundaries.forEach(boundary => {
        boundary.draw()
    })
    battleZones.forEach(battleZone => {
        battleZone.draw()
    })
    npcs.forEach(npc => {
        // Update NPC movement (approaching player or returning home)
        const moveResult = npc.updateMovement(player.position)
        if (moveResult === "arrived" && npc.alertMessage && !dialogueBox.active) {
            dialogueBox.open(npc.name, npc.alertMessage)
            npc.alertMessage = null
            npc.alertPriority = null
            // NPC will return home when dialogue closes
            npc._pendingReturn = true
        }

        npc.showIndicator = npc.isPlayerInRange(player.position)
        npc.draw(deltaTime)
    })
    player.draw(deltaTime)
    foreground.draw(deltaTime)

    context.restore()

    // Draw dialogue in screen-space (after restore, unaffected by zoom)
    dialogueBox.update(deltaTime)
    dialogueBox.draw(context, canvas.width, canvas.height)

    let moving = true
    player.moving = false

    if(battle.initiated) return
    if(dialogueBox.active) return

    if(keys.w.pressed || keys.a.pressed || keys.d.pressed || keys.s.pressed) {
        for (let i = 0; i < battleZones.length; i++) {
            let battleZone = battleZones[i]
            const overlapping = (Math.min(player.position.x + player.width, battleZone.position.x + battleZone.width) -
                Math.max(player.position.x, battleZone.position.x)) *
                (Math.min(player.position.y + player.height, battleZone.position.y + battleZone.height) -
                Math.max(player.position.y, battleZone.position.y))
            if(rectangularCollision({
                rectangle1: player,
                rectangle2: battleZone,
            }) &&
                overlapping >= (player.height * player.width) / 2 &&
                Math.random() < CONFIG.ENCOUNTER_RATE
            ) {
                battle.initiated = true
                break
            }
        }
    }
    // Build movement direction vector
    let dx = 0
    let dy = 0
    if (keys.w.pressed) dy -= 1
    if (keys.s.pressed) dy += 1
    if (keys.a.pressed) dx -= 1
    if (keys.d.pressed) dx += 1

    // Normalize diagonal speed so it doesn't feel faster
    if (dx !== 0 && dy !== 0) {
        const diag = Math.SQRT1_2
        dx *= diag
        dy *= diag
    }

    const moveX = dx * CONFIG.MOVE_SPEED
    const moveY = dy * CONFIG.MOVE_SPEED

    if (dx !== 0 || dy !== 0) {
        player.moving = true

        // Set sprite facing based on last pressed key
        if (lastKey === "w" || (dy < 0 && lastKey !== "a" && lastKey !== "d")) player.image = player.sprites.up
        else if (lastKey === "s" || (dy > 0 && lastKey !== "a" && lastKey !== "d")) player.image = player.sprites.down
        else if (lastKey === "a" || dx < 0) player.image = player.sprites.left
        else if (lastKey === "d" || dx > 0) player.image = player.sprites.right
    }

    // Check and apply horizontal movement
    if (moveX !== 0) {
        let canMoveX = true
        for (let i = 0; i < boundaries.length; i++) {
            let boundary = boundaries[i]
            if(rectangularCollision({
                rectangle1: player,
                rectangle2: {...boundary, position: {
                    x: boundary.position.x - moveX,
                    y: boundary.position.y,
                }},
            })) {
                canMoveX = false
                break;
            }
        }
        if (canMoveX) {
            movables.forEach(movable => {
                movable.position.x -= moveX
            })
            // Keep NPC home positions in sync with world scroll
            npcs.forEach(npc => { npc.homePosition.x -= moveX })
        }
    }

    // Check and apply vertical movement
    if (moveY !== 0) {
        let canMoveY = true
        for (let i = 0; i < boundaries.length; i++) {
            let boundary = boundaries[i]
            if(rectangularCollision({
                rectangle1: player,
                rectangle2: {...boundary, position: {
                    x: boundary.position.x,
                    y: boundary.position.y - moveY,
                }},
            })) {
                canMoveY = false
                break;
            }
        }
        if (canMoveY) {
            movables.forEach(movable => {
                movable.position.y -= moveY
            })
            // Keep NPC home positions in sync with world scroll
            npcs.forEach(npc => { npc.homePosition.y -= moveY })
        }
    }
}

animate()

let lastKey = ""
window.addEventListener("keydown", (e) => {
    // Handle NPC interaction with Enter
    if (e.key === "Enter") {
        if (dialogueBox.active) {
            if (!dialogueBox.isFullyDisplayed()) {
                dialogueBox.skipToEnd()
            } else {
                dialogueBox.close()
                // Return any approaching NPCs to their home position
                npcs.forEach(npc => {
                    if (npc._pendingReturn) {
                        npc.returnHome()
                        npc._pendingReturn = false
                    }
                })
            }
            return
        }
        // Check if near an NPC
        const nearbyNpc = npcs.find(npc => npc.isPlayerInRange(player.position))
        if (nearbyNpc) {
            interactionManager.interact(nearbyNpc)
        }
        return
    }

    switch (e.key) {
        case "w":
            keys.w.pressed = true
            lastKey = "w"
            break;
        case "a":
            keys.a.pressed = true
            lastKey = "a"
            break;
        case "s":
            keys.s.pressed = true
            lastKey = "s"
            break;
        case "d":
            keys.d.pressed = true
            lastKey = "d"
            break;
    }
})


window.addEventListener("keyup", (e) => {
    switch (e.key) {
        case "w":
            keys.w.pressed = false
            break;
        case "a":
            keys.a.pressed = false
            break;
        case "s":
            keys.s.pressed = false
            break;
        case "d":
            keys.d.pressed = false
            break;
    }
})
