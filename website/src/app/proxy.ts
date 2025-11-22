import { updateSession } from '@/lib/supabase/middleware'
import type { NextRequest } from 'next/server'

export const config = {
  matcher: '/about/:path*',
}

// This function can be marked `async` if using `await` inside
export async function proxy(request: NextRequest) {
    return await updateSession(request)
}

// Alternatively, you can use a default export:
// export default function proxy(request: NextRequest) { ... }

