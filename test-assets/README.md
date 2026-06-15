# Test assets

Real customer-drawing screenshots used to test the AI necklace generation, and
the generated cloisonné results. Handy for regression-checking prompt changes.

## inputs/  (original drawings, as uploaded — phone screenshots with UI/clutter)
| file | description |
|---|---|
| family-bunnies.jpg | 3 bunnies (family of 3) + hearts |
| rainbow-girl.jpg | girl with rainbow hair + striped dress |
| book-3figures.jpg | sketchbook held in hand, 3 figures |
| stick-girl.jpg | simple stick-figure girl on textured paper |
| umbrella-girl.jpg | watercolor girl with yellow umbrella |
| card-collage.jpg | decorated card (girl + hearts/flowers/balloons), in a car |
| boy-blue.jpg | boy with spiky hair, blue shirt |

## outputs/  (AI cloisonné results, enamel / gold)
- `out1..out7_*` — first pass (single-subject isolation; multi-figure reduced to one)
- `all1_family / all2_book / all3_boy` — "whole drawing" mode (keeps all figures) + colour-fidelity fix
- `conn_joined / conn_linked` — connection-style comparison for multi-figure (family)

Background/phone-UI/hands were removed by the subject-isolation prompt in all cases.
