// src/services/mpesa.ts
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const {
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE = "174379",
  MPESA_PASSKEY,
  MPESA_CALLBACK_URL,
} = process.env;

// 🔑 Get access token
export const getMpesaAccessToken = async (): Promise<string> => {
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString("base64");

  const response = await axios.get("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
    headers: { Authorization: `Basic ${auth}` },
  });

  // Explicitly type response.data
  const data = response.data as { access_token: string };
  return data.access_token;
};

// 📲 Initiate STK Push
export interface STKPushInput {
  amount: number;
  phoneNumber: string;
  accountReference: string;
  transactionDesc: string;
}

export interface STKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export const initiateSTKPush = async (data: STKPushInput): Promise<STKPushResponse> => {
  const token = await getMpesaAccessToken();

  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, "")
    .slice(0, 14);

  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString("base64");

  const payload = {
    BusinessShortCode: MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: data.amount,
    PartyA: data.phoneNumber,
    PartyB: MPESA_SHORTCODE,
    PhoneNumber: data.phoneNumber,
    CallBackURL: MPESA_CALLBACK_URL,
    AccountReference: data.accountReference,
    TransactionDesc: data.transactionDesc,
  };

  const response = await axios.post("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", payload, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // Explicitly type response.data
  const responseData = response.data as STKPushResponse;
  return responseData;
};
