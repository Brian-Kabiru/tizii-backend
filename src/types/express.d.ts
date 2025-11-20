import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface MulterFile {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    }

    interface Request {
      user?: JwtPayload & { id: string; role: string };
      file?: MulterFile;
      files?: MulterFile[] | { [fieldname: string]: MulterFile[] };
    }
  }
}

export {};
