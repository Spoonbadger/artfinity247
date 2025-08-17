export const DEFAULT_SCENE_IMG =
  '/uploads/scenes/new_york.webp' // adjust if you prefer

export function sceneImagePath(citySlug: string) {
  // your files use underscores; slugs use hyphens
  const filename = citySlug.replace(/-/g, '_') + '.webp'
  return `/uploads/scenes/${citySlug.replace(/-/g, '_')}.webp`
}
