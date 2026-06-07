import { ContextActionService, ReplicatedStorage, Players, RunService, Workspace, Debris } from "@rbxts/services";

const player = Players.LocalPlayer;

const Shared = ReplicatedStorage.WaitForChild("TS") as Folder;
const Events = Shared.WaitForChild("Events") as Folder;
const RequestAction = Events.WaitForChild("RequestAction") as RemoteEvent;
const NotifyClient = Events.WaitForChild("NotifyClient") as RemoteEvent; // Server → Client untuk suara

const ATTACK_COOLDOWN = 1.0;
const CHARGE_TIME     = 0.5;  // Minimal tahan untuk ChargedHit
const MAX_CHARGE_TIME = 2.0;  // Batas maksimal charge — otomatis release
const REPAIR_RANGE    = 8;
const PALLET_RANGE    = 6;
const VAULT_RANGE     = 4;
const INTERACT_RANGE  = 7;

// Speed
const BASE_SPEED             = 16;
const CHARGE_SPEED           = 20;
const HIT_SLOW_SPEED         = 8;
const HIT_SLOW_DURATION      = 0.6;
const CHARGED_SLOW_SPEED     = 4;
const CHARGED_SLOW_DURATION  = 1.0;

let isAttacking  = false;
let isCharging   = false;
let chargeStartTime = 0;
let currentDynamicAction: string | undefined = undefined;

type ChargeAnimState = "none" | "charging" | "charged";
let currentChargeAnimState: ChargeAnimState = "none";

// ---------------------------------------------------------
// SUARA — diputar di Client berdasarkan event dari Server
// ---------------------------------------------------------
const SOUND_MISS  = "rbxassetid://104385197343883";
const SOUND_WALL  = "rbxassetid://107536030334203";
const SOUND_FLESH = "rbxassetid://71282231814253";

function PlayLocalSound(soundId: string) {
	const rootPart = player.Character?.FindFirstChild("HumanoidRootPart") as Part | undefined;
	if (!rootPart) return;
	const sound = new Instance("Sound");
	sound.SoundId = soundId;
	sound.Volume = 1;
	sound.RollOffMaxDistance = 60;
	sound.Parent = rootPart;
	sound.Play();
	Debris.AddItem(sound, 3);
}

// Server memberitahu client suara apa yang harus dimainkan
// Payload: "HitFlesh" | "HitWall" | "Miss"
NotifyClient.OnClientEvent.Connect((eventType: unknown) => {
	if (eventType === "HitFlesh") {
		PlayLocalSound(SOUND_FLESH);
	} else if (eventType === "HitWall") {
		PlayLocalSound(SOUND_WALL);
	} else if (eventType === "Miss") {
		PlayLocalSound(SOUND_MISS);
	}
});

// ---------------------------------------------------------
// ANIMASI JURIG
// ---------------------------------------------------------
const jurigAnimationIds = {
	Hit1:       "rbxassetid://96515999112317",
	Hit2:       "rbxassetid://75059937670248",
	Charging:   "rbxassetid://127990702652676",
	Charged:    "rbxassetid://121600231814274",
	ChargedHit: "rbxassetid://99365271989430",
};

let loadedAnims = new Map<string, AnimationTrack>();
let hitCount    = 0;
let lastHitTime = 0;

