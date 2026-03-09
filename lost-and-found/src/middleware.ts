import { clerkMiddleware } from '@clerk/nextjs/server';

// Next.js Middleware entrypoint.
//
// We delegate all request handling to Clerk's middleware so authentication/session
// state can be established early in the request lifecycle (before route handlers
// or server components run).

export default clerkMiddleware();

// Configure which paths run through middleware.
//
// - We exclude Next.js internals (`_next`) and common static asset file types so
//   we don't add auth overhead to assets.
// - We include API and tRPC routes explicitly so authenticated calls work.
export const config = {
  matcher: [

 
   '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',

 
   '/(api|trpc)(.*)']

};
