import { Players, RunService } from "@rbxts/services";
import { StateManager } from "../shared/Modules/StateManager";
import { GetCharacterInfo, DEFAULT_CHARACTER_KEY } from "../shared/GameData/CharacterData";

const player = Players.LocalPlayer;

// ---------------------------------------------------------
// ANIMASI BARAYA (ID statis)
// ---------------------------------------------------------
const sprintAnim = new Instance("Animation");
sprintAnim.AnimationId = "rbxassetid://111842276303136";

const crouchIdleAnim = new Instance("Animation");
crouchIdleAnim.AnimationId = "rbxassetid://94284522079811";

const crouchWalkAnim = new Instance("Animation");
crouchWalkAnim.AnimationId = "rbxassetid://73928148642491";

const injuredIdleAnim = new Instance("Animation");
injuredIdleAnim.AnimationId = "rbxassetid://125341237040543";

const injuredWalkAnim = new Instance("Animation");
injuredWalkAnim.AnimationId = "rbxassetid://90712888924276";

const injuredRunAnim = new Instance("Animation");
injuredRunAnim.AnimationId = "rbxassetid://88011294949860";

const downIdleAnim = new Instance("Animation");
downIdleAnim.AnimationId = "rbxassetid://134552238763381";

const downMoveAnim = new Instance("Animation");
downMoveAnim.AnimationId = "rbxassetid://132750383282272";

const generatorAnim = new Instance("Animation");
generatorAnim.AnimationId = "rbxassetid://105099851016113";

const barayaCarryStartAnim = new Instance("Animation");
barayaCarryStartAnim.AnimationId = "rbxassetid://136698962412099";

const barayaCarryIdleAnim = new Instance("Animation");
barayaCarryIdleAnim.AnimationId = "rbxassetid://70854378825630";

// Variabel penampung Track Animasi Baraya
let loadedSprint:     AnimationTrack | undefined = undefined;
let loadedCrouchIdle: AnimationTrack | undefined = undefined;
let loadedCrouchWalk: AnimationTrack | undefined = undefined;

let loadedInjuredIdle: AnimationTrack | undefined = undefined;
let loadedInjuredWalk: AnimationTrack | undefined = undefined;
let loadedInjuredRun:  AnimationTrack | undefined = undefined;
let loadedDownIdle:    AnimationTrack | undefined = undefined;
let loadedDownMove:    AnimationTrack | undefined = undefined;
let loadedGenerator:   AnimationTrack | undefined = undefined;
let loadedBarayaCarryStart: AnimationTrack | undefined = undefined;
let loadedBarayaCarryIdle:  AnimationTrack | undefined = undefined;

// ---------------------------------------------------------
// ANIMASI JURIG
// ---------------------------------------------------------
let loadedJurigAnimations: Map<string, AnimationTrack> = new Map();
let weaponHoldTrack: AnimationTrack | undefined = undefined;

function getEquippedKey(): string {
	const key = player.GetAttribute("EquippedJurig") as string | undefined;
	return key ?? DEFAULT_CHARACTER_KEY;
}

function LoadJurigAnimations(character: Model) {
	const humanoid = character.WaitForChild("Humanoid", 5) as Humanoid | undefined;
	if (!humanoid) return;
	const animator = humanoid.WaitForChild("Animator", 5) as Animator | undefined;
	if (!animator) return;

	const charKey  = getEquippedKey();
	const charInfo = GetCharacterInfo(charKey);
	const animIds  = charInfo.Animations;

	loadedJurigAnimations.clear();
	if (weaponHoldTrack) {
		weaponHoldTrack.Stop();
		weaponHoldTrack = undefined;
	}

	for (const [name, id] of pairs(animIds)) {
		const anim           = new Instance("Animation");
		anim.AnimationId     = id as string;
		const track          = animator.LoadAnimation(anim);

		if (name === "WeaponHold") {
			track.Priority = Enum.AnimationPriority.Action3;
			track.Looped   = true;
			weaponHoldTrack = track;
			continue;
		}

		track.Priority = Enum.AnimationPriority.Action;
		if (name === "CarryStart" || name === "CarryIdle") track.Priority = Enum.AnimationPriority.Action4;
		if (name === "Charged" || name === "StunLoop" || name === "CarryIdle") track.Looped = true;
		loadedJurigAnimations.set(name as string, track);
	}

	print(`[AnimationController] Animasi Jurig dimuat untuk: ${charInfo.Name} (${charKey})`);
}

function PlayJurigAnimation(animName: string) {
	const track = loadedJurigAnimations.get(animName);
	if (track) {
		for (const [_, existingTrack] of loadedJurigAnimations) {
			if (existingTrack.IsPlaying) existingTrack.Stop(0.1);
		}
		track.Play();
	} else {
		warn(`[AnimationController] Animasi "${animName}" tidak ditemukan di memori!`);
	}
}

