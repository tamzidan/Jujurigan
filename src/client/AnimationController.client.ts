import { Players, RunService } from "@rbxts/services";
import { StateManager } from "../shared/Modules/StateManager";

const player = Players.LocalPlayer;

// 1. Setup ID Animasi (Baraya)
const sprintAnim = new Instance("Animation");
sprintAnim.AnimationId = "rbxassetid://111842276303136";

const crouchIdleAnim = new Instance("Animation");
crouchIdleAnim.AnimationId = "rbxassetid://94284522079811";

const crouchWalkAnim = new Instance("Animation");
crouchWalkAnim.AnimationId = "rbxassetid://73928148642491";

// Setup ID Animasi (Jurig)
const jurigAnimations = {
	Hit1: "rbxassetid://96515999112317",
	Hit2: "rbxassetid://75059937670248",
	// Tambahkan animasi lain seperti Charge di sini jika dibutuhkan
};

// Variabel penampung Track Animasi
let loadedSprint: AnimationTrack | undefined = undefined;
let loadedCrouchIdle: AnimationTrack | undefined = undefined;
let loadedCrouchWalk: AnimationTrack | undefined = undefined;

// Menyimpan referensi animasi Jurig agar tidak perlu di-load berulang kali saat bertarung
let loadedJurigAnimations: Map<string, AnimationTrack> = new Map();

// Fungsi memuat animasi Jurig
function LoadJurigAnimations(character: Model) {
	const humanoid = character.WaitForChild("Humanoid", 5) as Humanoid | undefined;
	if (!humanoid) return;

	const animator = humanoid.WaitForChild("Animator", 5) as Animator | undefined;
	if (!animator) return;

	// Bersihkan animasi lama jika pemain respawn
	loadedJurigAnimations.clear();

	// Load Animasi Pukulan 1
	const animHit1 = new Instance("Animation");
	animHit1.AnimationId = jurigAnimations.Hit1;
	const trackHit1 = animator.LoadAnimation(animHit1);
	trackHit1.Priority = Enum.AnimationPriority.Action;
	loadedJurigAnimations.set("Hit1", trackHit1);

	// Load Animasi Pukulan 2
	const animHit2 = new Instance("Animation");
	animHit2.AnimationId = jurigAnimations.Hit2;
	const trackHit2 = animator.LoadAnimation(animHit2);
	trackHit2.Priority = Enum.AnimationPriority.Action;
	loadedJurigAnimations.set("Hit2", trackHit2);

	print("[AnimationController] Animasi Jurig berhasil dimuat ke memori.");
}

// Fungsi ekspor yang akan dipanggil oleh InputController
export function PlayJurigAnimation(animName: "Hit1" | "Hit2") {
	const track = loadedJurigAnimations.get(animName);
	if (track) {
		// Stop animasi pukulan sebelumnya (jika masih main) sebelum memulai yang baru
		for (const [name, existingTrack] of loadedJurigAnimations) {
			if (existingTrack.IsPlaying) {
				existingTrack.Stop(0.1);
			}
		}

		track.Play();
	} else {
		warn(`[AnimationController] Animasi ${animName} tidak ditemukan di memori!`);
	}
}

// 2. Fungsi memuat animasi ke Animator karakter (Baraya)
function setupAnimations(character: Model) {
	const humanoid = character.WaitForChild("Humanoid") as Humanoid;
	let animator = humanoid.WaitForChild("Animator", 5) as Animator | undefined;

	if (!animator) {
		animator = new Instance("Animator");
		animator.Parent = humanoid;
	}

	// Muat animasi dan atur prioritas menjadi 'Action' agar menimpa gerak jalan bawaan Roblox
	loadedSprint = animator.LoadAnimation(sprintAnim);
	loadedSprint.Priority = Enum.AnimationPriority.Action;

	loadedCrouchIdle = animator.LoadAnimation(crouchIdleAnim);
	loadedCrouchIdle.Priority = Enum.AnimationPriority.Action;

	loadedCrouchWalk = animator.LoadAnimation(crouchWalkAnim);
	loadedCrouchWalk.Priority = Enum.AnimationPriority.Action;

	// 3. Deteksi Kecepatan Berjalan (Untuk memisahkan Jongkok Diam vs Jongkok Jalan)
	humanoid.Running.Connect((speed) => {
		const isCrouching = player.GetAttribute("IsCrouching") as boolean;
		const isSprinting = player.GetAttribute("IsSprinting") as boolean;

		if (isCrouching) {
			if (speed > 1) {
				if (loadedCrouchWalk && !loadedCrouchWalk.IsPlaying) loadedCrouchWalk.Play();
				if (loadedCrouchIdle && loadedCrouchIdle.IsPlaying) loadedCrouchIdle.Stop();
			} else {
				if (loadedCrouchIdle && !loadedCrouchIdle.IsPlaying) loadedCrouchIdle.Play();
				if (loadedCrouchWalk && loadedCrouchWalk.IsPlaying) loadedCrouchWalk.Stop();
			}
		} else if (isSprinting) {
			if (speed > 1) {
				if (loadedSprint && !loadedSprint.IsPlaying) loadedSprint.Play();
			} else {
				if (loadedSprint && loadedSprint.IsPlaying) loadedSprint.Stop();
			}
		}
	});
}

