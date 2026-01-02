"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MaxWidthWrapper } from "@/components/layout";
import { ImageWithText } from "@/components/sections";
import { ProductCard } from "@/components/cards";
import Pagination from "@/components/CustomPagination";
import SocialAccountLinks from "@/components/SocialAccountLinks";
import { getAppConfigs, getAppPages } from "@/db/query";
import { UserType, ProductType } from "@/types";
import { useUser } from "@/components/contexts/UserProvider";
import { toast } from "sonner";
import LogoutButton from '@/components/auth/LogoutButton'
import CITY_OPTIONS from "@/lib/constants/cities"
import US_STATE_OPTIONS from "@/lib/constants/usa_states";


type ParamsPropsType = { slug: string };

const AppConfigs = getAppConfigs();
const AppPages = getAppPages();

const SellerPage = ({ params }: { params: ParamsPropsType }): ReactNode => {
  const slug = decodeURIComponent(params.slug);
  const { currentUser, refreshUser, loading } = useUser()

  const [isOwner, setIsOwner] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  const [seller, setSeller] = useState<UserType | null | undefined>(undefined); // undefined=loading, null=not found
  const [bioDraft, setBioDraft] = useState("")

  const [nameDraft, setNameDraft] = useState("");

  const queryPageKey = "page"; // stop relying on AppConfigs
  const title = AppPages.seller?.title || "Artist";
  const items_limit = AppPages.seller?.items_limit || 12;
  const sections = AppPages.seller?.sections || { products: { title: "Artworks" }, reviews: { title: "Reviews" } };

  const [venmoHandle, setVenmoHandle] = useState("")

  const [totalSellerProducts, setTotalSellerProducts] = useState(0);
  const [paginatedProducts, setPaginatedProducts] = useState<ProductType[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(items_limit);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pickImage = () => fileInputRef.current?.click();

    useEffect(() => {
    const meSlug = currentUser?.slug
    if (meSlug && slug) setIsOwner(meSlug === slug);
  }, [currentUser, slug])

  useEffect(() => { 
    setNameDraft(seller?.name || ""); 
  }, [seller?.name])


  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const orig = e.target.files?.[0];
    if (!orig) return;

    setUploading(true);
    try {
      let file = orig;

      // HEIC detection (mime or extension)
      const mime = (orig.type || "").toLowerCase();
      const name = (orig.name || "").toLowerCase();
      const isHeic = mime.includes("heic") || mime.includes("heif") || /\.hei[c|f]$/.test(name);

      if (isHeic) {
        const heic2any = (await import("heic2any")).default as any;
        const converted = await heic2any({ blob: orig, toType: "image/jpeg", quality: 0.85 });
        const blob = Array.isArray(converted) ? converted[0] : converted;
        file = new File([blob], name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
      }

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/artists/profile-image", {
        method: "POST",
        body: formData,
        credentials: "include", // send auth cookie
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      setSeller((prev) => (prev ? { ...prev, profileImage: data.artist.profileImage } : prev));
      toast.success("Profile image updated");
    } catch (err) {
      console.error("Profile image upload failed", err);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  useEffect(() => {
    setItemsPerPage(items_limit);
    const q = parseInt(searchParams.get(queryPageKey) || "1", 10);
    setCurrentPage(q > 0 ? q : 1);
  }, [searchParams, queryPageKey, items_limit]);

  // SINGLE FETCH: profile + artworks
  useEffect(() => {
    if (!slug) return
    (async () => {
      const res = await fetch(`/api/artists/${slug}?page=${currentPage}&limit=${itemsPerPage}`, { cache: "no-store" });
      if (!res.ok) { setSeller(null); setPaginatedProducts([]); setTotalSellerProducts(0); return; }
      const data = await res.json();
      setSeller(data.artist);
      setPaginatedProducts(data.artworks || []);
      setTotalSellerProducts(data.total || 0);
    })();
  }, [slug, currentPage, itemsPerPage])

  useEffect(() => {
    if (seller) {
      setFirstNameDraft(seller.first_name || "");
      setLastNameDraft(seller.last_name || "");
      setArtistNameDraft(seller.artist_name || seller.name || "");
      setPhoneDraft(seller.phone || "");
      setBioDraft(seller.bio || "");
      setCityDraft(seller.city || "");
      setStateDraft(seller.state || "");
      setCountryDraft(seller.country || "US");
    }
  }, [seller])

  useEffect(() => { setBioDraft(seller?.bio || ""); }, [seller?.bio])

  const [cityDraft, setCityDraft] = useState("")
  const [stateDraft, setStateDraft] = useState("")
  const [countryDraft, setCountryDraft] = useState("US")
  const [firstNameDraft, setFirstNameDraft] = useState("")
  const [lastNameDraft, setLastNameDraft] = useState("")
  const [artistEmailDraft, setArtistEmailDraft] = useState("")
  const [phoneDraft, setPhoneDraft] = useState("")
  const [artistNameDraft, setArtistNameDraft] = useState("")
  const [errors, setErrors] = useState<{
    first_name?: string;
    last_name?: string;
    artist_name?: string;
    email?: string;
    phone?: string;
    city?: string;
    state?: string;
  }>({})


  useEffect(() => { setCityDraft(seller?.city || '') }, [seller?.city])

  const phonePattern = /^[+]?[0-9\s\-()]{7,20}$/;
  const isValidPhone = !!phoneDraft.trim() && phonePattern.test(phoneDraft.trim())

  const emailPattern = /^[^\s@]+@[^\s@]{2,}\.[^\s@]{2,}$/
  const isValidEmail =
    !!artistEmailDraft.trim() &&
    emailPattern.test(artistEmailDraft.trim().toLowerCase())

  const isFormComplete =
    !!firstNameDraft.trim() &&
    !!lastNameDraft.trim() &&
    !!artistNameDraft.trim() &&
    !!artistEmailDraft.trim() &&
    !!phoneDraft.trim() &&
    !!cityDraft.trim() &&
    !!stateDraft.trim() &&
    !!countryDraft.trim() &&
    venmoHandle.trim()

    const resetDraftsFromSeller = () => {
      if (!seller) return;
      setFirstNameDraft(seller.first_name || "");
      setLastNameDraft(seller.last_name || "");
      setArtistNameDraft(seller.artist_name || seller.name || "");
      setArtistEmailDraft(seller.email || "")
      setPhoneDraft(seller.phone || "");
      setBioDraft(seller.bio || "");
      setCityDraft(seller.city || "");
      setStateDraft(seller.state || "");
      setCountryDraft(seller.country || "US");
      setVenmoHandle(seller.venmoHandle || "")
      setErrors({})
    }

    function validateProfile() {
      const next: typeof errors = {}

      if (!firstNameDraft.trim()) next.first_name = "First name is required.";
      if (!lastNameDraft.trim())  next.last_name  = "Last name is required.";
      if (!artistNameDraft.trim()) next.artist_name = "Artist name is required.";

      if (!artistEmailDraft.trim()) next.email = "Email is required.";
      else if (!emailPattern.test(artistEmailDraft.trim().toLowerCase()))
        next.email = "Enter a valid email.";

      if (!phoneDraft.trim()) next.phone = "Phone number is required.";
      else if (!phonePattern.test(phoneDraft.trim()))
        next.phone = "Enter a valid phone number (digits, +, spaces, dashes).";

      if (!cityDraft.trim())  next.city  = "City is required.";
      if (!stateDraft.trim()) next.state = "State is required.";

      setErrors(next);
      return Object.keys(next).length === 0;
    }
                    

  const handleSaveProfile = async () => {
    // Validation
    const normalizedVenmo = venmoHandle.trim().startsWith("@")
    ? venmoHandle.trim()
    : "@" + venmoHandle.trim()

    const venmoPattern = /^@[A-Za-z0-9_-]{1,29}$/
    if (normalizedVenmo && !venmoPattern.test(normalizedVenmo)) {
      toast.error("Venmo handle can only contain letters, numbers, dashes, and underscores (max 30 chars)")
      return
    }

    if (!validateProfile()) {
      toast.error("Please fix the highlighted fields.");
      return
    }

    const cleanedPhone = phoneDraft.trim()
    if (cleanedPhone) {
      const phonePattern = /^[+]?[0-9\s\-()]{7,20}$/  // allows +, digits, (), spaces, dashes
      if (!phonePattern.test(cleanedPhone)) {
        toast.error("Please enter a valid phone number (digits, +, spaces, or dashes only)")
        return
      }
    }

    try {
      const res = await fetch("/api/artists/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstNameDraft.trim(),
          last_name: lastNameDraft.trim(),
          artist_name: artistNameDraft.trim(),
          email: artistEmailDraft.trim().toLowerCase(),
          phone: cleanedPhone.trim(),
          city: cityDraft,
          state: stateDraft,
          country: countryDraft,
          bio: bioDraft.trim(),
          venmoHandle: normalizedVenmo,
        }),
        credentials: "include",
      })
      if (!res.ok) throw new Error(await res.text())

      const { artist } = await res.json()

      setSeller(artist)
      toast.success("Profile updated")
      setIsEditing(false)

      if (artist.slug && artist.slug !== seller?.slug) {
        await refreshUser()   // Comes from useUser()
        router.replace(`/artists/${artist.slug}`)
        return
      }

    } catch (err) {
      console.error(err)
      toast.error("Failed to update profile")
    }
  }

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= Math.ceil(totalSellerProducts / itemsPerPage)) router.push(`?${queryPageKey}=${page}`);
    else router.push(`?${queryPageKey}=1`);
  }

  const [isEditing, setIsEditing] = useState(false)
  
  const handleEdit = (artworkSlug: string) => router.push(`/dashboard/edit/${artworkSlug}`);

  const handleDelete = async (artworkId: string) => {
    if (!confirm("Are you sure you want to delete this artwork?")) return;
    const res = await fetch(`/api/artworks/${artworkId}`, { 
      method: "DELETE",
      credentials: "include"
    })
    if (res.ok && seller?.slug) {
      // refetch current page
      const r = await fetch(`/api/artists/${seller.slug}?page=${currentPage}&limit=${itemsPerPage}`, { cache: "no-store" });
      if (r.ok) {
        const data = await r.json();
        setPaginatedProducts(data.artworks || []);
        setTotalSellerProducts(data.total || 0);
      }
      toast("- Artwork deleted")
    } else {
      alert("Failed to delete artwork");
    }
  };

