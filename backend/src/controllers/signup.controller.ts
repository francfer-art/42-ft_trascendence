import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../utils/prisma';
import { isEmailEnabled, sendVerificationEmail } from '../utils/emailUtil';
import { generateToken, hashToken } from '../utils/tokenUtils';

export async function createUser(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'email and password are required',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters',
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'A user with this email already exists',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        name: email.split('@')[0],
        passwordHash,
        // Without email sending there is no way to confirm the address
        emailVerified: !isEmailEnabled,
      },
    });

    if (isEmailEnabled) {
      // Generate verification token
      const token = generateToken();
      const tokenHash = hashToken(token);

      // Token expires in 24 hours
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.emailVerificationToken.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt,
        },
      });

      const confirmationUrl = `${(process.env.FRONTEND_URL ?? '').replace(/\/+$/, '')}/confirm-email?token=${token}`;

      try {
        await sendVerificationEmail({
          email: user.email,
          name: user.name,
          confirmationUrl,
        });
      } catch (error) {
        console.error('Could not send verification email:', error);
      }
    }

    return res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Could not create user',
    });
  }
}
