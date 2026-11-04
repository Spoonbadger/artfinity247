import { qrSVG, type QrOptions } from "@/lib/qr/render";
import { cn } from "@/lib/utils";

/** Renders a styled, scannable QR code. Server or client. */
export default function QRCode({ value, className, ...opts }: QrOptions & { value: string; className?: string }) {
  return <div className={cn("[&>svg]:block [&>svg]:h-auto [&>svg]:w-full", className)} dangerouslySetInnerHTML={{ __html: qrSVG(value, opts) }} />;
}
