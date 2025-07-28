import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
    const basicAuth = req.headers.get('authorization')

    if (!basicAuth) {
        return new NextResponse('Auth required', {
            status: 401,
            headers: {
                'WWW-Authenticate': 'Basic'
            }
        })
    } 

    const [scheme, encoded] = basicAuth.split(' ')

    if (scheme !== 'Basic') {
        return new NextResponse('Invalid auth scheme', { status: 400 })
    }

    const decoded = atob(encoded)
    const [user, pass] = decoded.split(':')

    if (
        user !== process.env.ADMIN_USER ||
        pass !== process.env.ADMIN_PASS
    ) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/admin/:path*', '/api/admin-orders']
}