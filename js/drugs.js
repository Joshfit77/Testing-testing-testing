// Common medicine names (generic and brand) mapped to the medicine groups in interactions.js,
// so people can type the name on their bottle. [generic name, groups, brand names]

const DRUGS = [
  // Blood thinners
  ["warfarin", ["blood-thinners"], "Coumadin, Jantoven"], ["apixaban", ["blood-thinners"], "Eliquis"], ["rivaroxaban", ["blood-thinners"], "Xarelto"],
  ["dabigatran", ["blood-thinners"], "Pradaxa"], ["edoxaban", ["blood-thinners"], "Savaysa"], ["clopidogrel", ["blood-thinners"], "Plavix"],
  ["prasugrel", ["blood-thinners"], "Effient"], ["ticagrelor", ["blood-thinners"], "Brilinta"], ["aspirin", ["blood-thinners", "pain-relievers"], "Bayer, Ecotrin, baby aspirin"],
  ["enoxaparin", ["blood-thinners"], "Lovenox"], ["heparin", ["blood-thinners"], ""],
  // NSAID pain relievers
  ["ibuprofen", ["pain-relievers"], "Advil, Motrin"], ["naproxen", ["pain-relievers"], "Aleve, Naprosyn"], ["diclofenac", ["pain-relievers"], "Voltaren"],
  ["celecoxib", ["pain-relievers"], "Celebrex"], ["meloxicam", ["pain-relievers"], "Mobic"],
  // Diabetes
  ["metformin", ["diabetes"], "Glucophage"], ["insulin", ["diabetes"], "Lantus, Humalog, Novolog, Tresiba"], ["glipizide", ["diabetes"], "Glucotrol"],
  ["glyburide", ["diabetes"], "Diabeta"], ["glimepiride", ["diabetes"], "Amaryl"], ["sitagliptin", ["diabetes"], "Januvia"],
  ["semaglutide", ["diabetes"], "Ozempic, Wegovy, Rybelsus"], ["tirzepatide", ["diabetes"], "Mounjaro, Zepbound"], ["dulaglutide", ["diabetes"], "Trulicity"],
  ["liraglutide", ["diabetes"], "Victoza, Saxenda"], ["empagliflozin", ["diabetes"], "Jardiance"], ["dapagliflozin", ["diabetes"], "Farxiga"], ["pioglitazone", ["diabetes"], "Actos"],
  // Blood pressure
  ["lisinopril", ["blood-pressure"], "Zestril, Prinivil"], ["enalapril", ["blood-pressure"], "Vasotec"], ["ramipril", ["blood-pressure"], "Altace"],
  ["losartan", ["blood-pressure"], "Cozaar"], ["valsartan", ["blood-pressure"], "Diovan"], ["olmesartan", ["blood-pressure"], "Benicar"],
  ["amlodipine", ["blood-pressure"], "Norvasc"], ["nifedipine", ["blood-pressure"], "Procardia, Adalat"], ["felodipine", ["blood-pressure"], "Plendil"],
  ["diltiazem", ["blood-pressure", "heart"], "Cardizem"], ["verapamil", ["blood-pressure", "heart"], "Calan"], ["metoprolol", ["blood-pressure", "heart"], "Lopressor, Toprol XL"],
  ["atenolol", ["blood-pressure"], "Tenormin"], ["carvedilol", ["blood-pressure", "heart"], "Coreg"], ["propranolol", ["blood-pressure"], "Inderal"],
  ["clonidine", ["blood-pressure"], "Catapres"], ["hydralazine", ["blood-pressure"], ""],
  // Diuretics
  ["hydrochlorothiazide", ["diuretics", "blood-pressure"], "HCTZ, Microzide"], ["chlorthalidone", ["diuretics", "blood-pressure"], ""],
  ["furosemide", ["diuretics"], "Lasix"], ["bumetanide", ["diuretics"], "Bumex"], ["spironolactone", ["diuretics", "blood-pressure"], "Aldactone"], ["triamterene", ["diuretics"], "Dyazide, Maxzide"],
  // Heart rhythm
  ["digoxin", ["heart"], "Lanoxin"], ["amiodarone", ["heart"], "Pacerone"], ["sotalol", ["heart"], "Betapace"], ["flecainide", ["heart"], "Tambocor"],
  // Statins
  ["atorvastatin", ["statins"], "Lipitor"], ["simvastatin", ["statins"], "Zocor"], ["rosuvastatin", ["statins"], "Crestor"], ["pravastatin", ["statins"], "Pravachol"], ["lovastatin", ["statins"], "Mevacor"],
  // Antidepressants & mood
  ["sertraline", ["antidepressants"], "Zoloft"], ["fluoxetine", ["antidepressants"], "Prozac"], ["escitalopram", ["antidepressants"], "Lexapro"],
  ["citalopram", ["antidepressants"], "Celexa"], ["paroxetine", ["antidepressants"], "Paxil"], ["venlafaxine", ["antidepressants"], "Effexor"],
  ["duloxetine", ["antidepressants"], "Cymbalta"], ["desvenlafaxine", ["antidepressants"], "Pristiq"], ["bupropion", ["antidepressants"], "Wellbutrin, Zyban"],
  ["mirtazapine", ["antidepressants", "sedatives"], "Remeron"], ["trazodone", ["antidepressants", "sedatives"], "Desyrel"], ["amitriptyline", ["antidepressants", "sedatives"], "Elavil"],
  ["phenelzine", ["antidepressants"], "Nardil (MAOI)"], ["tranylcypromine", ["antidepressants"], "Parnate (MAOI)"], ["selegiline", ["antidepressants"], "Emsam, Eldepryl (MAOI)"],
  ["sumatriptan", ["antidepressants"], "Imitrex (migraine)"], ["tramadol", ["antidepressants", "sedatives"], "Ultram"], ["lithium", ["lithium"], "Lithobid"],
  ["quetiapine", ["sedatives"], "Seroquel"], ["aripiprazole", ["liver-processed"], "Abilify"],
  // Sleep, anxiety, pain & sedatives
  ["zolpidem", ["sedatives"], "Ambien"], ["eszopiclone", ["sedatives"], "Lunesta"], ["lorazepam", ["sedatives"], "Ativan"], ["alprazolam", ["sedatives"], "Xanax"],
  ["clonazepam", ["sedatives"], "Klonopin"], ["diazepam", ["sedatives"], "Valium"], ["hydroxyzine", ["sedatives"], "Atarax, Vistaril"],
  ["gabapentin", ["sedatives"], "Neurontin"], ["pregabalin", ["sedatives"], "Lyrica"], ["oxycodone", ["sedatives"], "OxyContin, Percocet"],
  ["hydrocodone", ["sedatives"], "Vicodin, Norco"], ["morphine", ["sedatives"], ""], ["codeine", ["sedatives"], "Tylenol #3"],
  ["diphenhydramine", ["sedatives"], "Benadryl, ZzzQuil, Tylenol PM"], ["doxylamine", ["sedatives"], "Unisom"], ["alcohol", ["sedatives"], "beer, wine, spirits"],
  ["cyclobenzaprine", ["sedatives"], "Flexeril"],
  // ADHD
  ["methylphenidate", ["stimulants"], "Ritalin, Concerta"], ["amphetamine", ["stimulants"], "Adderall"], ["lisdexamfetamine", ["stimulants"], "Vyvanse"],
  // Hormones
  ["birth control pill", ["hormones"], "the Pill, combined pill, mini-pill"], ["contraceptive ring or patch", ["hormones"], "NuvaRing, Xulane, Twirla"],
  ["estradiol", ["hormones"], "Estrace, Vivelle, HRT"], ["conjugated estrogens", ["hormones"], "Premarin"], ["progesterone", ["hormones"], "Prometrium"],
  ["clomiphene", ["hormones"], "Clomid"], ["letrozole", ["hormones"], "Femara"], ["tamoxifen", ["hormones"], "Nolvadex"], ["testosterone", ["hormones"], "AndroGel, Testim, injections"],
  // Thyroid
  ["levothyroxine", ["thyroid"], "Synthroid, Levoxyl, Tirosint, Euthyrox"], ["liothyronine", ["thyroid"], "Cytomel"], ["desiccated thyroid", ["thyroid"], "Armour Thyroid, NP Thyroid"],
  ["methimazole", ["thyroid"], "Tapazole"],
  // Immune suppressing
  ["cyclosporine", ["immunosuppressants"], "Neoral, Sandimmune"], ["tacrolimus", ["immunosuppressants"], "Prograf"], ["mycophenolate", ["immunosuppressants"], "CellCept"],
  ["methotrexate", ["immunosuppressants"], "Trexall"], ["prednisone", ["immunosuppressants"], "Deltasone"], ["azathioprine", ["immunosuppressants"], "Imuran"],
  ["adalimumab", ["immunosuppressants"], "Humira"], ["etanercept", ["immunosuppressants"], "Enbrel"],
  // Other liver-processed medicines
  ["carbamazepine", ["liver-processed"], "Tegretol"], ["phenytoin", ["liver-processed"], "Dilantin"], ["lamotrigine", ["liver-processed"], "Lamictal"],
  ["valproate", ["liver-processed"], "Depakote"], ["HIV medicines", ["liver-processed"], "Biktarvy, Genvoya, Triumeq, Descovy"],
  ["sildenafil", ["liver-processed"], "Viagra"], ["tadalafil", ["liver-processed"], "Cialis"], ["omeprazole", ["liver-processed"], "Prilosec"],
  ["cancer treatment (chemotherapy)", ["liver-processed", "immunosuppressants"], ""]
];
