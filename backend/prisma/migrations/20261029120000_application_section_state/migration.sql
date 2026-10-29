-- CreateTable
CREATE TABLE "ApplicationSection" (
    "id" TEXT NOT NULL,
    "applicationStepId" TEXT NOT NULL,
    "substepOrder" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "finalizedReason" TEXT,
    "consecutiveErrors" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationSection_applicationStepId_substepOrder_key" ON "ApplicationSection"("applicationStepId", "substepOrder");
CREATE INDEX "ApplicationSection_applicationStepId_status_idx" ON "ApplicationSection"("applicationStepId", "status");

-- AddForeignKey
ALTER TABLE "ApplicationSection" ADD CONSTRAINT "ApplicationSection_applicationStepId_fkey" FOREIGN KEY ("applicationStepId") REFERENCES "ApplicationStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
