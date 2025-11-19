import { Prisma } from "@prisma/client";
 // remove this if not needed

export interface CreateBookingInput {
  artist_id: string;
  studio_id: string;
  room_id?: string;
  start_time: Date | string;
  end_time: Date | string;
  duration_minutes: number;
  amount: Prisma.Decimal | number | string;
  currency?: string;
  notes?: string;
  collaborators?: { id: string; share?: number }[]; // optional
}

export interface UpdateBookingInput {
  start_time?: Date | string;
  end_time?: Date | string;
  duration_minutes?: number;
  amount?: Prisma.Decimal | number | string;
  currency?: string;
  status?: string;
  notes?: string;
  collaborators?: { id: string; share?: number }[] | null;
}

export interface BookingSlotInput {
  booking_id: string;
  start_time: Date | string;
  end_time: Date | string;
}
