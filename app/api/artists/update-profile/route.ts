import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { jwtVerify, SignJWT } from "jose"
import slugify from "slugify"

async function makeUniqueSlug(base: string, selfId: string) {
  let slug = base
  let i = 2
  while (true) {
    const exists = await prisma.artist.findFirst({
      where: { slug, NOT: { id: selfId } },
      select: { id: true },
    })
    if (!exists) return slug
    slug = `${base}-${i++}`
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("auth-token")?.value
    if (!token) return new NextResponse("Not authenticated", { status: 401 })

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    )
    const artistId = payload.id as string
    const data = await req.json()

    // --- validation ---
    const artistName = data.artist_name?.trim() || ""
    if (!artistName)
      return new NextResponse("Artist name required", { status: 400 })

    let venmoHandle = data.venmoHandle?.trim() || null

    if (venmoHandle) {
      if (!venmoHandle.startsWith('@')) venmoHandle = '@' + venmoHandle

      // Validation pattern
      const venmoPattern = /^@[A-Za-z0-9_-]{1,29}$/ // '@' + up to 29 valid chars
      if (!venmoPattern.test(venmoHandle)) {
        return new NextResponse("Invalid Venmo handle", { status: 400 })
      }
    }

    // --- email normalize + validate + unique ---
    const rawEmail = (data.email || "").trim().toLowerCase()
    if (!rawEmail) return new NextResponse("Email required", { status: 400 })

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/ // simple, safe
    if (!emailPattern.test(rawEmail)) {
      return new NextResponse("Invalid email", { status: 400 })
    }

    // Ensure unique (ignore self)
    const emailClash = await prisma.artist.findFirst({
      where: { email: rawEmail, NOT: { id: artistId } },
      select: { id: true },
    })
    if (emailClash) {
      return new NextResponse("Email already in use", { status: 400 })
    }


    // --- find current artist ---
    const current = await prisma.artist.findUnique({
      where: { id: artistId },
      select: { artist_name: true, slug: true, city: true, citySlug: true },
    })
    if (!current)
      return new NextResponse("Artist not found", { status: 404 })

    // --- slug generation (you already have this above) ---
    const base = slugify(artistName, { lower: true, strict: true })
    let newSlug = current.slug
    if (current.artist_name !== artistName) {
      newSlug = await makeUniqueSlug(base, artistId)
    }

    // --- city + citySlug calc (ADD THIS BLOCK) ---
    const incomingCity = (data.city ?? "").trim()
    const cityChanged = !!incomingCity && incomingCity !== current.city
    const newCity = cityChanged ? incomingCity : current.city
    const newCitySlug = cityChanged
      ? slugify(newCity, { lower: true, strict: true })
      : current.citySlug


    // --- update artist ---
    const artist = await prisma.artist.update({
      where: { id: artistId },
      data: {
        first_name: data.first_name?.trim() || null,
        last_name: data.last_name?.trim() || null,
        artist_name: artistName,
        name: artistName, // keeping legacy sync... for now
        email: rawEmail,
        phone: data.phone?.trim() || null,
        city: newCity,
        citySlug: newCitySlug,
        state: data.state?.trim() || null,
        country: data.country?.trim() || null,
        bio: data.bio?.trim() || null,
        slug: newSlug,
        venmoHandle,
      },
    })

    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const newToken = await new SignJWT({
      id: artist.id,
      slug: artist.slug,     // include updated slug
      role: artist.role,
      email: artist.email,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret)

    // Return new cookie
    const res = NextResponse.json({ artist })

    res.cookies.set("auth-token", newToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })
    return res

  } catch (err) {
    console.error("Update profile failed:", err)
    return new NextResponse("Server error", { status: 500 })
  }
}