// ---------------------------------------------------------
// ANIMASI BARAYA
// ---------------------------------------------------------
function updateBarayaMovement(speed: number) {
	const healthState = player.GetAttribute("HealthState") as string | undefined;
	const isCrouching = player.GetAttribute("IsCrouching") as boolean;
	const isSprinting = player.GetAttribute("IsSprinting") as boolean;

	let trackToPlay: AnimationTrack | undefined = undefined;

	if (healthState === "Knock") {
		trackToPlay = speed > 1 ? loadedDownMove : loadedDownIdle;
	} else if (healthState === "Carried" || healthState === "Hooked" || healthState === "Dead") {
		trackToPlay = undefined;
	} else if (healthState === "Injured") {
		if (speed > 1) {
			trackToPlay = isSprinting ? loadedInjuredRun : loadedInjuredWalk;
		} else {
			trackToPlay = loadedInjuredIdle;
		}
	} else {
		// Healthy
		if (isCrouching) {
			trackToPlay = speed > 1 ? loadedCrouchWalk : loadedCrouchIdle;
		} else if (isSprinting && speed > 1) {
			trackToPlay = loadedSprint;
		}
	}

	const allTracks = [
		loadedCrouchWalk, loadedCrouchIdle, loadedSprint,
		loadedInjuredIdle, loadedInjuredWalk, loadedInjuredRun,
		loadedDownIdle, loadedDownMove
	];

	for (const track of allTracks) {
		if (track && track !== trackToPlay && track.IsPlaying) {
			track.Stop(0.2);
		}
	}

	if (trackToPlay && !trackToPlay.IsPlaying) {
		trackToPlay.Play(0.2);
	}
}

function setupBarayaAnimations(character: Model) {
	const humanoid = character.WaitForChild("Humanoid") as Humanoid;
	let animator   = humanoid.WaitForChild("Animator", 5) as Animator | undefined;

	if (!animator) {
		animator        = new Instance("Animator");
		animator.Parent = humanoid;
	}

	loadedSprint     = animator.LoadAnimation(sprintAnim);
	loadedSprint.Priority = Enum.AnimationPriority.Action; // Sprint overrides walk/run

	loadedCrouchIdle = animator.LoadAnimation(crouchIdleAnim);
	loadedCrouchIdle.Priority = Enum.AnimationPriority.Action;

	loadedCrouchWalk = animator.LoadAnimation(crouchWalkAnim);
	loadedCrouchWalk.Priority = Enum.AnimationPriority.Action;

	loadedInjuredIdle = animator.LoadAnimation(injuredIdleAnim);
	loadedInjuredIdle.Priority = Enum.AnimationPriority.Action;
	loadedInjuredIdle.Looped = true;

	loadedInjuredWalk = animator.LoadAnimation(injuredWalkAnim);
	loadedInjuredWalk.Priority = Enum.AnimationPriority.Action;
	loadedInjuredWalk.Looped = true;

	loadedInjuredRun = animator.LoadAnimation(injuredRunAnim);
	loadedInjuredRun.Priority = Enum.AnimationPriority.Action;
	loadedInjuredRun.Looped = true;

	loadedDownIdle = animator.LoadAnimation(downIdleAnim);
	loadedDownIdle.Priority = Enum.AnimationPriority.Action;
	loadedDownIdle.Looped = true;

	loadedDownMove = animator.LoadAnimation(downMoveAnim);
	loadedDownMove.Priority = Enum.AnimationPriority.Action;
	loadedDownMove.Looped = true;

	loadedGenerator = animator.LoadAnimation(generatorAnim);
	loadedGenerator.Priority = Enum.AnimationPriority.Action;
	loadedGenerator.Looped = true;

	loadedBarayaCarryStart = animator.LoadAnimation(barayaCarryStartAnim);
	loadedBarayaCarryStart.Priority = Enum.AnimationPriority.Action;

	loadedBarayaCarryIdle = animator.LoadAnimation(barayaCarryIdleAnim);
	loadedBarayaCarryIdle.Priority = Enum.AnimationPriority.Action;
	loadedBarayaCarryIdle.Looped = true;

	humanoid.Running.Connect((speed) => {
		updateBarayaMovement(speed);
	});
}

function PlayBarayaAction(actionName: "Generator") {
	if (actionName === "Generator") {
		if (loadedGenerator && !loadedGenerator.IsPlaying) loadedGenerator.Play();
	}
}

function StopBarayaAction(actionName: "Generator") {
	if (actionName === "Generator") {
		if (loadedGenerator && loadedGenerator.IsPlaying) loadedGenerator.Stop();
	}
}

// ---------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------
function UpdateAnimations() {
	const char = player.Character;
	if (!char) return;
	const team = player.Team ? player.Team.Name : "Arwah";

	if (team === "Jurig") {
		LoadJurigAnimations(char);
	} else if (team === "Baraya") {
		setupBarayaAnimations(char);
	}
}

