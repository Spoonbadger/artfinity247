import { notFound } from "next/navigation";

// Any /studio/... address that isn't a Studio page: show the Studio 404 (menu, Studio home, Help), not the site one.
export default function StudioMissing() {
  notFound();
}
