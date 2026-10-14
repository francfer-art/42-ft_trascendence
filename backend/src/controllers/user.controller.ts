import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import bcrypt from 'bcrypt';
import { createSession } from '../services/session.services';
import { unlink } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { UPLOADS_DIR } from '../utils/uploads';
import { isUserOnline } from '../utils/sockets/presence.store';
import { emitToUserRoom } from '../utils/sockets/socket.server';
import { SOCKET_EVENTS } from '../utils/sockets/socket.events';

const publicUserSelect = {
  id: true,
  login: true,
  email: true,
  firstName: true,
  lastName: true,
  displayName: true,
  image: true,
} as const;

export async function getUsers(req: Request, res: Response) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { login: { contains: q, mode: 'insensitive' } },
              { displayName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true,
        login: true,
        displayName: true,
        firstName: true,
        lastName: true,
        image: true,
      },
      orderBy: { createdAt: 'desc' },
      take: q ? 20 : undefined,
    });

    return res.json(users);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Could not get users',
    });
  }
}

export async function getUserByLogin(req: Request, res: Response) {
  try {
    const login =
      typeof req.params.login === 'string' ? req.params.login.trim() : '';

    if (!login) {
      return res.status(400).json({
        error: 'Login is required',
      });
    }

    const user = await prisma.user.findFirst({
      where: { login },
      select: publicUserSelect,
    });

    if (!user && /^\d+$/.test(login)) {
      const legacyUser = await prisma.user.findUnique({
        where: { id: Number(login) },
        select: publicUserSelect,
      });

      if (legacyUser) {
        return res.json({
          user: legacyUser,
          isOnline: isUserOnline(legacyUser.id),
        });
      }
    }

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    return res.json({ user, isOnline: isUserOnline(user.id) });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Could not get user',
    });
  }
}

