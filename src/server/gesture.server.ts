import { ReplicatedStorage, Players } from "@rbxts/services";

// Menelusuri folder TS -> Events
const tsFolder = ReplicatedStorage.WaitForChild("TS") as Folder;
const eventsFolder = tsFolder.WaitForChild("Events") as Folder;

// Mengambil LookSync dari dalam folder Events
const LookSync = eventsFolder.WaitForChild("LookSync") as RemoteEvent<
	(sender: Player | number, pitch: number, yaw?: number) => void
>;

// Menerima sudut Pitch & Yaw dari pemain, lalu mem-broadcast ke pemain LAIN
LookSync.OnServerEvent.Connect((player, pitch, yaw) => {
	// Pastikan data yang diterima dari client valid
	if (!typeIs(pitch, "number") || !typeIs(yaw, "number")) return;

	for (const otherPlayer of Players.GetPlayers()) {
		if (otherPlayer !== player) {
			// Broadcast data ke klien lain.
			// Di Roblox-TS, argument pertama FireClient adalah target player,
			// diikuti dengan argument yang akan diterima oleh OnClientEvent
			LookSync.FireClient(otherPlayer, player, pitch, yaw);
		}
	}
});