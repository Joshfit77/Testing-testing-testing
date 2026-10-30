# 2.5D exercise demonstrations: library status

Generated 2026-10-30 by `scripts/exercise-demos/status.mjs` from the manifest and each source folder's meta.json.

**COMPLETED** = a real moving clip in the app, at normal speed and as a 0.5× file, with frames for finger scrubbing, whose character, form, equipment, highlighting and playback were checked and passed. **FAILED** = a clip exists but a check failed. **MISSING** = no moving clip yet. Owner approval is separate and never implied. Physical-iPhone testing is listed separately.

| Exercises | COMPLETED | FAILED | MISSING | Moving clip in the app | Owner approved |
| --- | --- | --- | --- | --- | --- |
| 157 | 0 | 1 | 156 | 1 | 0 |

## Exercises with a clip

| Exercise | Tracker | Normal | 0.5× | Finger scrub | Views | Character | Form | Equipment | Highlighting | Playback | iPhone | Owner | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dumbbell Biceps Curl (`dumbbell-curl`) | **FAILED** | YES | YES | YES | 1 | PASS | PASS | FAIL | PASS | PASS | NOT TESTED | PENDING | Dumbbell shows a doubled outline for about 0.27 s at the fastest part of the lift (in the source footage), seen again on the reversed lowering. Needs a regenerated clip; this corrected version is the interim. |

## Missing (blocked)

Every exercise below is **MISSING** for the same reason: No clip yet. Generating one needs a video model that keeps the approved athlete; none can run or be reached from this environment (no GPU or ML runtime; model hosts and video generators blocked by its network policy; $0 budget). Needs a clip generated with the owner's own tools. Its ready-to-paste prompt is in `assets/exercise-demos-src/PROMPTS.md`; until its clip passes, the app keeps showing its existing animated illustration.

