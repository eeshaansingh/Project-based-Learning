import { prisma } from '../src/lib/db';
import { evaluateFraudReport, releaseLien, calculateQuorumMetrics } from '../src/lib/fraudResponseService';
import { checkAccountDebitEligibility, getAccountLienSummary } from '../src/lib/accountFreeze';
import bcrypt from 'bcryptjs';

async function runLienQuorumTest() {
  console.log('\n--- 🧪 Starting Automated Lien Marking & AI Quorum Test Suite ---\n');

  try {
    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Cleanup old test data
    await prisma.fraudReport.deleteMany({ where: { suspectUpiId: 'test_suspect@upi' } });
    await prisma.accountLien.deleteMany({ where: { account: { upiId: 'test_suspect@upi' } } });
    await prisma.accountFreeze.deleteMany({ where: { account: { upiId: 'test_suspect@upi' } } });
    await prisma.transaction.deleteMany({ where: { payeeUpiId: 'test_suspect@upi' } });
    await prisma.bankAccount.deleteMany({ where: { upiId: 'test_suspect@upi' } });
    await prisma.user.deleteMany({ where: { email: { in: ['reporter1@test.com', 'reporter2@test.com', 'reporter3@test.com', 'suspect@test.com'] } } });

    // 2. Provision Reporter Users & Suspect User
    const reporter1 = await prisma.user.create({
      data: { name: 'Reporter One', email: 'reporter1@test.com', mobileNumber: '9900000001', passwordHash },
    });
    const reporter2 = await prisma.user.create({
      data: { name: 'Reporter Two', email: 'reporter2@test.com', mobileNumber: '9900000002', passwordHash },
    });
    const reporter3 = await prisma.user.create({
      data: { name: 'Reporter Three', email: 'reporter3@test.com', mobileNumber: '9900000003', passwordHash },
    });
    const suspect = await prisma.user.create({
      data: { name: 'Suspect User', email: 'suspect@test.com', mobileNumber: '9900000004', passwordHash },
    });

    const suspectAccount = await prisma.bankAccount.create({
      data: {
        userId: suspect.id,
        bankName: 'HDFC Bank',
        accountNumberMasked: '••••9876',
        upiId: 'test_suspect@upi',
        balance: 75000,
        status: 'ACTIVE',
      },
    });

    console.log('✅ Created test users and suspect bank account (Balance: ₹75,000)');

    // 3. STEP 1: Single Fraud Report (User A reports User B for ₹500)
    const report1 = await prisma.fraudReport.create({
      data: {
        reporterUserId: reporter1.id,
        suspectUserId: suspect.id,
        suspectAccountId: suspectAccount.id,
        suspectUpiId: 'test_suspect@upi',
        amount: 500,
        category: 'MALICIOUS_FRAUD',
        description: 'Fake customer service scam report for ₹500',
        status: 'SUBMITTED',
      },
    });

    const evalResult1 = await evaluateFraudReport(report1.id);

    console.log('\n--- Test Case 1: Single Fraud Report (2026 RBI Lien) ---');
    console.log(`Lien Applied: ${evalResult1.lienApplied} (Amount: ₹${evalResult1.disputedAmount})`);
    console.log(`Full Account Hold Applied: ${evalResult1.holdApplied}`);
    console.log(`Quorum Count: ${evalResult1.quorumCount}/3`);
    console.log(`Reason: ${evalResult1.reason}`);

    if (!evalResult1.lienApplied || evalResult1.holdApplied) {
      throw new Error('FAIL: Single report should apply an Amount Lien without freezing the entire account.');
    }

    // Verify balance calculation
    const summary1 = await getAccountLienSummary(suspectAccount.id);
    console.log(`Total Balance: ₹${summary1.totalBalance}, Active Liens: ₹${summary1.totalLienAmount}, Available Balance: ₹${summary1.availableBalance}`);
    
    if (summary1.availableBalance !== 74500) {
      throw new Error(`FAIL: Available balance should be ₹74,500 but got ₹${summary1.availableBalance}`);
    }

    // Check transaction eligibility
    const allow5000 = await checkAccountDebitEligibility(suspectAccount.id, 5000);
    const allow74800 = await checkAccountDebitEligibility(suspectAccount.id, 74800);

    console.log(`Debit check for ₹5,000 (Allowed): ${allow5000.allowed}`);
    console.log(`Debit check for ₹74,800 (Blocked by Lien): ${allow74800.allowed} (Message: "${allow74800.message}")`);

    if (!allow5000.allowed || allow74800.allowed) {
      throw new Error('FAIL: Suspect should be allowed to spend up to available balance, but blocked for amounts exceeding available balance.');
    }

    // 4. STEP 2: AI Quorum & Velocity Escalation (Add 2 more reports + simulate velocity)
    // Simulate cashflow velocity: Inbound 1000 -> Outbound 900 (90% drain)
    await prisma.transaction.create({
      data: {
        userId: reporter1.id,
        payeeName: 'Suspect',
        payeeUpiId: 'test_suspect@upi',
        amount: 1000,
        status: 'SUCCESS',
        authMethod: 'STANDARD',
        riskLevel: 'LOW',
      },
    });

    await prisma.transaction.create({
      data: {
        userId: suspect.id,
        payeeName: 'External Mule',
        payeeUpiId: 'mule@upi',
        amount: 900,
        status: 'SUCCESS',
        authMethod: 'STANDARD',
        riskLevel: 'HIGH',
      },
    });

    const report2 = await prisma.fraudReport.create({
      data: {
        reporterUserId: reporter2.id,
        suspectUserId: suspect.id,
        suspectAccountId: suspectAccount.id,
        suspectUpiId: 'test_suspect@upi',
        amount: 1000,
        category: 'MALICIOUS_FRAUD',
        description: 'Second victim reporting scam',
        status: 'SUBMITTED',
      },
    });
    await evaluateFraudReport(report2.id);

    const report3 = await prisma.fraudReport.create({
      data: {
        reporterUserId: reporter3.id,
        suspectUserId: suspect.id,
        suspectAccountId: suspectAccount.id,
        suspectUpiId: 'test_suspect@upi',
        amount: 1500,
        category: 'MALICIOUS_FRAUD',
        description: 'Third victim reporting scam - Quorum reached',
        status: 'SUBMITTED',
      },
    });

    const evalResult3 = await evaluateFraudReport(report3.id);

    console.log('\n--- Test Case 2: AI Quorum & Cashflow Velocity Trigger ---');
    console.log(`Quorum Reached: ${evalResult3.isQuorumReached} (Count: ${evalResult3.quorumCount}/3)`);
    console.log(`High Velocity Flag: ${evalResult3.isHighVelocity}`);
    console.log(`Full Account Hold Applied: ${evalResult3.holdApplied}`);
    console.log(`Reason: ${evalResult3.reason}`);

    if (!evalResult3.holdApplied || !evalResult3.isQuorumReached) {
      throw new Error('FAIL: Quorum of 3 reports + high velocity should trigger full account debit hold.');
    }

    // 5. STEP 3: Bank Operator Lien Release
    console.log('\n--- Test Case 3: Bank Operator Lien Release ---');
    const lienToRelease = evalResult1.lienId!;
    const releaseResult = await releaseLien(lienToRelease, 'op_123', 'Bank Operator Alice', 'Customer dispute resolved. Merchant verified.');
    
    console.log(`Lien Release Result: ${releaseResult.success} (Status: ${releaseResult.status})`);

    const summaryAfterRelease = await getAccountLienSummary(suspectAccount.id);
    console.log(`Available Balance after lien release: ₹${summaryAfterRelease.availableBalance} (Active Liens: ${summaryAfterRelease.activeLienCount})`);

    if (summaryAfterRelease.totalLienAmount !== 2500) {
      throw new Error('FAIL: Total lien amount after releasing ₹500 lien should be ₹2,500 (1000 + 1500 remaining).');
    }

    console.log('\n🎉 ALL AUTOMATED LIEN MARKING & AI QUORUM TESTS PASSED SUCCESSFULLY!\n');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runLienQuorumTest();
