import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload an in-memory file buffer to Cloudinary.
 *
 * This is the serverless-safe upload path. With `multer.memoryStorage()` the
 * uploaded file is available as `file.buffer` (a `Buffer`) and there is NO file
 * on disk — so the disk-based `cloudinary.uploader.upload(file.path)` cannot be
 * used. Vercel (and most serverless runtimes) provide a read-only filesystem
 * except for `/tmp`, so writing temp files is fragile and unnecessary.
 *
 * `upload_stream` returns a writable stream; we push the buffer through it and
 * resolve with the API response. The buffer never touches the filesystem.
 */
export function uploadBufferToCloudinary(
  buffer: Buffer,
  options: UploadApiOptions = {}
): Promise<UploadApiResponse> {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      if (!result) return reject(new Error('Cloudinary upload returned no result'));
      resolve(result);
    });
    // `stream.end(buffer)` writes the whole buffer and closes the stream,
    // triggering the upload — no `streamifier` dependency required.
    stream.end(buffer);
  });
}

export default cloudinary;
