declare module "multer" {
  import { RequestHandler } from "express";

  interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }

  interface MulterFiles {
    [fieldname: string]: MulterFile[];
  }

  interface Multer {
    single(field: string): RequestHandler;
    array(field: string, maxCount?: number): RequestHandler;
    fields(fields: { name: string; maxCount?: number }[]): RequestHandler;
    any(): RequestHandler;
  }

  function multer(options?: any): Multer;
  export = multer;
}
