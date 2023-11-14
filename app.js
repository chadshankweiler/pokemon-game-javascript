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
let num = 0 
let collisionsMap = []

for(let i = 0; i < collisions.length; i += 70) {
    collisionsMap.push(collisions.slice(i, 70 + i))
}


class Boundary {
    static width = 48
    static height = 48
    constructor({position}){
        this.position = position
        this.width = 48
        this.height = 48
    }

    draw() {
        context.fillStyle = "red"
        context.fillRect(this.position.x, this.position.y, this.width, this.height)
    }
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

const playerImage = new Image()
playerImage.src = "./img/playerDown.png"

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

class Sprite {
    constructor({
        position,
        velocity,
        image,
        frames = { max: 1 },
        width
    }) {
        this.position = position
        this.image = image
        this.frames = frames
        this.image.onload = () => {
            this.width = this.image.width / this.frames.max 
            this.height = this.image.height 
            console.log("width",this.width)
            console.log("height",this.height)

        }
    }

    draw() {
        context.drawImage(this.image,

        // Cropping Player Image -> start x, start y, end x, end y
                0,
                0,
                this.image.width / this.frames.max,
                this.image.height,

        // Actual Display of Images from width and height

                this.position.x,
                this.position.y,
                this.image.width / this.frames.max,
                this.image.height,
    )
    }
}

const background = new Sprite({
    position: {
        x: offset.x,
        y: offset.y,
    },
    image: image,
})

const player = new Sprite({
    position: {
        x: canvas.width / 2 - (192 / 4) / 2,
        y: canvas.height / 2 - 68 / 2,
    },
    image: playerImage,
    frames: {
        max: 4
    },
})

const testBoundary = new Boundary({
    position: {
        x: 400,
        y: 400,
    }
})

const movables = [background, testBoundary]

function animate() {
    window.requestAnimationFrame(animate)
    background.draw()
    testBoundary.draw()
    player.draw()
//    boundaries.forEach(boundary => {
//        boundary.draw()
//    })

    if (player.position.x + player.width >= testBoundary.position.x && 
        player.position.x <= testBoundary.position.x + testBoundary.width &&
        player.position.y <= testBoundary.position.y + testBoundary.height &&
        player.position.y  + player.height >= testBoundary.position.y
        ) {
        console.log("hit")
    }

    if (keys.w.pressed && lastKey === "w") {
        movables.forEach(movable => {
            movable.position.y += 3
        })
    }
    else if (keys.a.pressed && lastKey === "a") {
        movables.forEach(movable => {
            movable.position.x += 3
        })
    }
    else if (keys.s.pressed && lastKey === "s") {
        movables.forEach(movable => {
            movable.position.y -= 3
        })
    }
    else if (keys.d.pressed && lastKey === "d") {
        movables.forEach(movable => {
            movable.position.x -= 3
        })
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
