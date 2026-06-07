import { RunService, Players, ReplicatedStorage, Workspace } from "@rbxts/services";

const player = Players.LocalPlayer;
const camera = Workspace.CurrentCamera!;
// Menelusuri folder TS -> Events
const tsFolder = ReplicatedStorage.WaitForChild("TS") as Folder;
const eventsFolder = tsFolder.WaitForChild("Events") as Folder;

// Mengambil LookSync dari dalam folder Events
const LookSync = eventsFolder.WaitForChild("LookSync") as RemoteEvent<
	(sender: Player | number, pitch: number, yaw?: number) => void
>;
// Konfigurasi Batas Sudut
const TORSO_YAW_MAX = math.rad(15);
const TORSO_PITCH_MAX = math.rad(6.5);
const TORSO_PITCH_MIN = math.rad(-15);
const SMOOTH_SPEED = 4;

const TOTAL_YAW_MAX = math.rad(60);
const TOTAL_PITCH_MAX = math.rad(30);
const TOTAL_PITCH_MIN = math.rad(-20);

// ── State Management ─────────────────────────────────────────────
interface CharacterData {
	joints: Map<string, Motor6D>;
	defaults: Map<string, CFrame>;
}

const characterJoints = new Map<Model, CharacterData>();
const otherPlayersTarget = new Map<Player, { pitch: number; yaw: number }>();

let lastSync = 0;
const SYNC_RATE = 0.1;

// ── Menerima Data dari Pemain Lain ───────────────────────────────
LookSync.OnClientEvent.Connect((otherPlayer: unknown, pitch: unknown, yaw: unknown) => {
	// Pengecekan tipe aman (Type Guard)
	if (typeIs(otherPlayer, "Instance") && otherPlayer.IsA("Player") && typeIs(pitch, "number") && typeIs(yaw, "number")) {
		otherPlayersTarget.set(otherPlayer, { pitch, yaw });
	}
});

Players.PlayerRemoving.Connect((p) => {
	otherPlayersTarget.delete(p);
	if (p.Character) characterJoints.delete(p.Character);
});

// ── Fungsi Helper ────────────────────────────────────────────────
const findJoint = (char: Model, name: string): Motor6D | undefined => {
	for (const v of char.GetDescendants()) {
		if (v.IsA("Motor6D") && v.Name === name) {
			return v;
		}
	}
	return undefined;
};

const getCharacterData = (char: Model): CharacterData | undefined => {
	if (!char || !char.Parent) return undefined;
	if (characterJoints.has(char)) return characterJoints.get(char);

	const hrp = char.FindFirstChild("HumanoidRootPart") as Part | undefined;
	if (!hrp) return undefined;

	const jointNames = ["RootJoint", "Left Hip", "Right Hip", "Neck", "Left Shoulder", "Right Shoulder"];
	const joints = new Map<string, Motor6D>();
	const defaults = new Map<string, CFrame>();
	let allFound = true;

	for (const name of jointNames) {
		const j = findJoint(char, name);
		if (j) {
			joints.set(name, j);
			defaults.set(name, j.C0);
		} else {
			allFound = false;
		}
	}

	if (!allFound) return undefined;

	const data: CharacterData = { joints, defaults };
	characterJoints.set(char, data);
	return data;
};