player.CharacterAdded.Connect((char) => {
	task.wait(1);
	UpdateAnimations();

	if (player.Team?.Name === "Jurig") {
		const checkToolAndPlay = () => {
			if (char.FindFirstChildWhichIsA("Tool")) {
				if (weaponHoldTrack && !weaponHoldTrack.IsPlaying) weaponHoldTrack.Play(0.2);
			} else {
				if (weaponHoldTrack && weaponHoldTrack.IsPlaying) weaponHoldTrack.Stop(0.2);
			}
		};

		char.ChildAdded.Connect((child) => {
			if (child.IsA("Tool")) checkToolAndPlay();
		});

		char.ChildRemoved.Connect((child) => {
			if (child.IsA("Tool")) checkToolAndPlay();
		});

		checkToolAndPlay();
	}
});

player.GetPropertyChangedSignal("Team").Connect(UpdateAnimations);

player.GetAttributeChangedSignal("EquippedJurig").Connect(() => {
	const char = player.Character;
	if (char && player.Team?.Name === "Jurig") {
		print("[AnimationController] EquippedJurig berubah — reload animasi Jurig.");
		LoadJurigAnimations(char);
	}
});

player.GetAttributeChangedSignal("IsCarrying").Connect(() => {
	if (player.Team?.Name === "Jurig") {
		const isCarrying = player.GetAttribute("IsCarrying") as boolean;
		const startTrack = loadedJurigAnimations.get("CarryStart");
		const idleTrack = loadedJurigAnimations.get("CarryIdle");

		if (isCarrying) {
			if (startTrack && idleTrack) {
				startTrack.Play(0);
				startTrack.Stopped.Once(() => {
					if (player.GetAttribute("IsCarrying")) {
						idleTrack.Play(0);
					}
				});
			}
		} else {
			if (startTrack?.IsPlaying) startTrack.Stop();
			if (idleTrack?.IsPlaying) idleTrack.Stop();
		}
	}
});

if (player.Character) UpdateAnimations();

// ---------------------------------------------------------
// RESPONS ATRIBUT (Baraya)
// ---------------------------------------------------------
function forceMovementUpdate() {
	if (player.Team?.Name === "Baraya") {
		const rootPart = player.Character?.FindFirstChild("HumanoidRootPart") as Part | undefined;
		if (rootPart) {
			const speed = rootPart.AssemblyLinearVelocity.Magnitude;
			updateBarayaMovement(speed);
		}
	}
}

player.GetAttributeChangedSignal("IsSprinting").Connect(forceMovementUpdate);
player.GetAttributeChangedSignal("IsCrouching").Connect(forceMovementUpdate);
player.GetAttributeChangedSignal("HealthState").Connect(() => {
	forceMovementUpdate();

	if (player.Team?.Name === "Baraya") {
		const state = player.GetAttribute("HealthState") as string;
		if (state === "Carried") {
			if (loadedBarayaCarryStart && loadedBarayaCarryIdle) {
				loadedBarayaCarryStart.Play(0);
				loadedBarayaCarryStart.Stopped.Once(() => {
					if (player.GetAttribute("HealthState") === "Carried") {
						loadedBarayaCarryIdle!.Play(0);
					}
				});
			}
		} else {
			if (loadedBarayaCarryStart?.IsPlaying) loadedBarayaCarryStart.Stop();
			if (loadedBarayaCarryIdle?.IsPlaying) loadedBarayaCarryIdle.Stop();
		}
	}
});

player.GetAttributeChangedSignal("IsRepairing").Connect(() => {
	const isRepairing = player.GetAttribute("IsRepairing") as boolean;
	if (isRepairing) {
		PlayBarayaAction("Generator");
	} else {
		StopBarayaAction("Generator");
	}
});

// ---------------------------------------------------------
// SUARA LANGKAH JONGKOK (Baraya) — Hilangkan saat jongkok/down
// ---------------------------------------------------------
RunService.RenderStepped.Connect(() => {
	const char = player.Character;
	if (char && player.Team?.Name === "Baraya") {
		const rootPart = char.FindFirstChild("HumanoidRootPart") as Part | undefined;
		if (rootPart) {
			const runningSound = rootPart.FindFirstChild("Running") as Sound | undefined;
			if (runningSound) {
				const healthState = player.GetAttribute("HealthState") as string | undefined;
				if (player.GetAttribute("IsCrouching") || healthState === "Knock") {
					runningSound.Volume = 0;
				} else {
					const currentSpeed = rootPart.AssemblyLinearVelocity.Magnitude;
					if (currentSpeed > 0.5 && runningSound.Volume === 0) {
						runningSound.Volume = (currentSpeed / 16) * 0.65;
					}
				}
			}
		}
	}
});