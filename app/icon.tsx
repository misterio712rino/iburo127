import { renderIBuroAppIcon } from "@/lib/branding/app-icon";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return renderIBuroAppIcon(size.width);
}
