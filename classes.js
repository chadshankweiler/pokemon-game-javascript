const DEBUG = false

class Sprite {
    constructor({
        position,
        velocity,
        image,
        frames = { max: 1 },
        width,
        sprites
    }) {
        this.position = position
        this.image = image
        this.frames = {...frames, val: 0, elapse: 0}
        this.image.onload = () => {
            this.width = this.image.width / this.frames.max
            this.height = this.image.height
        }
        this.image.onerror = () => {
            console.error(`Failed to load image: ${this.image.src}`)
        }
        this.moving = false
        this.sprites = sprites
    }

    draw(deltaTime = 16.67) {
        context.drawImage(this.image,

        // Cropping Player Image -> start x, start y, end x, end y
                this.frames.val * this.width,
                0,
                this.image.width / this.frames.max,
                this.image.height,

        // Actual Display of Images from width and height

                this.position.x,
                this.position.y,
                this.image.width / this.frames.max,
                this.image.height,
        )
        if (!this.moving) return
            if (this.frames.max > 1) {
                this.frames.elapse += deltaTime
            }

            if(this.frames.elapse >= 500) {
                this.frames.elapse = 0
                if (this.frames.val < this.frames.max - 1) this.frames.val++
                else this.frames.val = 0
            }
    }
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
        if (!DEBUG) return
        context.fillStyle = "rgba(255, 0, 0, 0.2)"
        context.fillRect(this.position.x, this.position.y, this.width, this.height)
    }
}
