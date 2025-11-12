-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "start_time" DROP NOT NULL,
ALTER COLUMN "end_time" DROP NOT NULL,
ALTER COLUMN "duration_minutes" DROP NOT NULL;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "mpesa_account_reference" TEXT,
ADD COLUMN     "mpesa_paybill_number" TEXT,
ADD COLUMN     "mpesa_till_number" TEXT;

-- AlterTable
ALTER TABLE "studios" ADD COLUMN     "paybill_number" TEXT,
ADD COLUMN     "payment_type" TEXT DEFAULT 'paybill',
ADD COLUMN     "till_number" TEXT;

-- CreateTable
CREATE TABLE "booking_slots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "booking_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_slots_booking_id_idx" ON "booking_slots"("booking_id");

-- CreateIndex
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");

-- AddForeignKey
ALTER TABLE "booking_slots" ADD CONSTRAINT "booking_slots_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
