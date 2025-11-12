// src/services/mpesa.ts
import axios from "axios";
import dotenv from "dotenv";
import dayjs from "dayjs";

dotenv.config();

const {
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_PASSKEY,
  MPESA_CALLBACK_URL,
  NODE_ENV,
} = process.env;

if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET || !MPESA_PASSKEY || !MPESA_CALLBACK_URL) {
  throw new Error("MPESA environment variables not set properly");
}

const SANDBOX_BASE_URL = "https://sandbox.safaricom.co.ke";
const PROD_BASE_URL = "https://api.safaricom.co.ke";
const BASE_URL = NODE_ENV === "production" ? PROD_BASE_URL : SANDBOX_BASE_URL;

// -------------------- Access Token --------------------
export const getMpesaAccessToken = async (): Promise<string> => {
  try {
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString("base64");
    const response = await axios.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    const data = response.data as { access_token: string };
    if (!data.access_token) throw new Error("MPESA access token not returned");
    return data.access_token;
  } catch (err: any) {
    console.error("Error fetching MPESA access token:", err.response?.data || err.message);
    throw new Error("Failed to get MPESA access token");
  }
};

// -------------------- STK Push --------------------
export interface STKPushInput {
  amount: number;
  phoneNumber: string;       // must be in 2547XXXXXXXX format
  accountReference: string;  // booking ID or invoice
  transactionDesc: string;
  businessShortCode: string; // studio paybill or till
  transactionType?: "CustomerPayBillOnline" | "CustomerBuyGoodsOnline";
}

export interface STKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export const initiateSTKPush = async (data: STKPushInput): Promise<STKPushResponse> => {
  try {
    const token = await getMpesaAccessToken();

    const timestamp = dayjs().format("YYYYMMDDHHmmss");
    const password = Buffer.from(`${data.businessShortCode}${MPESA_PASSKEY}${timestamp}`).toString("base64");

    const payload = {
      BusinessShortCode: data.businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: data.transactionType || "CustomerPayBillOnline",
      Amount: data.amount,
      PartyA: data.phoneNumber,
      PartyB: data.businessShortCode,
      PhoneNumber: data.phoneNumber,
      CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: data.accountReference,
      TransactionDesc: data.transactionDesc,
    };

    const response = await axios.post(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const responseData = response.data as STKPushResponse;

    if (!responseData.CheckoutRequestID) {
      console.error("STK Push failed:", responseData);
      throw new Error("STK Push initiation failed");
    }

    return responseData;
  } catch (err: any) {
    console.error("Error initiating STK Push:", err.response?.data || err.message);
    throw new Error("Failed to initiate STK Push");
  }
};
