export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
}

export interface FileUploadResponse {
  message: string;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  url: string;
}

export interface AvatarUploadOptions {
  maxSize?: number;
  allowedMimeTypes?: string[];
  destination?: string;
}
