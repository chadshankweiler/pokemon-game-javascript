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

const movables = [background, foreground, ...boundaries, ...battleZones]

const battle = {
    initiated: false
}

let lastTimestamp = 0

function animate(timestamp = 0) {
    window.requestAnimationFrame(animate)

    const deltaTime = timestamp - lastTimestamp
    lastTimestamp = timestamp

    background.draw(deltaTime)
    boundaries.forEach(boundary => {
        boundary.draw()
    })
    battleZones.forEach(battleZone => {
        battleZone.draw()
    })
    player.draw(deltaTime)
    foreground.draw(deltaTime)

    let moving = true
    player.moving = false

    if(battle.initiated) return

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
    if (keys.w.pressed && lastKey === "w") {
        player.image = player.sprites.up
        player.moving = true
        for (let i = 0; i < boundaries.length; i++) {
            let boundary = boundaries[i]
            if(rectangularCollision({
                rectangle1: player,
                rectangle2: {...boundary, position: {
                    x: boundary.position.x,
                    y: boundary.position.y + CONFIG.MOVE_SPEED,
                }},
            })) {
                moving = false
                break;
            }
        }

        if (moving) {
            movables.forEach(movable => {
                movable.position.y += CONFIG.MOVE_SPEED
            })
        }
    }
    else if (keys.a.pressed && lastKey === "a") {
        player.image = player.sprites.left
        player.moving = true
        for (let i = 0; i < boundaries.length; i++) {
            let boundary = boundaries[i]
            if(rectangularCollision({
                rectangle1: player,
                rectangle2: {...boundary, position: {
                    x: boundary.position.x + CONFIG.MOVE_SPEED,
                    y: boundary.position.y,
                }},
            })) {
                moving = false
                break;
            }
        }

        if (moving) {
            movables.forEach(movable => {
                movable.position.x += CONFIG.MOVE_SPEED
            })
        }
    }
    else if (keys.s.pressed && lastKey === "s") {
        player.image = player.sprites.down
        player.moving = true
        for (let i = 0; i < boundaries.length; i++) {
            let boundary = boundaries[i]
            if(rectangularCollision({
                rectangle1: player,
                rectangle2: {...boundary, position: {
                    x: boundary.position.x,
                    y: boundary.position.y - CONFIG.MOVE_SPEED,
                }},
            })) {
                moving = false
                break;
            }
        }
        if (moving) {
            movables.forEach(movable => {
                movable.position.y -= CONFIG.MOVE_SPEED
            })
        }
    }
    else if (keys.d.pressed && lastKey === "d") {
        player.image = player.sprites.right
        player.moving = true
        for (let i = 0; i < boundaries.length; i++) {
            let boundary = boundaries[i]
            if(rectangularCollision({
                rectangle1: player,
                rectangle2: {...boundary, position: {
                    x: boundary.position.x - CONFIG.MOVE_SPEED,
                    y: boundary.position.y,
                }},
            })) {
                moving = false
                break;
            }
        }
        if (moving) {
            movables.forEach(movable => {
                movable.position.x -= CONFIG.MOVE_SPEED
            })
        }
    }
}

animate()

let lastKey = ""
window.addEventListener("keydown", (e) => {
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
