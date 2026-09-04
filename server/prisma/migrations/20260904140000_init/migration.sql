-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN "policyComparisonMode" TEXT NOT NULL DEFAULT 'SYMMETRIC_A_B_CORE5_V1';

-- AlterTable
ALTER TABLE "policy_comparison_sessions" ADD COLUMN "comparisonMode" TEXT NOT NULL DEFAULT 'SYMMETRIC_A_B_CORE5_V1';
