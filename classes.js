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
            console.log("width",this.width)
            console.log("height",this.height)
        }
        this.moving = false
        this.sprites = sprites
    }

    draw() {
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
                this.frames.elapse++
            }

            if(this.frames.elapse % 30 === 0) {
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
        context.fillStyle = "rgba(255, 0, 0, 0)"
        context.fillRect(this.position.x, this.position.y, this.width, this.height)
    }
}
