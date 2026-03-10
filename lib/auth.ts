import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        await connectDB();
        const user = await User.findOne({ email: credentials.email.toLowerCase() });
        if (!user) return null;
        if (user.isActive === false) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        const role = user.role === "staff" ? "staff" : "owner";
        const ownerUser =
          role === "staff" && user.farmOwnerId
            ? await User.findById(user.farmOwnerId)
            : user;
        if (!ownerUser) return null;

        return {
          id: ownerUser._id.toString(),
          memberUserId: user._id.toString(),
          email: user.email,
          name: user.name,
          farmName: ownerUser.farmName,
          plan: ownerUser.plan,
          billingStatus: ownerUser.billingStatus,
          trialEndsAt: ownerUser.trialEndsAt || null,
          billingExpiresAt: ownerUser.billingExpiresAt || null,
          role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.memberUserId = (user as any).memberUserId || user.id;
        token.farmName = (user as any).farmName;
        token.plan = (user as any).plan || "free";
        token.billingStatus = (user as any).billingStatus || "inactive";
        token.trialEndsAt = (user as any).trialEndsAt || null;
        token.billingExpiresAt = (user as any).billingExpiresAt || null;
        token.role = (user as any).role || "owner";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).memberUserId = token.memberUserId || token.id;
        (session.user as any).farmName = token.farmName;
        (session.user as any).plan = token.plan || "free";
        (session.user as any).billingStatus = token.billingStatus || "inactive";
        (session.user as any).trialEndsAt = token.trialEndsAt || null;
        (session.user as any).billingExpiresAt = token.billingExpiresAt || null;
        (session.user as any).role = token.role || "owner";
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
};
