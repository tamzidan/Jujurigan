import { ContextActionService, ReplicatedStorage, Players, RunService, Workspace, Debris } from "@rbxts/services";
import { GetCharacterInfo, DEFAULT_CHARACTER_KEY } from "../shared/GameData/CharacterData";
import RaycastHitbox from "@rbxts/raycast-hitbox";
import type { HitboxObject } from "@rbxts/raycast-hitbox";

const player = Players.LocalPlayer;

const Shared        = ReplicatedStorage.WaitForChild("TS") as Folder;
const Events        = Shared.WaitForChild("Events") as Folder;
const RequestAction = Events.WaitForChild("RequestAction") as RemoteEvent;
const NotifyClient  = Events.WaitForChild("NotifyClient") as RemoteEvent;

const ATTACK_COOLDOWN = 1.0;
const CHARGE_TIME     = 0.5;
const MAX_CHARGE_TIME = 2.0;

// Speed
const BASE_SPEED            = 16;
const CHARGE_SPEED          = 20;
const HIT_SLOW_SPEED        = 8;
const HIT_SLOW_DURATION     = 0.6;
const CHARGED_SLOW_SPEED    = 4;
const CHARGED_SLOW_DURATION = 1.0;

let isAttacking  = false;
let isCharging   = false;
let chargeStartTime = 0;

type ChargeAnimState = "none" | "charging" | "charged";
let currentChargeAnimState: ChargeAnimState = "none";

// Hitbox tracking
let myHitbox: HitboxObject | undefined = undefined;
let currentAttackType: "Hit" | "ChargedHit" | undefined = undefined;
const hitTargetsPerSwing = new Set<Player>();

// ---------------------------------------------------------
// HELPER: Key karakter yang sedang diequip
// ---------------------------------------------------------
function getEquippedKey(): string {
	const key = player.GetAttribute("EquippedJurig") as string | undefined;
	return key ?? DEFAULT_CHARACTER_KEY;
}

// ---------------------------------------------------------
// HELPER: Resolusi part untuk hitbox berdasarkan CharacterData
// ---------------------------------------------------------
function resolveHitboxPart(
	character: Model,
	hitboxPart: "Tool" | "RightArm",
): BasePart | undefined {
	if (hitboxPart === "Tool") {
		const tool = character.FindFirstChildWhichIsA("Tool") as Tool | undefined;
		if (tool) {
			return tool.FindFirstChildWhichIsA("BasePart") as BasePart | undefined;
		}
		warn("[Hitbox] Tidak ada Tool — fallback ke Right Arm.");
		return character.FindFirstChild("Right Arm") as BasePart | undefined;
	} else {
		return character.FindFirstChild("Right Arm") as BasePart | undefined;
	}
}

// ---------------------------------------------------------
// SETUP CLIENT HITBOX
// ---------------------------------------------------------
function setupHitbox(character: Model) {
	if (myHitbox) {
		myHitbox.Destroy();
		myHitbox = undefined;
	}

	const charKey  = getEquippedKey();
	const charInfo = GetCharacterInfo(charKey);

	const attachPart = resolveHitboxPart(character, charInfo.Combat.HitboxPart);
	if (!attachPart) {
		warn(`[Hitbox] Part tidak ditemukan untuk karakter ${charKey} mode ${charInfo.Combat.HitboxPart}`);
		return;
	}

	const hitbox = new RaycastHitbox(attachPart);
	hitbox.Visualizer = true; // Ganti false saat release
	hitbox.DetectionMode = RaycastHitbox.DetectionMode.PartMode;

	const rayParams = new RaycastParams();
	rayParams.FilterType = Enum.RaycastFilterType.Exclude;
	rayParams.FilterDescendantsInstances = [character];
	hitbox.RaycastParams = rayParams;

	hitbox.OnHit.Connect((hitPart: BasePart, _humanoid?: Humanoid) => {
		if (!currentAttackType) return;

		let current: Instance | undefined = hitPart;
		let hitHumanoid: Humanoid | undefined;
		while (current && current !== Workspace) {
			const hum = current.FindFirstChildWhichIsA("Humanoid");
			if (hum) {
				hitHumanoid = hum as Humanoid;
				break;
			}
			current = current.Parent;
		}

		if (hitHumanoid) {
			const targetChar = hitHumanoid.Parent;
			if (!targetChar) return;
			const targetPlayer = Players.GetPlayerFromCharacter(targetChar);
			if (!targetPlayer || targetPlayer.Team?.Name !== "Baraya") return;

			if (hitTargetsPerSwing.has(targetPlayer)) return;
			hitTargetsPerSwing.add(targetPlayer);

			// Optimistik visual/suara di client
			PlayLocalSound(charInfo.Sounds.HitFlesh);
			
			// Minta server validasi jarak dan apply damage
			RequestAction.FireServer("ValidateHit", targetPlayer, currentAttackType);

		} else {
			const isCharacterPart = Players.GetPlayers().some((p) => {
				return p.Character !== undefined && hitPart.IsDescendantOf(p.Character);
			});
			if (isCharacterPart) return;

			// Lingkungan (Tembok)
			PlayLocalSound(charInfo.Sounds.HitWall);
		}
	});

	myHitbox = hitbox;
	print(`[Client Hitbox] Dipasang ke: ${attachPart.Name}`);
}

