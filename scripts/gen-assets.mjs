// One-off asset generator. Run: node scripts/gen-assets.mjs
// Requires OPENAI_API_KEY in the environment.
import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "public", "gallery");
fs.mkdirSync(outDir, { recursive: true });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const JOBS = [
  {
    file: "hero.png",
    prompt:
      "A single adorable hand-painted enamel jewelry charm illustration of a smiling little girl with brown pigtails, a yellow dress, round rosy pink cheeks, drawn in the bold-outline flat-color style of a happy child's crayon drawing. Centered on a pure clean white background with generous margin. Cute, warm, premium. No text.",
  },
  {
    file: "doodle.png",
    prompt:
      "A child's crayon and marker drawing on slightly textured white paper: a smiling girl with scribbly black pigtails, pink cheeks, a yellow dress, simple wobbly lines, innocent and charming. Flat top-down photo of the paper. No text.",
  },
  {
    file: "1.png",
    prompt:
      "Product photo of a delicate 18k gold necklace with a small round enamel pendant showing a cute child's crayon-style self-portrait of a little girl with pigtails and rosy cheeks. The necklace is laid on a cream gift card on a soft blurred natural background, warm sunlight. Premium handmade jewelry e-commerce shot. No text.",
  },
  {
    file: "2.png",
    prompt:
      "Product photo of a dainty gold necklace with a small enamel pendant shaped like a cute cartoon corgi dog with a happy face, flat bright colors and bold outlines. Laid on a cream card with soft natural blurred background and warm light. Premium handmade jewelry e-commerce shot. No text.",
  },
  {
    file: "3.png",
    prompt:
      "Product photo of a gold necklace with a small enamel pendant depicting a child's crayon-style family drawing (a few simple smiling stick-style figures holding hands, bright flat colors, bold outlines). On a cream gift card, soft blurred warm background. Premium handmade jewelry e-commerce shot. No text.",
  },
  {
    file: "4.png",
    prompt:
      "Product photo of a delicate gold necklace with a small enamel pendant showing a cute cartoon grey-and-white cat with big eyes and pink nose, flat colors, bold friendly outlines. Resting on a cream card with soft warm blurred background. Premium handmade jewelry e-commerce shot. No text.",
  },
];

let ok = 0;
for (const job of JOBS) {
  try {
    process.stdout.write(`Generating ${job.file}… `);
    const res = await client.images.generate({
      model: "gpt-image-1",
      prompt: job.prompt,
      size: "1024x1024",
      quality: "medium",
      n: 1,
    });
    const b64 = res.data[0].b64_json;
    fs.writeFileSync(path.join(outDir, job.file), Buffer.from(b64, "base64"));
    ok++;
    console.log("done");
  } catch (e) {
    console.log("FAILED:", e.message);
  }
}
console.log(`\n${ok}/${JOBS.length} assets generated → public/gallery/`);
