# Exercise library: 3D demonstration status

Generated 2026-10-29 by `npx tsx scripts/anatomy/library-status.mts --qa /tmp/claude-0/-home-user-Testing-testing-testing/b5f7be41-8a07-5fa2-949c-491c9ac58107/scratchpad/qa36f` from the code and files; do not edit by hand.

## The counts, kept apart

| What | Count |
| --- | ---: |
| **Original exercises** in the app (`src/data/exercises.ts`), each with a hand-made animated illustration | 157 |
| **Proposed additional exercises** (`EXERCISES_300.md`): a list awaiting approval; none exists in the app, none has a motion of any kind | 143 |
| Original exercises with an **implemented 3D motion** (their own spec: equipment, grips, 3D keyframes) | 18 |
| Original exercises with **no 3D motion** (the figure can only follow the 2D motion with no equipment and free hands: a placeholder, not a demonstration, and not shown in the app) | 139 |
| With a **baked motion** (`public/anatomy/bake`), as a phone plays it | 18 |
| **Automated QA pass** (`check-motion.mts --baked`, 24 samples) | 15 |
| Automated QA **fail** | 3 |
| 3D motions with **no automated QA run** recorded here | 0 |
| **Visual review** pass (Claude (the coding session), from the rendered videos (30 fps, two angles each) and close-up stills; not the owner, 2026-10-29; this is a reviewer's eye, not the owner's approval) | 14 |
| Visual review fail | 4 |
| **Owner's visual approval** of the rendered motion | 0 |
| Shown in the app as the 3D figure (with the illustration as fallback): read from `src/lib/anatomy3d/in-app.ts` on this branch | 5 |
| **PASS** (automated QA and visual review both pass, nothing visibly wrong; still not the owner's approval) | 11 |
| **POLISH NEEDED** (automated QA passes and the movement reads right, but a visible defect remains; not counted as approved) | 3 |
| **FAIL** (either fails) | 4 |
| **NOT TESTED** (no 3D motion, or not checked) | 139 |

Proposed additions by section: Strength 75, Core 15, Power and plyometric 18, Conditioning 13, Cardio 4, Mobility 18. None of them is built.

## Exercises with a 3D motion (18)

| Exercise | Bake | Automated QA | Visual review | Owner approval | In the app | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Sumo Deadlift (`sumo-deadlift`) | 115 frames, 3.8 s | FAIL: detached: Left_gracilis (29); detached: Right_gracilis (27); baked playback strays 2.6 cm from the solve between frames | FAIL: wide stance, hands inside the knees, the bar pulled from the floor to lockout and back, reads as a sumo pull from both angles; the automated check fails it: the gracilis pulls away from the thigh, the bar sits 1.3 cm off the hands, and the baked playback strays 2.6 cm from the live solve between frames | none | illustration | **FAIL** |
| Kettlebell Swing (`kettlebell-swing`) | 53 frames, 1.73 s | PASS | VISIBLE DEFECT: flat back through the hinge now (the chest brought into line with the pelvis; tilting the pelvis the rest of the way stretched the gracilis past 2%), stance a touch wider so the bell clears the thighs, hands on the handle, three-quarter views read as arms; at the top of the swing the pectorals and lats are still drawn into a sheet between the chest and the forward arms (close-up), which a pectoral corrective shape did not change | none | 3D figure, illustration as fallback | **POLISH NEEDED** |
| Push Press (`push-press`) | 97 frames, 3.2 s | PASS | FAIL: the rack now sits on the front of the shoulders with the elbows forward and out, the grip overhand throughout, the dip, drive and press read right, the figure fills the frame, and the automated check passes again (a first version pointed the elbows straight forward and the forearm wound round; a palms-up rack flipped the hand); at lockout the deltoid still flares into a flat sheet beside each arm (dual-quaternion skinning for it: no visible change). Still wrong by eye at lockout. | none | illustration | **FAIL** |
| Dumbbell Lateral Raise (`lateral-raise`) | 109 frames, 3.6 s | PASS | PASS: raise to shoulder height, slight forward lean, dumbbells in the hands; the figure fills the frame now; front three-quarter and rear renders | none | illustration | **PASS** |
| Cable Triceps Pushdown (`triceps-pushdown`) | 103 frames, 3.4 s | PASS | PASS: straight bar at the cable, elbows at the sides, push to extension; the cable runs to the top pulley; side and front renders | none | illustration | **PASS** |
| Inverted Row (`inverted-row`) | 99 frames, 3.25 s | PASS | PASS: body straight under the bar in the rack, heels on the floor, chest pulled to the bar; wide frame, side and front three-quarter | none | 3D figure, illustration as fallback | **PASS** |
| Dumbbell Biceps Curl (`dumbbell-curl`) | 109 frames, 3.6 s | PASS | PASS: supinated curl, dumbbells in the hands to the shoulders, elbows at the sides; side and front three-quarter renders | none | 3D figure, illustration as fallback | **PASS** |
| Hammer Curl (`hammer-curl`) | 109 frames, 3.6 s | PASS | PASS: neutral grip held through the curl, dumbbells in the hands, elbows at the sides; front three-quarter and side | none | illustration | **PASS** |
| Pallof Press (`pallof-press`) | 118 frames, 3.9 s | PASS | PASS: side-on to the cable, both hands on the handle at the chest, pressed out and back, the trunk holding; seen from behind the shoulder and from the front three-quarter, the arms read as arms | none | illustration | **PASS** |
| Cable Woodchop (`cable-woodchop`) | 85 frames, 2.8 s | PASS | VISIBLE DEFECT: high-to-low chop with the trunk turning and the cable to the top pulley, the figure filling the frame; the close-up at mid-chop shows both hands on the two rope ends and the automated contact check passes, but in the video from behind the far hand still reads as if it were off the rope (the body hides it); your eye on the player decides | none | illustration | **POLISH NEEDED** |
| Medicine Ball Rotational Throw (`medicine-ball-rotational-throw`) | 157 frames, 2.6 s | PASS | VISIBLE DEFECT: ball held in both hands at the hip, the trunk turns, the fingers now close round the ball instead of splaying, the ball leaves towards the wall and comes back to the catch; the figure fills the frame; it reappears in the hands when the loop restarts (inherent to a looping throw) | none | illustration | **POLISH NEEDED** |
| Farmer's Carry (`farmers-carry`) | 36 frames, 1.15 s | PASS | PASS: walking stride with the dumbbells at the sides, arms straight; side and front three-quarter | none | illustration | **PASS** |
| Sled Push (`sled-push`) | 34 frames, 1.1 s | PASS | PASS: hands on the posts, body angled into the sled, legs driving; the sled on the floor and moving | none | 3D figure, illustration as fallback | **PASS** |
| Rowing Machine (`rowing-intervals`) | 64 frames, 2.1 s | FAIL: stretched: Left_gracilis (2.2% of its surface); stretched: Right_gracilis (2.0% of its surface); detached: Left_gracilis (30); detached: Right_gracilis (28) | FAIL: catch, drive and layback read as rowing; seat, handle and chain move with the body; the gracilis still stretches and pulls away from the thigh at the catch (the automated check fails it) | none | illustration | **FAIL** |
| Running Intervals (`running-intervals`) | 42 frames, 0.68 s | PASS | PASS: sprint stride, knee drive and arm swing read right at 30 fps | none | illustration | **PASS** |
| Cable Chest Fly (`cable-chest-fly`) | 112 frames, 3.7 s | PASS | PASS: between two towers, handles from the high pulleys, arms open wide and brought together low in front; cables stay in the hands; front three-quarter and rear renders | none | 3D figure, illustration as fallback | **PASS** |
| Overhead Triceps Extension (`overhead-triceps-extension`) | 112 frames, 3.7 s | FAIL: wristR held at its limit by 15; wristL held at its limit by 15; pop: shT2R jumps 120° at 88%; stretched: Right_teres_major (4.4% of its surface); stretched: Left_teres_major (4.3% of its surface); stretched: Right_latissimus_dorsi (2.1% of its surface); stretched: Left_latissimus_dorsi (2.1% of its surface); collapsed: Left_teres_minor (5.6% of its surface); collapsed: Right_teres_minor (5.6% of its surface); collapsed: Left_infraspinatus_muscle (2.1% of its surface); collapsed: Right_infraspinatus_muscle (2.1% of its surface); dumbbell 1.6 cm into the thumb1L; baked playback strays 1.7 cm from the solve between frames | FAIL: dumbbell held overhead in both hands, lowered behind the head and pressed back up; at the bottom the upper arms and armpits flatten into sheets and the elbows flare; the automated check fails it (wrists held at their limit, a pop in the elbow, the shoulder helpers) | none | illustration | **FAIL** |
| Air Bike Sprint (`air-bike-sprint`) | 43 frames, 1.4 s | PASS | PASS: seated on the bike, hands on the levers, feet on the pedals; levers and cranks move with the body | none | illustration | **PASS** |

## Exercises without a 3D motion (139)

These keep the animated illustration in the app. The 3D figure has no motion for them beyond the generic lift of the 2D motion (no equipment, hands free), which is not a demonstration and is not shown; they are **NOT TESTED** for 3D.

| Exercise | Category | In the app | Result |
| --- | --- | --- | --- |
| Barbell Back Squat (`back-squat`) | strength | illustration | NOT TESTED |
| Barbell Front Squat (`front-squat`) | strength | illustration | NOT TESTED |
| Goblet Squat (`goblet-squat`) | strength | illustration | NOT TESTED |
| Bodyweight Squat (`bodyweight-squat`) | strength | illustration | NOT TESTED |
| Sit-to-Stand (Chair Squat) (`box-squat-to-chair`) | strength | illustration | NOT TESTED |
| Leg Press (`leg-press`) | strength | illustration | NOT TESTED |
| Conventional Deadlift (`conventional-deadlift`) | strength | illustration | NOT TESTED |
| Trap Bar Deadlift (`trap-bar-deadlift`) | strength | illustration | NOT TESTED |
| Romanian Deadlift (`romanian-deadlift`) | strength | illustration | NOT TESTED |
| Single-Leg Romanian Deadlift (`single-leg-rdl`) | strength | illustration | NOT TESTED |
| Barbell Hip Thrust (`hip-thrust`) | strength | illustration | NOT TESTED |
| Glute Bridge (`glute-bridge`) | strength | illustration | NOT TESTED |
| Machine Leg Curl (`leg-curl`) | strength | illustration | NOT TESTED |
| Machine Leg Extension (`leg-extension`) | strength | illustration | NOT TESTED |
| Standing Calf Raise (`standing-calf-raise`) | strength | illustration | NOT TESTED |
| Dumbbell Walking Lunge (`walking-lunge`) | strength | illustration | NOT TESTED |
| Reverse Lunge (`reverse-lunge`) | strength | illustration | NOT TESTED |
| Bulgarian Split Squat (`bulgarian-split-squat`) | strength | illustration | NOT TESTED |
| Step-Up (`step-up`) | strength | illustration | NOT TESTED |
| Barbell Bench Press (`bench-press`) | strength | illustration | NOT TESTED |
| Dumbbell Bench Press (`dumbbell-bench-press`) | strength | illustration | NOT TESTED |
| Incline Dumbbell Press (`incline-dumbbell-press`) | strength | illustration | NOT TESTED |
| Close-Grip Bench Press (`close-grip-bench-press`) | strength | illustration | NOT TESTED |
| Push-Up (`push-up`) | strength | illustration | NOT TESTED |
| Incline Push-Up (`incline-push-up`) | strength | illustration | NOT TESTED |
| Wall Push-Up (`wall-push-up`) | strength | illustration | NOT TESTED |
| Parallel Bar Dip (`dips`) | strength | illustration | NOT TESTED |
| Standing Overhead Press (`overhead-press`) | strength | illustration | NOT TESTED |
| Seated Dumbbell Shoulder Press (`seated-dumbbell-shoulder-press`) | strength | illustration | NOT TESTED |
| Pike Push-Up (`pike-push-up`) | strength | illustration | NOT TESTED |
| Half-Kneeling Landmine Press (`landmine-press`) | strength | illustration | NOT TESTED |
| Pull-Up (`pull-up`) | strength | illustration | NOT TESTED |
| Band-Assisted Pull-Up (`band-assisted-pull-up`) | strength | illustration | NOT TESTED |
| Chin-Up (`chin-up`) | strength | illustration | NOT TESTED |
| Lat Pulldown (`lat-pulldown`) | strength | illustration | NOT TESTED |
| Bent-Over Barbell Row (`barbell-row`) | strength | illustration | NOT TESTED |
| One-Arm Dumbbell Row (`one-arm-dumbbell-row`) | strength | illustration | NOT TESTED |
| Seated Cable Row (`seated-cable-row`) | strength | illustration | NOT TESTED |
| Resistance Band Row (`band-row`) | strength | illustration | NOT TESTED |
| Face Pull (`face-pull`) | strength | illustration | NOT TESTED |
| Band Pull-Apart (`band-pull-apart`) | strength | illustration | NOT TESTED |
| Front Plank (`plank`) | core | illustration | NOT TESTED |
| Side Plank (`side-plank`) | core | illustration | NOT TESTED |
| Dead Bug (`dead-bug`) | core | illustration | NOT TESTED |
| Bird Dog (`bird-dog`) | core | illustration | NOT TESTED |
| Hanging Knee Raise (`hanging-knee-raise`) | core | illustration | NOT TESTED |
| Ab Wheel Rollout (`ab-wheel-rollout`) | core | illustration | NOT TESTED |
| Suitcase Carry (`suitcase-carry`) | core | illustration | NOT TESTED |
| Sandbag Bear-Hug Carry (`sandbag-bear-hug-carry`) | strength | illustration | NOT TESTED |
| Sandbag to Shoulder (`sandbag-to-shoulder`) | strength | illustration | NOT TESTED |
| Dead Hang (`dead-hang`) | strength | illustration | NOT TESTED |
| Power Clean (`power-clean`) | plyometric | illustration | NOT TESTED |
| Box Jump (`box-jump`) | plyometric | illustration | NOT TESTED |
| Broad Jump (`broad-jump`) | plyometric | illustration | NOT TESTED |
| Medicine Ball Slam (`medicine-ball-slam`) | conditioning | illustration | NOT TESTED |
| Burpee (`burpee`) | conditioning | illustration | NOT TESTED |
| Step-Back Burpee (No Jump) (`step-back-burpee`) | conditioning | illustration | NOT TESTED |
| Sprawl (`sprawl`) | conditioning | illustration | NOT TESTED |
| Mountain Climber (`mountain-climber`) | conditioning | illustration | NOT TESTED |
| Bear Crawl (`bear-crawl`) | conditioning | illustration | NOT TESTED |
| Jump Rope (`jump-rope`) | cardio | illustration | NOT TESTED |
| Air / Stationary Bike (`bike-intervals`) | cardio | illustration | NOT TESTED |
| Brisk / Incline Walk (`brisk-walk`) | cardio | illustration | NOT TESTED |
| Shadowboxing (`shadowboxing`) | conditioning | illustration | NOT TESTED |
| Heavy Bag Rounds (`heavy-bag-rounds`) | conditioning | illustration | NOT TESTED |
| Battle Rope Waves (`battle-rope-waves`) | conditioning | illustration | NOT TESTED |
| Lateral Shuffle (`lateral-shuffle`) | conditioning | illustration | NOT TESTED |
| Hip Escape (Shrimp) (`hip-escape`) | conditioning | illustration | NOT TESTED |
| Cat-Cow (`cat-cow`) | mobility | illustration | NOT TESTED |
| World's Greatest Stretch (`worlds-greatest-stretch`) | mobility | illustration | NOT TESTED |
| 90/90 Hip Switch (`90-90-hip-switch`) | mobility | illustration | NOT TESTED |
| Thoracic Open Book (`thoracic-open-book`) | mobility | illustration | NOT TESTED |
| Couch Stretch (`couch-stretch`) | mobility | illustration | NOT TESTED |
| Supine Hamstring Stretch (`supine-hamstring-stretch`) | mobility | illustration | NOT TESTED |
| Child's Pose (`childs-pose`) | mobility | illustration | NOT TESTED |
| Knee-to-Wall Ankle Mobility (`ankle-knee-to-wall`) | mobility | illustration | NOT TESTED |
| Band Shoulder Pass-Through (`band-pass-through`) | mobility | illustration | NOT TESTED |
| Deep Squat Hold (`deep-squat-hold`) | mobility | illustration | NOT TESTED |
| Figure-Four Glute Stretch (`figure-four-stretch`) | mobility | illustration | NOT TESTED |
| Single-Leg Balance (`single-leg-balance`) | mobility | illustration | NOT TESTED |
| Standing March (`standing-march`) | cardio | illustration | NOT TESTED |
| Paused Bench Press (`paused-bench-press`) | strength | illustration | NOT TESTED |
| Pin Press (Bench) (`pin-press`) | strength | illustration | NOT TESTED |
| Pause Squat (`pause-squat`) | strength | illustration | NOT TESTED |
| Tempo Squat (`tempo-squat`) | strength | illustration | NOT TESTED |
| Barbell Box Squat (`box-squat`) | strength | illustration | NOT TESTED |
| Deficit Deadlift (`deficit-deadlift`) | strength | illustration | NOT TESTED |
| Block Pull (Rack Pull) (`block-pull`) | strength | illustration | NOT TESTED |
| Barbell Good Morning (`good-morning`) | strength | illustration | NOT TESTED |
| Log Clean & Press (`log-press`) | strength | illustration | NOT TESTED |
| Yoke Carry (`yoke-carry`) | strength | illustration | NOT TESTED |
| Atlas Stone Load (`atlas-stone-load`) | strength | illustration | NOT TESTED |
| A-Skip (`a-skip`) | plyometric | illustration | NOT TESTED |
| Acceleration Wall Drill (`wall-drill`) | plyometric | illustration | NOT TESTED |
| Acceleration Sprint (`acceleration-sprint`) | conditioning | illustration | NOT TESTED |
| Flying Sprint (`flying-sprint`) | conditioning | illustration | NOT TESTED |
| Bounding (`bounding`) | plyometric | illustration | NOT TESTED |
| Pogo Jumps (`pogo-jumps`) | plyometric | illustration | NOT TESTED |
| 5-10-5 Pro Agility Shuttle (`pro-agility-shuttle`) | conditioning | illustration | NOT TESTED |
| T-Drill (`t-drill`) | conditioning | illustration | NOT TESTED |
| Three-Cone (L) Drill (`three-cone-drill`) | conditioning | illustration | NOT TESTED |
| Agility Ladder Drills (`agility-ladder-drills`) | conditioning | illustration | NOT TESTED |
| Reactive Mirror Drill (`reactive-mirror-drill`) | conditioning | illustration | NOT TESTED |
| Lateral Bound (Skater Jump) (`lateral-bound`) | plyometric | illustration | NOT TESTED |
| Easy Zone 2 Run (`zone-2-run`) | cardio | illustration | NOT TESTED |
| Run/Walk Intervals (`run-walk-intervals`) | cardio | illustration | NOT TESTED |
| Stair Climber / Stair Climb (`stair-climb`) | cardio | illustration | NOT TESTED |
| Rear Delt Fly (`rear-delt-fly`) | strength | illustration | NOT TESTED |
| Axle Clean & Press (`axle-clean-and-press`) | strength | illustration | NOT TESTED |
| One-Arm Dumbbell Push Press (`one-arm-dumbbell-push-press`) | strength | illustration | NOT TESTED |
| Farmer's Walk (Strongman Handles) (`strongman-farmers-walk`) | strength | illustration | NOT TESTED |
| Trap Bar Carry (`trap-bar-carry`) | strength | illustration | NOT TESTED |
| Keg Carry (`keg-carry`) | strength | illustration | NOT TESTED |
| Zercher Carry (`zercher-carry`) | strength | illustration | NOT TESTED |
| Zercher Squat (`zercher-squat`) | strength | illustration | NOT TESTED |
| Heavy Sled Drag (`sled-drag`) | strength | illustration | NOT TESTED |
| Arm-Over-Arm Sled Pull (`arm-over-arm-sled-pull`) | strength | illustration | NOT TESTED |
| Sandbag Load to Platform (`sandbag-load-over-bar`) | strength | illustration | NOT TESTED |
| Neck Isometrics (4-Way) (`neck-isometrics`) | strength | illustration | NOT TESTED |
| Banded Neck Flexion & Extension (`band-neck-training`) | strength | illustration | NOT TESTED |
| Medicine Ball Shot Put Throw (`medicine-ball-shot-put`) | plyometric | illustration | NOT TESTED |
| Medicine Ball Scoop Toss (`medicine-ball-scoop-toss`) | plyometric | illustration | NOT TESTED |
| Landmine Rotation (`landmine-rotation`) | core | illustration | NOT TESTED |
| Trap Bar Jump (`trap-bar-jump`) | plyometric | illustration | NOT TESTED |
| Copenhagen Plank (`copenhagen-plank`) | core | illustration | NOT TESTED |
| Nordic Hamstring Curl (`nordic-hamstring-curl`) | strength | illustration | NOT TESTED |
| Band External Rotation (`band-external-rotation`) | strength | illustration | NOT TESTED |
| Hack Squat (Machine) (`hack-squat`) | strength | illustration | NOT TESTED |
| Machine Chest Press (`machine-chest-press`) | strength | illustration | NOT TESTED |
| Chest-Supported Row (`chest-supported-row`) | strength | illustration | NOT TESTED |
| Straight-Arm Pulldown (`straight-arm-pulldown`) | strength | illustration | NOT TESTED |
| Cable Lateral Raise (`cable-lateral-raise`) | strength | illustration | NOT TESTED |
| Incline Dumbbell Curl (`incline-dumbbell-curl`) | strength | illustration | NOT TESTED |
| Seated Leg Curl (`seated-leg-curl`) | strength | illustration | NOT TESTED |
| Seated Calf Raise (`seated-calf-raise`) | strength | illustration | NOT TESTED |
| Kneeling Cable Crunch (`cable-crunch`) | core | illustration | NOT TESTED |
| Posing Practice (`posing-practice`) | conditioning | illustration | NOT TESTED |
| Hip Abduction (Machine or Band) (`hip-abduction`) | strength | illustration | NOT TESTED |
| Back Extension (45° Hyperextension) (`back-extension`) | strength | illustration | NOT TESTED |

## Proposed additional exercises (143): not built

The list in [EXERCISES_300.md](EXERCISES_300.md) is a proposal for the owner's approval. None of these exercises has an entry in the app, an illustration, a 3D motion, a bake, a QA run or a review. They are not counted anywhere above.