// ---------------------------------------------------------
// SUARA LOKAL
// ---------------------------------------------------------
function PlayLocalSound(soundId: string) {
	const rootPart = player.Character?.FindFirstChild("HumanoidRootPart") as Part | undefined;
	if (!rootPart) return;
	const sound                  = new Instance("Sound");
	sound.SoundId                = soundId;
	sound.Volume                 = 1;
	sound.RollOffMaxDistance     = 60;
	sound.Parent                 = rootPart;
	sound.Play();
	Debris.AddItem(sound, 3);
}

// Dengarkan notifikasi dari server jika perlu
NotifyClient.OnClientEvent.Connect((eventType: unknown) => {
	const sounds = GetCharacterInfo(getEquippedKey()).Sounds;
	if (eventType === "HitFlesh") PlayLocalSound(sounds.HitFlesh);
	else if (eventType === "HitWall") PlayLocalSound(sounds.HitWall);
	else if (eventType === "Miss") PlayLocalSound(sounds.Miss);
});

// ---------------------------------------------------------
// ANIMASI JURIG
// ---------------------------------------------------------
let loadedAnims = new Map<string, AnimationTrack>();
let hitCount    = 0;
let lastHitTime = 0;

function LoadJurigAnimations() {
	const char = player.Character;
	if (!char) return;
	const humanoid = char.FindFirstChild("Humanoid") as Humanoid | undefined;
	const animator = humanoid?.FindFirstChild("Animator") as Animator | undefined;
	if (!animator) return;

	const charKey   = getEquippedKey();
	const charInfo  = GetCharacterInfo(charKey);
	const animIds   = charInfo.Animations;

	loadedAnims.clear();
	for (const [name, id] of pairs(animIds)) {
		const anim           = new Instance("Animation");
		anim.AnimationId     = id as string;
		const track          = animator.LoadAnimation(anim);
		track.Priority       = Enum.AnimationPriority.Action;
		if (name === "Charged") track.Looped = true;
		loadedAnims.set(name as string, track);
	}
	print(`[CombatController] Animasi dimuat untuk: ${charInfo.Name} (${charKey})`);
}

function StopAllAnims(fadeDuration = 0.1) {
	for (const [_, track] of loadedAnims) {
		if (track.IsPlaying) track.Stop(fadeDuration);
	}
}

function PlayAnim(name: string, fadeDuration = 0.1) {
	const track = loadedAnims.get(name);
	if (!track) return;
	for (const [n, t] of loadedAnims) {
		if (n !== name && t.IsPlaying) t.Stop(fadeDuration);
	}
	if (!track.IsPlaying) track.Play(fadeDuration);
}

// ---------------------------------------------------------
// SPEED HELPER
// ---------------------------------------------------------
let speedResetTask: thread | undefined = undefined;

function SetJurigSpeed(speed: number) {
	const humanoid = player.Character?.FindFirstChild("Humanoid") as Humanoid | undefined;
	if (humanoid) humanoid.WalkSpeed = speed;
}

function ApplySlowAfterHit(slowSpeed: number, duration: number) {
	if (speedResetTask !== undefined) {
		task.cancel(speedResetTask);
		speedResetTask = undefined;
	}
	SetJurigSpeed(slowSpeed);
	speedResetTask = task.delay(duration, () => {
		SetJurigSpeed(BASE_SPEED);
		speedResetTask = undefined;
	});
}

