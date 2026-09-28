import { Schema, model } from 'mongoose'

export const occurrenceTypes = ['intrusion', 'perimeter_breach', 'low_battery', 'signal_loss'] as const
export const occurrenceStatuses = ['open', 'acknowledged', 'resolved'] as const

export type OccurrenceType = (typeof occurrenceTypes)[number]
export type OccurrenceStatus = (typeof occurrenceStatuses)[number]

const typeWeights: Record<OccurrenceType, number> = {
  intrusion: 3,
  perimeter_breach: 2,
  low_battery: 1,
  signal_loss: 1,
}

const occurrenceSchema = new Schema(
  {
    siteId: { type: String, required: true },
    droneId: { type: String, required: true },
    type: { type: String, enum: occurrenceTypes, required: true },
    severity: { type: Number, required: true, min: 1, max: 5 },
    detectedAt: { type: Date, required: true },
    status: { type: String, enum: occurrenceStatuses, default: 'open' },
    count: { type: Number, default: 1 },
    note: String,
  },
  {
    versionKey: false,
    id: false,
    toJSON: { virtuals: true },
    virtuals: {
      priority: {
        get() {
          return this.severity * typeWeights[this.type]
        },
      },
    },
  },
)

occurrenceSchema.index({ siteId: 1, type: 1, status: 1, detectedAt: -1 })

export const Occurrence = model('Occurrence', occurrenceSchema)
