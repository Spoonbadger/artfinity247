"use client";
// /studio/art/new: the single upload form. Artists who already have work can pick several files or a folder there;
// that opens the upload queue (one painting at a time, same form). A saved queue (sessionStorage) reopens after a refresh.
// An artist's very first upload stays single-image.
import { useEffect, useState } from "react";
import ArtworkForm from "./ArtworkForm";
import UploadQueue, { readDraft, type QueueDraft } from "./UploadQueue";

export default function NewArtwork({ handle, split, canQueue }: { handle: string; split?: number; canQueue: boolean }) {
  const [queue, setQueue] = useState<{ files?: File[]; restored?: { draft: QueueDraft; dropped: number } } | null>(null);
  // Bumped when a queue ends, so the single form starts fresh.
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!canQueue) return;
    const restored = readDraft(handle);
    if (restored) setQueue({ restored });
  }, [canQueue, handle]);

  if (queue) {
    return <UploadQueue handle={handle} split={split} files={queue.files} restored={queue.restored} onExit={() => { setQueue(null); setRound((r) => r + 1); }} />;
  }
  return <ArtworkForm key={round} split={split} handle={handle} onManyFiles={canQueue ? (files) => setQueue({ files }) : undefined} />;
}