// Memeriksa dan memuat animasi sesuai dengan kondisi pemain saat ini
function UpdateAnimations() {
	const char = player.Character;
	if (!char) return;

	const team = player.Team ? player.Team.Name : "Arwah";

	if (team === "Jurig") {
		// Jika pemain masuk ke tim Jurig dan belum memuat animasi, muat sekarang.
		// PERBAIKAN TS2367: Menggunakan .isEmpty() atau .size()
		if (loadedJurigAnimations.isEmpty()) {
			LoadJurigAnimations(char);
		}
	} else if (team === "Baraya") {
        // Panggil saat karakter di-spawn pertama kali atau setelah mati
        setupAnimations(char);
    }
}

// Dengarkan setiap kali karakter baru terbuat (Respawn)
player.CharacterAdded.Connect((char) => {
	UpdateAnimations();
});

// Dengarkan perubahan tim (Misal dari Lobby ke dalam Game)
player.GetPropertyChangedSignal("Team").Connect(UpdateAnimations);

// Panggilan awal jika karakter sudah ada sebelum skrip ini selesai dimuat
if (player.Character) {
	UpdateAnimations();
}

// 4. Merespons pergantian Status (Lari/Jongkok/Normal) dari Server
player.GetAttributeChangedSignal("IsSprinting").Connect(() => {
	const isSprinting = player.GetAttribute("IsSprinting") as boolean;
	if (isSprinting) {
		// Hanya putar animasi lari jika pemain menekan tombol arah (sedang bergerak)
		const humanoid = player.Character?.FindFirstChild("Humanoid") as Humanoid | undefined;
		if (humanoid && humanoid.MoveDirection.Magnitude > 0) {
			if (loadedSprint && !loadedSprint.IsPlaying) loadedSprint.Play();
		}
	} else {
		if (loadedSprint && loadedSprint.IsPlaying) loadedSprint.Stop();
	}
});

player.GetAttributeChangedSignal("IsCrouching").Connect(() => {
	const isCrouching = player.GetAttribute("IsCrouching") as boolean;
	if (isCrouching) {
		const humanoid = player.Character?.FindFirstChild("Humanoid") as Humanoid | undefined;
		if (humanoid && humanoid.MoveDirection.Magnitude > 0) {
			if (loadedCrouchWalk && !loadedCrouchWalk.IsPlaying) loadedCrouchWalk.Play();
		} else {
			if (loadedCrouchIdle && !loadedCrouchIdle.IsPlaying) loadedCrouchIdle.Play();
		}
	} else {
		// Berhenti dari posisi jongkok, hentikan semua track
		if (loadedCrouchIdle && loadedCrouchIdle.IsPlaying) loadedCrouchIdle.Stop();
		if (loadedCrouchWalk && loadedCrouchWalk.IsPlaying) loadedCrouchWalk.Stop();
	}
});

// 5. LOGIKA BARU: Menghilangkan Suara Langkah Saat Jongkok
RunService.RenderStepped.Connect(() => {
	const char = player.Character;
	if (char) {
		const rootPart = char.FindFirstChild("HumanoidRootPart") as Part | undefined;
		if (rootPart) {
			// Mencari komponen suara bawaan Roblox bernama "Running"
			const runningSound = rootPart.FindFirstChild("Running") as Sound | undefined;
			if (runningSound) {
				if (player.GetAttribute("IsCrouching")) {
					// Jika sedang jongkok, paksa volume menjadi 0
					runningSound.Volume = 0;
				} else {
					// Jika sudah tidak jongkok, tapi suaranya "nyangkut" di 0
					const currentSpeed = rootPart.AssemblyLinearVelocity.Magnitude;
					if (currentSpeed > 0.5 && runningSound.Volume === 0) {
						// Kita pancing dengan rumus default Roblox: (Kecepatan / 16) * 0.65
						// Setelah dipancing, skrip bawaan Roblox akan otomatis mengambil alih kembali
						runningSound.Volume = (currentSpeed / 16) * 0.65;
					}
				}
			}
		}
	}
});