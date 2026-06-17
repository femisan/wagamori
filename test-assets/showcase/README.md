# Showcase / buyer-show sample assets

Real customer-supplied images, classified into **finished products** (the cloisonné
pendants people received) and their **source** (the child's drawing or pet photo the
pendant was made from).

| Finished product (买家秀) | Source (original) | Finish |
|---------------------------|-------------------|--------|
| `product-dog.jpg` — dog pendant, gold chain, in hand | `source-dog-photo.jpg` — real photo of the dog | gold |
| `product-girl.jpg` — blonde-girl pendant, silver chain, in gift box | `source-girl-drawing.jpg` — child's drawing | silver |
| `product-tomato.jpg` — tomato-creature pendant, gold chain, in hand | `source-tomato-drawing.jpg` — child's drawing | gold |
| `product-ant.jpg` — pink-ant pendant, gold chain, in gift box | `source-ant-drawing.jpg` — child's drawing | gold |

The four `product-*.jpg` images were seeded into the live buyer-show gallery
(`/showcase`) via `POST /api/admin/showcase/seed` (ADMIN_TOKEN-gated) with realistic
customer display names, Japanese captions, and like counts. To re-seed (e.g. on a
fresh DB), downscale them and POST again — see the seed route for the payload shape.

The `source-*` images are kept for reference / regression testing of the AI pipeline
(drawing/photo → cloisonné), alongside `test-assets/inputs/`.
