import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    // mcp and backup authenticate their own bearer tokens (and backup also
    // accepts a session), so the login redirect must not intercept them.
    "/api/((?!auth|mcp|backup).*)",
  ],
};