function LoadJurigAnimations() {
	const char = player.Character;
	if (!char) return;
	const humanoid = char.FindFirstChild("Humanoid") as Humanoid | undefined;
	const animator = humanoid?.FindFirstChild("Animator") as Animator | undefined;
	if (!animator) return;

	loadedAnims.clear();
	for (const [name, id] of pairs(jurigAnimationIds)) {
		const anim = new Instance("Animation");
		anim.AnimationId = id;
		const track = animator.LoadAnimation(anim);
		track.Priority = Enum.AnimationPriority.Action;
		if (name === "Charged") track.Looped = true;
		loadedAnims.set(name, track);
	}
	print("[AnimController] Semua animasi Jurig dimuat.");
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
// VISUAL HITBOX
// ---------------------------------------------------------
function CreateHitboxVisual(dmgPoint: Attachment) {
	const beam = new Instance("Part");
	beam.Size = new Vector3(0.2, 0.2, 3);
	beam.Color = Color3.fromRGB(255, 0, 0);
	beam.Material = Enum.Material.Neon;
	beam.Anchored = true;
	beam.CanCollide = false;
	beam.CFrame = dmgPoint.WorldCFrame;
	beam.Parent = Workspace;
	Debris.AddItem(beam, 0.2);
}

// ---------------------------------------------------------
// EKSEKUSI SERANGAN
// ---------------------------------------------------------
function executeAttack(chargeDuration: number) {
	if (isAttacking) return;
	if (player.Team?.Name !== "Jurig") return;

	isAttacking = true;
	isCharging  = false;
	currentChargeAnimState = "none";

	const char = player.Character;
	const dmgPoint = char?.FindFirstChild("DmgPoint", true) as Attachment | undefined;
	if (dmgPoint) CreateHitboxVisual(dmgPoint);

	const isCharged = chargeDuration >= CHARGE_TIME;

	if (isCharged) {
		PlayAnim("ChargedHit", 0.05);
		RequestAction.FireServer("ChargedHit");
		ApplySlowAfterHit(CHARGED_SLOW_SPEED, CHARGED_SLOW_DURATION);
		print(`[Attack] ChargedHit | Tahan: ${string.format("%.2f", chargeDuration)}s`);
	} else {
		const now = os.clock();
		if (now - lastHitTime > 2) hitCount = 0;
		hitCount = hitCount === 1 ? 2 : 1;
		lastHitTime = now;
		const animName = hitCount === 1 ? "Hit1" : "Hit2";
		PlayAnim(animName, 0.05);
		RequestAction.FireServer("Hit");
		ApplySlowAfterHit(HIT_SLOW_SPEED, HIT_SLOW_DURATION);
		print(`[Attack] Hit (${animName}) | Tahan: ${string.format("%.2f", chargeDuration)}s`);
	}

	// Suara Miss dimainkan dulu — server akan override ke HitFlesh/HitWall
	// jika hitbox benar-benar kena sesuatu (via NotifyClient)
	PlayLocalSound(SOUND_MISS);

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
		isCharging = true;
		chargeStartTime = os.clock();
		currentChargeAnimState = "none";

	} else if (inputState === Enum.UserInputState.End) {
		if (!isCharging) return;
		isCharging = false;
		currentChargeAnimState = "none";
		StopAllAnims(0.05);
		executeAttack(os.clock() - chargeStartTime);

	} else if (inputState === Enum.UserInputState.Cancel) {
		if (!isCharging) return;
		isCharging = false;
		currentChargeAnimState = "none";
		StopAllAnims(0.1);
		SetJurigSpeed(BASE_SPEED);
	}
}

