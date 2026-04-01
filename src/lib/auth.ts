// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8 horas
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Informe email e senha.')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        })

        if (!user || !user.active) {
          throw new Error('Usuário não encontrado ou inativo.')
        }

        const passwordMatch = await bcrypt.compare(credentials.password, user.password)
        if (!passwordMatch) {
          throw new Error('Senha incorreta.')
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
}

// Extensão de tipos do NextAuth
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: string
    }
  }
}
