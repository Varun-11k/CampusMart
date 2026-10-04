let io = null

function setIO(socketServer) {
    io = socketServer
}

function getIO() {
    return io
}

module.exports = {
    setIO,
    getIO,
}