// ---------------------------------------------------------
// EKSEKUSI SERANGAN
// ---------------------------------------------------------
function executeAttack(chargeDuration: number) {
	if (isAttacking) return;
	if (player.Team?.Name !== "Jurig") return;

	isAttacking            = true;
	isCharging             = false;
	currentChargeAnimState = "none";

	const charKey  = getEquippedKey();
	const charInfo = GetCharacterInfo(charKey);

	const isCharged = chargeDuration >= CHARGE_TIME;
	
	const actionType = isCharged ? "ChargedHit" : "Hit";
	const duration = isCharged ? charInfo.Combat.ChargedHitDuration : charInfo.Combat.HitDuration;

	if (isCharged) {
		PlayAnim("ChargedHit", 0.05);
		ApplySlowAfterHit(CHARGED_SLOW_SPEED, CHARGED_SLOW_DURATION);
	} else {
		const now = os.clock();
		if (now - lastHitTime > 2) hitCount = 0;
		hitCount    = hitCount === 1 ? 2 : 1;
		lastHitTime = now;
		PlayAnim(hitCount === 1 ? "Hit1" : "Hit2", 0.05);
		ApplySlowAfterHit(HIT_SLOW_SPEED, HIT_SLOW_DURATION);
	}

	// Client-side hitbox logic
	if (myHitbox) {
		currentAttackType = actionType;
		hitTargetsPerSwing.clear();
		myHitbox.HitStart();

		task.delay(duration, () => {
			if (myHitbox) myHitbox.HitStop();
			currentAttackType = undefined;
			hitTargetsPerSwing.clear();
		});
	}

	// Visual/Audio for others (and validation)
	RequestAction.FireServer("AttackSwing", actionType);

	// Suara Miss optimistik
	PlayLocalSound(charInfo.Sounds.Miss);

	task.wait(ATTACK_COOLDOWN);
	isAttacking = false;
}

// ---------------------------------------------------------
// HANDLE HIT INPUT
// ---------------------------------------------------------
function handleHit(actionName: string, inputState: Enum.UserInputState, inputObject: InputObject) {
	if (player.Team?.Name !== "Jurig") return;

	if (inputState === Enum.UserInputState.Begin) {
		if (isAttacking) return;
		isCharging             = true;
		chargeStartTime        = os.clock();
		currentChargeAnimState = "none";

	} else if (inputState === Enum.UserInputState.End) {
		if (!isCharging) return;
		isCharging             = false;
		currentChargeAnimState = "none";
		StopAllAnims(0.05);
		executeAttack(os.clock() - chargeStartTime);

	} else if (inputState === Enum.UserInputState.Cancel) {
		if (!isCharging) return;
		isCharging             = false;
		currentChargeAnimState = "none";
		StopAllAnims(0.1);
		SetJurigSpeed(BASE_SPEED);
	}
}

// ---------------------------------------------------------
// HEARTBEAT
// ---------------------------------------------------------
RunService.Heartbeat.Connect((_dt) => {
	if (!isCharging || isAttacking) return;
	if (player.Team?.Name !== "Jurig") return;

	const elapsed = os.clock() - chargeStartTime;

	if (elapsed >= MAX_CHARGE_TIME) {
		StopAllAnims(0.05);
		executeAttack(elapsed);
		return;
	}

	if (elapsed < CHARGE_TIME) {
		if (currentChargeAnimState !== "charging") {
			currentChargeAnimState = "charging";
			PlayAnim("Charging", 0.08);
			SetJurigSpeed(CHARGE_SPEED);
		}
	} else {
		if (currentChargeAnimState !== "charged") {
			currentChargeAnimState = "charged";
			PlayAnim("Charged", 0.08);
			SetJurigSpeed(CHARGE_SPEED);
		}
	}
});

// ---------------------------------------------------------
// BINDINGS & LIFECYCLE
// ---------------------------------------------------------
function SetupJurigCombat() {
	ContextActionService.UnbindAction("HitAction");
	
	if (player.Team?.Name === "Jurig") {
		ContextActionService.BindAction("HitAction", handleHit, true,
			Enum.UserInputType.MouseButton1, Enum.KeyCode.ButtonR2);
		ContextActionService.SetTitle("HitAction", "Pukul");
		ContextActionService.SetPosition("HitAction", new UDim2(0.2, 0, 0.65, 0));
		
		const char = player.Character;
		if (char) {
			LoadJurigAnimations();
			setupHitbox(char);
		}
	}
}

player.GetPropertyChangedSignal("Team").Connect(SetupJurigCombat);
player.CharacterAdded.Connect((char) => {
	task.wait(1);
	if (player.Team?.Name === "Jurig") {
		LoadJurigAnimations();
		setupHitbox(char);

		char.ChildAdded.Connect((child) => {
			if (child.IsA("Tool")) {
				task.wait(0.1);
				setupHitbox(char);
			}
		});
	}
});

player.GetAttributeChangedSignal("EquippedJurig").Connect(() => {
	if (player.Team?.Name === "Jurig") {
		LoadJurigAnimations();
		const char = player.Character;
		if (char) setupHitbox(char);
	}
});

SetupJurigCombat();
