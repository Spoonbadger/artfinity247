import { qrSVG, type QrOptions } from "@/lib/qr/render";
import { cn } from "@/lib/utils";

/** Renders a styled, scannable QR code with the Artfinity mark in the middle. Server or client.
 *  Pass logo={false} for a plain code. */
export default function QRCode({ value, className, logo = true, ...opts }: QrOptions & { value: string; className?: string }) {
  return <div className={cn("[&>svg]:block [&>svg]:h-auto [&>svg]:w-full", className)} dangerouslySetInnerHTML={{ __html: qrSVG(value, { ...opts, logo }) }} />;
}
