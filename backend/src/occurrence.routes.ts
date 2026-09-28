import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { Occurrence, occurrenceStatuses, occurrenceTypes, type OccurrenceStatus } from './occurrence.model.js'

const groupingWindowMs = 10 * 60 * 1000
const isoDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/

const nextStatus: Partial<Record<OccurrenceStatus, OccurrenceStatus>> = {
  open: 'acknowledged',
  acknowledged: 'resolved',
}

const isBlank = (value: unknown) => typeof value !== 'string' || value.trim() === ''

export const occurrenceRouter = Router()

occurrenceRouter.post('/', async (req, res) => {
  const { siteId, droneId, type, severity, detectedAt } = req.body ?? {}
  const detectedDate = new Date(detectedAt)

  if (isBlank(siteId) || isBlank(droneId)) {
    res.status(400).json({ message: 'siteId and droneId are required' })
    return
  }
  if (!occurrenceTypes.includes(type)) {
    res.status(400).json({ message: `type must be one of: ${occurrenceTypes.join(', ')}` })
    return
  }
  if (!Number.isInteger(severity) || severity < 1 || severity > 5) {
    res.status(400).json({ message: 'severity must be an integer between 1 and 5' })
    return
  }
  if (typeof detectedAt !== 'string' || !isoDateTime.test(detectedAt) || Number.isNaN(detectedDate.getTime())) {
    res.status(400).json({ message: 'detectedAt must be a valid ISO date' })
    return
  }

  // Atomic update so concurrent repeated alerts don't lose count/severity increments.
  const grouped = await Occurrence.findOneAndUpdate(
    {
      siteId,
      type,
      status: 'open',
      detectedAt: { $gte: new Date(detectedDate.getTime() - groupingWindowMs), $lte: detectedDate },
    },
    [
      {
        $set: {
          count: { $add: ['$count', 1] },
          severity: { $min: [{ $add: ['$severity', 1] }, 5] },
          detectedAt: detectedDate,
        },
      },
    ],
    { sort: { detectedAt: -1 }, returnDocument: 'after', updatePipeline: true },
  )

  if (grouped) {
    res.json(grouped)
    return
  }

  const occurrence = await Occurrence.create({ siteId, droneId, type, severity, detectedAt: detectedDate })
  res.status(201).json(occurrence)
})

occurrenceRouter.get('/', async (req, res) => {
  const { status, siteId } = req.query
  const filter: { status?: OccurrenceStatus; siteId?: string } = {}

  if (status !== undefined) {
    if (!occurrenceStatuses.includes(status as OccurrenceStatus)) {
      res.status(400).json({ message: `status must be one of: ${occurrenceStatuses.join(', ')}` })
      return
    }
    filter.status = status as OccurrenceStatus
  }
  if (siteId !== undefined) {
    if (typeof siteId !== 'string') {
      res.status(400).json({ message: 'siteId must be a single value' })
      return
    }
    filter.siteId = siteId
  }

  const occurrences = await Occurrence.find(filter)
  occurrences.sort((a, b) => b.priority - a.priority || b.detectedAt.getTime() - a.detectedAt.getTime())

  res.json(occurrences)
})

occurrenceRouter.patch('/:id/status', async (req, res) => {
  const { status, note } = req.body ?? {}

  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ message: 'Invalid occurrence id' })
    return
  }
  if (!occurrenceStatuses.includes(status)) {
    res.status(400).json({ message: `status must be one of: ${occurrenceStatuses.join(', ')}` })
    return
  }

  const occurrence = await Occurrence.findById(req.params.id)

  if (!occurrence) {
    res.status(404).json({ message: 'Occurrence not found' })
    return
  }
  if (nextStatus[occurrence.status] !== status) {
    res.status(409).json({ message: `Cannot change status from ${occurrence.status} to ${status}` })
    return
  }
  if (status === 'resolved' && isBlank(note)) {
    res.status(400).json({ message: 'note is required to resolve an occurrence' })
    return
  }

  occurrence.status = status
  if (status === 'resolved') {
    occurrence.note = note.trim()
  }
  await occurrence.save()

  res.json(occurrence)
})
