const canvas = document.querySelector("canvas")
const c = canvas.getContext("2d")
canvas.width = 1024
canvas.height = 576

c.fillStyle = "white"
c.fillRect(0, 0, canvas.width, canvas.height)

const image = new Image()
image.src = "./img/pelletTown.png"

const playerImage = new Image()
playerImage.src = "./img/playerDown.png"

image.onload = () => {
    c.drawImage(image, -735, -600)
    c.drawImage(playerImage,

        // Cropping Player Image -> start x, start y, end x, end y
                0,
                0,
                playerImage.width / 4,
                playerImage.height,

        // Actual Display of Images from width and height

                canvas.width / 2 - playerImage.width / 2,
                canvas.height / 2 - playerImage.height / 2,
                playerImage.width / 4,
                playerImage.height,
)
}


