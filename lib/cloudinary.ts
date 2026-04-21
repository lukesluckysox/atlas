import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadImage(
  file: Buffer,
  folder = "atlas"
): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: "image" }, (err, result) => {
        if (err || !result) reject(err);
        else resolve(result.secure_url);
      })
      .end(file);
  });
}

export async function uploadImageFromBase64(
  base64: string,
  folder = "atlas"
): Promise<string> {
  const result = await cloudinary.uploader.upload(base64, {
    folder,
    resource_type: "image",
  });
  return result.secure_url;
}

export { cloudinary };
