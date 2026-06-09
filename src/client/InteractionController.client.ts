import { ContextActionService, ReplicatedStorage, Players, RunService, Workspace } from "@rbxts/services";

const player = Players.LocalPlayer;

const Shared        = ReplicatedStorage.WaitForChild("TS") as Folder;
const Events        = Shared.WaitForChild("Events") as Folder;
const RequestAction = Events.WaitForChild("RequestAction") as RemoteEvent;

const REPAIR_RANGE    = 8;
const PALLET_RANGE    = 6;
const VAULT_RANGE     = 4;
const INTERACT_RANGE  = 7;

let currentDynamicAction: string | undefined = undefined;

// ---------------------------------------------------------
// DYNAMIC ACTION HANDLER
// ---------------------------------------------------------
function handleDynamicAction(actionName: string, inputState: Enum.UserInputState, inputObject: InputObject) {
	if (inputState === Enum.UserInputState.Begin) {
		if (currentDynamicAction) RequestAction.FireServer(currentDynamicAction);
	} else if (inputState === Enum.UserInputState.End) {
		if (currentDynamicAction === "StartRepair") RequestAction.FireServer("StopRepair");
	}
}

// ---------------------------------------------------------
// BINDINGS
// ---------------------------------------------------------
function SetupInteraction() {
	const teamName = player.Team ? player.Team.Name : "Arwah";
	ContextActionService.UnbindAction("DynamicAction");

	if (teamName === "Jurig") {
		ContextActionService.BindAction("DynamicAction", handleDynamicAction, true, Enum.KeyCode.F);
		ContextActionService.SetTitle("DynamicAction", "Aksi");
		ContextActionService.SetPosition("DynamicAction", new UDim2(0.8, -10, 0.65, 0));
	} else if (teamName === "Baraya") {
		ContextActionService.BindAction("DynamicAction", handleDynamicAction, true,
			Enum.KeyCode.E, Enum.KeyCode.F, Enum.KeyCode.Space, Enum.KeyCode.Q);
		ContextActionService.SetTitle("DynamicAction", "Aksi");
		ContextActionService.SetPosition("DynamicAction", new UDim2(0.8, -10, 0.65, 0));
	}
}

player.GetPropertyChangedSignal("Team").Connect(SetupInteraction);
player.CharacterAdded.Connect(() => {
	SetupInteraction();
});
SetupInteraction();

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
	let minDistance  = math.huge;

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
