"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useUser } from "@/components/contexts/UserProvider"

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter()
  const { setCurrentUser } = useUser()

  const onLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })
    } catch (_) {
    }
    localStorage.removeItem("token")
    setCurrentUser(null)
    router.push("/")
    router.refresh()
  }

  return (
    <Button onClick={onLogout} className={className}>
      logout
    </Button>
  )
}
