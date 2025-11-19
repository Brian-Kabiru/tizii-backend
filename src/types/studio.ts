// DTOs for studios & rooms
export interface CreateStudioInput {
  name: string;
  description?: string;
  location?: string;
  timezone?: string; // e.g., "Africa/Nairobi"
  amenities?: string[]; // optional
  photos?: Express.Multer.File[];
  tizii_paybill?: string;
  studio_paybill?: string;
  till_number?: string;
  payment_type?: "tizii_paybill" | "studio_paybill" | "till";
  payout_schedule?: "weekly" | "monthly";
  payout_account?: Record<string, any>; // optional bank account info
  owner_id?: string;
}

export interface UpdateStudioInput {
  name?: string;
  description?: string;
  location?: string;
  timezone?: string;
  amenities?: string[];
  tizii_paybill?: string | null;
  studio_paybill?: string | null;
  till_number?: string | null;
  payment_type?: "tizii_paybill" | "studio_paybill" | "till";
  payout_schedule?: "weekly" | "monthly";
  payout_account?: Record<string, any> | null;
  photos?: Express.Multer.File[];
}

export interface CreateRoomInput {
  name: string;
  description?: string;
  type?: string;
  hourly_rate: string | number; // decimal string or number
  overnight_rate?: string | number | null;
  visible?: boolean;
  equipment?: string[]; // e.g. ['mic', 'desk']
  photos?: Express.Multer.File[]; // optional room photos
}

export interface UpdateRoomInput {
  name?: string;
  description?: string;
  type?: string;
  hourly_rate?: string | number;
  overnight_rate?: string | number | null;
  visible?: boolean;
  equipment?: string[];
  photos?: Express.Multer.File[]; // optional room photos
}

// Availability DTO
export interface AvailabilityInput {
  day_of_week: number; // 0-6
  open_time: string; // "10:00"
  close_time: string; // "17:00"
}
