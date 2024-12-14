
const cors = require('cors')
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express()
app.use(cors())

const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ["GET", "POST"]
  }
})

app.get('/', (req, res) => {
  res.send('Video Chat Server Running')
})

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`)

  socket.on('call-user', ({ to, offer }) => {
    io.to(to).emit('call-made', {
      from: socket.id,
      offer
    })
  })

  socket.on('accept-call', ({ to, answer }) => {
    io.to(to).emit('call-accepted', {
      from: socket.id,
      answer
    })
  })

  socket.on('reject-call', ({ to }) => {
    io.to(to).emit('call-rejected', {
      from: socket.id
    })
  })

  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', {
      from: socket.id,
      candidate
    })
  })

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`)
  })
})

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

