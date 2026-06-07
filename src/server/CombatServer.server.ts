import { ReplicatedStorage, Players, Workspace, Debris } from "@rbxts/services";
import { StateManager } from "../shared/Modules/StateManager";
import RaycastHitbox from "@rbxts/raycast-hitbox";

const Shared = ReplicatedStorage.WaitForChild("TS") as Folder;
const Events = Shared.WaitForChild("Events") as Folder;
const RequestAction = Events.WaitForChild("RequestAction") as RemoteEvent;

let NotifyClient = Events.FindFirstChild("NotifyClient") as RemoteEvent | undefined;
if (!NotifyClient) {
	NotifyClient = new Instance("RemoteEvent");
	NotifyClient.Name = "NotifyClient";
	NotifyClient.Parent = Events;
}
const Notify = NotifyClient as RemoteEvent;

const INTERACT_RANGE              = 7;
const HIT_ACTIVE_DURATION         = 0.6;
const CHARGED_HIT_ACTIVE_DURATION = 0.9;

interface ActiveHitbox {
	HitStart(): void;
	HitStop(): void;
	Visualizer: boolean;
	OnHit: RBXScriptSignal;
	RaycastParams: RaycastParams;
}

const jurigHitboxes = new Map<Player, ActiveHitbox>();

// ---------------------------------------------------------
// SETUP HITBOX
// ---------------------------------------------------------
function setupHitbox(jurigPlayer: Player, character: Model) {
	const tool = character.FindFirstChildWhichIsA("Tool") as Tool | undefined;
	const attachPart = tool
		? (tool.FindFirstChildWhichIsA("BasePart") as BasePart | undefined)
		: (character.FindFirstChild("Right Arm") as BasePart | undefined);

	if (!attachPart) {
		warn(`[Hitbox] Tidak ada senjata atau Right Arm di karakter ${jurigPlayer.Name}`);
		return;
	}

	const hitbox = new RaycastHitbox(attachPart);
	hitbox.Visualizer = true; // Ganti false saat release

	// -------------------------------------------------------
	// KUNCI: Set RaycastParams agar hitbox mendeteksi SEMUA
	// BasePart di Workspace, termasuk tembok & lingkungan.
	// Tanpa ini, banyak part dilewati begitu saja.
	// -------------------------------------------------------
	const rayParams = new RaycastParams();
	rayParams.FilterType = Enum.RaycastFilterType.Exclude;
	// Exclude hanya karakter Jurig sendiri agar tidak self-hit
	rayParams.FilterDescendantsInstances = [character];
	hitbox.RaycastParams = rayParams;

	// Satu listener OnHit untuk semua jenis hit.
	// Tipe serangan (Hit/ChargedHit) dikontrol dari luar via flag.
	hitbox.OnHit.Connect((hitPart: BasePart, humanoid?: Humanoid) => {
		const currentAttackType = currentAttackTypes.get(jurigPlayer);
		if (!currentAttackType) return;

		if (humanoid) {
			// Kena makhluk hidup
			const targetChar = humanoid.Parent;
			if (!targetChar) return;
			const targetPlayer = Players.GetPlayerFromCharacter(targetChar);
			if (!targetPlayer || targetPlayer.Team?.Name !== "Baraya") return;

			const currentState = StateManager.GetState(targetPlayer);

			if (currentAttackType === "ChargedHit") {
				// ChargedHit langsung Knock apapun statenya
				if (currentState === "Healthy" || currentState === "Injured") {
					StateManager.SetState(targetPlayer, "Knock");
					print(`${jurigPlayer.Name} ChargedHit ${targetPlayer.Name}! LANGSUNG TUMBANG!`);
					Notify.FireClient(jurigPlayer, "HitFlesh");
				}
			} else {
				// Hit biasa
				if (currentState === "Healthy") {
					StateManager.SetState(targetPlayer, "Injured");
					print(`${jurigPlayer.Name} menebas ${targetPlayer.Name}! (Healthy → Injured)`);
					Notify.FireClient(jurigPlayer, "HitFlesh");
				} else if (currentState === "Injured") {
					StateManager.SetState(targetPlayer, "Knock");
					print(`${targetPlayer.Name} TUMBANG!`);
					Notify.FireClient(jurigPlayer, "HitFlesh");
				}
			}

		} else {
			// Kena benda mati — tembok, lantai, prop, dll
			// Pastikan bukan bagian dari karakter Jurig atau Baraya
			const partParent = hitPart.Parent;
			if (!partParent) return;

			// Skip jika part adalah bagian dari karakter pemain manapun
			const isCharacterPart = Players.GetPlayers().some((p) => {
				return p.Character !== undefined && hitPart.IsDescendantOf(p.Character);
			});
			if (isCharacterPart) return;

			Notify.FireClient(jurigPlayer, "HitWall");
			print(`[Hitbox] Kena lingkungan: ${hitPart.Name}`);
		}
	});

	jurigHitboxes.set(jurigPlayer, hitbox as unknown as ActiveHitbox);
	print(`[Hitbox] Hitbox dipasang ke: ${attachPart.Name} milik ${jurigPlayer.Name}`);
}

// Track tipe serangan aktif per player agar OnHit tahu konteksnya
// tanpa perlu daftarkan listener baru setiap serangan
const currentAttackTypes = new Map<Player, "Hit" | "ChargedHit">();

Players.PlayerAdded.Connect((player) => {
	player.CharacterAdded.Connect((char) => {
		task.wait(0.5);
		if (player.Team?.Name === "Jurig") setupHitbox(player, char);

		char.ChildAdded.Connect((child) => {
			if (child.IsA("Tool") && player.Team?.Name === "Jurig") {
				task.wait(0.1);
				setupHitbox(player, char);
			}
		});
	});
});