// ---------------------------------------------------------
// HEARTBEAT: Transisi animasi + auto-release saat MAX_CHARGE_TIME
// ---------------------------------------------------------
RunService.Heartbeat.Connect((_dt) => {
	if (!isCharging || isAttacking) return;
	if (player.Team?.Name !== "Jurig") return;

	const elapsed = os.clock() - chargeStartTime;

	// AUTO-RELEASE: Charge terlalu lama → eksekusi otomatis
	if (elapsed >= MAX_CHARGE_TIME) {
		print(`[Attack] Auto-release ChargedHit setelah ${string.format("%.2f", elapsed)}s`);
		StopAllAnims(0.05);
		executeAttack(elapsed);
		return;
	}

	// Transisi animasi — hanya update jika state berubah
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
// AKSI LAIN
// ---------------------------------------------------------
function handleSprint(actionName: string, inputState: Enum.UserInputState, inputObject: InputObject) {
	if (inputState !== Enum.UserInputState.Begin) return;
	if (player.Team?.Name !== "Baraya") return;
	const isSprinting = (player.GetAttribute("IsSprinting") as boolean) || false;
	RequestAction.FireServer(isSprinting ? "StopSprint" : "StartSprint");
}

function handleCrouch(actionName: string, inputState: Enum.UserInputState, inputObject: InputObject) {
	if (inputState !== Enum.UserInputState.Begin) return;
	if (player.Team?.Name !== "Baraya") return;
	const isCrouching = (player.GetAttribute("IsCrouching") as boolean) || false;
	RequestAction.FireServer(isCrouching ? "StopCrouch" : "StartCrouch");
}

function handleDynamicAction(actionName: string, inputState: Enum.UserInputState, inputObject: InputObject) {
	if (inputState === Enum.UserInputState.Begin) {
		if (currentDynamicAction) RequestAction.FireServer(currentDynamicAction);
	} else if (inputState === Enum.UserInputState.End) {
		if (currentDynamicAction === "StartRepair") RequestAction.FireServer("StopRepair");
	}
}

// ---------------------------------------------------------
// SETUP TOMBOL
// ---------------------------------------------------------
function SetupMobileButtons() {
	const teamName = player.Team ? player.Team.Name : "Arwah";

	ContextActionService.UnbindAction("HitAction");
	ContextActionService.UnbindAction("SprintAction");
	ContextActionService.UnbindAction("CrouchAction");
	ContextActionService.UnbindAction("DynamicAction");

	if (teamName === "Jurig") {
		ContextActionService.BindAction("HitAction", handleHit, true,
			Enum.UserInputType.MouseButton1, Enum.KeyCode.ButtonR2);
		ContextActionService.SetTitle("HitAction", "Pukul");
		ContextActionService.SetPosition("HitAction", new UDim2(0.2, 0, 0.65, 0));

		ContextActionService.BindAction("DynamicAction", handleDynamicAction, true, Enum.KeyCode.F);
		ContextActionService.SetTitle("DynamicAction", "Aksi");
		ContextActionService.SetPosition("DynamicAction", new UDim2(0.8, -10, 0.65, 0));

	} else if (teamName === "Baraya") {
		ContextActionService.BindAction("SprintAction", handleSprint, true, Enum.KeyCode.LeftShift);
		ContextActionService.SetTitle("SprintAction", "Lari");
		ContextActionService.SetPosition("SprintAction", new UDim2(0.2, 0, 0.65, 0));

		ContextActionService.BindAction("CrouchAction", handleCrouch, true,
			Enum.KeyCode.C, Enum.KeyCode.LeftControl);
		ContextActionService.SetTitle("CrouchAction", "Jongkok");
		ContextActionService.SetPosition("CrouchAction", new UDim2(0.2, 0, 0.85, 0));

		ContextActionService.BindAction("DynamicAction", handleDynamicAction, true,
			Enum.KeyCode.E, Enum.KeyCode.F, Enum.KeyCode.Space, Enum.KeyCode.Q);
		ContextActionService.SetTitle("DynamicAction", "Aksi");
		ContextActionService.SetPosition("DynamicAction", new UDim2(0.8, -10, 0.65, 0));
	}
}

player.GetPropertyChangedSignal("Team").Connect(SetupMobileButtons);
player.CharacterAdded.Connect(() => {
	task.wait(1);
	if (player.Team?.Name === "Jurig") LoadJurigAnimations();
	SetupMobileButtons();
});
SetupMobileButtons();

// ---------------------------------------------------------
// RADAR PENDETEKSI OBJEK
// ---------------------------------------------------------
function ScanForInteractables() {
	const teamName = player.Team ? player.Team.Name : "Arwah";
	if (teamName === "Arwah") return;

	const char = player.Character;
	if (!char) return;
	const rootPart = char.FindFirstChild("HumanoidRootPart") as Part | undefined;
	if (!rootPart) return;

	const myPos = rootPart.Position;
	let closestAction: string | undefined = undefined;
	let closestTitle = "Aksi";
	let minDistance = math.huge;

	if (teamName === "Baraya") {
		for (const item of Workspace.GetDescendants()) {
			if (item.Name === "Generator" && item.IsA("BasePart")) {
				const dist = myPos.sub(item.Position).Magnitude;
				if (dist <= REPAIR_RANGE && dist < minDistance) {
					const prog = (item.GetAttribute("Progress") as number) || 0;
					if (prog < 100) {
						minDistance = dist; closestAction = "StartRepair"; closestTitle = "Perbaiki";
					}
				}
			} else if (item.Name === "Pallet" && item.IsA("BasePart")) {
				const dist = myPos.sub(item.Position).Magnitude;
				if (dist <= PALLET_RANGE && dist < minDistance) {
					if (!item.GetAttribute("IsDropped")) {
						minDistance = dist; closestAction = "DropPallet"; closestTitle = "Pallet";
					}
				}
			} else if (item.Name === "Window" && item.IsA("BasePart")) {
				const dist = myPos.sub(item.Position).Magnitude;
				if (dist <= VAULT_RANGE && dist < minDistance) {
					minDistance = dist; closestAction = "Vault"; closestTitle = "Lompat";
				}
			}
		}
		for (const targetPlayer of Players.GetPlayers()) {
			if (targetPlayer !== player && targetPlayer.Team?.Name === "Baraya") {
				const tRoot = targetPlayer.Character?.FindFirstChild("HumanoidRootPart") as Part | undefined;
				if (tRoot) {
					const dist = myPos.sub(tRoot.Position).Magnitude;
					if (dist <= INTERACT_RANGE && dist < minDistance) {
						if (targetPlayer.GetAttribute("HealthState") === "Hooked") {
							minDistance = dist; closestAction = "Carry"; closestTitle = "Tolong";
						}
					}
				}
			}
		}

	} else if (teamName === "Jurig") {
		for (const item of Workspace.GetDescendants()) {
			if (item.Name === "Window" && item.IsA("BasePart")) {
				const dist = myPos.sub(item.Position).Magnitude;
				if (dist <= VAULT_RANGE && dist < minDistance) {
					minDistance = dist; closestAction = "Vault"; closestTitle = "Lompat";
				}
			} else if (item.Name === "TumbalHook" && item.IsA("BasePart")) {
				if (char.FindFirstChild("CarryWeld")) {
					const dist = myPos.sub(item.Position).Magnitude;
					if (dist <= INTERACT_RANGE && dist < minDistance) {
						minDistance = dist; closestAction = "Carry"; closestTitle = "Gantung";
					}
				}
			}
		}
		if (!char.FindFirstChild("CarryWeld")) {
			for (const targetPlayer of Players.GetPlayers()) {
				if (targetPlayer.Team?.Name === "Baraya") {
					const tRoot = targetPlayer.Character?.FindFirstChild("HumanoidRootPart") as Part | undefined;
					if (tRoot) {
						const dist = myPos.sub(tRoot.Position).Magnitude;
						if (dist <= INTERACT_RANGE && dist < minDistance) {
							if (targetPlayer.GetAttribute("HealthState") === "Knock") {
								minDistance = dist; closestAction = "Carry"; closestTitle = "Gendong";
							}
						}
					}
				}
			}
		}
	}

	currentDynamicAction = closestAction;
	pcall(() => { ContextActionService.SetTitle("DynamicAction", closestTitle); });
}

let scanTimer = 0;
RunService.Heartbeat.Connect((deltaTime) => {
	scanTimer += deltaTime;
	if (scanTimer >= 0.1) { scanTimer = 0; ScanForInteractables(); }
});