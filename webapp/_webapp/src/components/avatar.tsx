import { useEffect, useState } from "react";
import { fetchImage } from "../intermediate";

interface AvatarProps {
  name?: string;
  src?: string;
  className?: string;
}

export function Avatar({ name, src, className }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [imageBase64, setImageBase64] = useState<string>("");

  useEffect(() => {
    if (src) {
      fetchImage(src)
        .then((base64) => {
          setImageBase64(base64);
          setImgError(false);
        })
        .catch(() => {
          setImgError(true);
        });
    } else {
      setImageBase64("");
    }
  }, [src]);

  if (!imageBase64 || imgError) {
    return <span className={className + " pd-avatar-fallback"}>{name}</span>;
  }

  return (
    <img
      src={imageBase64}
      alt={name || "avatar"}
      onLoad={() => setImgError(false)}
      className={className + " pd-avatar"}
      style={{
        pointerEvents: "none",
      }}
    />
  );
}
