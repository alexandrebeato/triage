import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import mongoose from 'mongoose'
import { occurrenceRouter } from './occurrence.routes.js'

const port = Number(process.env.PORT ?? 3000)
const mongoUri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/aeroscan'

const app = express()
app.use(cors())
app.use(express.json())
app.use('/occurrences', occurrenceRouter)

const handleError: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ message: 'Invalid JSON body' })
    return
  }

  console.error(err)
  res.status(500).json({ message: 'Internal server error' })
}
app.use(handleError)

await mongoose.connect(mongoUri)

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})
