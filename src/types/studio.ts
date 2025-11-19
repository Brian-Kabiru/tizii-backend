// src/types/studio.ts

export interface CreateStudioInput {
  /** Studio name */
  name: string;

  /** Optional description */
  description?: string;

  /** Physical address or area */
  location?: string;

  /** IANA timezone (default Africa/Nairobi) */
  timezone?: string;

  /** List of amenities ("wifi", "parking", etc.) */
  amenities?: string[];

  /** Multer uploaded photo files */
  photos?: Express.Multer.File[];

  /** Tizii's system paybill (optional override) */
  tizii_paybill?: string;

  /** The studio’s own paybill (if using studio_paybill) */
  studio_paybill?: string;

  /** Till number when payment_type = "till" */
  till_number?: string;

  /** Determines where payments go */
  payment_type?: "tizii_paybill" | "studio_paybill" | "till";

  /** Studio payout schedule */
  payout_schedule?: "weekly" | "monthly";

  /** Optional payout account JSON (bank/mobile money details) */
  payout_account?: Record<string, any>;

  /** Used only when admin creates a studio for an owner */
  owner_id?: string;
}

export interface UpdateStudioInput {
  name?: string;
  description?: string;
  location?: string;
  timezone?: string;

  /** Update amenities list */
  amenities?: string[];

  /** Nullable fields allow deletion */
  tizii_paybill?: string | null;
  studio_paybill?: string | null;
  till_number?: string | null;

  /** Update payment routing */
  payment_type?: "tizii_paybill" | "studio_paybill" | "till";

  /** Update payout schedule */
  payout_schedule?: "weekly" | "monthly";

  /** Replace or clear payout account */
  payout_account?: Record<string, any> | null;

  /** New uploaded photos (optional) */
  photos?: Express.Multer.File[];
}

/* -----------------------------------------------------
 *                        ROOMS
 * --------------------------------------------------- */

export interface CreateRoomInput {
  name: string;
  description?: string;

  /** e.g., "live", "mixing", "podcast" */
  type?: string;

  /** Must end up stored as DECIMAL string */
  hourly_rate: string | number;

  /** Overnight rate or null */
  overnight_rate?: string | number | null;

  /** Default = true */
  visible?: boolean;

  /** List of equipment strings */
  equipment?: string[];

  /** Optional room photo uploads */
  photos?: Express.Multer.File[];
}

export interface UpdateRoomInput {
  name?: string;
  description?: string;
  type?: string;

  hourly_rate?: string | number;
  overnight_rate?: string | number | null;

  visible?: boolean;

  equipment?: string[];

  /** Additional photos */
  photos?: Express.Multer.File[];
}

/* -----------------------------------------------------
 *                   AVAILABILITY
 * --------------------------------------------------- */

export interface AvailabilityInput {
  /** 0 = Sunday, 1 = Monday … 6 = Saturday */
  day_of_week: number;

  /** HH:mm (24-hour time) */
  open_time: string;

  /** HH:mm (24-hour time) */
  close_time: string;
}
