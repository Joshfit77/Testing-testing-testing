# Exercise animations: known limitations (2026-11-20)

The 2D athlete is checked automatically on every frame of every exercise (`tests/unit/exercise-*.test.ts`, 1,761
tests: joint speeds, planted feet, equipment clearance from the head and body, plates inside the picture, loop seams).
What those checks can't judge is how a movement *reads* from a fixed camera. Known cases:

| Exercise | Limitation | Status |
|---|---|---|
| Cable Fly | Drawn from the front. The arc (cables from the pulleys to the handles, elbows slightly bent, hands meeting in front of the lower chest) is correct, but in a flat front view the squeeze toward the camera is foreshortened, so the end of the movement looks less pronounced than it is. A raised camera was tried and dropped: from above, hands reaching forward look as if they drop to the hips. | **Planned**: a three-quarter camera on the next animation milestone (owner decision 2026-11-20: keep the current fix, don't rebuild the renderer for one exercise). |
| Log Press | The log's near half is drawn as a cutaway (`logCover`) so it never appears to pass through the athlete. In the rack it rests on the chest (at most 0.9 cm drawn overlap, down from 23.6 cm before the fix) and clears the head by 2.0 cm overhead. | Accepted; regression-tested (body gap, head clearance). |
| Push Press, Overhead Press | The bar clears the face by 3.4 cm (push press) and 3.7 cm (overhead press) at its closest. | Accepted; regression-tested. |

Visual sign-off from the owner is still pending for the Cable Fly. None of these block the private TestFlight build:
they are presentation, not function.
