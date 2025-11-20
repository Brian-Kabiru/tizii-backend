import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    // Support req.user
    interface Request {
      user?: JwtPayload & { id: string; role: string };
      file?: Multer.File;
      files?: Multer.File[];
    }

    namespace Multer {
      interface File {
        /** Raw file buffer */
        buffer: Buffer;
        /** Original uploaded name */
        originalname: string;
        mimetype: string;
        size: number;
      }
    }
  }
}

export {};
