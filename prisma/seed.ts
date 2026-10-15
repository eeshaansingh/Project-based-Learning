import { prisma } from '../src/lib/db';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Seeding database with updated demo data including fraud & dispute models...');

  // Reset database tables in logical dependency order
  await prisma.disputeClassification.deleteMany({});
  await prisma.dispute.deleteMany({});
  await prisma.investigationCase.deleteMany({});
  await prisma.accountFreeze.deleteMany({});
  await prisma.fraudReport.deleteMany({});
  await prisma.auditEvent.deleteMany({});
  await prisma.authenticationChallenge.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.payee.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.recoveryCode.deleteMany({});
  await prisma.mockBankCredential.deleteMany({});
  await prisma.bankAccount.deleteMany({});
  await prisma.systemPolicy.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Reset database state.');

  // Create demo credential hashes
  const passwordHash = await bcrypt.hash('password123', 10);
  const pinHash = await bcrypt.hash('123456', 10); // Standard 6-digit mock bank PIN

  // 1. Seed System Policies
  await prisma.systemPolicy.createMany({
    data: [
      {
        key: 'maxDebitHoldDays',
        value: '60',
        description: 'Maximum simulated temporary debit-hold period (Days)',
      },
      {
        key: 'requireHumanReviewConfidenceThreshold',
        value: '0.60',
        description: 'Dispute confidence threshold below which human review is mandatory',
      },
    ],
  });

  // 2. Create Regular Demo User
  const demoUser = await prisma.user.create({
    data: {
      name: 'Demo User',
      email: 'demo@secureupi',
      mobileNumber: '9876543210',
      passwordHash,
      role: 'USER',
      stepUpThreshold: 15000,
      dailyLimit: 50000,
      requireMfaNewPayees: true,
      requireMfaNewDevices: false,
      allowTrustedPayees: true,
      mfaEnabled: true,
    },
  });

  // 3. Create Bank Operator User
  const operatorUser = await prisma.user.create({
    data: {
      name: 'Bank Operations Admin',
      email: 'operator@secureupi',
      mobileNumber: '9998887770',
      passwordHash,
      role: 'BANK_OPERATOR',
      stepUpThreshold: 100000,
      dailyLimit: 1000000,
      requireMfaNewPayees: false,
      requireMfaNewDevices: false,
      allowTrustedPayees: true,
      mfaEnabled: true,
    },
  });

  // 4. Create Suspect Fraudster User (Under Debit Hold)
  const suspectUser = await prisma.user.create({
    data: {
      name: 'Suspect Fraud Merchant',
      email: 'suspect@secureupi',
      mobileNumber: '9111111111',
      passwordHash,
      role: 'USER',
      stepUpThreshold: 15000,
      dailyLimit: 50000,
      mfaEnabled: true,
    },
  });

  // Create Mock Bank account linked to demo user
  const bankAccount = await prisma.bankAccount.create({
    data: {
      userId: demoUser.id,
      bankName: 'HDFC Bank',
      accountNumberMasked: '•••• 4821',
      upiId: 'demo@secureupi',
      balance: 75000.00,
      status: 'ACTIVE',
    },
  });

  // Create Mock Bank UPI PIN credentials
  await prisma.mockBankCredential.create({
    data: {
      bankAccountId: bankAccount.id,
      pinHash,
    },
  });

  // Create Mock Bank account linked to Bank Operator
  const operatorAccount = await prisma.bankAccount.create({
    data: {
      userId: operatorUser.id,
      bankName: 'Reserve Bank Operations',
      accountNumberMasked: '•••• 0001',
      upiId: 'operator@secureupi',
      balance: 500000.00,
      status: 'ACTIVE',
    },
  });
  await prisma.mockBankCredential.create({
    data: {
      bankAccountId: operatorAccount.id,
      pinHash,
    },
  });

  // Create Mock Bank account linked to Suspect User (Status: DEBIT_HOLD_ACTIVE)
  const suspectAccount = await prisma.bankAccount.create({
    data: {
      userId: suspectUser.id,
      bankName: 'ICICI Bank',
      accountNumberMasked: '•••• 9999',
      upiId: 'suspect@upi',
      balance: 42000.00,
      status: 'DEBIT_HOLD_ACTIVE',
    },
  });
  await prisma.mockBankCredential.create({
    data: {
      bankAccountId: suspectAccount.id,
      pinHash,
    },
  });

  // Create Payees for Demo User
  await prisma.payee.create({
    data: {
      userId: demoUser.id,
      name: 'Rahul',
      upiId: 'rahul@upi',
      isTrusted: false,
    },
  });

  await prisma.payee.create({
    data: {
      userId: demoUser.id,
      name: 'Cafe',
      upiId: 'cafe@upi',
      isTrusted: false,
    },
  });

  await prisma.payee.create({
    data: {
      userId: demoUser.id,
      name: 'Rent',
      upiId: 'rent@upi',
      isTrusted: true,
    },
  });

  await prisma.payee.create({
    data: {
      userId: demoUser.id,
      name: 'Suspect Merchant',
      upiId: 'suspect@upi',
      isTrusted: false,
    },
  });

  // Create Sample transactions
  const tx1 = await prisma.transaction.create({
    data: {
      userId: demoUser.id,
      payeeName: 'Rahul',
      payeeUpiId: 'rahul@upi',
      amount: 500,
      note: 'Dinner split',
      status: 'SUCCESS',
      authMethod: 'STANDARD',
      riskLevel: 'LOW',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000 * 2),
    },
  });

  const tx2 = await prisma.transaction.create({
    data: {
      userId: demoUser.id,
      payeeName: 'Suspect Merchant',
      payeeUpiId: 'suspect@upi',
      amount: 8500,
      note: 'Unrecognized purchase request',
      status: 'SUCCESS',
      authMethod: 'STANDARD',
      riskLevel: 'MEDIUM',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000 * 1),
    },
  });

  // 5. Seed Pre-existing Fraud Report against Suspect
  const fraudReport = await prisma.fraudReport.create({
    data: {
      reporterUserId: demoUser.id,
      suspectUserId: suspectUser.id,
      suspectAccountId: suspectAccount.id,
      transactionId: tx2.id,
      suspectUpiId: 'suspect@upi',
      amount: 8500,
      category: 'MALICIOUS_FRAUD',
      description: 'User reported fake customer care scam impersonation leading to unauthorized transfer.',
      status: 'HOLD_ACTIVE',
      priority: 'HIGH',
      assignedCaseId: 'CASE-2026-0041',
    },
  });

  // 6. Seed Account Freeze Record for Suspect Account
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days
  const accountFreeze = await prisma.accountFreeze.create({
    data: {
      accountId: suspectAccount.id,
      userId: suspectUser.id,
      status: 'DEBIT_HOLD_ACTIVE',
      reason: 'Automated prototype fraud policy triggered due to MALICIOUS_FRAUD report.',
      triggeredBy: 'FRAUD_REPORT',
      fraudReportId: fraudReport.id,
      startedAt: now,
      expiresAt,
      investigationStatus: 'UNDER_INVESTIGATION',
      notes: 'Investigating potential social engineering campaign targeting multiple users.',
    },
  });

  // 7. Seed Investigation Case
  await prisma.investigationCase.create({
    data: {
      id: 'CASE-2026-0041',
      fraudReportId: fraudReport.id,
      suspectAccountId: suspectAccount.id,
      status: 'UNDER_REVIEW',
      reviewer: 'System Automated Sentinel',
      notes: 'Debit hold applied. Customer documentation pending review.',
    },
  });

  // 8. Seed Sample Smart Disputes
  const dispute1 = await prisma.dispute.create({
    data: {
      userId: demoUser.id,
      transactionId: tx1.id,
      rawDescription: 'I tried to pay the shopkeeper but the app crashed and my money is gone but he didn\'t get it.',
      predictedType: 'PENDING_NETWORK_TIMEOUT',
      confidence: 0.94,
      severity: 'MEDIUM',
      routingStatus: 'ROUTED',
      recommendedRoute: 'PAYMENT_STATUS_RECONCILIATION',
      requiresHumanReview: false,
    },
  });

  await prisma.disputeClassification.create({
    data: {
      disputeId: dispute1.id,
      modelType: 'RULE_BASED_NLP',
      modelVersion: 'v1.0.0',
      category: 'PENDING_NETWORK_TIMEOUT',
      confidence: 0.94,
      reason: 'Complaint indicates payment deduction during application/network crash before merchant receipt.',
    },
  });

  // 9. Initialize Audit events
  await prisma.auditEvent.createMany({
    data: [
      {
        userId: demoUser.id,
        eventType: 'LOGIN_SUCCESS',
        metadata: JSON.stringify({ message: 'Demo user logged in successfully' }),
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 * 2),
      },
      {
        userId: demoUser.id,
        eventType: 'FRAUD_REPORT_CREATED',
        metadata: JSON.stringify({ reportId: fraudReport.id, suspectUpiId: 'suspect@upi', category: 'MALICIOUS_FRAUD' }),
        timestamp: now,
      },
      {
        userId: suspectUser.id,
        eventType: 'DEBIT_HOLD_ACTIVATED',
        metadata: JSON.stringify({ freezeId: accountFreeze.id, accountId: suspectAccount.id, durationDays: 60 }),
        timestamp: now,
      },
      {
        userId: operatorUser.id,
        eventType: 'INVESTIGATION_OPENED',
        metadata: JSON.stringify({ caseId: 'CASE-2026-0041', reportId: fraudReport.id }),
        timestamp: now,
      },
    ],
  });

  console.log('Database seeded successfully with fraud & dispute demo data!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
