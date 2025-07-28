import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const email = searchParams.get('email')
  const status = searchParams.get('status')
  const before = searchParams.get('before')
  const after = searchParams.get('after')

  const filters: any = {}

  if (email) filters.email = email
  if (status) filters.paymentStatus = status
  if (after || before) {
    filters.createdAt = {}
    if (after) filters.createdAt.gte = new Date(after)
    if (before) filters.createdAt.lte = new Date(before)
  }

  const orders = await prisma.order.findMany({
    where: filters,
    orderBy: { createdAt: 'desc' },
  })

  return Response.json(orders) // full, private data
}
