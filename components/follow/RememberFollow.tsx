"use client";

import { useEffect } from "react";
import { rememberFollow, type FollowState } from "./FollowButton";

/** Updates this browser's Follow button after the confirm / unsubscribe link. */
export default function RememberFollow({ handle, state }: { handle: string; state: FollowState }) {
  useEffect(() => rememberFollow(handle, state), [handle, state]);
  return null;
}
