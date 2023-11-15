// Used to try and fix screen tearing
// https://carmencincotti.com/2022-12-19/how-to-render-a-webgpu-triangle-series-part-three-video/

//async function initialize () {
//    const gpu = navigator.gpu
//    if (!navigator.gpu) {
//        throw Error("WebGPU not supported.");
//    }
//
//    const adapter = await gpu.requestAdapter()
//    if (!adapter) {
//        throw Error("Couldn't request WebGPU adapter.");
//    }
//
//    const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
//
//    const device = await adapter.requestDevice()
//    context.configure({
//        device,
//        format: presentationFormat,
//    })
//    return device
//}

//const init = initialize() 

const canvas = document.querySelector("canvas")
const context = canvas.getContext("2d")
canvas.width = 1024
canvas.height = 576

context.fillStyle = "white"
context.fillRect(0, 0, canvas.width, canvas.height)

const collisions = data.layers[8].data
let collisionsMap = []

for(let i = 0; i < collisions.length; i += 70) {
    collisionsMap.push(collisions.slice(i, 70 + i))
}


const boundaries = []
const offset = {
    x: -730,
    y: -620,
}

collisionsMap.forEach((row, i)=> {
    row.forEach((symbol, j) => {
        if(symbol === 1025) {
            boundaries.push(new Boundary({
                position: {
                    x: j * Boundary.width + offset.x, 
                    y: i * Boundary.height + offset.y,
                }
            }))
        }
    })
})

const image = new Image()
image.src = "./img/pelletTown.png"

const playerDownImage = new Image()
playerDownImage.src = "./img/playerDown.png"

const playerLeftImage = new Image()
playerLeftImage.src = "./img/playerLeft.png"

const playerUpImage = new Image()
playerUpImage.src = "./img/playerUp.png"

const playerRightImage = new Image()
playerRightImage.src = "./img/playerRight.png"

const foregroundImage = new Image()
foregroundImage.src = "./img/foregroundObject.png"

const keys = {
    w: {
        pressed: false
    },
    a: {
        pressed: false
    },
    s: {
        pressed: false
    },
    d: {
        pressed: false
    },
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
        x: canvas.width / 2 - (192 / 4) / 2,
        y: canvas.height / 2 - 68 / 2,
    },
    image: playerDownImage,
    frames: {
        max: 4
    },
    sprites: {
        up: playerUpImage,
        left: playerLeftImage,
        down: playerDownImage,
        right: playerRightImage,
    }
})
console.log(player)
const testBoundary = new Boundary({
    position: {
        x: 400,
        y: 400,
    }
})

function rectangularCollision({rectangle1, rectangle2}){
    if (
        rectangle1.position.x + rectangle1.width >= rectangle2.position.x && 
        rectangle1.position.x <= rectangle2.position.x + rectangle2.width &&
        rectangle1.position.y <= rectangle2.position.y + rectangle2.height &&
        rectangle1.position.y  + rectangle1.height >= rectangle2.position.y
    ) {
        return true
    } else {
        return false
    }
}

const movables = [background, foreground, ...boundaries]

function animate() {
    window.requestAnimationFrame(animate)
    background.draw()
    boundaries.forEach(boundary => {
        boundary.draw()
    })
    player.draw()
    foreground.draw()

    let moving = true
    player.moving = false
    if (keys.w.pressed && lastKey === "w") {
        player.image = player.sprites.up
        player.moving = true
        for (let i = 0; i < boundaries.length; i++) {
            let boundary = boundaries[i]
            if(rectangularCollision({
                rectangle1: player, 
                rectangle2: {...boundary, position: {
                    x: boundary.position.x,
                    y: boundary.position.y + 3,
                }}, 
            })) {
                moving = false
                break;

            }
        }
        if (moving) {
            movables.forEach(movable => {
                movable.position.y += 3
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
                    x: boundary.position.x + 3,
                    y: boundary.position.y,
                }}, 
            })) {
                console.log("boundary")
                moving = false
                break;

            }
        }
        if (moving) {
        movables.forEach(movable => {
            movable.position.x += 3
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
                    y: boundary.position.y - 3,
                }}, 
            })) {
                console.log("boundary")
                moving = false
                break;

            }
        }
        if (moving) {
        movables.forEach(movable => {
            movable.position.y -= 3
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
                    x: boundary.position.x - 3,
                    y: boundary.position.y,
                }}, 
            })) {
                console.log("boundary")
                moving = false
                break;

            }
        }
        if (moving) {
        movables.forEach(movable => {
            movable.position.x -= 3
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
