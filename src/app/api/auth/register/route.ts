import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/crypto';
import { createSession } from '@/lib/session';

export async function POST(req: Request) {
  try {
    const { name, email, mobileNumber, password, confirmPassword } = await req.json();

    if (!name || !email || !mobileNumber || !password || !confirmPassword) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    // Check if email already registered
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (existingUserByEmail) {
      return NextResponse.json({ error: 'Email is already registered' }, { status: 400 });
    }

    // Check if mobile number already registered
    const existingUserByMobile = await prisma.user.findUnique({
      where: { mobileNumber: mobileNumber.trim() },
    });

    if (existingUserByMobile) {
      return NextResponse.json({ error: 'Mobile number is already registered' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        mobileNumber: mobileNumber.trim(),
        passwordHash,
      },
    });

    // Auto log in after registration
    await createSession(user.id, req);

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
