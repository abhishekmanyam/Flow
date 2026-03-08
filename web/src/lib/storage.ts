import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function uploadAvatar(
  userId: string,
  file: File
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File must be an image");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File must be under 10MB");
  }

  const storageRef = ref(storage, `avatars/${userId}`);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}