export async function sendFriendRequest(req: Request, res: Response) {
  try {
    const sessionId = req.cookies.session;

    if (!sessionId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const login =
      typeof req.params.login === 'string' ? req.params.login.trim() : '';

    if (!login) {
      return res.status(400).json({ error: 'Login is required' });
    }

    const targetUser = await prisma.user.findFirst({
      where: { login },
      select: {
        id: true,
        login: true,
        displayName: true,
        firstName: true,
      },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.id === session.userId) {
      return res.status(400).json({ error: 'You cannot add yourself' });
    }

    const userOneId = Math.min(session.userId, targetUser.id);
    const userTwoId = Math.max(session.userId, targetUser.id);

    const existingFriendship = await prisma.friendship.findFirst({
      where: { userOneId, userTwoId },
    });

    if (existingFriendship?.isBlocked) {
      return res.status(403).json({ error: 'This user is blocked' });
    }

    if (existingFriendship?.isAccepted) {
      return res.json({
        friendship: existingFriendship,
        created: false,
        message: 'You are already friends',
      });
    }

    let friendship = existingFriendship;
    let created = false;

    if (!friendship) {
      friendship = await prisma.friendship.create({
        data: {
          userOneId,
          userTwoId,
          requesterId: session.userId,
          isAccepted: false,
          isBlocked: false,
        },
      });
      created = true;
    } else if (friendship.requesterId !== session.userId) {
      friendship = await prisma.friendship.update({
        where: { id: friendship.id },
        data: {
          isAccepted: true,
        },
      });
    }

    if (isUserOnline(targetUser.id)) {
      emitToUserRoom(targetUser.id, SOCKET_EVENTS.SOCIAL.FRIEND_REQUESTED, {
        userId: session.user.id,
        senderName:
          session.user.displayName ?? session.user.login ?? session.user.name,
      });
    }

    return res.json({
      friendship,
      created,
      message: created
        ? 'Friend request sent'
        : 'Friendship updated successfully',
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({ error: 'Could not send friend request' });
  }
}

export async function getFriendRequests(req: Request, res: Response) {
  try {
    const sessionId = req.cookies.session;

    if (!sessionId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const requests = await prisma.friendship.findMany({
      where: {
        isAccepted: false,
        isBlocked: false,
        OR: [{ userOneId: session.userId }, { userTwoId: session.userId }],
        requesterId: {
          not: session.userId,
        },
      },
      include: {
        requester: {
          select: {
            id: true,
            login: true,
            displayName: true,
            firstName: true,
            lastName: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({
      requests: requests.map((request) => ({
        id: request.id,
        requester: request.requester,
        createdAt: request.createdAt,
      })),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({ error: 'Could not get friend requests' });
  }
}

export async function getNotifications(req: Request, res: Response) {
  try {
    const sessionId = req.cookies.session;

    if (!sessionId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const friendRequests = await prisma.friendship.findMany({
      where: {
        isAccepted: false,
        isBlocked: false,
        OR: [{ userOneId: session.userId }, { userTwoId: session.userId }],
        requesterId: {
          not: session.userId,
        },
      },
      include: {
        requester: {
          select: {
            id: true,
            login: true,
            displayName: true,
            firstName: true,
            lastName: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const messageNotifications = await (
      prisma as any
    ).messageNotification.findMany({
      where: {
        recipientId: session.userId,
        isRead: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            login: true,
            displayName: true,
            firstName: true,
            lastName: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({
      friendRequests: friendRequests.map((request) => ({
        id: request.id,
        requester: request.requester,
        createdAt: request.createdAt,
      })),
      messageNotifications: messageNotifications.map((notification: any) => ({
        id: notification.id,
        conversationId: notification.conversationId,
        preview: notification.preview,
        createdAt: notification.createdAt,
        sender: notification.sender,
      })),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({ error: 'Could not get notifications' });
  }
}

export async function markMessageNotificationRead(req: Request, res: Response) {
  try {
    const sessionId = req.cookies.session;

    if (!sessionId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const notificationId = Number(req.params.id);

    if (Number.isNaN(notificationId)) {
      return res.status(400).json({ error: 'Invalid notification id' });
    }

    const notification = await (prisma as any).messageNotification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.recipientId !== session.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await (prisma as any).messageNotification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error(error);

    return res.status(500).json({ error: 'Could not update notification' });
  }
}

export async function getFriends(req: Request, res: Response) {
  try {
    const sessionId = req.cookies.session;

    if (!sessionId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const friendships = await prisma.friendship.findMany({
      where: {
        isAccepted: true,
        isBlocked: false,
        OR: [{ userOneId: session.userId }, { userTwoId: session.userId }],
      },
      include: {
        userOne: {
          select: publicUserSelect,
        },
        userTwo: {
          select: publicUserSelect,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const friends = friendships.map((friendship) => {
      const friend =
        friendship.userOne.id === session.userId
          ? friendship.userTwo
          : friendship.userOne;

      return {
        friendshipId: friendship.id,
        friend,
        isOnline: isUserOnline(friend.id),
      };
    });

    return res.json({ friends });
  } catch (error) {
    console.error(error);

    return res.status(500).json({ error: 'Could not get friends' });
  }
}

export async function acceptFriendRequest(req: Request, res: Response) {
  try {
    const sessionId = req.cookies.session;

    if (!sessionId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const friendshipId = Number(req.params.id);

    if (Number.isNaN(friendshipId)) {
      return res.status(400).json({ error: 'Invalid friendship id' });
    }

    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (friendship.isBlocked) {
      return res.status(403).json({ error: 'This request is blocked' });
    }

    if (friendship.requesterId === session.userId) {
      return res
        .status(400)
        .json({ error: 'You cannot accept your own request' });
    }

    const updatedFriendship = await prisma.friendship.update({
      where: { id: friendship.id },
      data: { isAccepted: true },
    });

    const requester = await prisma.user.findUnique({
      where: { id: friendship.requesterId },
      select: { id: true, displayName: true, login: true },
    });

    if (requester) {
      emitToUserRoom(requester.id, SOCKET_EVENTS.SOCIAL.FRIEND_ACCEPTED, {
        userId: session.user.id,
        accepterName:
          session.user.displayName ?? session.user.login ?? session.user.name,
      });
    }

    return res.json({ friendship: updatedFriendship });
  } catch (error) {
    console.error(error);

    return res.status(500).json({ error: 'Could not accept friend request' });
  }
}

export async function rejectFriendRequest(req: Request, res: Response) {
  try {
    const sessionId = req.cookies.session;

    if (!sessionId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const friendshipId = Number(req.params.id);

    if (Number.isNaN(friendshipId)) {
      return res.status(400).json({ error: 'Invalid friendship id' });
    }

    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (friendship.requesterId === session.userId) {
      return res
        .status(400)
        .json({ error: 'You cannot reject your own request' });
    }

    await prisma.friendship.delete({
      where: { id: friendship.id },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error(error);

    return res.status(500).json({ error: 'Could not reject friend request' });
  }
}

export async function loginUser(req: Request, res: Response) {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in',
      });
    }

    // lets use bcrypt to compare the password
    // with the hashed password in the database
    const isMatch = await bcrypt.compare(password, user.passwordHash ?? '');
    console.log('Password match:', isMatch);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    const session = await createSession(user.id);

    res.cookie('session', session.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      expires: session.expiresAt,
    });

    return res.json({
      message: 'Login successful',
      user,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Could not login user',
    });
  }
}

export async function updateCurrentUser(req: Request, res: Response) {
  try {
    const sessionId = req.cookies.session;

    if (!sessionId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { login, firstName, lastName, displayName } = req.body;
    const file = req.file as Express.Multer.File | undefined;

    const normalizedLogin = typeof login === 'string' ? login.trim() : '';

    if (!normalizedLogin) {
      return res.status(400).json({
        error: 'Login is required',
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: { login: normalizedLogin },
      select: { id: true },
    });

    if (existingUser && existingUser.id !== session.userId) {
      return res.status(409).json({
        error: 'Login is already taken',
      });
    }

    const oldImage = session.user.image;
    const imagePath = file ? `/uploads/${file.filename}` : undefined;

    if (file && oldImage?.startsWith('/uploads/')) {
      const oldImagePath = resolve(UPLOADS_DIR, basename(oldImage));

      await unlink(oldImagePath).catch(() => null);
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        login: normalizedLogin,
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(displayName !== undefined && { displayName }),
        ...(imagePath !== undefined && { image: imagePath }),
      },
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not update user' });
  }
}

export async function deleteCurrentUser(req: Request, res: Response) {
  try {
    const sessionId = req.cookies.session;

    if (!sessionId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = session.userId;

    // Delete the user's sessions
    await prisma.session.deleteMany({
      where: { userId },
    });

    // Delete the user
    await prisma.user.delete({
      where: { id: userId },
    });

    res.clearCookie('session');

    return res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not delete user' });
  }
}
