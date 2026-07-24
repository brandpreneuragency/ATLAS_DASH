import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db, ensureUserByEmail } from "@model-monitor/database";
import {
  isDevAuthBypassEnabled,
  isEmailAllowed,
  parseAllowedEmails,
} from "./auth-policy";
import { verifyPassword } from "./password";

const allowedEmails = parseAllowedEmails(process.env.ALLOWED_EMAILS);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        const configuredEmail = process.env.AUTH_LOGIN_EMAIL?.trim().toLowerCase();
        const passwordHash = process.env.AUTH_PASSWORD_HASH;
        const allowedEmails = parseAllowedEmails(process.env.ALLOWED_EMAILS);

        if (
          !email ||
          !password ||
          !configuredEmail ||
          !passwordHash ||
          email !== configuredEmail ||
          !allowedEmails.includes(email) ||
          !verifyPassword(password, passwordHash)
        ) {
          return null;
        }

        return ensureUserByEmail(db, email);
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      return isEmailAllowed(user.email, {
        allowedEmails,
        devBypass: isDevAuthBypassEnabled(),
      });
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email;
      }
      return token;
    },
  },
});
