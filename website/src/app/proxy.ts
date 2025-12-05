import { updateSession } from '@/lib/supabase/middleware';
import { NextResponse, type NextRequest } from 'next/server';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

const requireAuth = process.env.REQUIRE_AUTH ? Boolean(process.env.REQUIRE_AUTH) : true;

// This function can be marked `async` if using `await` inside
export default async function proxy(request: NextRequest) {
    if (!requireAuth) {
      return NextResponse.redirect('/auth/login')
    }

    return await updateSession(request);
}
