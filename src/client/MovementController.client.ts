import { ContextActionService, ReplicatedStorage, Players } from "@rbxts/services";

const player = Players.LocalPlayer;

const Shared        = ReplicatedStorage.WaitForChild("TS") as Folder;
const Events        = Shared.WaitForChild("Events") as Folder;
const RequestAction = Events.WaitForChild("RequestAction") as RemoteEvent;

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

function SetupMovement() {
	const teamName = player.Team ? player.Team.Name : "Arwah";
	
	ContextActionService.UnbindAction("SprintAction");
	ContextActionService.UnbindAction("CrouchAction");

	if (teamName === "Baraya") {
		ContextActionService.BindAction("SprintAction", handleSprint, true, Enum.KeyCode.LeftShift);
		ContextActionService.SetTitle("SprintAction", "Lari");
		ContextActionService.SetPosition("SprintAction", new UDim2(0.2, 0, 0.65, 0));

		ContextActionService.BindAction("CrouchAction", handleCrouch, true,
			Enum.KeyCode.C, Enum.KeyCode.LeftControl);
		ContextActionService.SetTitle("CrouchAction", "Jongkok");
		ContextActionService.SetPosition("CrouchAction", new UDim2(0.2, 0, 0.85, 0));
	}
}

player.GetPropertyChangedSignal("Team").Connect(SetupMovement);
player.CharacterAdded.Connect(() => {
	SetupMovement();
});
SetupMovement();