// ── Fungsi Animasi Utama ─────────────────────────────────────────
const applyRotations = (char: Model, data: CharacterData, pitchAngle: number, yawOffset: number, lerpAlpha: number) => {
	const humanoid = char.FindFirstChild("Humanoid") as Humanoid | undefined;
	if (humanoid && humanoid.Health <= 0) return;

	// Cek Status Baraya
	const state = (char.GetAttribute("HealthState") as string) || "Normal";
	const isIncapacitated = state === "Down" || state === "Carried" || state === "Sacrificed";

	let downYOffset = 0;

	if (isIncapacitated) {
		pitchAngle = 0;
		yawOffset = 0;
		if (state === "Down") {
			downYOffset = 0.4;
		}
	}

	const torsoPitch = math.clamp(pitchAngle, TORSO_PITCH_MIN, TORSO_PITCH_MAX);
	const torsoYaw = math.clamp(yawOffset, -TORSO_YAW_MAX, TORSO_YAW_MAX);

	const headPitch = pitchAngle - torsoPitch;
	const headYaw = yawOffset - torsoYaw;

	const j = data.joints;
	const d = data.defaults;

	// [ APLIKASI KE TORSO & KAKI ]
	if (j.has("RootJoint")) {
		const targetRoot = new CFrame(0, downYOffset, 0).mul(CFrame.Angles(torsoPitch, torsoYaw, 0)).mul(d.get("RootJoint")!);
		j.get("RootJoint")!.C0 = j.get("RootJoint")!.C0.Lerp(targetRoot, lerpAlpha);
	}

	if (j.has("Left Hip")) {
		const targetLHip = CFrame.Angles(-torsoPitch, -torsoYaw, 0).mul(d.get("Left Hip")!);
		j.get("Left Hip")!.C0 = j.get("Left Hip")!.C0.Lerp(targetLHip, lerpAlpha);
	}
	
	if (j.has("Right Hip")) {
		const targetRHip = CFrame.Angles(-torsoPitch, -torsoYaw, 0).mul(d.get("Right Hip")!);
		j.get("Right Hip")!.C0 = j.get("Right Hip")!.C0.Lerp(targetRHip, lerpAlpha);
	}

	// [ APLIKASI KE KEPALA & TANGAN ]
	if (j.has("Neck")) {
		const targetNeck = CFrame.Angles(headPitch, headYaw, 0).mul(d.get("Neck")!);
		j.get("Neck")!.C0 = j.get("Neck")!.C0.Lerp(targetNeck, lerpAlpha);
	}

	const shoulderZShift = headYaw * 0.1;
	if (j.has("Left Shoulder")) {
		const targetL = new CFrame(0, 0, shoulderZShift).mul(CFrame.Angles(headPitch * 0.8, headYaw * 0.2, 0)).mul(d.get("Left Shoulder")!);
		j.get("Left Shoulder")!.C0 = j.get("Left Shoulder")!.C0.Lerp(targetL, lerpAlpha);
	}
	
	if (j.has("Right Shoulder")) {
		const targetR = new CFrame(0, 0, -shoulderZShift).mul(CFrame.Angles(headPitch * 0.8, headYaw * 0.2, 0)).mul(d.get("Right Shoulder")!);
		j.get("Right Shoulder")!.C0 = j.get("Right Shoulder")!.C0.Lerp(targetR, lerpAlpha);
	}
};

// ── Render Loop Utama ────────────────────────────────────────────
RunService.RenderStepped.Connect((deltaTime) => {
	const lerpAlpha = math.min(deltaTime * SMOOTH_SPEED, 1);
	const localChar = player.Character;

	if (localChar) {
		const hrp = localChar.FindFirstChild("HumanoidRootPart") as Part | undefined;
		if (hrp) {
			const lookVec = camera.CFrame.LookVector;
			const camFlat = new Vector3(lookVec.X, 0, lookVec.Z);
			const bodyFlat = new Vector3(hrp.CFrame.LookVector.X, 0, hrp.CFrame.LookVector.Z);

			let yawOffset = 0;
			if (camFlat.Magnitude > 0.001 && bodyFlat.Magnitude > 0.001) {
				const cross = bodyFlat.Unit.Cross(camFlat.Unit);
				const dot = math.clamp(bodyFlat.Unit.Dot(camFlat.Unit), -1, 1);
				yawOffset = math.atan2(cross.Y, dot);
				yawOffset = math.clamp(yawOffset, -TOTAL_YAW_MAX, TOTAL_YAW_MAX);
			}

			let pitchAngle = math.asin(math.clamp(lookVec.Y, -1, 1));
			pitchAngle = math.clamp(pitchAngle, TOTAL_PITCH_MIN, TOTAL_PITCH_MAX);

			const localData = getCharacterData(localChar);
			if (localData) {
				applyRotations(localChar, localData, pitchAngle, yawOffset, lerpAlpha);
			}

			if (os.clock() - lastSync >= SYNC_RATE) {
				lastSync = os.clock();
				LookSync.FireServer(pitchAngle, yawOffset);
			}
		}
	}

	// Loop pemain lain
	for (const [otherPlayer, targetData] of otherPlayersTarget) {
		const otherChar = otherPlayer.Character;
		if (otherChar) {
			const data = getCharacterData(otherChar);
			if (data) {
				applyRotations(otherChar, data, targetData.pitch, targetData.yaw, lerpAlpha);
			}
		}
	}
});