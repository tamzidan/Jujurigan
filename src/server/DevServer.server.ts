import { ReplicatedStorage, Players, Workspace, RunService, ServerStorage, Teams, StarterPlayer } from "@rbxts/services";
import { StateManager } from "../shared/Modules/StateManager";

const Shared = ReplicatedStorage.WaitForChild("TS") as Folder;
const Events = Shared.WaitForChild("Events") as Folder;
const DevAction = Events.WaitForChild("DevAction") as RemoteEvent;

// GANTI DENGAN USER ID ROBLOX ANDA
const ADMIN_USER_IDS = [123456789]; 

function IsAdmin(player: Player): boolean {
	if (RunService.IsStudio()) return true;
	return ADMIN_USER_IDS.includes(player.UserId);
}

DevAction.OnServerEvent.Connect((player, action) => {
	if (!IsAdmin(player)) {
		warn(`[KEAMANAN] ${player.Name} mencoba menggunakan Dev Menu secara ilegal!`);
		return;
	}

	print(`[DEV MENU] ${player.Name} mengeksekusi: ${action}`);

	if (action === "ForceJurig") {
		// --- BYPASS: MENJADI JURIG INSTAN ---
		const jurigTeam = Teams.FindFirstChild("Jurig") as Team | undefined;
		if (jurigTeam) player.Team = jurigTeam;

		let equippedJurig = player.GetAttribute("EquippedJurig") as string;
		if (!equippedJurig || equippedJurig === "") equippedJurig = "JurigDefault";

		const jurigModels = ServerStorage.FindFirstChild("JurigModels") as Folder | undefined;
		const jurigModelPrefab = jurigModels?.FindFirstChild(equippedJurig) as Model | undefined;

		if (jurigModelPrefab) {
			const oldStarter = StarterPlayer.FindFirstChild("StarterCharacter");
			if (oldStarter) oldStarter.Destroy();

			const tempStarter = jurigModelPrefab.Clone();
			tempStarter.Name = "StarterCharacter";
			tempStarter.Parent = StarterPlayer;

			// Paksa Respawn
			player.LoadCharacter();

			tempStarter.Destroy(); // Hapus agar pemain lain yang spawn tidak ikut jadi jurig

			task.wait(1); // Tunggu physic roblox selesai load
			const char = player.Character;
			const humanoid = char?.FindFirstChild("Humanoid") as Humanoid | undefined;
			if (humanoid) {
				humanoid.WalkSpeed = 18;
				humanoid.JumpPower = 0;
			}
			print(">>> DEV: Berhasil Force Morph ke Jurig!");
		} else {
			warn(`Model Jurig ${equippedJurig} tidak ditemukan di ServerStorage/JurigModels!`);
		}

	} else if (action === "ForceBaraya") {
		// --- BYPASS: MENJADI BARAYA INSTAN ---
		const barayaTeam = Teams.FindFirstChild("Baraya") as Team | undefined;
		if (barayaTeam) player.Team = barayaTeam;

		// Hapus StarterCharacter sisa Jurig jika ada
		const oldStarter = StarterPlayer.FindFirstChild("StarterCharacter");
		if (oldStarter) oldStarter.Destroy();

		// Paksa Respawn menjadi avatar asli pemain
		player.LoadCharacter();

		task.wait(1);
		StateManager.SetState(player, "Healthy");
		print(">>> DEV: Berhasil Force Morph ke Baraya!");

	} else if (action === "ToggleCamera") {
		// --- BYPASS: MENGAKTIFKAN/MEMATIKAN FREE CAM ---
		const isFree = (player.GetAttribute("DevFreeCam") as boolean) || false;
		player.SetAttribute("DevFreeCam", !isFree);
		print(`>>> DEV: Free Camera ${!isFree ? "Diaktifkan" : "Dimatikan"}`);

	} else if (action === "AddMoney") {
		const leaderstats = player.FindFirstChild("leaderstats");
		if (leaderstats) {
			const uang = leaderstats.FindFirstChild("Uang") as IntValue | undefined;
			if (uang) uang.Value += 10000;
		}

	} else if (action === "SpawnDummy") {
		const dummyPrefab = ServerStorage.FindFirstChild("Dummy") as Model | undefined;
		const char = player.Character;
		const root = char?.FindFirstChild("HumanoidRootPart") as Part | undefined;

		if (dummyPrefab && root) {
			const newDummy = dummyPrefab.Clone();
			newDummy.SetAttribute("HealthState", "Healthy");
			newDummy.PivotTo(root.CFrame.mul(new CFrame(0, 0, -5)));
			newDummy.Parent = Workspace;
		} else {
			warn("Model 'Dummy' tidak ditemukan di ServerStorage, atau karakter belum spawn.");
		}

	} else if (action === "SetInjured") {
		StateManager.SetState(player, "Injured");
		
	} else if (action === "SetKnock") {
		StateManager.SetState(player, "Knock");
	}
});