import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

export async function GET(req: NextRequest) {
    const token = req.cookies.get('auth-token')?.value

    if (!token) {
        return new NextResponse('Not authenticated', { status: 401 })
    }

    try {
        const { payload } = await jwtVerify(
            token,
            new TextEncoder().encode(process.env.JWT_SECRET!)
        )

        // Return user data from token
        return NextResponse.json({
            id: payload.id,
            email: payload.email,
        })

    } catch (err) {
        return new NextResponse('Invalid token', { status: 401})
    }
}