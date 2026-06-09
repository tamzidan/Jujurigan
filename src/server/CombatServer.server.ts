import { ReplicatedStorage, Players, Workspace } from "@rbxts/services";
import { StateManager } from "../shared/Modules/StateManager";

const Shared        = ReplicatedStorage.WaitForChild("TS") as Folder;
const Events        = Shared.WaitForChild("Events") as Folder;
const RequestAction = Events.WaitForChild("RequestAction") as RemoteEvent;

let NotifyClient = Events.FindFirstChild("NotifyClient") as RemoteEvent | undefined;
if (!NotifyClient) {
	NotifyClient = new Instance("RemoteEvent");
	NotifyClient.Name = "NotifyClient";
	NotifyClient.Parent = Events;
}
const Notify = NotifyClient as RemoteEvent;

const INTERACT_RANGE = 7;
const MAX_VALID_HIT_DISTANCE = 10; // Toleransi lag compensation (studs)

// Anti-spam / deduplication server-side
const lastHitTimes = new Map<Player, Map<Player, number>>();

Players.PlayerRemoving.Connect((player) => {
	lastHitTimes.delete(player);
});

// ---------------------------------------------------------
// HANDLER AKSI SERVER
// ---------------------------------------------------------
RequestAction.OnServerEvent.Connect((player: Player, action: unknown, ...args: unknown[]) => {
	const char = player.Character;
	if (!char) return;
	const rootPart = char.FindFirstChild("HumanoidRootPart") as Part | undefined;
	if (!rootPart) return;

	const myPos = rootPart.Position;

	// ---------------------------------------------------------
	// TIM JURIG
	// ---------------------------------------------------------
	if (player.Team?.Name === "Jurig") {

		if (action === "ValidateHit") {
			const targetPlayer = args[0] as Player;
			const attackType   = args[1] as "Hit" | "ChargedHit";

			if (!targetPlayer || targetPlayer.Team?.Name !== "Baraya") return;
			const targetRoot = targetPlayer.Character?.FindFirstChild("HumanoidRootPart") as Part | undefined;
			if (!targetRoot) return;

			// 1. Validasi Jarak (Lag Compensation Sanity Check)
			const distance = myPos.sub(targetRoot.Position).Magnitude;
			if (distance > MAX_VALID_HIT_DISTANCE) {
				warn(`[Anti-Cheat] Pukulan ${player.Name} ke ${targetPlayer.Name} dibatalkan! Jarak tidak wajar: ${distance}`);
				return;
			}

			// 2. Validasi Anti-Spam / Deduplikasi (Hanya boleh dipukul tiap 0.8 detik)
			let attackerHitMap = lastHitTimes.get(player);
			if (!attackerHitMap) {
				attackerHitMap = new Map<Player, number>();
				lastHitTimes.set(player, attackerHitMap);
			}
			const lastHit = attackerHitMap.get(targetPlayer) || 0;
			if (os.clock() - lastHit < 0.8) {
				return; // Terlalu cepat (mungkin spam dari client atau deduplikasi Hitbox PartMode)
			}
			attackerHitMap.set(targetPlayer, os.clock());

			// 3. Terapkan Damage
			const currentState = StateManager.GetState(targetPlayer);

			if (attackType === "ChargedHit") {
				if (currentState === "Healthy" || currentState === "Injured") {
					StateManager.SetState(targetPlayer, "Knock");
					print(`${player.Name} ChargedHit ${targetPlayer.Name}! LANGSUNG TUMBANG!`);
				}
			} else {
				if (currentState === "Healthy") {
					StateManager.SetState(targetPlayer, "Injured");
					print(`${player.Name} menebas ${targetPlayer.Name}! (Healthy → Injured)`);
				} else if (currentState === "Injured") {
					StateManager.SetState(targetPlayer, "Knock");
					print(`${targetPlayer.Name} TUMBANG!`);
				}
			}

		} else if (action === "AttackSwing") {
			// (Opsional) Teruskan ke client lain untuk memutar suara / efek
		} else if (action === "Carry") {
			const existingWeld = char.FindFirstChild("CarryWeld") as WeldConstraint | undefined;

			if (existingWeld) {
				for (const item of Workspace.GetDescendants()) {
					if (item.Name === "TumbalHook" && item.IsA("BasePart")) {
						if (myPos.sub(item.Position).Magnitude <= INTERACT_RANGE) {
							const targetTorso  = existingWeld.Part1 as Part;
							const targetChar   = targetTorso.Parent as Model;
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
									const hookWeld     = new Instance("WeldConstraint");
									hookWeld.Name      = "HookWeld";
									hookWeld.Part0     = item;
									hookWeld.Part1     = targetTorso;
									hookWeld.Parent    = targetTorso;

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

				if (
					myPos.sub(targetRoot.Position).Magnitude <= INTERACT_RANGE &&
					StateManager.GetState(targetPlayer) === "Knock"
				) {
					print(`${player.Name} menggendong ${targetPlayer.Name}`);
					StateManager.SetState(targetPlayer, "Carried");

					targetRoot.CFrame = rootPart.CFrame
						.mul(new CFrame(0, 2, 1))
						.mul(CFrame.Angles(math.rad(-90), 0, 0));

					const weld    = new Instance("WeldConstraint");
					weld.Name     = "CarryWeld";
					weld.Part0    = rootPart;
					weld.Part1    = targetRoot;
					weld.Parent   = char;

					for (const part of targetPlayer.Character!.GetChildren()) {
						if (part.IsA("BasePart")) {
							part.Massless    = true;
							part.CanCollide  = false;
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