Connect Artfinity's room-preview scenes to real photos from Pexels, test it, and commit the photos to the repo. Do this on my computer, where the internet isn't restricted. I'm not a developer, so explain anything I need to click in one short line.

The code is at https://github.com/thomasdemuth/artfinity247 on branch `redesign/artist-first`. Never push to `main`. If the project is already cloned in my home folder, use it and pull the latest from that branch. Otherwise clone it with `git clone -b redesign/artist-first https://github.com/thomasdemuth/artfinity247.git`. Install packages with `npx -y pnpm@10.13.1 install`. Node 20 or newer is needed, and `LOCAL_SETUP_PROMPT.md` has install steps if Node is missing.

1. **Pexels API key.** Ask me for my free Pexels API key. If I don't have one, tell me to sign up at https://www.pexels.com/api/ and copy the key it shows. Put it in the project's `.env` file as `PEXELS_API_KEY=...`. Never commit `.env` (it's already git-ignored), and never paste the key into a commit, a file other than `.env`, or the chat log.

2. **Try one small batch first.** Run `npm run scenes:fetch -- --dry-run`, then `npm run scenes:fetch -- --max 12`. Check:
   - `scenes/photos/` now has `pexels-<id>.jpg` files with matching `pexels-<id>.json` credit files (photographer, page URL, license).
   - The photos are real interiors (living rooms, cafés, galleries, bedrooms, offices) where a wall is visible, ideally with a person, door, sofa or table for size reference.
   
   If a request fails, show me the exact error. If a key error or a 401 appears, the key in `.env` is wrong.

3. **Fetch the full set.** Run `npm run scenes:fetch` until there are about 150 photos. The free tier allows 200 requests an hour. The script stops and says when to come back, and running it again resumes. Then remove photos that won't work:
   - no clear wall area
   - wall too dark or busy
   - the only people are close-ups
   - anything with visible logos, artwork already on the wall in the spot we'd use, or anything inappropriate
   
   Delete both the .jpg and its .json. Aim for a mix: living rooms, cafés and restaurants, galleries, bedrooms, offices and hallways, with at least half including a person.

4. **Keep the repo light.** Check the total size of `scenes/photos/`. If any photo is over 700 KB, shrink it to a 2000px long edge at JPEG quality 82 with a small Node script using `sharp`, which is already installed. Keep the matching .json. The folder should end up under about 90 MB.

5. **Check the pipeline works.**
   - Start the site with `npx -y pnpm@10.13.1 local` (or `npm run dev` if the database is already set up).
   - Log in as admin (`admin@artfinity.local`, password `artfinity123`) and open http://localhost:3000/admin/scenes. Confirm the new photos appear.
   - Annotate 3 photos yourself to prove it works. Q, then click the 4 wall corners. A, then click where the art hangs. R, then draw a line along a person, door or sofa, and pick its type with 1–8. Enter saves.
   - Run `npm run scenes:build`, then `npm run scenes:render -- --art east-river-late-may --sizes small,xl --frames black --scenes base --sheet`.
   - Open the contact sheet it writes and check the art sits on the wall at a believable size next to the reference object.
   - Open http://localhost:3000/@mayaokafor/art/east-river-late-may and confirm the room preview now shows the photo scenes with a "Photo: … / Pexels" credit line.

6. **Commit and push.** Commit `scenes/photos/` (the .jpg and .json files), `scenes/annotations/` and `data/scenes.json`, with the message "Add real Pexels room photos for scene previews (with photographer credits)". Push with `git push origin redesign/artist-first`. Don't commit `.env`, `.cache/`, or `scenes/photos/.pexels-state.json`.

7. **Tell me what's left for me.** Annotating the rest of the photos is a person's job, about 30 seconds each at /admin/scenes. Around 84 annotated photos give the full 1,000 scene variations. After annotating a batch, run `npm run scenes:build` and commit `scenes/annotations/` and `data/scenes.json` the same way.

Rules: don't change the project's code. If something in the scripts is broken, show me the exact error and what you think the fix is, and wait. Only commit the photo, credit and annotation files listed above, and only to `redesign/artist-first`. Pexels photos are free to use under the Pexels License, and we keep the photographer credit with each one.