Players.PlayerRemoving.Connect((player) => {
	jurigHitboxes.delete(player);
	currentAttackTypes.delete(player);
});

// ---------------------------------------------------------
// HANDLER AKSI SERVER
// ---------------------------------------------------------
RequestAction.OnServerEvent.Connect((player, action) => {
	const char = player.Character;
	if (!char) return;
	const rootPart = char.FindFirstChild("HumanoidRootPart") as Part | undefined;
	if (!rootPart) return;

	const myPos = rootPart.Position;

	// ---------------------------------------------------------
	// TIM JURIG
	// ---------------------------------------------------------
	if (player.Team?.Name === "Jurig") {

		if (action === "Hit" || action === "ChargedHit") {
			const hitbox = jurigHitboxes.get(player);
			if (!hitbox) return;

			const duration = action === "ChargedHit"
				? CHARGED_HIT_ACTIVE_DURATION
				: HIT_ACTIVE_DURATION;

			// Set tipe serangan sebelum HitStart agar OnHit tahu konteksnya
			currentAttackTypes.set(player, action as "Hit" | "ChargedHit");

			hitbox.HitStart();

			task.delay(duration, () => {
				hitbox.HitStop();
				// Bersihkan tipe serangan setelah hitbox selesai
				currentAttackTypes.delete(player);
			});

		} else if (action === "Carry") {
			const existingWeld = char.FindFirstChild("CarryWeld") as WeldConstraint | undefined;

			if (existingWeld) {
				for (const item of Workspace.GetDescendants()) {
					if (item.Name === "TumbalHook" && item.IsA("BasePart")) {
						if (myPos.sub(item.Position).Magnitude <= INTERACT_RANGE) {
							const targetTorso = existingWeld.Part1 as Part;
							const targetChar = targetTorso.Parent as Model;
							const targetPlayer = Players.GetPlayerFromCharacter(targetChar);

							if (targetPlayer) {
								existingWeld.Destroy();
								targetTorso.CFrame = item.CFrame
									.mul(new CFrame(0, 0, -1))
									.mul(CFrame.Angles(0, math.rad(180), 0));

								let currentHooks = (targetPlayer.GetAttribute("HookCount") as number) || 0;
								currentHooks += 1;
								targetPlayer.SetAttribute("HookCount", currentHooks);

								if (currentHooks >= 3) {
									print(`${targetPlayer.Name} MATI DITUMBALKAN!`);
									StateManager.SetState(targetPlayer, "Dead");
								} else {
									print(`${targetPlayer.Name} di-hook (Tahap ${currentHooks}/3)`);
									const hookWeld = new Instance("WeldConstraint");
									hookWeld.Name = "HookWeld";
									hookWeld.Part0 = item;
									hookWeld.Part1 = targetTorso;
									hookWeld.Parent = targetTorso;

									for (const part of targetChar.GetChildren()) {
										if (part.IsA("BasePart")) part.Massless = false;
									}
									StateManager.SetState(targetPlayer, "Hooked");
								}
							}
							break;
						}
					}
				}
				return;
			}

			for (const targetPlayer of Players.GetPlayers()) {
				if (targetPlayer.Team?.Name !== "Baraya") continue;
				const targetRoot = targetPlayer.Character
					?.FindFirstChild("HumanoidRootPart") as Part | undefined;
				if (!targetRoot) continue;

				if (myPos.sub(targetRoot.Position).Magnitude <= INTERACT_RANGE
					&& StateManager.GetState(targetPlayer) === "Knock") {
					print(`${player.Name} menggendong ${targetPlayer.Name}`);
					StateManager.SetState(targetPlayer, "Carried");

					targetRoot.CFrame = rootPart.CFrame
						.mul(new CFrame(0, 2, 1))
						.mul(CFrame.Angles(math.rad(-90), 0, 0));

					const weld = new Instance("WeldConstraint");
					weld.Name = "CarryWeld";
					weld.Part0 = rootPart;
					weld.Part1 = targetRoot;
					weld.Parent = char;

					for (const part of targetPlayer.Character!.GetChildren()) {
						if (part.IsA("BasePart")) {
							part.Massless = true;
							part.CanCollide = false;
						}
					}
					break;
				}
			}
		}

	// ---------------------------------------------------------
	// TIM BARAYA
	// ---------------------------------------------------------
	} else if (player.Team?.Name === "Baraya") {

		if (action === "Carry") {
			const myState = StateManager.GetState(player);
			if (myState !== "Healthy" && myState !== "Injured") return;

			for (const targetPlayer of Players.GetPlayers()) {
				if (targetPlayer === player) continue;
				if (targetPlayer.Team?.Name !== "Baraya") continue;
				if (StateManager.GetState(targetPlayer) !== "Hooked") continue;

				const targetRoot = targetPlayer.Character
					?.FindFirstChild("HumanoidRootPart") as Part | undefined;
				if (!targetRoot) continue;

				if (myPos.sub(targetRoot.Position).Magnitude <= INTERACT_RANGE) {
					print(`${player.Name} menyelamatkan ${targetPlayer.Name}!`);

					const hookWeld = targetRoot.FindFirstChild("HookWeld");
					if (hookWeld) hookWeld.Destroy();

					targetPlayer.Character!.PivotTo(
						targetRoot.CFrame.mul(new CFrame(0, 0, -3))
					);
					for (const part of targetPlayer.Character!.GetChildren()) {
						if (part.IsA("BasePart")) part.CanCollide = true;
					}
					StateManager.SetState(targetPlayer, "Injured");
					break;
				}
			}
		}
	}
});