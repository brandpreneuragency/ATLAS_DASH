import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isEmailAllowed, parseAllowedEmails } from "./auth-policy";

const allowedEmails = parseAllowedEmails(process.env.ALLOWED_EMAILS);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
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
        devBypass: process.env.AUTH_DEV_BYPASS === "true",
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
