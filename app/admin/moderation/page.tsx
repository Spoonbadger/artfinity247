"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/contexts/UserProvider";
import { MaxWidthWrapper } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ModerationArtwork = {
  id: string;
  title: string;
  slug: string | null;
  imageUrl: string;
  createdAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  flaggedReason: string | null;
  flaggedBy: string | null;
  artist: {
    slug: string;
    artist_name: string | null;
    name: string;
    email: string;
  };
};

export default function ModerationPage() {
  const router = useRouter();
  const { currentUser } = useUser();
  const [artworks, setArtworks] = useState<ModerationArtwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleModeration = async (
    id: string,
    action: "approve" | "reject"
    ) => {
    const label = action === "approve" ? "Approve" : "Reject";

    if (action === "reject") {
        const sure = confirm("Reject this artwork?");
        if (!sure) return;
    }

    try {
        setUpdatingId(id);
        const res = await fetch(`/api/admin/moderation/artworks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
            action,
            reason: action === "reject" ? "rejected_by_admin" : undefined,
        }),
        });

        if (!res.ok) {
        const text = await res.text();
        toast.error(`${label} failed: ${text}`);
        return;
        }

        toast.success(`Artwork ${label.toLowerCase()}d`);

        // Remove from local list (queue shrinks)
        setArtworks((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
        console.error("Moderation error", err);
        toast.error("Server error");
    } finally {
        setUpdatingId(null);
    }
    };

    const handleDelete = async (id: string) => {
      const sure = confirm("Permanently delete this artwork? This cannot be undone.");
      if (!sure) return;

      try {
        setUpdatingId(id);
        const res = await fetch(`/api/admin/moderation/artworks/${id}`, {
          method: "DELETE",
          credentials: "include",
        });

        if (!res.ok && res.status !== 204) {
          const text = await res.text();
          toast.error(`Delete failed: ${text}`);
          return;
        }

        toast.success("Artwork deleted");
        setArtworks((prev) => prev.filter((a) => a.id !== id));
      } catch (err) {
        console.error("Delete error", err);
        toast.error("Server error");
      } finally {
        setUpdatingId(null);
      }
    };


  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role !== "ADMIN") {
      router.replace("/");
      return;
    }

    const fetchData = async () => {
      try {
        const res = await fetch("/api/admin/moderation/artworks");
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setArtworks(data.artworks || []);
      } catch (err) {
        console.error("Failed to load moderation queue", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, router]);

  if (!currentUser) {
    return <div className="p-6">Checking permissions…</div>;
  }

  if (currentUser.role !== "ADMIN") {
    return <div className="p-6">Unauthorized</div>;
  }

  return (
    <section className="my-8 md:my-12">
      <MaxWidthWrapper className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Artwork Moderation</h1>
          <Button size="sm" onClick={() => location.reload()}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="p-6">Loading…</div>
        ) : artworks.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No artworks to review.
          </div>
        ) : (
          <div className="space-y-4">
            {artworks.map((art) => (
              <div
                key={art.id}
                className="flex gap-4 rounded border p-3 text-sm items-start"
              >
                <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded bg-muted">
                  {art.imageUrl && (
                    <Image
                      src={art.imageUrl}
                      alt={art.title}
                      fill
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{art.title}</div>
                      <div className="text-xs text-muted-foreground">
                        By{" "}
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/artists/${art.artist.slug}`)
                          }
                          className="underline"
                        >
                          {art.artist.artist_name || art.artist.name}
                        </button>{" "}
                        · {new Date(art.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-xs">
                      <span
                        className={
                          art.status === "PENDING"
                            ? "rounded bg-yellow-100 px-2 py-1 text-yellow-800"
                            : art.status === "APPROVED"
                            ? "rounded bg-green-100 px-2 py-1 text-green-800"
                            : "rounded bg-red-100 px-2 py-1 text-red-800"
                        }
                      >
                        {art.status.toLowerCase()}
                      </span>
                    </div>
                  </div>

                  {art.flaggedReason && (
                    <div className="text-xs text-red-600">
                      Flagged: {art.flaggedReason}{" "}
                      {art.flaggedBy && `(by ${art.flaggedBy})`}
                    </div>
                  )}

                  {/* Actions will be wired next step */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingId === art.id}
                      onClick={() => handleModeration(art.id, "approve")}
                    >
                      {updatingId === art.id ? "Approving…" : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={updatingId === art.id}
                      onClick={() => handleModeration(art.id, "reject")}
                    >
                      {updatingId === art.id ? "Rejecting…" : "Reject"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={updatingId === art.id}
                      onClick={() => handleDelete(art.id)}
                    >
                      {updatingId === art.id ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </MaxWidthWrapper>
    </section>
  );
}
