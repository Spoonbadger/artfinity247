import { jwtVerify } from 'jose'
import { NextRequest } from 'next/server'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function getUserFromRequest(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    
    const token = authHeader.split(' ')[1]

    try {
        const { payload } = await jwtVerify(token, JWT_SECRET)
        return payload as { id: string; slug: string; email: string }
        
    } catch (err) {
        return null
    }
}