const handleDeleteAccount = async () => {
  const sure = confirm(
    "Are you absolutely sure? This will permanently delete your profile and all your artworks."
  );
  if (!sure) return;

  try {
    const res = await fetch("/api/artists/delete-profile", {
      method: "DELETE",
      credentials: "include",
    });

    if (!res.ok) {
      const text = await res.text();
      toast.error(`Delete failed: ${text}`);
      return;
    }

    toast.success("Account deleted");

    // optional: clear user context
    await refreshUser();

    // log user out & redirect
    window.location.replace("/");
  } catch (err) {
    console.error("Delete account error:", err);
    toast.error("Something went wrong");
  }
}

  // guards
  if (seller === undefined) return <div className="p-6 text-theme-secondary-600">Loading…</div>;
  if (seller === null) return <div className="p-6">Artist not found.</div>;


  return (
    <div>
      <title>{`${title} - ${seller?.name || "Info"}: ${AppConfigs.app_name}`}</title>

      <section className="my-12 md:my-16">
        <MaxWidthWrapper>
          <ImageWithText
            img={seller?.profileImage || "/assets/images/icons/users/generic-user-profile-picture.png"}
            title={seller?.name || ""}
            imgAlign="left"
            txtAlign="left"
            imgLoading="eager"
            className="[&_.area-content]:self-center [&_.area-media]:relative [&_.area-image]:object-contain"
            onEditPhoto={isOwner ? pickImage : undefined}
          >

            {/* Hidden input for file upload */}
            {isOwner && (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={onFileChange}
              />
            )}

            {/* When 'editing', buttons here */}
            {isOwner ? (
              isEditing ? (
                <div className="space-y-3 mt-4">
                  <input value={firstNameDraft} onChange={e=>setFirstNameDraft(e.target.value)} className="border rounded px-2 py-1 text-sm w-full text-theme-secondary-500" placeholder="First Name" />
                  <input value={lastNameDraft} onChange={e=>setLastNameDraft(e.target.value)} className="border rounded px-2 py-1 text-sm w-full text-theme-secondary-500" placeholder="Last Name" />
                  <label className="text-sm font-medium text-theme-secondary-600">
                    Artist name (public)
                  <input value={artistNameDraft} onChange={e=>setArtistNameDraft(e.target.value)} className="border rounded px-2 py-1 text-sm w-full text-theme-secondary-500" placeholder="Artist Name" />
                  </label>
                  <input
                    value={artistEmailDraft}
                    onChange={(e) => {
                      setArtistEmailDraft(e.target.value);
                      if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                    }}
                    className={`text-theme-secondary-500 border rounded px-2 py-1 text-sm w-full ${errors.email ? "border-red-500" : ""}`}
                    placeholder="Email"
                    type="email"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                  {errors.email && (
                    <p id="email-error" className="text-xs text-red-600 mt-1">{errors.email}</p>
                  )}

                  <input
                    value={phoneDraft}
                    onChange={(e) => {
                      setPhoneDraft(e.target.value);
                      if (errors.phone) setErrors(prev => ({ ...prev, phone: undefined }));
                    }}
                    className={`text-theme-secondary-500 border rounded px-2 py-1 text-sm w-full ${errors.phone ? "border-red-500" : ""}`}
                    placeholder="Phone Number"
                  />
                  {errors.phone && (
                    <p className="text-xs text-red-600 mt-1">{errors.phone}</p>
                  )}
                  <textarea value={bioDraft} onChange={e=>setBioDraft(e.target.value)} className="text-theme-secondary-500 w-full rounded border p-2 text-sm" placeholder="Bio" />

                    <Select
                      value={cityDraft}
                      onValueChange={(val) => {
                        setCityDraft(val);
                        const found = CITY_OPTIONS.find((c) => c.name === val);
                        if (found?.state) setStateDraft(found.state);
                        setCountryDraft("US")
                      }}
                    >
                      <SelectTrigger className="max-w-[220px] capitalize text-theme-secondary-500">
                        <SelectValue placeholder="Select city" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Cities</SelectLabel>
                          {CITY_OPTIONS.map((c) => (
                            <SelectItem key={c.name} value={c.name}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>

                    <Select
                      value={stateDraft}
                      onValueChange={(val) => {
                        setStateDraft(val)
                        setCityDraft("")
                      }}
                    >
                      <SelectTrigger className="max-w-[220px] capitalize text-theme-secondary-500">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>States</SelectLabel>
                          {US_STATE_OPTIONS.map((s) => (
                            <SelectItem key={s.code} value={s.code}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>

                  <Select value={countryDraft} onValueChange={setCountryDraft}>
                    <SelectTrigger className="text-theme-secondary-500">
                      <SelectValue placeholder="Country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">United States</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    value={venmoHandle}
                    onChange={(e) => setVenmoHandle(e.target.value)}
                    className="border rounded px-2 py-1 text-sm w-full text-theme-secondary-500"
                    placeholder="Venmo handle (e.g. @artistname)"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveProfile}
                    disabled={!isFormComplete || !isValidEmail || !isValidPhone}
                    aria-disabled={!isFormComplete || !isValidEmail || !isValidPhone}
                  >
                    Save All
                  </Button>
                  <Button size="sm" variant="secondary" onClick={()=> { resetDraftsFromSeller(), setIsEditing(false) }}>
                    Cancel
                  </Button>
                  <div>
                    {isOwner && isEditing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-4 mt-10"
                        onClick={handleDeleteAccount}
                      >
                        Delete account
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <p className="text-sm">{seller?.bio}</p>
                  <p className="text-xs text-slate-600">Based in {seller?.city}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isOwner && (
                      <div>
                        <Link href="/my-sales">
                          <Button className="mr-2" size="sm">Sales</Button>
                        </Link>
                        <Link href="/my-purchases">
                          <Button size="sm">Your Purchases</Button>
                        </Link>
                      </div>
                    )}
                    <div>
                    <Button size="sm" onClick={() => { resetDraftsFromSeller(), setIsEditing(true) }}>
                      Edit Profile
                    </Button>
                    <LogoutButton  className='mx-2'/>
                    </div>

                    {isOwner && !seller?.venmoHandle && (
                      <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 p-3 rounded mb-4 text-sm">
                        ⚠ You haven’t added your Venmo handle yet. Add it in “Edit Profile” to receive payouts.
                      </div>
                    )}


                    {!loading && currentUser?.role === "ADMIN" && (
                      <div>
                        <Link href="/admin/orders">
                          <Button size="sm" variant="destructive" className='mr-2'>Admin Orders</Button>
                        </Link>
                        <Link href="/admin/payouts">
                          <Button size="sm" variant="destructive">Admin Payouts</Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              <>
                <p className="text-sm">{seller?.bio}</p>
                <p className="text-xs text-slate-600">Based in {seller?.city}</p>
              </>
            )}

            <SocialAccountLinks
              links={seller?.social_accounts ?? []}
              className="justify-center md:justify-start mt-6"
            />
          </ImageWithText>
        </MaxWidthWrapper>
      </section>

      <section className="my-12 md:my-16">
        <MaxWidthWrapper className="space-y-4 md:space-y-6">
          <h2>{sections?.products?.title || "Artworks"}</h2>
          <div className="page-top grid grid-cols-1 items-center justify-between gap-x-4 gap-y-2 space-y-2 md:grid-cols-2 md:gap-6">
            <div>
              <div className="filter-area relative isolate">
                <Select>
                  <SelectTrigger className="max-w-[180px] capitalize">
                    <SelectValue className="capitalize" placeholder="Default Sorting" />
                  </SelectTrigger>
                  <SelectContent className="capitalize">
                    <SelectGroup>
                      <SelectLabel>Sort By</SelectLabel>
                      <SelectItem value="popularity">popularity</SelectItem>
                      {/* <SelectItem value="rating_average">average rating</SelectItem> */}
                      <SelectItem value="latest">latest</SelectItem>
                      <SelectItem value="price_low_to_high">price: low to high</SelectItem>
                      <SelectItem value="price_high_to_low">price: high to low</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Pagination
                totalItems={totalSellerProducts}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                className="hidden justify-end md:flex"
              />
            </div>
          </div>

          {paginatedProducts.length > 0 ? (
            <div className="products-area grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
              {paginatedProducts.map((product) => (
                <div key={product.id} className="relative">
                  <Link href={`/art/${product.slug}`}>
                    <ProductCard product={product} />
                  </Link>
                {isOwner && (
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button
                      className="text-xs px-2 py-1 bg-blue-600 text-white rounded"
                      onClick={() => handleEdit(product.slug)}
                    >
                      Edit
                    </button>

                    <button
                      className="text-xs px-2 py-1 bg-red-900 text-white rounded"
                      onClick={() => handleDelete(product.id)}
                    >
                      Delete
                    </button>

                    {/* QR actions */}
                    <button
                      className="text-xs px-2 py-1 bg-slate-700 text-white rounded"
                      onClick={() => window.open(`/api/artworks/${product.slug}/qr`, '_blank', 'noopener')}
                    >
                      View QR
                    </button>

                    <button
                      className="text-xs px-2 py-1 bg-slate-900 text-white rounded"
                      onClick={() => window.open(`/api/artworks/${product.slug}/qr?download=1`, '_blank', 'noopener')}
                    >
                      Download QR
                    </button>
                  </div>
                )}
                </div>
              ))}
            </div>
          ) : (
            isOwner && (
              <div className="my-8 text-center">
                <p className="mb-4 text-lg">You haven’t uploaded any artwork yet.</p>
                <Link href="/dashboard/upload"><Button>Upload Artwork</Button></Link>
              </div>
            )
          )}

          {isOwner && paginatedProducts.length > 0 && (
            <div className="mt-6 text-center">
              <Link href="/dashboard/upload"><Button>Upload Artwork</Button></Link>
              <div className='m-6'>
                <button
                  className="text-xs px-3 py-2 bg-slate-700 text-white rounded"
                  onClick={() => window.open('/api/artworks/qr/bulk?layout=4up', '_blank', 'noopener')}
                >
                  View all qr cards
                </button>
                <button
                  className="text-xs px-3 py-2 bg-slate-900 text-white rounded"
                  onClick={() => window.open('/api/artworks/qr/bulk?layout=4up&download=1', '_blank', 'noopener')}
                >
                  Download all qr cards
                </button>
              </div>
            </div>
          )}

          <div className="pagination-area flex items-center justify-center py-6">
            <Pagination
              totalItems={totalSellerProducts}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              onPageChange={handlePageChange}
            />
          </div>
        </MaxWidthWrapper>
      </section>
    </div>
  )
}

export default SellerPage