| # | Exercise | Category | Equipment |
| --- | --- | --- | --- |
| 1 | Barbell Back Squat (`back-squat`) | strength | barbell, rack |
| 2 | Barbell Front Squat (`front-squat`) | strength | barbell, rack |
| 3 | Goblet Squat (`goblet-squat`) | strength | dumbbell, kettlebell |
| 4 | Bodyweight Squat (`bodyweight-squat`) | strength | bodyweight |
| 5 | Sit-to-Stand (Chair Squat) (`box-squat-to-chair`) | strength | bodyweight |
| 6 | Leg Press (`leg-press`) | strength | machine |
| 7 | Conventional Deadlift (`conventional-deadlift`) | strength | barbell |
| 8 | Sumo Deadlift (`sumo-deadlift`) | strength | barbell |
| 9 | Trap Bar Deadlift (`trap-bar-deadlift`) | strength | trap_bar |
| 10 | Romanian Deadlift (`romanian-deadlift`) | strength | barbell, dumbbell |
| 11 | Single-Leg Romanian Deadlift (`single-leg-rdl`) | strength | dumbbell, kettlebell, bodyweight |
| 12 | Kettlebell Swing (`kettlebell-swing`) | conditioning | kettlebell |
| 13 | Barbell Hip Thrust (`hip-thrust`) | strength | barbell, bench |
| 14 | Glute Bridge (`glute-bridge`) | strength | bodyweight, mat |
| 15 | Machine Leg Curl (`leg-curl`) | strength | machine |
| 16 | Machine Leg Extension (`leg-extension`) | strength | machine |
| 17 | Standing Calf Raise (`standing-calf-raise`) | strength | bodyweight, dumbbell, machine |
| 18 | Dumbbell Walking Lunge (`walking-lunge`) | strength | dumbbell |
| 19 | Reverse Lunge (`reverse-lunge`) | strength | bodyweight, dumbbell |
| 20 | Bulgarian Split Squat (`bulgarian-split-squat`) | strength | bench, dumbbell, bodyweight |
| 21 | Step-Up (`step-up`) | strength | box, bodyweight, dumbbell |
| 22 | Barbell Bench Press (`bench-press`) | strength | barbell, bench, rack |
| 23 | Dumbbell Bench Press (`dumbbell-bench-press`) | strength | dumbbell, bench |
| 24 | Incline Dumbbell Press (`incline-dumbbell-press`) | strength | dumbbell, bench |
| 25 | Close-Grip Bench Press (`close-grip-bench-press`) | strength | barbell, bench, rack |
| 26 | Push-Up (`push-up`) | strength | bodyweight |
| 27 | Incline Push-Up (`incline-push-up`) | strength | bodyweight, bench, box |
| 28 | Wall Push-Up (`wall-push-up`) | strength | bodyweight |
| 29 | Parallel Bar Dip (`dips`) | strength | dip_station |
| 30 | Standing Overhead Press (`overhead-press`) | strength | barbell, rack |
| 31 | Seated Dumbbell Shoulder Press (`seated-dumbbell-shoulder-press`) | strength | dumbbell, bench |
| 32 | Pike Push-Up (`pike-push-up`) | strength | bodyweight |
| 33 | Half-Kneeling Landmine Press (`landmine-press`) | strength | landmine, barbell |
| 34 | Push Press (`push-press`) | plyometric | barbell, rack |
| 35 | Dumbbell Lateral Raise (`lateral-raise`) | strength | dumbbell, cable, band |
| 36 | Cable Triceps Pushdown (`triceps-pushdown`) | strength | cable, band |
| 37 | Pull-Up (`pull-up`) | strength | pull_up_bar |
| 38 | Band-Assisted Pull-Up (`band-assisted-pull-up`) | strength | pull_up_bar, band |
| 39 | Chin-Up (`chin-up`) | strength | pull_up_bar |
| 40 | Lat Pulldown (`lat-pulldown`) | strength | cable, machine |
| 41 | Bent-Over Barbell Row (`barbell-row`) | strength | barbell |
| 42 | One-Arm Dumbbell Row (`one-arm-dumbbell-row`) | strength | dumbbell, bench |
| 43 | Seated Cable Row (`seated-cable-row`) | strength | cable, machine |
| 44 | Resistance Band Row (`band-row`) | strength | band |
| 45 | Inverted Row (`inverted-row`) | strength | barbell, rack, bodyweight |
| 46 | Face Pull (`face-pull`) | strength | cable, band |
| 47 | Band Pull-Apart (`band-pull-apart`) | strength | band |
| 48 | Hammer Curl (`hammer-curl`) | strength | dumbbell |
| 49 | Front Plank (`plank`) | core | bodyweight, mat |
| 50 | Side Plank (`side-plank`) | core | bodyweight, mat |
| 51 | Dead Bug (`dead-bug`) | core | bodyweight, mat |
| 52 | Bird Dog (`bird-dog`) | core | bodyweight, mat |
| 53 | Pallof Press (`pallof-press`) | core | cable, band |
| 54 | Cable Woodchop (`cable-woodchop`) | core | cable, band |
| 55 | Hanging Knee Raise (`hanging-knee-raise`) | core | pull_up_bar |
| 56 | Ab Wheel Rollout (`ab-wheel-rollout`) | core | ab_wheel |
| 57 | Medicine Ball Rotational Throw (`medicine-ball-rotational-throw`) | plyometric | medicine_ball |
| 58 | Farmer's Carry (`farmers-carry`) | strength | dumbbell, kettlebell, trap_bar |
| 59 | Suitcase Carry (`suitcase-carry`) | core | dumbbell, kettlebell |
| 60 | Sandbag Bear-Hug Carry (`sandbag-bear-hug-carry`) | strength | sandbag |
| 61 | Sandbag to Shoulder (`sandbag-to-shoulder`) | strength | sandbag |
| 62 | Sled Push (`sled-push`) | conditioning | sled |
| 63 | Dead Hang (`dead-hang`) | strength | pull_up_bar |
| 64 | Power Clean (`power-clean`) | plyometric | barbell |
| 65 | Box Jump (`box-jump`) | plyometric | box |
| 66 | Broad Jump (`broad-jump`) | plyometric | bodyweight |
| 67 | Medicine Ball Slam (`medicine-ball-slam`) | conditioning | medicine_ball |
| 68 | Burpee (`burpee`) | conditioning | bodyweight |
| 69 | Step-Back Burpee (No Jump) (`step-back-burpee`) | conditioning | bodyweight |
| 70 | Sprawl (`sprawl`) | conditioning | bodyweight, mat |
| 71 | Mountain Climber (`mountain-climber`) | conditioning | bodyweight |
| 72 | Bear Crawl (`bear-crawl`) | conditioning | bodyweight |
| 73 | Jump Rope (`jump-rope`) | cardio | jump_rope |
| 74 | Rowing Machine (`rowing-intervals`) | cardio | rower |
| 75 | Air / Stationary Bike (`bike-intervals`) | cardio | bike |
| 76 | Brisk / Incline Walk (`brisk-walk`) | cardio | bodyweight |
| 77 | Shadowboxing (`shadowboxing`) | conditioning | bodyweight |
| 78 | Heavy Bag Rounds (`heavy-bag-rounds`) | conditioning | heavy_bag |
| 79 | Battle Rope Waves (`battle-rope-waves`) | conditioning | battle_rope |
| 80 | Lateral Shuffle (`lateral-shuffle`) | conditioning | bodyweight |
| 81 | Hip Escape (Shrimp) (`hip-escape`) | conditioning | mat |
| 82 | Cat-Cow (`cat-cow`) | mobility | mat |
| 83 | World's Greatest Stretch (`worlds-greatest-stretch`) | mobility | bodyweight |
| 84 | 90/90 Hip Switch (`90-90-hip-switch`) | mobility | mat |
| 85 | Thoracic Open Book (`thoracic-open-book`) | mobility | mat |
| 86 | Couch Stretch (`couch-stretch`) | mobility | mat |
| 87 | Supine Hamstring Stretch (`supine-hamstring-stretch`) | mobility | band, mat |
| 88 | Child's Pose (`childs-pose`) | mobility | mat |
| 89 | Knee-to-Wall Ankle Mobility (`ankle-knee-to-wall`) | mobility | bodyweight |
| 90 | Band Shoulder Pass-Through (`band-pass-through`) | mobility | band |
| 91 | Deep Squat Hold (`deep-squat-hold`) | mobility | bodyweight |
| 92 | Figure-Four Glute Stretch (`figure-four-stretch`) | mobility | mat |
| 93 | Single-Leg Balance (`single-leg-balance`) | mobility | bodyweight |
| 94 | Standing March (`standing-march`) | cardio | bodyweight |
| 95 | Paused Bench Press (`paused-bench-press`) | strength | barbell, bench, rack |
| 96 | Pin Press (Bench) (`pin-press`) | strength | barbell, rack, bench |
| 97 | Pause Squat (`pause-squat`) | strength | barbell, rack |
| 98 | Tempo Squat (`tempo-squat`) | strength | barbell, rack |
| 99 | Barbell Box Squat (`box-squat`) | strength | barbell, rack, box |
| 100 | Deficit Deadlift (`deficit-deadlift`) | strength | barbell |
| 101 | Block Pull (Rack Pull) (`block-pull`) | strength | barbell, rack |
| 102 | Barbell Good Morning (`good-morning`) | strength | barbell, rack |
| 103 | Log Clean & Press (`log-press`) | strength | strongman_implements |
| 104 | Yoke Carry (`yoke-carry`) | strength | strongman_implements |
| 105 | Atlas Stone Load (`atlas-stone-load`) | strength | strongman_implements |
| 106 | A-Skip (`a-skip`) | plyometric | bodyweight |
| 107 | Acceleration Wall Drill (`wall-drill`) | plyometric | bodyweight |
| 108 | Acceleration Sprint (`acceleration-sprint`) | conditioning | bodyweight |
| 109 | Flying Sprint (`flying-sprint`) | conditioning | bodyweight |
| 110 | Bounding (`bounding`) | plyometric | bodyweight |
| 111 | Pogo Jumps (`pogo-jumps`) | plyometric | bodyweight |
| 112 | 5-10-5 Pro Agility Shuttle (`pro-agility-shuttle`) | conditioning | bodyweight |
| 113 | T-Drill (`t-drill`) | conditioning | bodyweight |
| 114 | Three-Cone (L) Drill (`three-cone-drill`) | conditioning | bodyweight |
| 115 | Agility Ladder Drills (`agility-ladder-drills`) | conditioning | bodyweight |
| 116 | Reactive Mirror Drill (`reactive-mirror-drill`) | conditioning | bodyweight |
| 117 | Lateral Bound (Skater Jump) (`lateral-bound`) | plyometric | bodyweight |
| 118 | Easy Zone 2 Run (`zone-2-run`) | cardio | bodyweight |
| 119 | Run/Walk Intervals (`run-walk-intervals`) | cardio | bodyweight |
| 120 | Running Intervals (`running-intervals`) | cardio | bodyweight |
| 121 | Stair Climber / Stair Climb (`stair-climb`) | cardio | bodyweight |
| 122 | Cable Chest Fly (`cable-chest-fly`) | strength | cable, dumbbell |
| 123 | Rear Delt Fly (`rear-delt-fly`) | strength | dumbbell, cable, machine |
| 124 | Overhead Triceps Extension (`overhead-triceps-extension`) | strength | dumbbell, cable |
| 125 | Axle Clean & Press (`axle-clean-and-press`) | strength | strongman_implements |
| 126 | One-Arm Dumbbell Push Press (`one-arm-dumbbell-push-press`) | strength | dumbbell, kettlebell |
| 127 | Farmer's Walk (Strongman Handles) (`strongman-farmers-walk`) | strength | strongman_implements |
| 128 | Trap Bar Carry (`trap-bar-carry`) | strength | trap_bar |
| 129 | Keg Carry (`keg-carry`) | strength | strongman_implements |
| 130 | Zercher Carry (`zercher-carry`) | strength | barbell, rack |
| 131 | Zercher Squat (`zercher-squat`) | strength | barbell, rack |
| 132 | Heavy Sled Drag (`sled-drag`) | strength | sled |
| 133 | Arm-Over-Arm Sled Pull (`arm-over-arm-sled-pull`) | strength | sled |
| 134 | Sandbag Load to Platform (`sandbag-load-over-bar`) | strength | sandbag |
| 135 | Air Bike Sprint (`air-bike-sprint`) | cardio | bike |
| 136 | Neck Isometrics (4-Way) (`neck-isometrics`) | strength | bodyweight |
| 137 | Banded Neck Flexion & Extension (`band-neck-training`) | strength | band |
| 138 | Medicine Ball Shot Put Throw (`medicine-ball-shot-put`) | plyometric | medicine_ball |
| 139 | Medicine Ball Scoop Toss (`medicine-ball-scoop-toss`) | plyometric | medicine_ball |
| 140 | Landmine Rotation (`landmine-rotation`) | core | landmine, barbell |
| 141 | Trap Bar Jump (`trap-bar-jump`) | plyometric | trap_bar |
| 142 | Copenhagen Plank (`copenhagen-plank`) | core | bench, bodyweight |
| 143 | Nordic Hamstring Curl (`nordic-hamstring-curl`) | strength | bodyweight, mat |
| 144 | Band External Rotation (`band-external-rotation`) | strength | band, cable |
| 145 | Hack Squat (Machine) (`hack-squat`) | strength | machine |
| 146 | Machine Chest Press (`machine-chest-press`) | strength | machine |
| 147 | Chest-Supported Row (`chest-supported-row`) | strength | dumbbell, bench, machine |
| 148 | Straight-Arm Pulldown (`straight-arm-pulldown`) | strength | cable, band |
| 149 | Cable Lateral Raise (`cable-lateral-raise`) | strength | cable |
| 150 | Incline Dumbbell Curl (`incline-dumbbell-curl`) | strength | dumbbell, bench |
| 151 | Seated Leg Curl (`seated-leg-curl`) | strength | machine |
| 152 | Seated Calf Raise (`seated-calf-raise`) | strength | machine, dumbbell |
| 153 | Kneeling Cable Crunch (`cable-crunch`) | core | cable, band |
| 154 | Posing Practice (`posing-practice`) | conditioning | bodyweight |
| 155 | Hip Abduction (Machine or Band) (`hip-abduction`) | strength | machine, band |
| 156 | Back Extension (45° Hyperextension) (`back-extension`) | strength | bench |
