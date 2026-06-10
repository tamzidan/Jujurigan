// ===================================================================
// CharacterData.ts — Pusat Data Semua Karakter Jurig
// ===================================================================
// Untuk menambah karakter baru, cukup tambahkan entri baru di objek
// CharacterData di bawah. TIDAK PERLU mengubah controller manapun.
// ===================================================================

// --- Tipe Data Animasi ---
export interface JurigAnimations {
	Hit1:       string;
	Hit2:       string;
	Charging:   string;
	Charged:    string;
	ChargedHit: string;
	WeaponHold: string;
	StunStart:  string;
	StunLoop:   string;
	StunEnd:    string;
}

// --- Tipe Data Suara ---
export interface JurigSounds {
	Miss:     string;
	HitWall:  string;
	HitFlesh: string;
}

// --- Konfigurasi Combat ---
export interface JurigCombatConfig {
	/** Durasi hitbox aktif untuk serangan Hit biasa (detik) */
	HitDuration: number;
	/** Durasi hitbox aktif untuk serangan ChargedHit (detik) */
	ChargedHitDuration: number;
	/**
	 * Sumber part hitbox:
	 *   "Tool"     → BasePart pertama dari Tool yang diequip karakter
	 *   "RightArm" → "Right Arm" di rig karakter (tanpa senjata)
	 */
	HitboxPart: "Tool" | "RightArm";
}

// --- Tipe Data Karakter Lengkap ---
export interface CharacterInfo {
	Name:         string;
	Cost:         number;
	PassiveSkill: string;
	ActiveSkill1: string;
	ActiveSkill2: string;
	Animations:   JurigAnimations;
	Sounds:       JurigSounds;
	Combat:       JurigCombatConfig;
}

// ===================================================================
// DATA KARAKTER
// ===================================================================
export const CharacterData: Record<string, CharacterInfo> = {

	JurigDefault: {
		Name:         "Sang Algojo",
		Cost:         0,
		PassiveSkill: "Jejak Darah",
		ActiveSkill1: "Teriakan Maut",
		ActiveSkill2: "Lari Kesetanan",
		Animations: {
			Hit1:       "rbxassetid://96515999112317",
			Hit2:       "rbxassetid://75059937670248",
			Charging:   "rbxassetid://127990702652676",
			Charged:    "rbxassetid://121600231814274",
			ChargedHit: "rbxassetid://99365271989430",
			WeaponHold: "rbxassetid://110727538350674",
			StunStart:  "rbxassetid://77817294824883",
			StunLoop:   "rbxassetid://120296808547646",
			StunEnd:    "rbxassetid://97962248551821",
		},
		Sounds: {
			Miss:     "rbxassetid://104385197343883",
			HitWall:  "rbxassetid://107536030334203",
			HitFlesh: "rbxassetid://71282231814253",
		},
		Combat: {
			HitDuration:        0.6,
			ChargedHitDuration: 0.9,
			HitboxPart:         "Tool",
		},
	},

	Kuntilanak: {
		Name:         "Kuntilanak Merah",
		Cost:         2500,
		PassiveSkill: "Melayang",
		ActiveSkill1: "Tawa Nyaring",
		ActiveSkill2: "Teleportasi",
		Animations: {
			// TODO: Ganti ID di bawah dengan aset animasi Kuntilanak yang sebenarnya
			Hit1:       "rbxassetid://96515999112317",
			Hit2:       "rbxassetid://75059937670248",
			Charging:   "rbxassetid://127990702652676",
			Charged:    "rbxassetid://121600231814274",
			ChargedHit: "rbxassetid://99365271989430",
			WeaponHold: "rbxassetid://110727538350674",
			StunStart:  "rbxassetid://77817294824883",
			StunLoop:   "rbxassetid://120296808547646",
			StunEnd:    "rbxassetid://97962248551821",
		},
		Sounds: {
			// TODO: Ganti ID di bawah dengan suara khas Kuntilanak
			Miss:     "rbxassetid://104385197343883",
			HitWall:  "rbxassetid://107536030334203",
			HitFlesh: "rbxassetid://71282231814253",
		},
		Combat: {
			HitDuration:        0.5,
			ChargedHitDuration: 0.8,
			HitboxPart:         "RightArm",
		},
	},

	Pocong: {
		Name:         "Pocong Mumun",
		Cost:         2000,
		PassiveSkill: "Lompat Jauh",
		ActiveSkill1: "Semburan Tanah",
		ActiveSkill2: "Ikat Pocong",
		Animations: {
			// TODO: Ganti ID di bawah dengan aset animasi Pocong yang sebenarnya
			Hit1:       "rbxassetid://96515999112317",
			Hit2:       "rbxassetid://75059937670248",
			Charging:   "rbxassetid://127990702652676",
			Charged:    "rbxassetid://121600231814274",
			ChargedHit: "rbxassetid://99365271989430",
			WeaponHold: "rbxassetid://110727538350674",
			StunStart:  "rbxassetid://77817294824883",
			StunLoop:   "rbxassetid://120296808547646",
			StunEnd:    "rbxassetid://97962248551821",
		},
		Sounds: {
			// TODO: Ganti ID di bawah dengan suara khas Pocong
			Miss:     "rbxassetid://104385197343883",
			HitWall:  "rbxassetid://107536030334203",
			HitFlesh: "rbxassetid://71282231814253",
		},
		Combat: {
			HitDuration:        0.7,
			ChargedHitDuration: 1.0,
			HitboxPart:         "RightArm",
		},
	},

};

// ===================================================================
// HELPERS
// ===================================================================

/** Key fallback jika atribut EquippedJurig tidak diset */
export const DEFAULT_CHARACTER_KEY = "JurigDefault";

/**
 * Ambil CharacterInfo berdasarkan key.
 * Otomatis fallback ke JurigDefault jika key tidak valid.
 */
export function GetCharacterInfo(key: string): CharacterInfo {
	return CharacterData[key] ?? CharacterData[DEFAULT_CHARACTER_KEY];
}